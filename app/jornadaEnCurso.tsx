import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, 
  TextInput, StatusBar, Alert, ActivityIndicator, Image 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location'; 
import * as Crypto from 'expo-crypto';
import { Picker } from '@react-native-picker/picker'; 
import MapaRuta from './mapaRuta'; 
import { iniciarRastreoBackground, detenerRastreo, obtenerDireccion, validarPermisosRastreoBackground, iniciarNotificacionTemporizador, detenerNotificacionTemporizador } from '../src/services/LocationService'; 
import { iniciarNuevaJornada, finalizarJornada, insertarPausa, insertarIncidencia, obtenerDetalleJornada, vincularInspeccionAViaje, obtenerKmTotalesJornada } from '../db/database';
import FirmaDigital from '../src/components/FirmaDigital';
import { generarPDF } from '../src/services/PdfGenerator'; 
import { db_firestore, storage } from '../src/services/firebaseConfig';
import { doc, setDoc, serverTimestamp, updateDoc, collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { supabase } from '../src/services/supabaseClient';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', danger: '#7f1d1d',  
  text: '#f8fafc', subtext: '#94a3b8', success: '#10b981', 
  border: '#334155', warning: '#f97316', white: '#ffffff',
  modalOverlay: 'rgba(15, 23, 42, 0.95)',
  police: '#3b82f6' 
};

const TIPOS_INCIDENCIA = [
  { id: 'puente_bajo', label: 'Puente Bajo', icon: 'bridge' },
  { id: 'calle_angosta', label: 'Calle Angosta', icon: 'road-variant' },
  { id: 'zona_insegura', label: 'Zona Insegura', icon: 'alert-octagon' },
  { id: 'reten', label: 'Retén / GN', icon: 'police-badge' },
  { id: 'otro', label: 'Otro', icon: 'pencil' }
];

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
  const [modalQR, setModalQR] = useState(false);
  
  const [formulario, setFormulario] = useState({
    permisionario: '', domicilio: '', tipo_servicio: 'Carga General', 
    unidad: '', placas: '', marca: '', modelo: '', modalidad: 'Sencillo', 
    remolque1_eco: '', remolque1_placas: '', remolque2_eco: '', remolque2_placas: '', 
    operador: '', licencia: '', vigencia: '', origen: '', destino: ''
  });

  const [tipoIncidencia, setTipoIncidencia] = useState('Otro');
  const [descIncidencia, setDescIncidencia] = useState('');
  const [tiempoManejo, setTiempoManejo] = useState('00:00:00');
  const [tiempoTotal, setTiempoTotal] = useState('00:00:00');

  const urlVerificacion = jornadaId
    ? `https://bitacora57.com/validar?id=${jornadaId}`
    : '';

  const qrUrl = jornadaId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlVerificacion)}`
    : '';

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

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const monitorearVelocidad = async () => {
      if (enPausa) {
        locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
          (location) => {
            const velocidad = location.coords.speed || 0;
            if (velocidad > 4.16) { // aprox 15 km/h
              terminarPausa();
              Alert.alert("Movimiento Detectado", "La pausa se ha quitado automáticamente al reanudar la marcha.");
            }
          }
        );
      }
    };
    monitorearVelocidad();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, [enPausa]);

  const formatearTiempo = (ms: number) => {
    const segundos = Math.floor((ms / 1000) % 60);
    const minutos = Math.floor((ms / (1000 * 60)) % 60);
    const horas = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
        let datosBase: any = {};
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

    const permisosRastreo = await validarPermisosRastreoBackground();
    if (!permisosRastreo.ok) {
      Alert.alert("Permiso requerido", permisosRastreo.message);
      return;
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
        await AsyncStorage.setItem('CURRENT_JORNADA_OPERADOR', formulario.operador);
        await AsyncStorage.setItem('CURRENT_JORNADA_UNIDAD', formulario.unidad);
        const datosVis = { unidad: formulario.unidad, operador: formulario.operador };
        await AsyncStorage.setItem('CURRENT_JORNADA_VISUAL', JSON.stringify(datosVis));
        setJornadaId(nuevoId); setFechaInicio(ahora); setVisuales(datosVis);
        if (nuevoId) {
            await vincularInspeccionAViaje(Number(nuevoId));
        }
        const rastreo = await iniciarRastreoBackground();
        if (!rastreo.ok) {
          throw new Error(rastreo.message);
        }
        
        await iniciarNotificacionTemporizador();
        
        const datosInicioNube = {
            ...datosParaGuardar,
            id_interno: nuevoId,
            empresa: formulario.permisionario,
            estatus: 'en_curso',
            fecha_inicio: ahora,
            fecha_inicio_local: ahora,
            fecha_inicio_server: serverTimestamp(),
            ultima_sincronizacion: serverTimestamp()
        };
        await setDoc(doc(db_firestore, "jornadas", String(nuevoId)), datosInicioNube);

        Alert.alert("¡Buen Viaje!", "Bitácora iniciada.");
    } catch (error: any) {
      const message = error?.message || "No se pudo iniciar la jornada.";
      Alert.alert("No fue posible iniciar", message);
    }
  };

  const pedirFirmaCierre = () => { 
    if (enPausa) { Alert.alert("Pausa Activa", "Termina la pausa antes de finalizar."); return; } 
    setModalFirma(true); 
  };

  const subirPdfFirebase = async (idLocal: number, uriLocal: string) => {
    try {
      const response = await fetch(uriLocal);
      const blob = await response.blob();
      const storageRef = ref(storage, `reportes_v2/${formulario.licencia || 'anonimo'}/Viaje_${idLocal}.pdf`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db_firestore, "jornadas", String(idLocal)), { pdf_url: downloadURL });
      try {
        await updateDoc(doc(db_firestore, "rutas_maestras", String(idLocal)), { pdf_url: downloadURL });
      } catch (e) { console.log("No existe ruta maestra aún"); }
    } catch (e) { console.error("Error subiendo PDF:", e); }
  };

  const sincronizarYFinalizar = async (idLocal: number, firmaBase64: string, rutaJson: string | null) => {
    try {
      const dataFull = await obtenerDetalleJornada(idLocal);
      if (!dataFull.jornada) return;
      const { jornada, pausas, incidencias, inspecciones }: {jornada:any, pausas:any, incidencias:any, inspecciones:any[]} = dataFull;

      let inspeccionData: any = null;
      try {
        const inspeccionesDB = Array.isArray(inspecciones) ? inspecciones : [];
        if (inspeccionesDB.length > 0) {
          const ultimaInspeccion = [...inspeccionesDB].sort(
            (a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
          )[0];
          let items = {};
          try { items = JSON.parse(ultimaInspeccion.detalles_json || '{}'); } catch (e) {}
          const fechaInspeccion = ultimaInspeccion.fecha ? new Date(ultimaInspeccion.fecha) : null;
          inspeccionData = {
            fecha: fechaInspeccion ? fechaInspeccion.toISOString().split('T')[0] : '---',
            hora: fechaInspeccion ? fechaInspeccion.toLocaleTimeString() : '---',
            tipo: ultimaInspeccion.tipo || 'general',
            items,
            comentarios: ultimaInspeccion.comentarios || '',
            estatus: (ultimaInspeccion.comentarios || '').trim().length > 5 ? 'CON OBSERVACIONES' : 'APROBADO'
          };
        }

        if (!inspeccionData) {
          const fechaViaje = jornada?.fecha_inicio ? String(jornada.fecha_inicio).split('T')[0] : null;
          if (fechaViaje) {
            const inspeccionRaw = await AsyncStorage.getItem(`INSPECCION_${fechaViaje}`);
            if (inspeccionRaw) inspeccionData = JSON.parse(inspeccionRaw);
          }
        }

        if (!inspeccionData) {
          const hoy = new Date().toISOString().split('T')[0];
          const inspeccionRaw = await AsyncStorage.getItem(`INSPECCION_${hoy}`);
          if (inspeccionRaw) inspeccionData = JSON.parse(inspeccionRaw);
        }

        if (!inspeccionData) {
          const ultimaFecha = await AsyncStorage.getItem('ULTIMA_INSPECCION');
          if (ultimaFecha) {
            const inspeccionRaw = await AsyncStorage.getItem(`INSPECCION_${ultimaFecha}`);
            if (inspeccionRaw) inspeccionData = JSON.parse(inspeccionRaw);
          }
        }
      } catch (e) {
        console.log("Error leyendo inspección para cierre", e);
      }

      let puntosIntermedios = [];
      let distanciaCalculada = 0; 

      if (pausas && pausas.length > 0) {
          puntosIntermedios = pausas.map((p: any) => ({
              tipo: 'PAUSA', hora: p.inicio, ubicacion: p.direccion || 'Ubicación registrada', detalle: p.motivo, lat: 0, lng: 0 
          }));
      }

      if (rutaJson) {
          try {
              const coordenadas = JSON.parse(rutaJson);
              if (Array.isArray(coordenadas) && coordenadas.length > 0) {
                  const paso = Math.max(1, Math.floor(coordenadas.length / 10));
                  for (let i = 0; i < coordenadas.length - 1; i++) {
                      const p1 = coordenadas[i];
                      const p2 = coordenadas[i+1];
                      if(p1.latitude && p1.longitude && p2.latitude && p2.longitude){
                          distanciaCalculada += getDistanceFromLatLonInKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
                      }
                  }
                  for (let i = 0; i < coordenadas.length; i += paso) {
                      const pt = coordenadas[i];
                      if(pt && pt.latitude && pt.longitude) {
                          let horaSafe = pt.timestamp ? new Date(pt.timestamp).toISOString() : new Date().toISOString(); 
                          puntosIntermedios.push({
                              tipo: 'RASTREO', hora: horaSafe, ubicacion: `${pt.latitude.toFixed(5)}, ${pt.longitude.toFixed(5)}`,
                              lat: pt.latitude, lng: pt.longitude, detalle: 'En ruta'
                          });
                      }
                  }
              }
          } catch (e) { console.log("Error procesando ruta GPS", e); }
      }

      const kmTotales = parseFloat(distanciaCalculada.toFixed(2));
      const kmTotalesStr = kmTotales.toFixed(2);
      const datosParaSello = JSON.stringify({
        id: idLocal,
        operador: jornada?.operador || '',
        unidad: jornada?.unidad || '',
        fecha_inicio: jornada?.fecha_inicio || '',
        km_totales: kmTotales
      });
      const selloDigital = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        datosParaSello
      );

      await setDoc(doc(db_firestore, "jornadas", String(idLocal)), {
          ...jornada, id_interno: idLocal, empresa: jornada.permisionario, estatus: 'finalizado',
          pausas: pausas || [], incidencias: incidencias || [], inspeccion: inspeccionData || "No registrada",
          puntos_rastreo: puntosIntermedios, ruta_geojson: rutaJson, ultima_sincronizacion: serverTimestamp(),
          km_totales: kmTotales,
          servidor_verificado: true, firma: firmaBase64, km_calculados: kmTotalesStr,
          fecha_fin_server: serverTimestamp(), sello_digital: selloDigital
        });
      
      await setDoc(doc(db_firestore, "rutas_maestras", String(idLocal)), {
          id_interno: idLocal, empresa: jornada.permisionario, unidad: jornada.unidad, operador: jornada.operador,
          origen: jornada.origen, destino: jornada.destino, fecha_inicio: jornada.fecha_inicio, fecha_fin: serverTimestamp(),
          km_totales: kmTotales, estatus: 'finalizado', ruta: rutaJson, 
          incidencias_count: incidencias ? incidencias.length : 0
      });

       try {
        const { error: supabaseError } = await supabase
          .from('rutas_recolectadas')
          .insert([
            {
              usuario_id: jornada.licencia || 'anonimo',
              tipo_unidad: formulario.modalidad || 'Sencillo', 
              datos_viaje: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: rutaJson ? JSON.parse(rutaJson).map((p: any) => [p.longitude, p.latitude]) : []
                },
                properties: {
                  id_interno: idLocal,
                  operador: jornada.operador,
                  unidad: jornada.unidad,
                  km_totales: kmTotales,
                  incidencias: incidencias || []
                }
              },
              procesado: false
            }
          ]);
        if (supabaseError) console.log("Error enviando a Supabase:", supabaseError.message);
      } catch (e) {
        console.log("Fallo crítico en envío a Supabase, pero continuamos con el flujo original", e);
      }
      
      const uriPdf = await generarPDF({...jornada, firma: firmaBase64, km_totales: kmTotalesStr}, pausas, incidencias, inspeccionData, puntosIntermedios); 
      if (uriPdf) { await subirPdfFirebase(idLocal, uriPdf); }
      Alert.alert("Éxito", "Viaje finalizado.");

    } catch (e: any) { 
        Alert.alert("Aviso", "Datos guardados en celular. " + e.message);
    }
  };

  const confirmarCierreConFirma = async (firmaBase64: string) => {
    setModalFirma(false); 
    setCargando(true);
    try {
        await detenerRastreo();
        await detenerNotificacionTemporizador();
        const kmTotales = jornadaId ? await obtenerKmTotalesJornada(jornadaId) : 0;
        const rutaJson = await AsyncStorage.getItem('RUTA_OFFLINE_CACHE');
        if(jornadaId) {
            await finalizarJornada(jornadaId, firmaBase64, rutaJson, kmTotales);
            await sincronizarYFinalizar(jornadaId, firmaBase64, rutaJson);
        }
        await AsyncStorage.removeItem('RUTA_OFFLINE_CACHE');
        await AsyncStorage.multiRemove([
          'CURRENT_JORNADA_ID', 'CURRENT_JORNADA_START', 'CURRENT_JORNADA_VISUAL', 
          'CURRENT_PAUSA_START', 'CURRENT_PAUSA_TYPE', 'CURRENT_PAUSA_ADDRESS'
        ]);
        router.replace('/home');
    } catch (e) { Alert.alert("Error", "Error al finalizar."); } finally { setCargando(false); }
  };

  const activarPausa = async (motivo: string) => {
    setModalPausa(false); 
    const direccion = await obtenerDireccion();
    const ahora = new Date().toISOString();
    setEnPausa(true); setInicioPausa(ahora); setTipoPausaActual(motivo);
    await AsyncStorage.setItem('CURRENT_PAUSA_START', ahora); 
    await AsyncStorage.setItem('CURRENT_PAUSA_TYPE', motivo);
    await AsyncStorage.setItem('CURRENT_PAUSA_ADDRESS', direccion); 
  };

  const terminarPausa = async () => {
    if (!inicioPausa || !jornadaId) return;
    const fin = new Date(); 
    const inicio = new Date(inicioPausa);
    const duracion = (fin.getTime() - inicio.getTime()) / 60000;
    const direccionGuardada = await AsyncStorage.getItem('CURRENT_PAUSA_ADDRESS') || '';

    await insertarPausa(jornadaId, tipoPausaActual || 'Varios', inicio.toISOString(), fin.toISOString(), duracion, direccionGuardada);

    await AsyncStorage.multiRemove(['CURRENT_PAUSA_START', 'CURRENT_PAUSA_TYPE', 'CURRENT_PAUSA_ADDRESS']);
    setEnPausa(false); setInicioPausa(null); setTipoPausaActual(null);
  };

  const reportarIncidencia = async () => {
    if (!jornadaId) return; 
    setModalIncidencia(false);
    try { 
      const direccion = await obtenerDireccion();
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      
      await insertarIncidencia(jornadaId, tipoIncidencia, descIncidencia, null, direccion); 

      await addDoc(collection(db_firestore, `reportes_ruta`), {
          jornada_id: jornadaId, usuario: visuales.operador || 'Desconocido', tipo: tipoIncidencia,
          descripcion: descIncidencia, ubicacion: { lat, lng }, direccion: direccion, timestamp: serverTimestamp()
      });

      setDescIncidencia(''); setTipoIncidencia('Otro');
      Alert.alert("Reportado", "Incidencia registrada."); 
    } catch (e) { Alert.alert("Error", "No se guardó el reporte."); }
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
            <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                {jornadaId && !enPausa && (
                  <>
                    <TouchableOpacity style={styles.btnReportarNew} onPress={() => setModalIncidencia(true)}>
                      <MaterialCommunityIcons name="alert" size={16} color={COLORS.warning} />
                      <Text style={styles.txtReportarNew}>Reportar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnReportarNew, {borderColor: COLORS.police, backgroundColor: 'rgba(59, 130, 246, 0.1)'}]} onPress={() => setModalQR(true)}>
                      <MaterialCommunityIcons name="qrcode-scan" size={16} color={COLORS.police} />
                      <Text style={[styles.txtReportarNew, {color: COLORS.police}]}>QR Oficial</Text>
                    </TouchableOpacity>
                  </>
                )}
            </View>
          </View>
          
          <View style={{flexDirection:'column', alignItems:'flex-end', marginBottom:10}}>
                <View style={[styles.statusBadgeNew, {backgroundColor: enPausa ? COLORS.warning : COLORS.success}]}>
                    <Text style={styles.statusTextNew}>{enPausa ? "EN PAUSA" : "EN RUTA"}</Text>
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
             <Text style={styles.btnBigTitle}>INICIAR JORNADA</Text><Text style={styles.btnBigSub}>Configurar nueva ruta y unidad</Text>
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
                    
                    <Text style={styles.labelSection}>1. Empresa y Carga</Text>
                    <InputDark label="Permisionario (Razón Social)" val={formulario.permisionario} set={(t:string)=>setFormulario({...formulario, permisionario: t})} placeholder="Nombre Empresa" />
                    
                    <Text style={{color:COLORS.subtext, fontSize:12, marginBottom:4, marginTop: 5}}>Tipo de Carga (SCT)</Text>
                    <View style={styles.pickerBox}>
                      <Picker 
                        selectedValue={formulario.tipo_servicio} 
                        onValueChange={(val) => setFormulario({...formulario, tipo_servicio: val})} 
                        style={{color: COLORS.text}} 
                        dropdownIconColor={COLORS.white}
                      >
                        <Picker.Item label="Carga General" value="Carga General" />
                        <Picker.Item label="Material Peligroso (HAZMAT)" value="Material Peligroso" />
                        <Picker.Item label="Refrigerado / Perecedero" value="Refrigerado" />
                        <Picker.Item label="Carga Suelta" value="Carga Suelta" />
                        <Picker.Item label="Granel" value="Granel" />
                      </Picker>
                    </View>

                    <Text style={styles.labelSection}>2. Unidad de Arrastre</Text>
                    <View style={styles.row}>
                        <InputDark label="No. Unidad" val={formulario.unidad} set={(t:string)=>setFormulario({...formulario, unidad: t})} flex />
                        <InputDark label="Placas" val={formulario.placas} set={(t:string)=>setFormulario({...formulario, placas: t})} flex />
                    </View>
                    <View style={styles.row}>
                        <InputDark label="Marca" val={formulario.marca} set={(t:string)=>setFormulario({...formulario, marca: t})} flex />
                        <InputDark label="Modelo" val={formulario.modelo} set={(t:string)=>setFormulario({...formulario, modelo: t})} flex />
                    </View>

                    <Text style={{color:COLORS.subtext, fontSize:12, marginBottom:4, marginTop: 5}}>Configuración de Equipo</Text>
                    <View style={styles.pickerBox}>
                      <Picker 
                        selectedValue={formulario.modalidad} 
                        onValueChange={(val) => setFormulario({...formulario, modalidad: val})} 
                        style={{color: COLORS.text}} 
                        dropdownIconColor={COLORS.white}
                      >
                        <Picker.Item label="Sencillo (1 Remolque)" value="Sencillo" />
                        <Picker.Item label="Full (Doble Articulado)" value="Full" />
                        <Picker.Item label="Torton / Rabón" value="Torton" />
                        <Picker.Item label="Exceso de Dimensiones" value="Exceso de Dimensiones" />
                      </Picker>
                    </View>

                    {(formulario.modalidad === 'Sencillo' || formulario.modalidad === 'Full' || formulario.modalidad === 'Exceso de Dimensiones') && (
                      <>
                        <Text style={styles.labelSection}>3. Remolques</Text>
                        <View style={styles.row}>
                            <InputDark label="Eco R1" val={formulario.remolque1_eco} set={(t:string)=>setFormulario({...formulario, remolque1_eco: t})} flex />
                            <InputDark label="Placas R1" val={formulario.remolque1_placas} set={(t:string)=>setFormulario({...formulario, remolque1_placas: t})} flex />
                        </View>
                      </>
                    )}
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
                    
                    <TouchableOpacity style={styles.btnFullOrange} onPress={iniciarViaje}><Text style={styles.btnText}>COMENZAR VIAJE Y RASTREO</Text></TouchableOpacity>
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
              <View style={[styles.modalContent, { paddingBottom: 40 }]}>
                  <Text style={styles.sectionHeader}>Reportar en Ruta</Text>
                  <View style={{flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom: 20}}>
                      {TIPOS_INCIDENCIA.map((t) => (
                          <TouchableOpacity key={t.id} style={[styles.chip, tipoIncidencia === t.label && { backgroundColor: COLORS.primary }]} onPress={() => setTipoIncidencia(t.label)}>
                              <MaterialCommunityIcons name={t.icon as any} size={16} color="white" style={{marginRight: 5}}/>
                              <Text style={{color:'white'}}>{t.label}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
                  <InputDark label="Detalles Adicionales (Opcional)" val={descIncidencia} set={setDescIncidencia} multiline />
                  <TouchableOpacity style={styles.btnFullOrange} onPress={reportarIncidencia}><Text style={styles.btnText}>ENVIAR REPORTE</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>setModalIncidencia(false)} style={{marginTop:20, alignSelf:'center'}}><Text style={{color:COLORS.subtext}}>Cancelar</Text></TouchableOpacity>
              </View>
          </View>
      </Modal>

      <Modal visible={modalQR} transparent animationType="fade">
          <View style={[styles.modalOverlay, {justifyContent:'center', alignItems:'center'}]}>
              <View style={{backgroundColor: 'white', padding: 25, borderRadius: 20, alignItems:'center', width:'85%'}}>
                  <Text style={{fontSize:18, fontWeight:'bold', marginBottom:10, color:'#000'}}>INSPECCIÓN OFICIAL</Text>
                  <Text style={{fontSize:12, color:'#555', marginBottom:20, textAlign:'center'}}>
                      Presente este código a la autoridad para validar la bitácora digital (NOM-087-SCT).
                  </Text>
                  {qrUrl !== '' && (
                    <Image source={{uri: qrUrl}} style={{width: 250, height: 250, marginBottom: 20}} resizeMode="contain" />
                  )}
                  <Text style={{fontSize:10, color:'#999', marginBottom:20}}>ID VIAJE: {jornadaId}</Text>
                  <TouchableOpacity onPress={()=>setModalQR(false)} style={{backgroundColor: COLORS.primary, paddingVertical:12, paddingHorizontal:30, borderRadius:25}}><Text style={{fontWeight:'bold', color:'white'}}>CERRAR</Text></TouchableOpacity>
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
  pickerBox: { backgroundColor: COLORS.bg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' }, // Estilo para los menús
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  btnFullOrange: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  btnText: { fontWeight: 'bold', color: '#000' },
});
