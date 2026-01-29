import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { loginUsuario, registrarUsuario, loginConGoogle } from '../db/database';

// Importamos el texto legal (Asegúrate de haber creado el componente src/components/AvisoPrivacidad.tsx)
import { AvisoTexto } from '../src/components/AvisoPrivacidad';

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
  webClientId: "363075260432-cc1jribde44btsk7dg9snns7u69su2ej.apps.googleusercontent.com", 
  offlineAccess: true
});

export default function Login() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  
  // --- NUEVOS ESTADOS PARA PRIVACIDAD ---
  const [aceptoPrivacidad, setAceptoPrivacidad] = useState(false);
  const [showAviso, setShowAviso] = useState(false);

  const handleAction = async () => {
    // Validación de la casilla
    if (!aceptoPrivacidad) {
      Alert.alert("Aviso de Privacidad", "Debes aceptar el aviso de privacidad para continuar.");
      return;
    }

    if (!usuario || !password) { Alert.alert("Error", "Faltan datos"); return; }
    setLoading(true);
    try {
      if (isRegistering) {
        const newId = await registrarUsuario(nombre, usuario, password);
        if (newId) { Alert.alert("Éxito", "Cuenta creada."); setIsRegistering(false); }
        else Alert.alert("Error", "Usuario ya existe.");
      } else {
        const user = await loginUsuario(usuario, password);
        if (user) { await AsyncStorage.setItem('USER_SESSION', JSON.stringify(user)); router.replace('/home'); }
        else { Alert.alert("Error", "Credenciales incorrectas."); }
      }
    } catch (e) { } finally { setLoading(false); }
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
        Alert.alert("Error Google", "No se pudo conectar.");
      }
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}><MaterialCommunityIcons name="truck-fast" size={40} color={COLORS.primary} /></View>
          <Text style={styles.title}>BITÁCORA <Text style={{color: COLORS.primary}}>57</Text></Text>
          <Text style={styles.subtitle}>ACCESO OPERADORES</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</Text>
          
          {isRegistering && (
            <View style={styles.inputContainer}><MaterialCommunityIcons name="account" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Nombre" placeholderTextColor={COLORS.subtext} style={styles.input} value={nombre} onChangeText={setNombre} /></View>
          )}
          
          <View style={styles.inputContainer}><MaterialCommunityIcons name="email" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Usuario/Email" placeholderTextColor={COLORS.subtext} style={styles.input} value={usuario} onChangeText={setUsuario} /></View>
          
          <View style={styles.inputContainer}><MaterialCommunityIcons name="lock" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Contraseña" placeholderTextColor={COLORS.subtext} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry /></View>

          {/* --- CASILLA DE PRIVACIDAD --- */}
          <View style={styles.privacyRow}>
            <TouchableOpacity 
              onPress={() => setAceptoPrivacidad(!aceptoPrivacidad)}
              style={[styles.checkbox, aceptoPrivacidad && styles.checkboxChecked]}
            >
              {aceptoPrivacidad && <MaterialCommunityIcons name="check" size={16} color={COLORS.bg} />}
            </TouchableOpacity>
            <View style={{flex: 1, flexDirection: 'row', flexWrap: 'wrap'}}>
              <Text style={styles.privacyText}>Acepto el </Text>
              <TouchableOpacity onPress={() => setShowAviso(true)}>
                <Text style={styles.privacyLink}>Aviso de Privacidad</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.btnPrimary, !aceptoPrivacidad && {backgroundColor: COLORS.disabled}]} 
            onPress={handleAction} 
            disabled={loading || !aceptoPrivacidad}
          >
            {loading ? <ActivityIndicator color="white"/> : <Text style={styles.btnText}>{isRegistering ? "REGISTRAR" : "ENTRAR"}</Text>}
          </TouchableOpacity>

          <View style={{flexDirection:'row', alignItems:'center', marginVertical:20}}>
            <View style={{flex:1, height:1, backgroundColor:COLORS.border}} />
            <Text style={{color:COLORS.subtext, marginHorizontal:10}}>O continúa con</Text>
            <View style={{flex:1, height:1, backgroundColor:COLORS.border}} />
          </View>

          <TouchableOpacity 
            style={[styles.btnGoogle, !aceptoPrivacidad && {opacity: 0.5}]} 
            onPress={signInWithGoogle} 
            disabled={loading || !aceptoPrivacidad}
          >
            <Image source={{uri:'https://cdn-icons-png.flaticon.com/512/2991/2991148.png'}} style={{width:24, height:24, marginRight:10}} />
            <Text style={styles.googleText}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleBtn} onPress={()=>setIsRegistering(!isRegistering)}>
            <Text style={styles.toggleText}>{isRegistering ? "¿Ya tienes cuenta? Entra" : "¿No tienes cuenta? Regístrate"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- MODAL DEL AVISO --- */}
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
              <Text style={styles.btnText}>ENTENDIDO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' },
  content: { padding: 30 },
  header: { alignItems: 'center', marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  subtitle: { fontSize: 12, color: COLORS.subtext, letterSpacing: 2 },
  form: { backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  formTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: COLORS.border },
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
  toggleText: { color: COLORS.primary, fontSize: 14 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  btnModal: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 }
});
