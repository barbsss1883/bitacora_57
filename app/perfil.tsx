import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker'; 
import { doc, setDoc } from 'firebase/firestore'; 
import { db_firestore } from '../src/services/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin'; 

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  inputBg: '#334155',
  danger: '#ef4444',
  success: '#10b981'
};

export default function Perfil() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [nombre, setNombre] = useState('');
  const [licencia, setLicencia] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  
  const [docLicencia, setDocLicencia] = useState<{uri: string, name: string, type: string} | null>(null);
  const [fotoIne, setFotoIne] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const userSession = await AsyncStorage.getItem('USER_SESSION');
    if (userSession) {
      const data = JSON.parse(userSession);
      setNombre(data.nombre || '');
      setLicencia(data.licencia || '');
      setEmpresa(data.empresa || 'PARTICULAR');
      setFoto(data.foto || null);
      setDocLicencia(data.docLicencia || null);
      setFotoIne(data.fotoIne || null);
    }
  };

  const seleccionarFotoPerfil = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const seleccionarLicencia = async () => {
    Alert.alert(
      "Subir Licencia",
      "Selecciona el formato de tu documento",
      [
        {
          text: "Imagen / Cámara",
          onPress: async () => {
            let res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
            if (!res.canceled) {
               setDocLicencia({ uri: res.assets[0].uri, name: 'licencia.jpg', type: 'image' });
            }
          }
        },
        {
          text: "Archivo PDF",
          onPress: async () => {
            let res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            if (!res.canceled) {
              setDocLicencia({ uri: res.assets[0].uri, name: res.assets[0].name, type: 'pdf' });
            }
          }
        },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const seleccionarIne = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
    if (!result.canceled) setFotoIne(result.assets[0].uri);
  };

  const guardarPerfil = async () => {
    if (!nombre || !licencia) {
      Alert.alert('Error', 'Nombre y Licencia son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const perfilUsuario = {
        id: Date.now().toString(),
        nombre, licencia, empresa: empresa.toUpperCase().trim() || 'PARTICULAR',
        foto, docLicencia, fotoIne,
        fecha_actualizacion: new Date().toISOString()
      };
      await AsyncStorage.setItem('USER_SESSION', JSON.stringify(perfilUsuario));
      await setDoc(doc(db_firestore, "usuarios", licencia), perfilUsuario);
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar');
    } finally { setLoading(false); }
  };

  // --- FUNCIÓN CORREGIDA ---
  const cerrarSesion = () => {
    Alert.alert("Cerrar Sesión", "¿Deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Salir", 
        style: "destructive", 
        onPress: async () => {
          try {
              // 1. Eliminar sesión local del dispositivo
              await AsyncStorage.removeItem('USER_SESSION');
              
              // 2. Desconectar de Google para permitir cambiar de cuenta después
              try {
                await GoogleSignin.signOut();
              } catch (googleError) {
                // Si falla (ej. no estaba logueado con Google), solo lo ignoramos
                console.log("No se pudo cerrar sesión de Google o no existía:", googleError);
              }

              // 3. Redirigir al Login (usando replace para borrar historial)
              router.replace('/login');
          } catch (error) {
              console.error("Error fatal al salir:", error);
              // En caso de emergencia, forzar ida al login
              router.replace('/login');
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Perfil</Text>
        <View style={{width: 28}} />
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
        <View style={{alignItems:'center', marginBottom: 20}}>
          <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.avatarContainer}>
            {foto ? <Image source={{ uri: foto }} style={styles.avatar} /> : <MaterialCommunityIcons name="camera-plus" size={40} color={COLORS.subtext} />}
          </TouchableOpacity>
          <Text style={styles.hint}>Foto de Perfil</Text>
        </View>

        <Text style={styles.label}>Nombre Completo</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholderTextColor={COLORS.subtext} />

        <View style={styles.row}>
          <View style={{flex:1, marginRight:10}}>
            <Text style={styles.label}>No. Licencia</Text>
            <TextInput style={styles.input} value={licencia} onChangeText={setLicencia} placeholderTextColor={COLORS.subtext} />
          </View>
          <View style={{flex:1}}>
            <Text style={styles.label}>Empresa</Text>
            <TextInput style={styles.input} value={empresa} onChangeText={setEmpresa} autoCapitalize="characters" placeholderTextColor={COLORS.subtext} />
          </View>
        </View>

        <Text style={[styles.label, {marginTop: 25}]}>Documentación Legal</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.docCard, docLicencia && {borderColor: COLORS.success, borderStyle: 'solid'}]} 
            onPress={seleccionarLicencia}
          >
            {docLicencia ? (
              <View style={styles.pdfPreview}>
                <MaterialCommunityIcons 
                  name={docLicencia.type === 'pdf' ? "file-pdf-box" : "image-check"} 
                  size={40} 
                  color={COLORS.success} 
                />
                <Text style={styles.pdfText} numberOfLines={1}>{docLicencia.name}</Text>
                <Text style={styles.reemplazarText}>Toca para cambiar</Text>
              </View>
            ) : (
              <View style={{alignItems:'center'}}>
                <MaterialCommunityIcons name="card-account-details-outline" size={32} color={COLORS.primary} />
                <Text style={styles.docText}>Licencia (PDF/JPG)</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.docCard, fotoIne && {borderColor: COLORS.success, borderStyle: 'solid'}]} 
            onPress={seleccionarIne}
          >
            {fotoIne ? (
              <View style={{width: '100%', height: '100%'}}>
                <Image source={{ uri: fotoIne }} style={styles.docImage} />
                <View style={styles.overlayCheck}>
                   <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                </View>
              </View>
            ) : (
              <View style={{alignItems:'center'}}>
                <MaterialCommunityIcons name="id-card" size={32} color={COLORS.primary} />
                <Text style={styles.docText}>INE / ID (Foto)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnSave} onPress={guardarPerfil} disabled={loading}>
          {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>GUARDAR CAMBIOS</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLogout} onPress={cerrarSesion}>
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} style={{marginRight: 8}} />
          <Text style={styles.btnLogoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  avatarContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  hint: { color: COLORS.subtext, fontSize: 11, marginTop: 5 },
  label: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#475569' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  docCard: { flex: 1, height: 110, backgroundColor: COLORS.inputBg, borderRadius: 12, marginHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary, overflow: 'hidden' },
  docImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  docText: { color: COLORS.subtext, fontSize: 10, marginTop: 5, fontWeight: 'bold', paddingHorizontal: 5 },
  btnSave: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 30 },
  btnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 15 },
  btnLogout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  btnLogoutText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },
  pdfPreview: { alignItems: 'center', justifyContent: 'center', padding: 10, width: '100%' },
  pdfText: { color: '#f8fafc', fontSize: 9, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
  reemplazarText: { color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', marginTop: 2 },
  overlayCheck: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 10 }
});