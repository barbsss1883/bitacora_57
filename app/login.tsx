import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { loginUsuario, registrarUsuario, loginConGoogle } from '../db/database';

const COLORS = { bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', text: '#f8fafc', subtext: '#94a3b8', border: '#334155' };

// CONFIGURACIÓN DE GOOGLE (Aquí va tu Web Client ID)
GoogleSignin.configure({
  webClientId: "363075260432-73vjlu0ukn1u59sjgf5dpi1mkunda880.apps.googleusercontent.com", 
  offlineAccess: true
});

export default function Login() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const handleAction = async () => {
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
        Alert.alert("Error Google", "No se pudo conectar. Verifica tu internet y configuración.");
      }
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconCircle}><MaterialCommunityIcons name="truck-fast" size={40} color={COLORS.primary} /></View>
          <Text style={styles.title}>BITÁCORA 57</Text>
          <Text style={styles.subtitle}>ACCESO OPERADORES</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.formTitle}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</Text>
          {isRegistering && (
            <View style={styles.inputContainer}><MaterialCommunityIcons name="account" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Nombre" placeholderTextColor={COLORS.subtext} style={styles.input} value={nombre} onChangeText={setNombre} /></View>
          )}
          <View style={styles.inputContainer}><MaterialCommunityIcons name="email" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Usuario/Email" placeholderTextColor={COLORS.subtext} style={styles.input} value={usuario} onChangeText={setUsuario} /></View>
          <View style={styles.inputContainer}><MaterialCommunityIcons name="lock" size={20} color={COLORS.subtext} style={styles.icon} /><TextInput placeholder="Contraseña" placeholderTextColor={COLORS.subtext} style={styles.input} value={password} onChangeText={setPassword} secureTextEntry /></View>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleAction} disabled={loading}>{loading?<ActivityIndicator color="white"/>:<Text style={styles.btnText}>{isRegistering?"REGISTRAR":"ENTRAR"}</Text>}</TouchableOpacity>
          <View style={{flexDirection:'row', alignItems:'center', marginVertical:20}}><View style={{flex:1, height:1, backgroundColor:COLORS.border}} /><Text style={{color:COLORS.subtext, marginHorizontal:10}}>O continúa con</Text><View style={{flex:1, height:1, backgroundColor:COLORS.border}} /></View>
          <TouchableOpacity style={styles.btnGoogle} onPress={signInWithGoogle} disabled={loading}><Image source={{uri:'https://cdn-icons-png.flaticon.com/512/2991/2991148.png'}} style={{width:24, height:24, marginRight:10}} /><Text style={styles.googleText}>Google</Text></TouchableOpacity>
          <TouchableOpacity style={styles.toggleBtn} onPress={()=>setIsRegistering(!isRegistering)}><Text style={styles.toggleText}>{isRegistering?"¿Ya tienes cuenta? Entra":"¿No tienes cuenta? Regístrate"}</Text></TouchableOpacity>
        </View>
      </View>
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
  btnPrimary: { backgroundColor: COLORS.primary, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  btnText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },
  btnGoogle: { flexDirection: 'row', backgroundColor: 'white', height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  googleText: { color: '#333', fontWeight: 'bold', fontSize: 16 },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: COLORS.primary, fontSize: 14 }
});
