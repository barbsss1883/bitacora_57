import React, { useState } from 'react';
// 1. Importamos ImageBackground y StatusBar
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, ImageBackground, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { loginUsuario, registrarUsuario, loginConGoogle } from '../db/database';
import { auth } from '../src/services/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AvisoTexto } from '../src/components/AvisoPrivacidad';

// Usamos la imagen local. Asegúrate de que la ruta sea correcta.
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

GoogleSignin.configure({
  webClientId: "363075260432-v489o093cfoicld54u29be3p3p6l176a.apps.googleusercontent.com",
  offlineAccess: true
});

export default function Login() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);
  const [showAviso, setShowAviso] = useState(false);

  const handleForgotPassword = async () => {
    if (!usuario) {
      Alert.alert("Requerido", "Por favor escribe tu correo electrónico en el campo de 'Usuario/Email' para enviarte el enlace de recuperación.");
      return;
    }
    if (!usuario.includes('@')) {
      Alert.alert("Error", "Ingresa un correo válido.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, usuario);
      Alert.alert("Correo Enviado", "Revisa tu bandeja de entrada (y spam). Te enviamos un enlace para restablecer tu contraseña.");
    } catch (error: any) {
      console.log(error);
      if (error.code === 'auth/user-not-found') {
        Alert.alert("Error", "Ese correo no está registrado en Bitácora 57.");
      } else {
        Alert.alert("Error", "No se pudo enviar el correo. Intenta más tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!aceptoPrivacidad) {
      Alert.alert("Aviso de Privacidad", "Debes aceptar el aviso de privacidad para continuar.");
      return;
    }

    if (!usuario || !password) {
      Alert.alert("Error", "Faltan datos. Por favor llena todos los campos.");
      return;
    }

    if (isRegistering) {
      if (password.length < 6) {
        Alert.alert("Contraseña Insegura", "La contraseña debe tener al menos 6 caracteres por seguridad.");
        return;
      }
      if (!nombre) {
        Alert.alert("Error", "Por favor ingresa tu nombre.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegistering) {
        const newId = await registrarUsuario(nombre, usuario, password);
        if (newId) {
          Alert.alert("Bienvenido", "Cuenta creada exitosamente. Ya puedes iniciar sesión.");
          setIsRegistering(false);
        }
        else Alert.alert("Error", "El usuario ya existe.");
      } else {
        const user = await loginUsuario(usuario, password);
        if (user) {
          await AsyncStorage.setItem('USER_SESSION', JSON.stringify(user));
          router.replace('/home');
        }
        else { Alert.alert("Acceso Denegado", "Usuario o contraseña incorrectos."); }
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Ocurrió un problema de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!aceptoPrivacidad) {
      Alert.alert("Aviso de Privacidad", "Acepta los términos antes de usar Google.");
      return;
    }
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.data && userInfo.data.user) {
        const dbUser = await loginConGoogle(userInfo.data.user);
        if (dbUser) { await AsyncStorage.setItem('USER_SESSION', JSON.stringify(dbUser)); router.replace('/home'); }
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) console.log("Cancelado");
      else {
        console.error("Error Google:", error);
        Alert.alert("Error Google", "No se pudo conectar con Google. Verifica tu conexión.");
      }
    } finally { setLoading(false); }
  };

  return (
    // 2. Usamos ImageBackground como contenedor principal
    <ImageBackground
      source={BACKGROUND_IMAGE}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* 3. Agregamos un Overlay oscuro para legibilidad */}
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name="truck-fast" size={40} color={COLORS.primary} /></View>
            <Text style={styles.title}>BITÁCORA <Text style={{ color: COLORS.primary }}>57</Text></Text>
            <Text style={styles.subtitle}>ACCESO OPERADORES</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</Text>

            {isRegistering && (
              <View style={styles.inputContainer}><MaterialCommunityIcons name="account" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Nombre Completo" placeholderTextColor={COLORS.subtext} style={styles.input} value={nombre} onChangeText={setNombre} /></View>
            )}

            <View style={styles.inputContainer}><MaterialCommunityIcons name="email" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Correo Electrónico" placeholderTextColor={COLORS.subtext} style={styles.input} value={usuario} onChangeText={setUsuario} keyboardType="email-address" autoCapitalize="none" /></View>

            <View style={styles.inputContainer}><MaterialCommunityIcons name="lock" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Contraseña (mín 6 caracteres)" placeholderTextColor={COLORS.subtext} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry /></View>

            {!isRegistering && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 15, marginTop: -5 }}>
                <Text style={{ color: COLORS.primary, fontSize: 13, textDecorationLine: 'underline' }}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.privacyRow}>
              <TouchableOpacity
                onPress={() => setAceptoPrivacidad(!aceptoPrivacidad)}
                style={[styles.checkbox, aceptoPrivacidad && styles.checkboxChecked]}
              >
                {aceptoPrivacidad && <MaterialCommunityIcons name="check" size={16} color={COLORS.bg} />}
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
                <Text style={styles.privacyText}>Acepto el </Text>
                <TouchableOpacity onPress={() => setShowAviso(true)}>
                  <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, !aceptoPrivacidad && { backgroundColor: COLORS.disabled }]}
              onPress={handleAction}
              disabled={loading || !aceptoPrivacidad}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{isRegistering ? "REGISTRARSE" : "ENTRAR"}</Text>}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
              <Text style={{ color: COLORS.subtext, marginHorizontal: 10 }}>O continúa con</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: COLORS.border }} />
            </View>

            <TouchableOpacity
              style={[styles.btnGoogle, !aceptoPrivacidad && { opacity: 0.5 }]}
              onPress={signInWithGoogle}
              disabled={loading || !aceptoPrivacidad}
            >
              <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={{ width: 24, height: 24, marginRight: 10 }} />
              <Text style={styles.googleText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleBtn} onPress={() => setIsRegistering(!isRegistering)}>
              <Text style={styles.toggleText}>{isRegistering ? "¿Ya tienes cuenta? Entra aquí" : "¿Eres nuevo? Regístrate gratis"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={showAviso} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Aviso de Privacidad</Text>
                <TouchableOpacity onPress={() => setShowAviso(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
              <AvisoTexto />
              <TouchableOpacity style={styles.btnModal} onPress={() => setShowAviso(false)}>
                <Text style={styles.btnText}>ENTENDIDO Y ACEPTAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // 4. Estilos para la imagen y el overlay
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    // Capa oscura con 70% de opacidad para que resalte el formulario
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'center',
  },
  content: { padding: 30 },
  header: { alignItems: 'center', marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 4.65, elevation: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  subtitle: { fontSize: 12, color: COLORS.subtext, letterSpacing: 2, fontWeight: 'bold' },
  // Hacemos el formulario un poco más transparente para que se integre con el fondo
  form: { backgroundColor: 'rgba(30, 41, 59, 0.90)', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  formTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: COLORS.border },
  icon: { marginRight: 10 },
  input: { flex: 1, color: 'white' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: COLORS.primary },
  privacyText: { color: COLORS.subtext, fontSize: 13 },
  privacyLink: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline' },
  btnPrimary: { backgroundColor: COLORS.primary, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },
  btnGoogle: { flexDirection: 'row', backgroundColor: 'white', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  btnModal: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});