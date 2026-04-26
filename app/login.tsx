import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Modal, ImageBackground,
  StatusBar, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../src/services/supabaseClient';
import AvisoTexto from '../src/components/AvisoPrivacidad';

const BACKGROUND_IMAGE = require('../assets/images/kenworth.png');

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  border: '#334155',
  disabled: '#475569'
};

export default function Login() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);
  const [showAviso, setShowAviso] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);

  useEffect(() => {
    checkPermissionsOnStartup();
  }, []);

  const checkPermissionsOnStartup = async () => {
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (fgStatus !== 'granted' || bgStatus !== 'granted') {
      setShowDisclosure(true);
    }
  };

  const handleAcceptDisclosure = async () => {
    setShowDisclosure(false);
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus === 'granted') {
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch (e) {
      console.log('Error al pedir permisos:', e);
    }
  };

  const validarPasswordRegistro = (pass: string) => {
    if (pass.length < 8) return 'Debe tener al menos 8 caracteres.';
    if (!/[a-z]/.test(pass)) return 'Debe incluir al menos una letra minúscula.';
    if (!/[A-Z]/.test(pass)) return 'Debe incluir al menos una letra mayúscula.';
    if (!/[0-9]/.test(pass)) return 'Debe incluir al menos un número.';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'Debe incluir al menos un carácter especial (@$!%*#?&...).';
    if (/\s/.test(pass)) return 'No debe contener espacios.';
    return null;
  };

  // ─── Recuperar contraseña ──────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!usuario) {
      Alert.alert('Requerido', "Escribe tu correo en el campo 'Usuario/Email' para enviarte el enlace.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(
        usuario.trim().toLowerCase(),
        { redirectTo: 'bitacora57://reset-password' }
      );
      if (error) throw error;
      Alert.alert('Enviado', 'Revisa tu correo para restablecer tu contraseña.');
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo enviar el correo de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Login / Registro ──────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!aceptoPrivacidad) {
      Alert.alert('Aviso de Privacidad', 'Debes aceptar el aviso de privacidad para continuar.');
      return;
    }
    const correo = usuario.trim().toLowerCase();
    if (!correo || !password) {
      Alert.alert('Error', 'Faltan datos.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        // ── REGISTRO ──────────────────────────────────────────────────────────
        if (!nombre.trim()) {
          Alert.alert('Error', 'Ingresa tu nombre.');
          return;
        }
        const errorPass = validarPasswordRegistro(password);
        if (errorPass) {
          Alert.alert('Seguridad', errorPass);
          return;
        }

        // 1. Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: correo,
          password,
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error('No se pudo crear el usuario');

        // 2. Crear perfil en tabla operadores
        const { error: profileError } = await supabase.from('operadores').insert({
          auth_id: authData.user.id,
          email: correo,
          nombre: nombre.trim(),
        });
        if (profileError) throw profileError;

        Alert.alert(
          'Cuenta creada',
          'Revisa tu correo para confirmar tu cuenta y luego inicia sesión.',
          [{ text: 'OK', onPress: () => setIsRegistering(false) }]
        );

      } else {
        // ── LOGIN ─────────────────────────────────────────────────────────────
        const { data, error } = await supabase.auth.signInWithPassword({
          email: correo,
          password,
        });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            Alert.alert('Confirma tu correo', 'Revisa tu bandeja de entrada y confirma tu cuenta antes de entrar.');
          } else {
            Alert.alert('Error', 'Credenciales incorrectas.');
          }
          return;
        }
        if (data.session) {
          router.replace('/home');
        }
      }
    } catch (e: any) {
      console.error('[Login]', e);
      Alert.alert('Error', e.message ?? 'Fallo de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Sign-In ────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    if (!aceptoPrivacidad) {
      Alert.alert('Privacidad', 'Acepta los términos antes de usar Google.');
      return;
    }
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? (userInfo as any).idToken;

      if (!idToken) throw new Error('No se obtuvo el token de Google');

      // Supabase acepta el id_token de Google directamente
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;

      // Crear o actualizar perfil (upsert por auth_id)
      if (data.user) {
        const nombreGoogle = data.user.user_metadata?.full_name
          ?? data.user.user_metadata?.name
          ?? data.user.email
          ?? 'Operador';

        await supabase.from('operadores').upsert({
          auth_id:  data.user.id,
          email:    data.user.email ?? '',
          nombre:   nombreGoogle,
          foto_url: data.user.user_metadata?.avatar_url ?? null,
        }, { onConflict: 'auth_id', ignoreDuplicates: false });
      }

      router.replace('/home');
    } catch (error: any) {
      console.log('Error Google:', error);
      Alert.alert('Error', 'No se pudo iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ImageBackground source={BACKGROUND_IMAGE} style={styles.backgroundImage} resizeMode="cover">
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="truck" size={36} color={COLORS.bg} />
            </View>
            <Text style={styles.title}>Bitácora 57</Text>
            <Text style={styles.subtitle}>TRANSPORTE PROFESIONAL MX</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>{isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}</Text>

            {isRegistering && (
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="account" size={20} color={COLORS.subtext} style={styles.icon} />
                <TextInput
                  placeholder="Nombre completo"
                  placeholderTextColor={COLORS.subtext}
                  style={styles.input}
                  value={nombre}
                  onChangeText={setNombre}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="email" size={20} color={COLORS.subtext} style={styles.icon} />
              <TextInput
                placeholder="Correo electrónico"
                placeholderTextColor={COLORS.subtext}
                style={styles.input}
                value={usuario}
                onChangeText={setUsuario}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="lock" size={20} color={COLORS.subtext} style={styles.icon} />
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor={COLORS.subtext}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {!isRegistering && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 15 }}>
                <Text style={{ color: COLORS.primary, fontSize: 13 }}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.privacyRow}>
              <TouchableOpacity
                onPress={() => setAceptoPrivacidad(!aceptoPrivacidad)}
                style={[styles.checkbox, aceptoPrivacidad && styles.checkboxChecked]}
              >
                {aceptoPrivacidad && <MaterialCommunityIcons name="check" size={16} color={COLORS.bg} />}
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <Text style={styles.privacyText}>Acepto el </Text>
                <TouchableOpacity onPress={() => setShowAviso(true)}>
                  <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, (!aceptoPrivacidad || loading) && { backgroundColor: COLORS.disabled }]}
              onPress={handleAction}
              disabled={loading || !aceptoPrivacidad}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={styles.btnText}>{isRegistering ? 'REGISTRARSE' : 'ENTRAR'}</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>O continúa con</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={[styles.btnGoogle, (!aceptoPrivacidad || loading) && { opacity: 0.5 }]}
              onPress={signInWithGoogle}
              disabled={loading || !aceptoPrivacidad}
            >
              <MaterialCommunityIcons name="google" size={20} color="#EA4335" style={{ marginRight: 10 }} />
              <Text style={styles.googleText}>Continuar con Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsRegistering(!isRegistering)}>
              <Text style={styles.toggleText}>
                {isRegistering ? '¿Ya tienes cuenta? Entra aquí' : '¿Eres nuevo? Regístrate gratis'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Modal aviso de privacidad */}
      <Modal visible={showAviso} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacidad</Text>
              <TouchableOpacity onPress={() => setShowAviso(false)}>
                <MaterialCommunityIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <AvisoTexto />
            <TouchableOpacity style={styles.btnModal} onPress={() => setShowAviso(false)}>
              <Text style={styles.btnText}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal divulgación prominente Google Play */}
      <Modal visible={showDisclosure} animationType="fade" transparent={false}>
        <View style={stylesModal.mainContainer}>
          <ScrollView contentContainerStyle={stylesModal.container}>
            <View style={stylesModal.iconHeader}>
              <MaterialCommunityIcons name="map-marker-radius" size={60} color={COLORS.primary} />
            </View>
            <Text style={stylesModal.title}>PERMISO DE UBICACIÓN Y PRIVACIDAD</Text>
            <View style={stylesModal.alertBox}>
              <Text style={stylesModal.alertText}>
                Bitácora 57 recopila datos de ubicación para permitir el rastreo de sus rutas, cálculo de velocidades
                y cumplimiento de la NOM-087-SCT, incluso cuando la aplicación está cerrada o no se está utilizando
                (ubicación en segundo plano).
              </Text>
            </View>
            <Text style={stylesModal.parrafo}>
              Este acceso es vital para garantizar que sus registros ante la Guardia Nacional sean precisos y válidos
              legalmente durante las inspecciones en carretera.
            </Text>
            <Text style={stylesModal.subtitle}>¿Por qué ubicación en segundo plano?</Text>
            <Text style={stylesModal.parrafo}>
              • Registro continuo de la jornada sin interrupciones.{'\n'}
              • Generación de códigos QR verificables por la autoridad.{'\n'}
              • Seguridad logística en zonas críticas.
            </Text>
            <Text style={stylesModal.footerNote}>
              Sus datos de ubicación son privados y solo se comparten con las autoridades competentes en caso de una
              inspección oficial.
            </Text>
          </ScrollView>
          <View style={stylesModal.buttonArea}>
            <TouchableOpacity style={stylesModal.acceptButton} onPress={handleAcceptDisclosure}>
              <Text style={stylesModal.buttonTextAccept}>ACEPTAR Y CONTINUAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={stylesModal.declineButton} onPress={() => setShowDisclosure(false)}>
              <Text style={stylesModal.buttonTextDecline}>AHORA NO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center' },
  content: { padding: 25 },
  header: { alignItems: 'center', marginBottom: 25 },
  iconCircle: { width: 70, height: 70, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white' },
  subtitle: { fontSize: 11, color: COLORS.subtext, letterSpacing: 2, fontWeight: 'bold' },
  form: { backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  formTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, marginBottom: 12, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: COLORS.border },
  icon: { marginRight: 10 },
  input: { flex: 1, color: 'white' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.primary, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary },
  privacyText: { color: COLORS.subtext, fontSize: 12 },
  privacyLink: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' },
  btnPrimary: { backgroundColor: COLORS.primary, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 15 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.subtext, marginHorizontal: 10, fontSize: 12 },
  btnGoogle: { flexDirection: 'row', backgroundColor: 'white', height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 14 },
  toggleBtn: { marginTop: 15, alignItems: 'center' },
  toggleText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  btnModal: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});

const stylesModal = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#010A14' },
  container: { padding: 25, paddingTop: 60, alignItems: 'center' },
  iconHeader: { marginBottom: 20 },
  title: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18, marginBottom: 25, textAlign: 'center' },
  alertBox: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  alertText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, lineHeight: 22, textAlign: 'justify' },
  subtitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 15, alignSelf: 'flex-start', marginTop: 15, marginBottom: 8 },
  parrafo: { color: COLORS.subtext, fontSize: 13, lineHeight: 20, textAlign: 'justify', marginBottom: 12 },
  footerNote: { color: '#FFFFFF', fontSize: 12, fontStyle: 'italic', marginTop: 20, textAlign: 'center', opacity: 0.8 },
  buttonArea: { padding: 20, backgroundColor: '#010A14', borderTopWidth: 1, borderTopColor: '#1e293b' },
  acceptButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  buttonTextAccept: { color: '#010A14', fontWeight: 'bold', fontSize: 15 },
  declineButton: { padding: 10, alignItems: 'center' },
  buttonTextDecline: { color: COLORS.subtext, fontSize: 14, fontWeight: 'bold' }
});
