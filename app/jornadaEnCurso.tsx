import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, 
  TextInput, StatusBar, Alert, ActivityIndicator, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// --- IMPORTAMOS TU MAPA BLINDADO ---
import MapaRuta from './mapaRuta'; 

// SERVICIOS Y BD
import { iniciarRastreoBackground, detenerRastreo, obtenerDireccion } from '../src/services/LocationService'; // <--- AGREGADO obtenerDireccion
import { iniciarNuevaJornada, finalizarJornada, insertarPausa, insertarIncidencia, obtenerDetalleJornada } from '../db/database';
import FirmaDigital from '../src/components/FirmaDigital';
import { generarPDF } from '../src/services/PdfGenerator'; 

// FIREBASE
import { db_firestore, storage } from '../src/services/firebaseConfig';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', danger: '#7f1d1d',  
  text: '#f8fafc', subtext: '#94a3b8', success: '#10b981', 
  border: '#334155', warning: '#f97316', white: '#ffffff',
  modalOverlay: 'rgba(15, 23, 42, 0.95)'
};

export default function JornadaEnCurso() {
  const router = useRouter();
  
  const [cargando, setCargando] = useState(true);
  const [jornadaId, setJornadaId] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState<string | null>(null);
  const [visuales, setVisuales] = useState({ unidad: '---', operador: '---' });
  
  const [enPausa, setEnPausa] = useState(false);
  const [inicioPausa, setInicioPausa] = useState<string | null>(null);
  const [tipoPausaActual, setTipoPausaActual] = useState<string | null>(null);

  const [modalRegistro, setModalRegistro] = useState(false);
  const [modalPausa, setModalPausa] = useState(false);
  const [modalFirma, setModalFirma] = useState(false);
  const [modalIncidencia, setModalIncidencia] = useState(false);
  
  const [formulario, setFormulario] = useState({
    permisionario: '', domicilio: '', tipo_servicio: 'Carga General',
    unidad: '', placas: '', marca: '', modelo: '', modalidad: 'Sencillo',
    remolque1_eco: '', remolque1_placas: '', remolque2_eco: '', remolque2_placas: '', 
    operador: '', licencia: '', vigencia: '', origen: '', destino: ''
  });

  const [descIncidencia, setDescIncidencia] = useState('');
  const [tiempoManejo, setTiempoManejo] = useState('00:00:00');
  const [tiempoTotal, setTiempoTotal] = useState('00:00:00');

  useEffect(() => { 
    cargarEstado(); 
    const interval = setInterval(() => {
      if (jornadaId && fechaInicio && !enPausa) {
        const inicio = new Date(fechaInicio);
        const ahora = new Date();
        const diff = ahora.getTime() - inicio.getTime();
        setTiempoManejo(formatearTiempo(diff));
        setTiempoTotal(formatearTiempo(diff)); 
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [jornadaId, fechaInicio, enPausa]);

  const formatearTiempo = (ms: number) => {
    const segundos = Math.floor((ms / 1000) % 60);
    const minutos = Math.floor((ms / (1000 * 60)) % 60);
    const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  const cargarEstado = async () => {
    try {
      const id = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
      const inicio = await AsyncStorage.getItem('CURRENT_JORNADA_START');
      const vis = await AsyncStorage.getItem('CURRENT_JORNADA_VISUAL');
      const pStart = await AsyncStorage.getItem('CURRENT_PAUSA_START');
      const pType = await AsyncStorage.getItem('CURRENT_PAUSA_TYPE');

      if (id && inicio) { setJornadaId(Number(id)); setFechaInicio(inicio); }
      if (vis) setVisuales(JSON.parse(vis));
      if (pStart) { setEnPausa(true); setInicioPausa(pStart); setTipoPausaActual(pType || 'Pausa'); }
      
      if (!id) {
        const userSession = await AsyncStorage.getItem('USER_SESSION');
        const presets = await AsyncStorage.getItem('FORM_PRESETS');
        let datosBase = {};
        if (presets) { datosBase = JSON.parse(presets); }

        if (userSession) {
          const perfil = JSON.parse(userSession);
          datosBase = {
            ...datosBase,
            operador: perfil.nombre || '',
            licencia: perfil.licencia || '',
            permisionario: perfil.empresa || '',
          };
        }
        setFormulario(prev => ({ ...prev, ...datosBase, origen: '', destino: '' }));
      }
    } catch(e) { console.error(e); } finally { setCargando(false); }
  };

  const iniciarViaje = async () => {
    if (!formulario.permisionario || !formulario.unidad || !formulario.operador || !formulario.origen || !formulario.destino) {
         Alert.alert("Datos Incompletos", "Verifica unidad, operador y ruta."); return;
    }
    await AsyncStorage.removeItem('RUTA_OFFLINE_CACHE');
    setModalRegistro(false);
    const datosParaGuardar = { ...formulario, marca: `${formulario.marca} ${formulario.modelo}` };
    const presets = { ...formulario, origen: '', destino: '' };
    await AsyncStorage.setItem('FORM_PRESETS', JSON.stringify(presets));

    try {
        const nuevoId = await iniciarNuevaJornada(datosParaGuardar);
        const ahora = new Date().toISOString();
        await AsyncStorage.setItem('CURRENT_JORNADA_ID', String(nuevoId));
        await AsyncStorage.setItem('CURRENT_JORNADA_START', ahora);
        const datosVis = { unidad: formulario.unidad, operador: formulario.operador };
        await AsyncStorage.setItem('CURRENT_JORNADA_VISUAL', JSON.stringify(datosVis));
        setJornadaId(nuevoId); setFechaInicio(ahora); setVisuales(datosVis);
        await iniciarRastreoBackground();
        Alert.alert("¡Buen Viaje!", "Bitácora iniciada correctamente.");
    } catch (error) { Alert.alert("Error BD", "No se pudo iniciar."); }
  };

  const pedirFirmaCierre = () => { 
    if (enPausa) { 
      Alert.alert("Pausa Activa", "Termina la pausa antes de finalizar."); 
      return; 
    } 
    setModalFirma(true); 
  };

  // --- MODIFICACIÓN: SUBIDA DE ARCHIVO ---
  const subirPdfFirebase = async (idLocal: number, uriLocal: string) => {
    try {
      const response = await fetch(uriLocal);
      const blob = await response.blob();
      const storageRef = ref(storage, `reportes_v2/${formulario.licencia || 'anonimo'}/Viaje_${idLocal}.pdf`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      // Sincronizamos con la colección rutas_maestras que usa el monitor
      await updateDoc(doc(db_firestore, "rutas_maestras", String(idLocal)), { pdf_url: downloadURL });
    } catch (e) { console.error("Error subiendo PDF:", e); }
  };

  // --- MODIFICACIÓN: SINCRONIZACIÓN FINAL ---
  const sincronizarYFinalizar = async (idLocal: number, firmaBase64: string, rutaJson: string | null) => {
    try {
      const dataFull = await obtenerDetalleJornada(idLocal);
      if (!dataFull.jornada) return;
      const { jornada, pausas, incidencias } = dataFull;

      await setDoc(doc(db_firestore, "rutas_maestras", String(idLocal)), {
        ...jornada, 
        pausas, 
        incidencias, 
        ruta_geojson: rutaJson, 
        ultima_sincronizacion: serverTimestamp(), 
        servidor_verificado: true,
        firma: firmaBase64
      });
      
      const uriPdf = await generarPDF({...jornada, firma: firmaBase64}, pausas, incidencias, []); 
      if (uriPdf) { await subirPdfFirebase(idLocal, uriPdf); }
    } catch (e) { console.error("Error sincronizando:", e); }
  };

  const confirmarCierreConFirma = async (firmaBase64: string) => {
    setModalFirma(false); 
    setCargando(true);
    try {
        await detenerRastreo();
        const rutaJson = await AsyncStorage.getItem('RUTA_OFFLINE_CACHE');
        if(jornadaId) {
            await finalizarJornada(jornadaId, firmaBase64, rutaJson);
            await sincronizarYFinalizar(jornadaId, firmaBase64, rutaJson);
        }
        await AsyncStorage.removeItem('RUTA_OFFLINE_CACHE');
        await AsyncStorage.multiRemove([
          'CURRENT_JORNADA_ID', 'CURRENT_JORNADA_START', 
          'CURRENT_JORNADA_VISUAL', 'CURRENT_PAUSA_START', 'CURRENT_PAUSA_TYPE',
          'CURRENT_PAUSA_ADDRESS' // Limpiamos dirección temporal
        ]);
        router.replace('/home');
    } catch (e) { 
      console.error(e);
      Alert.alert("Error", "Error al finalizar."); 
    } finally { 
      setCargando(false); 
    }
  };

  const activarPausa = async (motivo: string) => {
    setModalPausa(false); 
    
    // Obtener dirección al inicio de la pausa
    const direccion = await obtenerDireccion();
    
    const ahora = new Date().toISOString();
    setEnPausa(true); 
    setInicioPausa(ahora); 
    setTipoPausaActual(motivo);
    
    await AsyncStorage.setItem('CURRENT_PAUSA_START', ahora); 
    await AsyncStorage.setItem('CURRENT_PAUSA_TYPE', motivo);
    await AsyncStorage.setItem('CURRENT_PAUSA_ADDRESS', direccion); // Guardamos dirección
  };

  const terminarPausa = async () => {
    if (!inicioPausa || !jornadaId) return;
    
    const fin = new Date(); 
    const inicio = new Date(inicioPausa);
    const duracion = (fin.getTime() - inicio.getTime()) / 60000;
    
    // Recuperamos la dirección guardada
    const direccionGuardada = await AsyncStorage.getItem('CURRENT_PAUSA_ADDRESS') || '';

    await insertarPausa(
      jornadaId, 
      tipoPausaActual || 'Varios', 
      inicio.toISOString(), 
      fin.toISOString(), 
      duracion,
      direccionGuardada // Nuevo parámetro
    );

    await AsyncStorage.removeItem('CURRENT_PAUSA_START'); 
    await AsyncStorage.removeItem('CURRENT_PAUSA_TYPE');
    await AsyncStorage.removeItem('CURRENT_PAUSA_ADDRESS');

    setEnPausa(false); 
    setInicioPausa(null); 
    setTipoPausaActual(null);
  };

  const reportarIncidencia = async () => {
    if (!jornadaId) return; 
    setModalIncidencia(false);
    try { 
      // Obtener dirección del incidente
      const direccion = await obtenerDireccion();
      await insertarIncidencia(
        jornadaId, 
        "Reporte Manual", 
        descIncidencia, 
        null, 
        direccion // Nuevo parámetro
      ); 
      setDescIncidencia(''); 
      Alert.alert("Reportado", "Incidencia registrada."); 
    } catch (e) { Alert.alert("Error", "No se guardó."); }
  };

  if (cargando) return <View style={[styles.container, {justifyContent:'center'}]}><ActivityIndicator size="large" color={COLORS.primary}/></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.timerCardNew}>
          <View style={styles.timerHeader}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <MaterialCommunityIcons name="timer-outline" size={18} color={COLORS.subtext} style={{marginRight: 5}} />
                <Text style={styles.cardLabelNew}>TIEMPO DE MANEJO</Text>
            </View>
            <View style={{flexDirection:'column', alignItems:'flex-end', gap: 6}}>
                <View style={[styles.statusBadgeNew, {backgroundColor: enPausa ? COLORS.warning : COLORS.success}]}>
                    <Text style={styles.statusTextNew}>{enPausa ? "EN PAUSA" : "EN RUTA"}</Text>
                </View>
                {jornadaId && !enPausa && (
                  <TouchableOpacity style={styles.btnReportarNew} onPress={() => setModalIncidencia(true)}>
                    <MaterialCommunityIcons name="alert" size={16} color={COLORS.warning} />
                    <Text style={styles.txtReportarNew}>Reportar</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
          <View style={styles.mainTimerContainer}>
            {enPausa ? (
                <View style={{alignItems:'center'}}>
                    <Text style={[styles.mainTimerText, {color: COLORS.warning, fontSize: 32}]}>PAUSA</Text>
                    <Text style={{color: COLORS.subtext, fontSize: 16}}>{tipoPausaActual}</Text>
                </View>
            ) : (
                <View style={{flexDirection:'row', alignItems:'baseline'}}>
                    <Text style={styles.mainTimerText}>{tiempoManejo}</Text>
                    <Text style={styles.subTimerText}> / 05:00:00</Text>
                </View>
            )}
          </View>
          <View style={styles.progressBarBgNew}><View style={[styles.progressBarFillNew, { width: '30%', backgroundColor: enPausa ? COLORS.warning : COLORS.success }]} /></View>
          <View style={styles.progressLabels}><Text style={styles.progressLabelText}>INICIO</Text><Text style={styles.progressLabelText}>ALERTA 4.5H</Text><Text style={styles.progressLabelText}>LÍMITE 5H</Text></View>
          <View style={styles.dividerNew} />
          <View style={styles.footerTimer}>
             <Text style={styles.footerLabel}>Jornada Total Acumulada:</Text>
             <View style={{flexDirection:'row', alignItems:'baseline'}}><Text style={styles.footerTimerText}>{tiempoTotal}</Text><Text style={styles.footerSubTimerText}> / 14:00:00</Text></View>
          </View>
        </View>
        <View style={styles.mapContainer}><MapaRuta key={jornadaId ? `viaje-${jornadaId}` : 'sin-viaje'} /></View>
      </ScrollView>

      <View style={styles.bottomBarBig}>
        {!jornadaId ? (
          <TouchableOpacity style={[styles.btnBigBase, {backgroundColor: COLORS.primary}]} onPress={() => setModalRegistro(true)}>
             <Text style={styles.btnBigTitle}>INICIAR JORNADA</Text><Text style={styles.btnBigSub}>Configurar nueva ruta</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.btnBigBase, {backgroundColor: enPausa ? COLORS.success : COLORS.primary, marginRight: 10}]} onPress={() => enPausa ? terminarPausa() : setModalPausa(true)}>
                <View style={{flexDirection:'row', alignItems:'center'}}><MaterialCommunityIcons name={enPausa ? "play" : "pause"} size={24} color="white" style={{marginRight:5}} /><Text style={styles.btnBigTitle}>{enPausa ? "REANUDAR" : "PAUSA"}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnBigBase, {backgroundColor: COLORS.danger, flex: 0.6}]} onPress={pedirFirmaCierre}>
                <View style={{flexDirection:'row', alignItems:'center'}}><Text style={styles.btnBigTitle}>FINALIZAR</Text></View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal visible={modalRegistro} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
                    <Text style={styles.sectionHeader}>NUEVO VIAJE</Text>
                    <TouchableOpacity onPress={() => setModalRegistro(false)}><MaterialCommunityIcons name="close" size={24} color="#fff"/></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <InputDark label="1. Permisionario" val={formulario.permisionario} set={(t:string)=>setFormulario({...formulario, permisionario: t})} placeholder="Nombre Empresa" />
                    <InputDark label="Domicilio Fiscal" val={formulario.domicilio} set={(t:string)=>setFormulario({...formulario, domicilio: t})} />
                    <Text style={styles.labelSection}>2. Unidad</Text>
                    <View style={styles.row}>
                        <InputDark label="Unidad" val={formulario.unidad} set={(t:string)=>setFormulario({...formulario, unidad: t})} flex />
                        <InputDark label="Placas" val={formulario.placas} set={(t:string)=>setFormulario({...formulario, placas: t})} flex />
                    </View>
                    <View style={styles.row}>
                        <InputDark label="Marca" val={formulario.marca} set={(t:string)=>setFormulario({...formulario, marca: t})} flex />
                        <InputDark label="Modelo" val={formulario.modelo} set={(t:string)=>setFormulario({...formulario, modelo: t})} flex />
                    </View>
                    <View style={{flexDirection:'row', marginBottom:10, marginTop:5}}>
                         <TouchableOpacity onPress={()=>setFormulario({...formulario, modalidad:'Sencillo'})} style={[styles.switch, formulario.modalidad==='Sencillo' && styles.switchActive]}><Text style={{color:'white'}}>Sencillo</Text></TouchableOpacity>
                         <TouchableOpacity onPress={()=>setFormulario({...formulario, modalidad:'Full'})} style={[styles.switch, formulario.modalidad==='Full' && styles.switchActive]}><Text style={{color:'white'}}>Full</Text></TouchableOpacity>
                    </View>
                    <Text style={styles.labelSection}>3. Remolques</Text>
                    <View style={styles.row}>
                        <InputDark label="Eco R1" val={formulario.remolque1_eco} set={(t:string)=>setFormulario({...formulario, remolque1_eco: t})} flex />
                        <InputDark label="Placas R1" val={formulario.remolque1_placas} set={(t:string)=>setFormulario({...formulario, remolque1_placas: t})} flex />
                    </View>
                    {formulario.modalidad === 'Full' && (
                        <View style={styles.row}>
                            <InputDark label="Eco R2" val={formulario.remolque2_eco} set={(t:string)=>setFormulario({...formulario, remolque2_eco: t})} flex />
                            <InputDark label="Placas R2" val={formulario.remolque2_placas} set={(t:string)=>setFormulario({...formulario, remolque2_placas: t})} flex />
                        </View>
                    )}
                    <Text style={styles.labelSection}>4. Conductor</Text>
                    <InputDark label="Nombre" val={formulario.operador} set={(t:string)=>setFormulario({...formulario, operador: t})} />
                    <View style={styles.row}>
                        <InputDark label="Licencia" val={formulario.licencia} set={(t:string)=>setFormulario({...formulario, licencia: t})} flex />
                        <InputDark label="Vigencia" val={formulario.vigencia} set={(t:string)=>setFormulario({...formulario, vigencia: t})} flex />
                    </View>
                    <Text style={styles.labelSection}>5. Ruta</Text>
                    <InputDark label="Origen" val={formulario.origen} set={(t:string)=>setFormulario({...formulario, origen: t})} />
                    <InputDark label="Destino" val={formulario.destino} set={(t:string)=>setFormulario({...formulario, destino: t})} />
                    <TouchableOpacity style={styles.btnFullOrange} onPress={iniciarViaje}><Text style={styles.btnText}>COMENZAR VIAJE</Text></TouchableOpacity>
                    <View style={{height:60}}/>
                </ScrollView>
            </View>
        </View>
      </Modal>

      <Modal visible={modalPausa} transparent>
          <View style={[styles.modalOverlay, {justifyContent:'center'}]}>
              <View style={[styles.modalContent, {borderRadius:20}]}>
                  <Text style={styles.sectionHeader}>Registrar Pausa</Text>
                  <View style={{flexDirection:'row', flexWrap:'wrap', gap:10}}>
                      {["Alimentos", "Descanso", "Combustible", "Mecánica"].map((m) => (
                          <TouchableOpacity key={m} style={styles.chip} onPress={() => activarPausa(m)}>
                              <Text style={{color:'white'}}>{m}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
                  <TouchableOpacity onPress={()=>setModalPausa(false)} style={{marginTop:20, alignSelf:'center'}}><Text style={{color:COLORS.subtext}}>Cancelar</Text></TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal visible={modalIncidencia} transparent>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.sectionHeader}>Reportar Incidencia</Text>
                  <InputDark label="Descripción" val={descIncidencia} set={setDescIncidencia} multiline />
                  <TouchableOpacity style={styles.btnFullOrange} onPress={reportarIncidencia}><Text style={styles.btnText}>REPORTAR</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>setModalIncidencia(false)} style={{marginTop:20, alignSelf:'center'}}><Text style={{color:COLORS.subtext}}>Cancelar</Text></TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal visible={modalFirma}>
          <View style={{flex:1, backgroundColor: COLORS.bg}}><FirmaDigital onOK={confirmarCierreConFirma} onCancel={() => setModalFirma(false)} /></View>
      </Modal>
    </View>
  );
}

const InputDark = ({ label, val, set, placeholder, flex, multiline }: any) => (
  <View style={[{ marginBottom: 10 }, flex && { flex: 1, marginRight:5 }]}>
    <Text style={{color:COLORS.subtext, fontSize:12, marginBottom:4}}>{label}</Text>
    <TextInput style={[styles.input, multiline && {height:80}]} value={val} onChangeText={set} placeholder={placeholder} placeholderTextColor="#555" multiline={multiline} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  timerCardNew: { margin: 20, padding: 20, borderRadius: 16, backgroundColor: COLORS.card, elevation: 8 },
  timerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardLabelNew: { color: COLORS.subtext, fontSize: 12, fontWeight: '600' },
  statusBadgeNew: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusTextNew: { color: COLORS.bg, fontSize: 12, fontWeight: 'bold' },
  btnReportarNew: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.warning },
  txtReportarNew: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  mainTimerContainer: { marginVertical: 15 },
  mainTimerText: { color: COLORS.white, fontSize: 48, fontWeight: 'bold' },
  subTimerText: { color: COLORS.subtext, fontSize: 18, marginLeft: 5 },
  progressBarBgNew: { height: 6, backgroundColor: '#0f172a', borderRadius: 3, marginTop: 5 },
  progressBarFillNew: { height: 6, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progressLabelText: { color: COLORS.subtext, fontSize: 10 },
  dividerNew: { height: 1, backgroundColor: '#334155', marginVertical: 15 },
  footerTimer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: COLORS.subtext, fontSize: 14 },
  footerTimerText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  footerSubTimerText: { color: COLORS.subtext, fontSize: 14, marginLeft: 5 },
  mapContainer: { marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, height: 350 },
  bottomBarBig: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', padding: 15, paddingBottom: 25, backgroundColor: COLORS.bg },
  btnBigBase: { flex: 1, borderRadius: 12, padding: 15, justifyContent: 'center' },
  btnBigTitle: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  btnBigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.modalOverlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: 15 },
  labelSection: { color: COLORS.white, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  switch: { flex:1, padding:10, alignItems:'center', borderWidth:1, borderColor: COLORS.border, borderRadius:6, marginHorizontal:2 },
  switchActive: { backgroundColor: COLORS.primary },
  chip: { backgroundColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  btnFullOrange: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  btnText: { fontWeight: 'bold', color: '#000' },
});