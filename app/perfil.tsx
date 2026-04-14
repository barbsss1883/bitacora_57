import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, Image, Modal, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import { doc, setDoc } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';
import { cloudFunctions, db_firestore } from '../src/services/firebaseConfig';
import { GoogleSignin } from '@react-native-google-signin/google-signin'; 
import { eliminarCuentaYDatosLocales } from '../db/database';
import { detenerRastreo } from '../src/services/LocationService';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = {
  bg:        '#010A14',
  card:      '#051C33',
  primary:   '#D4AF37',
  goldBevel: '#D4AF37',
  text:      '#FFFFFF',
  subtext:   '#9DA8B5',
  inputBg:   '#0D2137',
  border:    '#12365A',
  border2:   '#2A4A69',
  danger:    '#ef4444',
  success:   '#10b981',
};

const GRADIENTS = {
  cardBg:  ['#12365A', '#081D33', '#030E1A'] as const,
  header:  ['#051C33', '#010A14'] as const,
  saveBtn: ['#D4AF37', '#C5A059', '#8A6E2F'] as const,
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function Perfil() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading]               = useState(false);
  const [nombre, setNombre]                 = useState('');
  const [licencia, setLicencia]             = useState('');
  const [empresa, setEmpresa]               = useState('');
  const [foto, setFoto]                     = useState<string | null>(null);
  const [docLicencia, setDocLicencia]       = useState<{uri: string, name: string, type: string} | null>(null);
  const [fotoIne, setFotoIne]               = useState<string | null>(null);
  const [visorVisible, setVisorVisible]     = useState(false);
  const [docVisualizado, setDocVisualizado] = useState<{uri: string, tipo: string} | null>(null);
  const [errorPdf, setErrorPdf]             = useState(false);
  const [zoomDocumento, setZoomDocumento]   = useState(1);
  const [pdfHtml, setPdfHtml]               = useState<string | null>(null);
  const [cargandoPdf, setCargandoPdf]       = useState(false);

  useEffect(() => { cargarDatos(); }, []);

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
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setFoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const seleccionarLicencia = async () => {
    Alert.alert("Subir Licencia", "Selecciona el formato de tu documento", [
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
    ]);
  };

  const seleccionarIne = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
    if (!result.canceled) setFotoIne(result.assets[0].uri);
  };

  const guardarPerfil = async () => {
    if (!nombre || !licencia) { Alert.alert('Error', 'Nombre y Licencia son obligatorios'); return; }
    setLoading(true);
    try {
      const perfilUsuario = {
        id: Date.now().toString(),
        nombre, licencia,
        empresa: empresa.toUpperCase().trim() || 'PARTICULAR',
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
      { text: "Salir", style: "destructive", onPress: async () => {
        try {
          await AsyncStorage.removeItem('USER_SESSION');
          try { await GoogleSignin.signOut(); } catch (e) {}
          router.replace('/login');
        } catch (error) { router.replace('/login'); }
      }}
    ]);
  };

  const limpiarStorageBitacora = async () => {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter((k) =>
      k === 'USER_SESSION' || k === 'FORM_PRESETS' ||
      k === 'ULTIMA_INSPECCION' || k === 'RUTA_OFFLINE_CACHE' ||
      k.startsWith('CURRENT_') || k.startsWith('INSPECCION_')
    );
    if (keysToRemove.length > 0) await AsyncStorage.multiRemove(keysToRemove);
  };

  const registrarSolicitudEliminacion = async () => {
    const sessionRaw  = await AsyncStorage.getItem('USER_SESSION');
    const sessionData = sessionRaw ? JSON.parse(sessionRaw) : {};
    const callable    = httpsCallable(cloudFunctions, 'solicitarEliminacionCuenta');
    const response: any = await callable({
      nombre:   (sessionData?.nombre   || nombre   || '').trim(),
      email:    (sessionData?.email    || '').trim().toLowerCase(),
      licencia: (sessionData?.licencia || licencia || '').trim().toUpperCase(),
      motivo:   'Solicitud iniciada por el usuario desde la app'
    });
    return response?.data?.requestId || null;
  };

  const ejecutarEliminacionCuenta = async () => {
    setLoading(true);
    let folio: string | null = null;
    let solicitudEnviada = false;
    try {
      try { folio = await registrarSolicitudEliminacion(); solicitudEnviada = true; }
      catch (e) { console.warn('No se pudo registrar solicitud remota:', e); }

      await detenerRastreo();
      const limpiezaOk = await eliminarCuentaYDatosLocales();
      await limpiarStorageBitacora();
      try { await GoogleSignin.signOut(); } catch (_) {}

      if (!limpiezaOk) {
        Alert.alert("Proceso incompleto", "No fue posible borrar completamente los datos locales.");
        return;
      }
      const mensaje = solicitudEnviada
        ? `Datos locales eliminados. Solicitud registrada${folio ? ` (Folio: ${folio})` : ''}.`
        : "Datos locales eliminados. Escríbenos a soportebitacora57@gmail.com para completar el borrado en servidor.";

      Alert.alert("Cuenta eliminada", mensaje, [
        { text: "Aceptar", onPress: () => router.replace('/login') }
      ]);
    } catch (error) {
      Alert.alert("Error", "No fue posible eliminar la cuenta.");
    } finally { setLoading(false); }
  };

  const confirmarEliminacionCuenta = () => {
    Alert.alert("Eliminar cuenta y datos",
      "Esta acción es permanente. Se eliminarán tus datos del dispositivo y del servidor.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Continuar", style: "destructive", onPress: () =>
          Alert.alert("Confirmación final", "¿Eliminar definitivamente?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Eliminar definitivamente", style: "destructive", onPress: ejecutarEliminacionCuenta }
          ])
        }
      ]
    );
  };

  // ─── VISOR PDF: lee como base64 y renderiza con pdf.js ───────────────────
  const mostrarDocumento = async (uri: string, tipo: string) => {
    setErrorPdf(false);
    setZoomDocumento(1);
    setPdfHtml(null);
    setDocVisualizado({ uri, tipo });
    setVisorVisible(true);

    if (tipo === 'pdf') {
      setCargandoPdf(true);
      try {
        // ✅ Usa el string 'base64' directamente — evita el bug de EncodingType
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64' as any,
        });

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { background: #0b1220; display: flex; flex-direction: column; align-items: center; }
              canvas { max-width: 100%; display: block; margin: 6px auto; }
              #loading {
                color: #D4AF37; font-family: sans-serif;
                font-size: 14px; text-align: center; padding: 40px;
              }
            </style>
          </head>
          <body>
            <div id="loading">Cargando PDF...</div>
            <div id="container"></div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
            <script>
              pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

              const base64 = "${base64}";
              const binary = atob(base64);
              const bytes  = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

              pdfjsLib.getDocument({ data: bytes }).promise
                .then(function(pdf) {
                  document.getElementById('loading').style.display = 'none';
                  const container = document.getElementById('container');
                  for (let p = 1; p <= pdf.numPages; p++) {
                    pdf.getPage(p).then(function(page) {
                      const scale    = window.innerWidth / page.getViewport({ scale: 1 }).width;
                      const viewport = page.getViewport({ scale });
                      const canvas   = document.createElement('canvas');
                      canvas.width   = viewport.width;
                      canvas.height  = viewport.height;
                      container.appendChild(canvas);
                      page.render({ canvasContext: canvas.getContext('2d'), viewport });
                    });
                  }
                })
                .catch(function() {
                  document.getElementById('loading').innerHTML =
                    '<span style="color:#ef4444">No se pudo leer el PDF</span>';
                });
            </script>
          </body>
          </html>
        `;
        setPdfHtml(html);
      } catch (e) {
        console.log('Error leyendo PDF:', e);
        setErrorPdf(true);
      } finally {
        setCargandoPdf(false);
      }
    }
  };

  const abrirPdfExterno = async () => {
    if (!docVisualizado?.uri) return;
    try {
      const disponible = await Sharing.isAvailableAsync();
      if (disponible) {
        await Sharing.shareAsync(docVisualizado.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Abrir PDF con...',
        });
      } else {
        Alert.alert("No disponible", "No se puede compartir en este dispositivo.");
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo abrir el PDF.");
    }
  };

  const aplicarZoomPdf = (zoom: number) => {
    const z = Math.max(0.5, Math.min(3, zoom));
    webViewRef.current?.injectJavaScript(`
      (function() {
        document.body.style.zoom = '${z}';
        true;
      })();
    `);
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

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENTS.header} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Perfil</Text>
        <TouchableOpacity onPress={() => router.push('/configuracion')}>
          <MaterialCommunityIcons name="cog-outline" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={seleccionarFotoPerfil} style={styles.avatarContainer}>
            {foto
              ? <Image source={{ uri: foto }} style={styles.avatar} />
              : <MaterialCommunityIcons name="camera-plus" size={40} color={COLORS.subtext} />}
          </TouchableOpacity>
          <Text style={styles.hint}>Foto de Perfil</Text>
        </View>

        <Text style={styles.label}>Nombre Completo</Text>
        <TextInput
          style={styles.input} value={nombre} onChangeText={setNombre}
          placeholderTextColor={COLORS.subtext}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.label}>No. Licencia</Text>
            <TextInput
              style={styles.input} value={licencia} onChangeText={setLicencia}
              placeholderTextColor={COLORS.subtext}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Empresa</Text>
            <TextInput
              style={styles.input} value={empresa} onChangeText={setEmpresa}
              autoCapitalize="characters" placeholderTextColor={COLORS.subtext}
            />
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 25 }]}>Documentación Legal (Mostrar a Oficial)</Text>
        <Text style={{ color: COLORS.subtext, fontSize: 10, marginBottom: 10 }}>
          Toca para ver. Mantén presionado para cambiar.
        </Text>

        <View style={styles.row}>
          {/* Licencia */}
          <TouchableOpacity
            style={[styles.docCard, docLicencia && { borderColor: COLORS.success, borderStyle: 'solid' }]}
            onPress={() => docLicencia ? mostrarDocumento(docLicencia.uri, docLicencia.type) : seleccionarLicencia()}
            onLongPress={seleccionarLicencia}
            delayLongPress={800}
          >
            {docLicencia ? (
              <View style={styles.pdfPreview}>
                <MaterialCommunityIcons
                  name={docLicencia.type === 'pdf' ? "file-pdf-box" : "image-check"}
                  size={40} color={COLORS.success}
                />
                <Text style={styles.pdfText} numberOfLines={1}>{docLicencia.name}</Text>
                <Text style={styles.reemplazarText}>VER / MANTÉN PARA CAMBIAR</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <MaterialCommunityIcons name="card-account-details-outline" size={32} color={COLORS.primary} />
                <Text style={styles.docText}>Licencia (PDF/JPG)</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* INE */}
          <TouchableOpacity
            style={[styles.docCard, fotoIne && { borderColor: COLORS.success, borderStyle: 'solid' }]}
            onPress={() => fotoIne ? mostrarDocumento(fotoIne, 'image') : seleccionarIne()}
            onLongPress={seleccionarIne}
            delayLongPress={800}
          >
            {fotoIne ? (
              <View style={{ width: '100%', height: '100%' }}>
                <Image source={{ uri: fotoIne }} style={styles.docImage} />
                <View style={styles.overlayCheck}>
                  <MaterialCommunityIcons name="magnify-plus-outline" size={24} color={COLORS.success} />
                </View>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <MaterialCommunityIcons name="id-card" size={32} color={COLORS.primary} />
                <Text style={styles.docText}>INE / ID (Foto)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btnSave} onPress={guardarPerfil} disabled={loading}>
          <LinearGradient colors={GRADIENTS.saveBtn} style={styles.btnSaveInner}>
            {loading
              ? <ActivityIndicator color="#010A14" />
              : <Text style={styles.btnText}>GUARDAR CAMBIOS</Text>}
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Botón Configuración ── */}
        <TouchableOpacity style={styles.btnConfig} onPress={() => router.push('/configuracion')}>
          <LinearGradient colors={GRADIENTS.cardBg} style={styles.btnConfigInner}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.btnConfigText}>CONFIGURACIÓN</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.subtext} style={{ marginLeft: 'auto' }} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLogout} onPress={cerrarSesion}>
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.btnLogoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnDeleteAccount, loading && { opacity: 0.7 }]}
          onPress={confirmarEliminacionCuenta}
          disabled={loading}
        >
          <MaterialCommunityIcons name="account-remove" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.btnDeleteAccountText}>ELIMINAR CUENTA Y DATOS</Text>
        </TouchableOpacity>
        <Text style={styles.deleteHelpText}>
          Se borrarán datos locales del dispositivo y se enviará solicitud de borrado en servidor.
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Modal Visor ─────────────────────────────────────────────────── */}
      <Modal visible={visorVisible} transparent={false} animationType="fade">
        <View style={styles.visorContainer}>

          <View style={styles.visorHeader}>
            <Text style={styles.visorTitle}>Documento Oficial</Text>
            <View style={styles.visorHeaderActions}>
              <View style={styles.zoomGroup}>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => cambiarZoom(-0.25)}>
                  <MaterialCommunityIcons name="minus" size={18} color="#010A14" />
                </TouchableOpacity>
                <Text style={styles.zoomText}>{Math.round(zoomDocumento * 100)}%</Text>
                <TouchableOpacity style={styles.zoomBtn} onPress={() => cambiarZoom(0.25)}>
                  <MaterialCommunityIcons name="plus" size={18} color="#010A14" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setVisorVisible(false)} style={styles.visorCloseBtn}>
                <MaterialCommunityIcons name="close-circle-outline" size={36} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Imagen */}
          {docVisualizado?.tipo === 'image' && (
            <View style={styles.visorImageContainer}>
              <Image
                source={{ uri: docVisualizado.uri }}
                style={[styles.visorImage, { transform: [{ scale: zoomDocumento }] }]}
                resizeMode="contain"
              />
            </View>
          )}

          {/* PDF */}
          {docVisualizado?.tipo === 'pdf' && (
            <View style={styles.visorPdfContainer}>
              {cargandoPdf && (
                <View style={styles.visorLoader}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.visorLoaderText}>Cargando PDF...</Text>
                </View>
              )}

              {!cargandoPdf && pdfHtml && !errorPdf && (
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: pdfHtml }}
                  style={styles.visorPdf}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  onError={() => setErrorPdf(true)}
                  startInLoadingState={false}
                />
              )}

              {!cargandoPdf && (errorPdf || !pdfHtml) && (
                <View style={styles.pdfErrorBox}>
                  <MaterialCommunityIcons name="file-pdf-box" size={64} color={COLORS.primary} />
                  <Text style={styles.pdfErrorText}>No se pudo mostrar el PDF en la app.</Text>
                  <TouchableOpacity style={styles.pdfErrorBtn} onPress={abrirPdfExterno}>
                    <MaterialCommunityIcons name="open-in-new" size={18} color="#010A14" />
                    <Text style={styles.pdfErrorBtnText}>Abrir con otra app</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <Text style={styles.visorInstrucciones}>
            Bitácora57 — Documentación Digital NOM-087
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title:           { color: COLORS.text, fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  avatarContainer: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primary, overflow: 'hidden',
  },
  avatar:          { width: '100%', height: '100%' },
  hint:            { color: COLORS.subtext, fontSize: 11, marginTop: 5 },
  label:           { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: COLORS.inputBg, color: COLORS.text,
    borderRadius: 10, padding: 12, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border2,
  },
  row:             { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  docCard: {
    flex: 1, height: 110, backgroundColor: COLORS.inputBg,
    borderRadius: 12, marginHorizontal: 5,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  docImage:        { width: '100%', height: '100%', resizeMode: 'cover' },
  docText:         { color: COLORS.subtext, fontSize: 10, marginTop: 5, fontWeight: 'bold', paddingHorizontal: 5 },

  // Guardar
  btnSave:         { borderRadius: 12, overflow: 'hidden', marginTop: 30, borderWidth: 1.5, borderColor: COLORS.primary },
  btnSaveInner:    { padding: 18, alignItems: 'center' },
  btnText:         { color: '#010A14', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },

  // Configuración
  btnConfig: {
    borderRadius: 12, overflow: 'hidden', marginTop: 12,
    borderWidth: 1.5, borderColor: COLORS.border2,
  },
  btnConfigInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingHorizontal: 18,
  },
  btnConfigText:   { color: COLORS.primary, fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },

  // Cerrar sesión
  btnLogout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border2,
    backgroundColor: 'rgba(18,54,90,0.3)',
  },
  btnLogoutText:   { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },

  // Eliminar cuenta
  btnDeleteAccount: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, padding: 15, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)',
    backgroundColor: 'rgba(127,29,29,0.25)',
  },
  btnDeleteAccountText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 13 },
  deleteHelpText:  { color: COLORS.subtext, fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 6 },
  pdfPreview:      { alignItems: 'center', justifyContent: 'center', padding: 10, width: '100%' },
  pdfText:         { color: COLORS.text, fontSize: 9, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },
  reemplazarText:  { color: COLORS.subtext, fontSize: 8, textTransform: 'uppercase', marginTop: 2 },
  overlayCheck: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: 'rgba(1,10,20,0.8)', borderRadius: 15, padding: 2,
  },

  // Visorh
  visorContainer:      { flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
  visorHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15,
    zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  visorHeaderActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  visorTitle:          { color: 'white', fontSize: 18, fontWeight: 'bold' },
  zoomGroup: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(1,10,20,0.95)',
    borderRadius: 20, paddingHorizontal: 6, paddingVertical: 4,
  },
  zoomBtn: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  zoomText:            { color: '#fff', fontWeight: 'bold', fontSize: 11, width: 52, textAlign: 'center' },
  visorCloseBtn:       { padding: 5 },
  visorImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  visorImage:          { width: '95%', height: SCREEN_HEIGHT * 0.75 },
  visorPdfContainer:   { flex: 1, width: '100%' },
  visorPdf:            { flex: 1, backgroundColor: '#0b1220' },
  visorLoader: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1220',
  },
  visorLoaderText:     { color: COLORS.subtext, marginTop: 10, fontSize: 12 },
  pdfErrorBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24, backgroundColor: '#0b1220',
  },
  pdfErrorText:        { color: COLORS.subtext, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  pdfErrorBtn: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
  },
  pdfErrorBtnText:     { color: '#010A14', fontWeight: 'bold' },
  visorInstrucciones: {
    color: COLORS.subtext, textAlign: 'center',
    padding: 20, fontSize: 12, letterSpacing: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
});