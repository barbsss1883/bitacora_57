import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, Image, Modal, Dimensions, Linking 
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker'; 
import { WebView } from 'react-native-webview';
import { doc, setDoc } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';
import { cloudFunctions, db_firestore } from '../src/services/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin'; 
import { eliminarCuentaYDatosLocales } from '../db/database';
import { detenerRastreo } from '../src/services/LocationService';

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

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function Perfil() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(false);
  
  const [nombre, setNombre] = useState('');
  const [licencia, setLicencia] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  
  const [docLicencia, setDocLicencia] = useState<{uri: string, name: string, type: string} | null>(null);
  const [fotoIne, setFotoIne] = useState<string | null>(null);

  // --- ESTADOS PARA EL VISOR DE DOCUMENTOS OFICIALES ---
  const [visorVisible, setVisorVisible] = useState(false);
  const [docVisualizado, setDocVisualizado] = useState<{uri: string, tipo: string} | null>(null);
  const [errorPdf, setErrorPdf] = useState(false);
  const [zoomDocumento, setZoomDocumento] = useState(1);

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
            let res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
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

  const cerrarSesion = () => {
    Alert.alert("Cerrar Sesión", "¿Deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { 
        text: "Salir", 
        style: "destructive", 
        onPress: async () => {
          try {
              await AsyncStorage.removeItem('USER_SESSION');
              try { await GoogleSignin.signOut(); } catch (e) {}
              router.replace('/login');
          } catch (error) {
              router.replace('/login');
          }
        }
      }
    ]);
  };

  const limpiarStorageBitacora = async () => {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter((k) =>
      k === 'USER_SESSION' ||
      k === 'FORM_PRESETS' ||
      k === 'ULTIMA_INSPECCION' ||
      k === 'RUTA_OFFLINE_CACHE' ||
      k.startsWith('CURRENT_') ||
      k.startsWith('INSPECCION_')
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  };

  const registrarSolicitudEliminacion = async () => {
    const sessionRaw = await AsyncStorage.getItem('USER_SESSION');
    const sessionData = sessionRaw ? JSON.parse(sessionRaw) : {};

    const callable = httpsCallable(cloudFunctions, 'solicitarEliminacionCuenta');
    const response: any = await callable({
      nombre: (sessionData?.nombre || nombre || '').trim(),
      email: (sessionData?.email || '').trim().toLowerCase(),
      licencia: (sessionData?.licencia || licencia || '').trim().toUpperCase(),
      motivo: 'Solicitud iniciada por el usuario desde la app'
    });

    return response?.data?.requestId || null;
  };

  const ejecutarEliminacionCuenta = async () => {
    setLoading(true);
    let folio: string | null = null;
    let solicitudEnviada = false;

    try {
      try {
        folio = await registrarSolicitudEliminacion();
        solicitudEnviada = true;
      } catch (e) {
        console.warn('No se pudo registrar solicitud remota de eliminacion:', e);
      }

      await detenerRastreo();
      const limpiezaOk = await eliminarCuentaYDatosLocales();
      await limpiarStorageBitacora();
      try { await GoogleSignin.signOut(); } catch (_) {}

      if (!limpiezaOk) {
        Alert.alert(
          "Proceso incompleto",
          "No fue posible borrar completamente los datos locales. Intenta de nuevo."
        );
        return;
      }

      const mensaje = solicitudEnviada
        ? `Tus datos locales fueron eliminados. Se registró la solicitud de eliminación en servidor${folio ? ` (Folio: ${folio})` : ''}.`
        : "Tus datos locales fueron eliminados, pero no se pudo registrar la solicitud remota. Escríbenos a soportebitacora57@gmail.com para completar el borrado en servidor.";

      Alert.alert("Cuenta eliminada en este dispositivo", mensaje, [
        { text: "Aceptar", onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      Alert.alert("Error", "No fue posible eliminar la cuenta en este momento.");
    } finally {
      setLoading(false);
    }
  };

  const confirmarEliminacionCuenta = () => {
    Alert.alert(
      "Eliminar cuenta y datos",
      "Esta acción es permanente. Se eliminarán tus datos del dispositivo y se enviará la solicitud para borrar datos de servidor.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Confirmación final",
              "¿Deseas eliminar definitivamente la cuenta?",
              [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar definitivamente", style: "destructive", onPress: ejecutarEliminacionCuenta }
              ]
            )
        }
      ]
    );
  };

  // --- FUNCIÓN PARA MOSTRAR A LA AUTORIDAD ---
  const mostrarDocumento = (uri: string, tipo: string) => {
      setErrorPdf(false);
      setZoomDocumento(1);
      setDocVisualizado({uri, tipo});
      setVisorVisible(true);
  };

  const aplicarZoomPdf = (zoom: number) => {
    const zoomSeguro = Math.max(0.5, Math.min(3, zoom));
    const script = `
      (function() {
        var z = ${zoomSeguro.toFixed(2)};
        if (document && document.body) {
          document.body.style.zoom = z;
          document.documentElement.style.zoom = z;
          document.body.style.transformOrigin = '0 0';
        }
        true;
      })();
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  const cambiarZoom = (delta: number) => {
    setZoomDocumento((prev) => {
      const siguiente = Math.max(0.5, Math.min(3, Number((prev + delta).toFixed(2))));
      if (docVisualizado?.tipo === 'pdf') {
        setTimeout(() => aplicarZoomPdf(siguiente), 40);
      }
      return siguiente;
    });
  };

  const abrirPdfExterno = async () => {
    if (!docVisualizado?.uri) return;
    try {
      const puedeAbrir = await Linking.canOpenURL(docVisualizado.uri);
      if (!puedeAbrir) {
        Alert.alert("No se puede abrir", "No hay app compatible para abrir este PDF.");
        return;
      }
      await Linking.openURL(docVisualizado.uri);
    } catch (e) {
      Alert.alert("Error", "No se pudo abrir el PDF.");
    }
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

        <Text style={[styles.label, {marginTop: 25}]}>Documentación Legal (Mostrar a Oficial)</Text>
        <Text style={{color: COLORS.subtext, fontSize: 10, marginBottom: 10}}>Toca la imagen para ver en pantalla completa. Mantén presionado para cambiar documento.</Text>
        
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.docCard, docLicencia && {borderColor: COLORS.success, borderStyle: 'solid'}]} 
            onPress={() => docLicencia ? mostrarDocumento(docLicencia.uri, docLicencia.type) : seleccionarLicencia()}
            onLongPress={seleccionarLicencia}
            delayLongPress={800}
          >
            {docLicencia ? (
              <View style={styles.pdfPreview}>
                <MaterialCommunityIcons 
                  name={docLicencia.type === 'pdf' ? "file-pdf-box" : "image-check"} 
                  size={40} 
                  color={COLORS.success} 
                />
                <Text style={styles.pdfText} numberOfLines={1}>{docLicencia.name}</Text>
                <Text style={styles.reemplazarText}>Ver / Mantén para cambiar</Text>
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
            onPress={() => fotoIne ? mostrarDocumento(fotoIne, 'image') : seleccionarIne()}
            onLongPress={seleccionarIne}
            delayLongPress={800}
          >
            {fotoIne ? (
              <View style={{width: '100%', height: '100%'}}>
                <Image source={{ uri: fotoIne }} style={styles.docImage} />
                <View style={styles.overlayCheck}>
                   <MaterialCommunityIcons name="magnify-plus-outline" size={24} color={COLORS.success} />
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

        <TouchableOpacity
          style={[styles.btnDeleteAccount, loading && { opacity: 0.7 }]}
          onPress={confirmarEliminacionCuenta}
          disabled={loading}
        >
          <MaterialCommunityIcons name="account-remove" size={20} color={COLORS.danger} style={{marginRight: 8}} />
          <Text style={styles.btnDeleteAccountText}>ELIMINAR CUENTA Y DATOS</Text>
        </TouchableOpacity>
        <Text style={styles.deleteHelpText}>
          Se borrarán datos locales del dispositivo y se enviará solicitud de borrado en servidor.
        </Text>
        <View style={{height: 40}} />
      </ScrollView>

      {/* --- MODAL PANTALLA COMPLETA PARA MOSTRAR DOCUMENTO A OFICIALES --- */}
      <Modal visible={visorVisible} transparent={false} animationType="fade">
          <View style={styles.visorContainer}>
              <View style={styles.visorHeader}>
                  <Text style={styles.visorTitle}>Documento Oficial</Text>
                  <View style={styles.visorHeaderActions}>
                    <View style={styles.zoomGroup}>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => cambiarZoom(-0.25)}>
                        <MaterialCommunityIcons name="minus" size={18} color="#0f172a" />
                      </TouchableOpacity>
                      <Text style={styles.zoomText}>{Math.round(zoomDocumento * 100)}%</Text>
                      <TouchableOpacity style={styles.zoomBtn} onPress={() => cambiarZoom(0.25)}>
                        <MaterialCommunityIcons name="plus" size={18} color="#0f172a" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setVisorVisible(false)} style={styles.visorCloseBtn}>
                      <MaterialCommunityIcons name="close-circle-outline" size={36} color="white" />
                    </TouchableOpacity>
                  </View>
              </View>
              
              {docVisualizado && docVisualizado.tipo === 'image' && (
                  <View style={styles.visorImageContainer}>
                      <Image 
                        source={{ uri: docVisualizado.uri }} 
                        style={[styles.visorImage, { transform: [{ scale: zoomDocumento }] }]} 
                        resizeMode="contain" 
                      />
                  </View>
              )}

              {docVisualizado && docVisualizado.tipo === 'pdf' && (
                  <View style={styles.visorPdfContainer}>
                      {!errorPdf ? (
                        <WebView
                          ref={webViewRef}
                          source={{ uri: docVisualizado.uri }}
                          style={styles.visorPdf}
                          originWhitelist={['*']}
                          allowFileAccess={true}
                          allowUniversalAccessFromFileURLs={true}
                          setBuiltInZoomControls={true}
                          setDisplayZoomControls={false}
                          scalesPageToFit={true}
                          onError={() => setErrorPdf(true)}
                          onHttpError={() => setErrorPdf(true)}
                          onLoadEnd={() => aplicarZoomPdf(zoomDocumento)}
                          startInLoadingState={true}
                          renderLoading={() => (
                            <View style={styles.visorLoader}>
                              <ActivityIndicator size="large" color={COLORS.primary} />
                              <Text style={styles.visorLoaderText}>Abriendo PDF...</Text>
                            </View>
                          )}
                        />
                      ) : (
                        <View style={styles.pdfErrorBox}>
                          <MaterialCommunityIcons name="file-pdf-box" size={64} color={COLORS.primary} />
                          <Text style={styles.pdfErrorText}>
                            No se pudo renderizar el PDF dentro de la app.
                          </Text>
                          <TouchableOpacity style={styles.pdfErrorBtn} onPress={abrirPdfExterno}>
                            <MaterialCommunityIcons name="open-in-new" size={18} color="#0f172a" />
                            <Text style={styles.pdfErrorBtnText}>Abrir con otra app</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                  </View>
              )}
              
              <Text style={styles.visorInstrucciones}>
                  Bitácora57 - Documentación Digital NOM-087
              </Text>
          </View>
      </Modal>

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
  btnDeleteAccount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(127,29,29,0.25)' },
  btnDeleteAccountText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },
  deleteHelpText: { color: COLORS.subtext, fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 },
  pdfPreview: { alignItems: 'center', justifyContent: 'center', padding: 10, width: '100%' },
  pdfText: { color: '#f8fafc', fontSize: 9, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
  reemplazarText: { color: '#94a3b8', fontSize: 8, textTransform: 'uppercase', marginTop: 2 },
  overlayCheck: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 15, padding: 2 },

  // Estilos del Visor de Documentos
  visorContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
  visorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingBottom: 15 },
  visorHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  visorTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  zoomGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4 },
  zoomBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
  zoomText: { color: '#f8fafc', fontWeight: 'bold', fontSize: 11, width: 52, textAlign: 'center' },
  visorCloseBtn: { padding: 5 },
  visorImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  visorImage: { width: '95%', height: SCREEN_HEIGHT * 0.75 }, // Ocupa el 75% de la pantalla para verse bien grande
  visorPdfContainer: { flex: 1, width: '100%' },
  visorPdf: { flex: 1, backgroundColor: '#0b1220' },
  visorLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1220' },
  visorLoaderText: { color: COLORS.subtext, marginTop: 10, fontSize: 12 },
  pdfErrorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: '#0b1220' },
  pdfErrorText: { color: COLORS.subtext, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  pdfErrorBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  pdfErrorBtnText: { color: '#0f172a', fontWeight: 'bold' },
  visorInstrucciones: { color: COLORS.subtext, textAlign: 'center', padding: 20, fontSize: 12, letterSpacing: 1, backgroundColor: 'rgba(0,0,0,0.8)' }
});
