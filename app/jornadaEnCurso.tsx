// ─── CAMBIOS RESPECTO AL ORIGINAL ────────────────────────────────────────────
// 1. Eliminado: import { db_firestore, storage } from '../src/services/firebaseConfig'
//               import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
//               import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
//
// 2. subirPdfFirebase() → subirPdfSupabase()
//    Usa supabase.storage en lugar de Firebase Storage.
//    El PDF se sube al bucket 'reportes-pdf' con path:
//    {licencia}/{jornadaId}/Viaje_{jornadaId}.pdf
//
// 3. encolarSync() sigue igual (ya usaba el SyncService propio).
//    SyncService fue actualizado por separado para apuntar a Supabase.
//
// 4. cargarEstado(): USER_SESSION de AsyncStorage → supabase.auth.getSession()
//    para obtener el perfil del operador actual.
//
// 5. sincronizarYFinalizar(): el insert directo a 'rutas_recolectadas' en Supabase
//    ahora incluye el operador_id del usuario autenticado en lugar de la licencia.
//
// 6. Se eliminó todo import de Firebase (firebaseConfig, firestore, storage).
//
// 7. [BUG FIX] sincronizarYFinalizar(): ultimaInspeccion era tratado como objeto
//    cuando en realidad es el resultado de .sort() (sigue siendo un array).
//    Corregido: ultimaInspeccion[0].detalles_json en lugar de ultimaInspeccion.detalles_json
//    y todos los accesos de propiedad apuntan a ultimaInspeccion[0].
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
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
import {
  iniciarRastreoBackground, detenerRastreo, obtenerDireccion,
  validarPermisosRastreoBackground, iniciarNotificacionTemporizador,
  detenerNotificacionTemporizador,
} from '../src/services/LocationService'; 
import {
  iniciarNuevaJornada, finalizarJornada, insertarPausa, insertarIncidencia,
  obtenerDetalleJornada, vincularInspeccionAViaje, obtenerKmTotalesJornada,
  calcularDistanciaTotalKm,
} from '../db/database';
import FirmaDigital from '../src/components/FirmaDigital';
import { generarPdfMaestro } from '../src/services/PdfMaestro';
// ✅ CAMBIADO: supabase reemplaza Firebase storage + firestore
import { supabase } from '../src/services/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { encolarSync, procesarColaSync } from '../src/services/SyncService';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg:           '#010A14',
  card:         '#081D33',
  primary:      '#D4AF37',
  goldBevel:    '#D4AF37',
  gold2:        '#C5A059',
  danger:       '#A70000',
  dangerBright: '#ef4444',
  text:         '#FFFFFF',
  subtext:      '#9DA8B5',
  success:      '#10B981',
  border:       '#12365A',
  border2:      '#2A4A69',
  warning:      '#C5A059',
  white:        '#FFFFFF',
  modalOverlay: 'rgba(1, 10, 20, 0.95)',
  police:       '#3B82F6',
};

const GRADIENTS = {
  cardBg:     ['#12365A', '#081D33', '#030E1A'] as const,
  header:     ['#051C33', '#010A14'] as const,
  saveBtn:    ['#D4AF37', '#C5A059', '#8A6E2F'] as const,
  dangerBtn:  ['#A70000', '#7A0000', '#4A0000'] as const,
  successBtn: ['#065F46', '#064E3B', '#022C22'] as const,
};

const TIPOS_INCIDENCIA = [
  { id: 'puente_bajo',   label: 'Puente Bajo',    icon: 'bridge' },
  { id: 'calle_angosta', label: 'Calle Angosta',   icon: 'road-variant' },
  { id: 'zona_insegura', label: 'Zona Insegura',   icon: 'alert-octagon' },
  { id: 'reten',         label: 'Retén / GN',      icon: 'police-badge' },
  { id: 'otro',          label: 'Otro',             icon: 'pencil' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function JornadaEnCurso() {
  const router = useRouter();

  const [cargando,         setCargando]         = useState(true);
  const [jornadaId,        setJornadaId]        = useState<number | null>(null);
  const [fechaInicio,      setFechaInicio]      = useState<string | null>(null);
  const [visuales,         setVisuales]         = useState({ unidad: '---', operador: '---' });
  const [enPausa,          setEnPausa]          = useState(false);
  const [inicioPausa,      setInicioPausa]      = useState<string | null>(null);
  const [tipoPausaActual,  setTipoPausaActual]  = useState<string | null>(null);

  const [modalRegistro,   setModalRegistro]    = useState(false);
  const [modalPausa,      setModalPausa]       = useState(false);
  const [modalFirma,      setModalFirma]       = useState(false);
  const [modalIncidencia, setModalIncidencia]  = useState(false);
  const [modalQR,         setModalQR]          = useState(false);

  const [formulario, setFormulario] = useState({
    permisionario: '', domicilio: '', tipo_servicio: 'Carga General',
    unidad: '', placas: '', marca: '', modelo: '', modalidad: 'Sencillo',
    remolque1_eco: '', remolque1_placas: '', remolque2_eco: '', remolque2_placas: '',
    operador: '', licencia: '', vigencia: '', origen: '', destino: '',
  });

  const [tipoIncidencia,  setTipoIncidencia]  = useState('Otro');
  const [descIncidencia,  setDescIncidencia]  = useState('');
  const [tiempoManejo,    setTiempoManejo]    = useState('00:00:00');
  const [tiempoTotal,     setTiempoTotal]     = useState('00:00:00');
  const [kmEnRuta,        setKmEnRuta]        = useState<number>(0);

  // ✅ FIX: refs para que los intervals siempre lean valores actuales (evita closure stale)
  const jornadaIdRef   = useRef<number | null>(null);
  const fechaInicioRef = useRef<string | null>(null);
  const enPausaRef     = useRef<boolean>(false);
  useEffect(() => { jornadaIdRef.current   = jornadaId;   }, [jornadaId]);
  useEffect(() => { fechaInicioRef.current = fechaInicio; }, [fechaInicio]);
  useEffect(() => { enPausaRef.current     = enPausa;     }, [enPausa]);

  const urlVerificacion = jornadaId ? `https://bitacora57.com/validar?id=${jornadaId}` : '';
  const qrUrl = jornadaId
    ? `https://api.qrserver.com/v1/create-qrcode/?size=300x300&data=${encodeURIComponent(urlVerificacion)}`
    : '';

  // ─── Timers ───────────────────────────────────────────────────────────────
  useEffect(() => {
    cargarEstado();

    const interval = setInterval(() => {
      // ✅ Lee desde refs — siempre tiene el valor más reciente aunque los states cambien
      if (jornadaIdRef.current && fechaInicioRef.current && !enPausaRef.current) {
        const diff = new Date().getTime() - new Date(fechaInicioRef.current).getTime();
        setTiempoManejo(formatearTiempo(diff));
        setTiempoTotal(formatearTiempo(diff));
      }
    }, 1000);

    const kmInterval = setInterval(async () => {
      if (!jornadaIdRef.current) return;
      try {
        const { getDB } = await import('../db/database');
        const db = await getDB();
        const puntos = await db.getAllAsync(
          'SELECT latitud, longitud FROM puntos_gps WHERE jornada_id = ? ORDER BY id ASC',
          [jornadaIdRef.current]
        );
        setKmEnRuta(calcularDistanciaTotalKm(puntos as any[]));
      } catch (_) {}
    }, 5000);

    return () => { clearInterval(interval); clearInterval(kmInterval); };
  }, []); // ✅ Sin dependencias — los refs se actualizan solos y los intervals los leen frescos

  // ─── Auto-quitar pausa al detectar movimiento ─────────────────────────────
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;

    const monitorear = async () => {
      if (!enPausa) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          if ((loc.coords.speed ?? 0) > 4.16) {
            terminarPausa();
            Alert.alert('Movimiento Detectado', 'La pausa se ha quitado automáticamente al reanudar la marcha.');
          }
        }
      );
    };

    monitorear();
    return () => { sub?.remove(); };
  }, [enPausa]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatearTiempo = (ms: number) => {
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 60000) % 60);
    const h = Math.floor(ms / 3600000 % 24);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ─── Cargar estado ────────────────────────────────────────────────────────
  // ✅ CAMBIADO: USER_SESSION de AsyncStorage → supabase.auth.getSession()
  const cargarEstado = async () => {
    try {
      const id     = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
      const inicio = await AsyncStorage.getItem('CURRENT_JORNADA_START');
      const vis    = await AsyncStorage.getItem('CURRENT_JORNADA_VISUAL');
      const pStart = await AsyncStorage.getItem('CURRENT_PAUSA_START');
      const pType  = await AsyncStorage.getItem('CURRENT_PAUSA_TYPE');

      if (id && inicio) { setJornadaId(Number(id)); setFechaInicio(inicio); }
      if (vis) setVisuales(JSON.parse(vis));
      if (pStart) { setEnPausa(true); setInicioPausa(pStart); setTipoPausaActual(pType || 'Pausa'); }

      if (!id) {
        const presets = await AsyncStorage.getItem('FORM_PRESETS');
        let datosBase: any = presets ? JSON.parse(presets) : {};

        // ✅ CAMBIADO: leer perfil desde Supabase en lugar de AsyncStorage USER_SESSION
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: perfil } = await supabase
              .from('operadores')
              .select('nombre, licencia_numero, empresa')
              .eq('auth_id', session.user.id)
              .maybeSingle();
            if (perfil) {
              datosBase = {
                ...datosBase,
                operador:      perfil.nombre           ?? datosBase.operador      ?? '',
                licencia:      perfil.licencia_numero  ?? datosBase.licencia      ?? '',
                permisionario: perfil.empresa          ?? datosBase.permisionario ?? '',
              };
            }
          }
        } catch (e) {
          console.log('[JornadaEnCurso] No se pudo leer perfil de Supabase, usando presets:', e);
        }

        setFormulario(prev => ({ ...prev, ...datosBase, origen: '', destino: '' }));
      }
    } catch (e) { console.error(e); } finally { setCargando(false); }
  };

  // ─── Iniciar viaje ────────────────────────────────────────────────────────
  const iniciarViaje = async () => {
    if (!formulario.permisionario || !formulario.unidad || !formulario.operador ||
        !formulario.origen || !formulario.destino) {
      Alert.alert('Datos Incompletos', 'Verifica unidad, operador y ruta.'); return;
    }

    const permisosRastreo = await validarPermisosRastreoBackground();
    if (!permisosRastreo.ok) {
      Alert.alert('Permiso requerido', permisosRastreo.message); return;
    }

    await AsyncStorage.removeItem('RUTA_OFFLINE_CACHE');
    setModalRegistro(false);
    const datosParaGuardar = { ...formulario, marca: `${formulario.marca} ${formulario.modelo}` };
    await AsyncStorage.setItem('FORM_PRESETS', JSON.stringify({ ...formulario, origen: '', destino: '' }));

    try {
      const nuevoId = await iniciarNuevaJornada(datosParaGuardar);
      const ahora   = new Date().toISOString();
      await AsyncStorage.setItem('CURRENT_JORNADA_ID',      String(nuevoId));
      await AsyncStorage.setItem('CURRENT_JORNADA_START',   ahora);
      await AsyncStorage.setItem('CURRENT_JORNADA_OPERADOR', formulario.operador);
      await AsyncStorage.setItem('CURRENT_JORNADA_UNIDAD',  formulario.unidad);
      const datosVis = { unidad: formulario.unidad, operador: formulario.operador };
      await AsyncStorage.setItem('CURRENT_JORNADA_VISUAL', JSON.stringify(datosVis));
      setJornadaId(nuevoId); setFechaInicio(ahora); setVisuales(datosVis);

      if (nuevoId) await vincularInspeccionAViaje(Number(nuevoId));

      const rastreo = await iniciarRastreoBackground();
      if (!rastreo.ok) throw new Error(rastreo.message);

      await iniciarNotificacionTemporizador();

      await encolarSync('jornada_inicio', {
        ...datosParaGuardar,
        id_interno:         nuevoId,
        empresa:            formulario.permisionario,
        estatus:            'en_curso',
        fecha_inicio:       ahora,
        fecha_inicio_local: ahora,
      });

      Alert.alert('¡Buen Viaje!', 'Bitácora iniciada.');
    } catch (error: any) {
      Alert.alert('No fue posible iniciar', error?.message ?? 'No se pudo iniciar la jornada.');
    }
  };

  const pedirFirmaCierre = () => {
    if (enPausa) { Alert.alert('Pausa Activa', 'Termina la pausa antes de finalizar.'); return; }
    setModalFirma(true);
  };

  // ─── Subir PDF a Supabase Storage ─────────────────────────────────────────
  // ✅ CAMBIADO: reemplaza subirPdfFirebase() — usa supabase.storage
  const subirPdfSupabase = async (idLocal: number, uriLocal: string) => {
    try {
      const blob        = await (await fetch(uriLocal)).blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const uint8Array  = new Uint8Array(arrayBuffer);
      const licencia    = formulario.licencia || 'anonimo';
      const path        = `${licencia}/${idLocal}/Viaje_${idLocal}.pdf`;

      const { error } = await supabase.storage
        .from('reportes-pdf')
        .upload(path, uint8Array, { contentType: 'application/pdf', upsert: true });

      if (error) throw error;

      const { data: urlData } = await supabase.storage
        .from('reportes-pdf')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (urlData?.signedUrl) {
        await encolarSync('pdf_meta', { id_interno: idLocal, pdf_url: urlData.signedUrl });
      }
    } catch (e) { console.error('[JornadaEnCurso] Error subiendo PDF a Supabase:', e); }
  };

  // ─── Sincronizar y finalizar ──────────────────────────────────────────────
  // ✅ CAMBIADO: usa auth_id real + encolarSync en lugar de writes directos a Firebase
  // 🐛 BUG FIX: ultimaInspeccion es un array tras .sort() — se accede con [0]
  const sincronizarYFinalizar = async (idLocal: number, firmaBase64: string, rutaJsonParam: string | null) => {
    try {
      const dataFull = await obtenerDetalleJornada(idLocal);
      if (!dataFull.jornada) return;

      const { jornada, pausas, incidencias, inspecciones } = dataFull as {
        jornada: any; pausas: any[]; incidencias: any[]; inspecciones: any[];
      };

      const rutaFinalGeojson = rutaJsonParam || jornada.ruta_geojson;

      // ── Calcular km totales ──────────────────────────────────────────────
      let kmTotales = 0;
      if (rutaFinalGeojson) {
        try {
          const parsedData = JSON.parse(rutaFinalGeojson);
          let coordenadas: any[] = [];

          if (parsedData.type === 'Feature') {
            const coords = parsedData.geometry.coordinates;
            const times  = parsedData.properties?.timestamps || [];
            coordenadas  = coords.map((c: any[], i: number) => ({
              latitude: c[1], longitude: c[0], timestamp: times[i] || 0,
            }));
          } else if (Array.isArray(parsedData)) {
            coordenadas = parsedData;
          }

          for (let i = 0; i < coordenadas.length - 1; i++) {
            const p1 = coordenadas[i], p2 = coordenadas[i + 1];
            if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
              kmTotales += getDistanceFromLatLonInKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
            }
          }
          kmTotales = parseFloat(kmTotales.toFixed(2));
        } catch (e) { console.log('[JornadaEnCurso] Error procesando ruta GPS', e); }
      }

      // ── Sello SHA-256 ────────────────────────────────────────────────────
      const payloadSello = JSON.stringify({
        id:           idLocal,
        operador:     jornada?.operador     || '',
        unidad:       jornada?.unidad       || '',
        fecha_inicio: jornada?.fecha_inicio || '',
        // km_totales excluido intencionalmente para hash estable (ver PdfMaestro)
      });
      const selloDigital = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        payloadSello
      );

      // ── 🐛 BUG FIX: leer inspección vinculada ───────────────────────────
      // Antes: se accedía a ultimaInspeccion.detalles_json (undefined, porque es array)
      // Ahora: se accede a ultimaInspeccion[0].detalles_json (correcto)
      let inspeccionData: any = null;
      try {
        const inspeccionesDB: any[] = Array.isArray(inspecciones) ? inspecciones : [];

        if (inspeccionesDB.length > 0) {
          // Ordenar por fecha DESC y tomar el primer elemento
          const sorted         = [...inspeccionesDB].sort(
            (a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
          );
          const ultimaInspeccion = sorted[0]; // ✅ FIX: era sorted sin [0]

          let items: Record<string, any> = {};
          try { items = JSON.parse(ultimaInspeccion.detalles_json || '{}'); } catch (_) {}

          const fechaInsp = ultimaInspeccion.fecha ? new Date(ultimaInspeccion.fecha) : null;

          inspeccionData = {
            fecha:      fechaInsp ? fechaInsp.toISOString().split('T')[0] : '---',
            hora:       fechaInsp ? fechaInsp.toLocaleTimeString('es-MX') : '---',
            tipo:       ultimaInspeccion.tipo        || 'general',
            items,
            comentarios: ultimaInspeccion.comentarios || '',
            estatus:    (ultimaInspeccion.comentarios || '').trim().length > 5
                          ? 'CON OBSERVACIONES'
                          : 'APROBADO',
          };
        }

        // Fallbacks si no se encontró en DB
        if (!inspeccionData) {
          const fechaViaje = jornada?.fecha_inicio ? String(jornada.fecha_inicio).split('T')[0] : null;
          if (fechaViaje) {
            const raw = await AsyncStorage.getItem(`INSPECCION_${fechaViaje}`);
            if (raw) inspeccionData = JSON.parse(raw);
          }
        }
        if (!inspeccionData) {
          const hoy = new Date().toISOString().split('T')[0];
          const raw = await AsyncStorage.getItem(`INSPECCION_${hoy}`);
          if (raw) inspeccionData = JSON.parse(raw);
        }
        if (!inspeccionData) {
          const ultimaFecha = await AsyncStorage.getItem('ULTIMA_INSPECCION');
          if (ultimaFecha) {
            const raw = await AsyncStorage.getItem(`INSPECCION_${ultimaFecha}`);
            if (raw) inspeccionData = JSON.parse(raw);
          }
        }
      } catch (e) {
        console.log('[JornadaEnCurso] Error leyendo inspección para cierre', e);
      }

      // ── Sync offline: jornada finalizada ─────────────────────────────────
      await encolarSync('jornada_fin', {
        ...jornada,
        id_interno:          idLocal,
        empresa:             jornada.permisionario,
        estatus:             'finalizado',
        pausas:              pausas      || [],
        incidencias:         incidencias || [],
        inspeccion:          inspeccionData || 'No registrada',
        ruta_geojson:        rutaFinalGeojson,
        km_totales:          kmTotales,
        servidor_verificado: true,
        firma:               firmaBase64,
        km_calculados:       kmTotales.toFixed(2),
        sello_digital:       selloDigital,
      });

      // ── Sync ruta maestra ─────────────────────────────────────────────────
      await encolarSync('ruta_maestra', {
        id_interno:        idLocal,
        empresa:           jornada.permisionario,
        unidad:            jornada.unidad,
        operador:          jornada.operador,
        origen:            jornada.origen,
        destino:           jornada.destino,
        fecha_inicio:      jornada.fecha_inicio,
        km_totales:        kmTotales,
        estatus:           'finalizado',
        ruta:              rutaFinalGeojson,
        incidencias_count: incidencias ? incidencias.length : 0,
      });

      // ── Supabase: ruta colectiva para inteligencia vial ───────────────────
      // ✅ CAMBIADO: ahora usamos auth_id del usuario autenticado
      try {
        let featureGeoJSON: any = null;
        if (rutaFinalGeojson) {
          const parsedRuta = JSON.parse(rutaFinalGeojson);
          const propsMeta  = {
            id_interno:  idLocal,
            operador:    jornada.operador,
            unidad:      jornada.unidad,
            km_totales:  kmTotales,
            incidencias: incidencias || [],
          };

          if (parsedRuta.type === 'Feature') {
            featureGeoJSON = { ...parsedRuta, properties: { ...parsedRuta.properties, ...propsMeta } };
          } else if (Array.isArray(parsedRuta)) {
            featureGeoJSON = {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: parsedRuta.map((p: any) => [p.longitude || p.lng, p.latitude || p.lat]),
              },
              properties: propsMeta,
            };
          }
        }

        if (featureGeoJSON) {
          const { data: { session } } = await supabase.auth.getSession();
          const { error: supaErr } = await supabase.from('rutas_recolectadas').insert([{
            usuario_id:  session?.user?.id ?? null, // ✅ UUID real
            tipo_unidad: formulario.modalidad || 'Sencillo',
            datos_viaje: featureGeoJSON,
            procesado:   false,
          }]);
          if (supaErr) console.log('[JornadaEnCurso] Error enviando ruta colectiva:', supaErr.message);
        }
      } catch (e) {
        console.log('[JornadaEnCurso] Fallo en envío de ruta colectiva, continuando:', e);
      }

      // ── Generar PDF y subir a Supabase Storage ────────────────────────────
      // ✅ CAMBIADO: subirPdfFirebase → subirPdfSupabase
      const uriPdf = await generarPdfMaestro({ jornadaId: idLocal });
      if (uriPdf) await subirPdfSupabase(idLocal, uriPdf);

      // Intentar procesar cola de sincronización
      procesarColaSync().catch(() => {});

      Alert.alert('Éxito', 'Viaje finalizado y bitácora guardada.');
    } catch (e: any) {
      Alert.alert('Aviso', 'Datos guardados en el dispositivo. ' + (e?.message ?? ''));
    }
  };

  // ─── Confirmar cierre con firma ───────────────────────────────────────────
  const confirmarCierreConFirma = async (firmaBase64: string) => {
    setModalFirma(false);
    setCargando(true);
    try {
      await detenerRastreo();
      await detenerNotificacionTemporizador();
      const kmTotales     = jornadaId ? await obtenerKmTotalesJornada(jornadaId) : 0;
      const rutaJsonParam = await AsyncStorage.getItem('RUTA_OFFLINE_CACHE');

      if (jornadaId) {
        await finalizarJornada(jornadaId, firmaBase64, rutaJsonParam, kmTotales);
        await sincronizarYFinalizar(jornadaId, firmaBase64, rutaJsonParam);
      }

      await AsyncStorage.removeItem('RUTA_OFFLINE_CACHE');
      await AsyncStorage.multiRemove([
        'CURRENT_JORNADA_ID', 'CURRENT_JORNADA_START', 'CURRENT_JORNADA_VISUAL',
        'CURRENT_PAUSA_START', 'CURRENT_PAUSA_TYPE', 'CURRENT_PAUSA_ADDRESS',
      ]);
      router.replace('/home');
    } catch (e) {
      Alert.alert('Error', 'Error al finalizar la jornada.');
    } finally {
      setCargando(false);
    }
  };

  // ─── Pausas ───────────────────────────────────────────────────────────────
  const activarPausa = async (motivo: string) => {
    setModalPausa(false);
    const direccion = await obtenerDireccion();
    const ahora     = new Date().toISOString();
    setEnPausa(true); setInicioPausa(ahora); setTipoPausaActual(motivo);
    await AsyncStorage.setItem('CURRENT_PAUSA_START',   ahora);
    await AsyncStorage.setItem('CURRENT_PAUSA_TYPE',    motivo);
    await AsyncStorage.setItem('CURRENT_PAUSA_ADDRESS', direccion);
  };

  const terminarPausa = async () => {
    if (!inicioPausa || !jornadaId) return;
    const fin      = new Date();
    const inicio   = new Date(inicioPausa);
    const duracion = (fin.getTime() - inicio.getTime()) / 60000;
    const dir      = await AsyncStorage.getItem('CURRENT_PAUSA_ADDRESS') || '';
    await insertarPausa(jornadaId, tipoPausaActual || 'Varios', inicio.toISOString(), fin.toISOString(), duracion, dir);
    await AsyncStorage.multiRemove(['CURRENT_PAUSA_START', 'CURRENT_PAUSA_TYPE', 'CURRENT_PAUSA_ADDRESS']);
    setEnPausa(false); setInicioPausa(null); setTipoPausaActual(null);
  };

  // ─── Incidencias ──────────────────────────────────────────────────────────
  const reportarIncidencia = async () => {
    if (!jornadaId) return;
    setModalIncidencia(false);
    try {
      const direccion = await obtenerDireccion();
      const loc       = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await insertarIncidencia(jornadaId, tipoIncidencia, descIncidencia, null, direccion);

      await encolarSync('incidencia', {
        jornada_id:  jornadaId,
        usuario:     visuales.operador || 'Desconocido',
        tipo:        tipoIncidencia,
        descripcion: descIncidencia,
        ubicacion:   { lat: loc.coords.latitude, lng: loc.coords.longitude },
        direccion,
      });

      setDescIncidencia(''); setTipoIncidencia('Otro');
      Alert.alert('Reportado', 'Incidencia registrada.');
    } catch (e) { Alert.alert('Error', 'No se guardó el reporte.'); }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Tarjeta ELD / Timer ── */}
        <LinearGradient colors={GRADIENTS.cardBg} style={styles.timerCardNew}>
          <View style={styles.timerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="timer-outline" size={18} color={COLORS.subtext} style={{ marginRight: 5 }} />
              <Text style={styles.cardLabelNew}>TIEMPO DE MANEJO</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {jornadaId && !enPausa && (
                <>
                  <TouchableOpacity style={styles.btnReportarNew} onPress={() => setModalIncidencia(true)}>
                    <MaterialCommunityIcons name="alert" size={16} color={COLORS.warning} />
                    <Text style={styles.txtReportarNew}>Reportar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnReportarNew, { borderColor: COLORS.police, backgroundColor: 'rgba(59,130,246,0.1)' }]}
                    onPress={() => setModalQR(true)}
                  >
                    <MaterialCommunityIcons name="qrcode-scan" size={16} color={COLORS.police} />
                    <Text style={[styles.txtReportarNew, { color: COLORS.police }]}>QR Oficial</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'column', alignItems: 'flex-end', marginBottom: 10 }}>
            <View style={[styles.statusBadgeNew, { backgroundColor: enPausa ? COLORS.warning : COLORS.success }]}>
              <Text style={styles.statusTextNew}>{enPausa ? 'EN PAUSA' : 'EN RUTA'}</Text>
            </View>
          </View>

          <View style={styles.mainTimerContainer}>
            {enPausa ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.mainTimerText, { color: COLORS.warning, fontSize: 32 }]}>PAUSA</Text>
                <Text style={{ color: COLORS.subtext, fontSize: 16 }}>{tipoPausaActual}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.mainTimerText}>{tiempoManejo}</Text>
                <Text style={styles.subTimerText}> / 05:00:00</Text>
              </View>
            )}
          </View>

          <View style={styles.progressBarBgNew}>
            <View style={[styles.progressBarFillNew, { width: '30%', backgroundColor: enPausa ? COLORS.warning : COLORS.success }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelText}>INICIO</Text>
            <Text style={styles.progressLabelText}>ALERTA 4.5H</Text>
            <Text style={styles.progressLabelText}>LÍMITE 5H</Text>
          </View>

          <View style={styles.dividerNew} />

          {/* KM en tiempo real */}
          <View style={styles.kmRow}>
            <View style={styles.kmItem}>
              <MaterialCommunityIcons name="map-marker-distance" size={18} color={COLORS.goldBevel} />
              <Text style={styles.kmLabel}>KM RECORRIDOS</Text>
              <Text style={styles.kmValue}>{kmEnRuta.toFixed(1)} <Text style={styles.kmUnit}>km</Text></Text>
            </View>
            <View style={styles.kmDivider} />
            <View style={styles.kmItem}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.goldBevel} />
              <Text style={styles.kmLabel}>JORNADA TOTAL</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.kmValue}>{tiempoTotal}</Text>
                <Text style={styles.kmUnit}> / 14h</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Mapa ── */}
        <View style={styles.mapContainer}>
          <MapaRuta key={jornadaId ? `viaje-${jornadaId}` : 'sin-viaje'} />
        </View>

      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBarBig}>
        {!jornadaId ? (
          <TouchableOpacity style={styles.btnBigWrapper} onPress={() => setModalRegistro(true)}>
            <LinearGradient colors={GRADIENTS.saveBtn} style={styles.btnBigBase}>
              <Text style={styles.btnBigTitle}>INICIAR JORNADA</Text>
              <Text style={styles.btnBigSub}>Configurar nueva ruta y unidad</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.btnBigWrapper, { marginRight: 10 }]}
              onPress={() => enPausa ? terminarPausa() : setModalPausa(true)}
            >
              <LinearGradient
                colors={enPausa ? GRADIENTS.successBtn : GRADIENTS.cardBg}
                style={[styles.btnBigBase, { borderWidth: 1.5, borderColor: enPausa ? COLORS.success : COLORS.border2 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={enPausa ? 'play' : 'pause'} size={24} color="white" style={{ marginRight: 5 }} />
                  <Text style={styles.btnBigTitle}>{enPausa ? 'REANUDAR' : 'PAUSA'}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnBigWrapper, { flex: 0.6 }]} onPress={pedirFirmaCierre}>
              <LinearGradient colors={GRADIENTS.dangerBtn} style={[styles.btnBigBase, { borderWidth: 1.5, borderColor: COLORS.danger }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.btnBigTitle}>FINALIZAR</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ══ Modal: Nuevo Viaje ══ */}
      <Modal visible={modalRegistro} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <LinearGradient colors={['#0D2137', '#051C33', '#010A14']} style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <Text style={styles.sectionHeader}>NUEVO VIAJE</Text>
              <TouchableOpacity onPress={() => setModalRegistro(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.labelSection}>1. Empresa y Carga</Text>
              <InputDark label="Permisionario (Razón Social)" val={formulario.permisionario}
                set={(t: string) => setFormulario({ ...formulario, permisionario: t })} placeholder="Nombre Empresa" />

              <Text style={{ color: COLORS.subtext, fontSize: 12, marginBottom: 4, marginTop: 5 }}>Tipo de Carga (SCT)</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={formulario.tipo_servicio}
                  onValueChange={(val) => setFormulario({ ...formulario, tipo_servicio: val })}
                  style={{ color: COLORS.text }} dropdownIconColor={COLORS.white}>
                  <Picker.Item label="Carga General" value="Carga General" />
                  <Picker.Item label="Material Peligroso (HAZMAT)" value="Material Peligroso" />
                  <Picker.Item label="Refrigerado / Perecedero" value="Refrigerado" />
                  <Picker.Item label="Carga Suelta" value="Carga Suelta" />
                  <Picker.Item label="Granel" value="Granel" />
                </Picker>
              </View>

              <Text style={styles.labelSection}>2. Unidad de Arrastre</Text>
              <View style={styles.row}>
                <InputDark label="No. Unidad" val={formulario.unidad} set={(t: string) => setFormulario({ ...formulario, unidad: t })} flex />
                <InputDark label="Placas" val={formulario.placas} set={(t: string) => setFormulario({ ...formulario, placas: t })} flex />
              </View>
              <View style={styles.row}>
                <InputDark label="Marca" val={formulario.marca} set={(t: string) => setFormulario({ ...formulario, marca: t })} flex />
                <InputDark label="Modelo" val={formulario.modelo} set={(t: string) => setFormulario({ ...formulario, modelo: t })} flex />
              </View>

              <Text style={{ color: COLORS.subtext, fontSize: 12, marginBottom: 4, marginTop: 5 }}>Configuración de Equipo</Text>
              <View style={styles.pickerBox}>
                <Picker selectedValue={formulario.modalidad}
                  onValueChange={(val) => setFormulario({ ...formulario, modalidad: val })}
                  style={{ color: COLORS.text }} dropdownIconColor={COLORS.white}>
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
                    <InputDark label="Eco R1" val={formulario.remolque1_eco} set={(t: string) => setFormulario({ ...formulario, remolque1_eco: t })} flex />
                    <InputDark label="Placas R1" val={formulario.remolque1_placas} set={(t: string) => setFormulario({ ...formulario, remolque1_placas: t })} flex />
                  </View>
                </>
              )}
              {formulario.modalidad === 'Full' && (
                <View style={styles.row}>
                  <InputDark label="Eco R2" val={formulario.remolque2_eco} set={(t: string) => setFormulario({ ...formulario, remolque2_eco: t })} flex />
                  <InputDark label="Placas R2" val={formulario.remolque2_placas} set={(t: string) => setFormulario({ ...formulario, remolque2_placas: t })} flex />
                </View>
              )}

              <Text style={styles.labelSection}>4. Conductor</Text>
              <InputDark label="Nombre" val={formulario.operador} set={(t: string) => setFormulario({ ...formulario, operador: t })} />
              <View style={styles.row}>
                <InputDark label="Licencia" val={formulario.licencia} set={(t: string) => setFormulario({ ...formulario, licencia: t })} flex />
                <InputDark label="Vigencia" val={formulario.vigencia} set={(t: string) => setFormulario({ ...formulario, vigencia: t })} flex />
              </View>

              <Text style={styles.labelSection}>5. Ruta</Text>
              <InputDark label="Origen" val={formulario.origen} set={(t: string) => setFormulario({ ...formulario, origen: t })} />
              <InputDark label="Destino" val={formulario.destino} set={(t: string) => setFormulario({ ...formulario, destino: t })} />

              <TouchableOpacity style={styles.btnFullOrangeWrapper} onPress={iniciarViaje}>
                <LinearGradient colors={GRADIENTS.saveBtn} style={styles.btnFullOrange}>
                  <Text style={styles.btnText}>COMENZAR VIAJE Y RASTREO</Text>
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 60 }} />
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

      {/* ══ Modal: Pausa ══ */}
      <Modal visible={modalPausa} transparent>
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View style={[styles.modalContent, { borderRadius: 20 }]}>
            <Text style={styles.sectionHeader}>Registrar Pausa</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {['Alimentos', 'Descanso', 'Combustible', 'Mecánica'].map((m) => (
                <TouchableOpacity key={m} style={styles.chip} onPress={() => activarPausa(m)}>
                  <Text style={{ color: 'white' }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setModalPausa(false)} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={{ color: COLORS.subtext }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Incidencia ══ */}
      <Modal visible={modalIncidencia} transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 40 }]}>
            <Text style={styles.sectionHeader}>Reportar en Ruta</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {TIPOS_INCIDENCIA.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.chip, tipoIncidencia === t.label && { backgroundColor: COLORS.primary }]}
                  onPress={() => setTipoIncidencia(t.label)}
                >
                  <MaterialCommunityIcons name={t.icon as any} size={16} color="white" style={{ marginRight: 5 }} />
                  <Text style={{ color: 'white' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <InputDark label="Detalles Adicionales (Opcional)" val={descIncidencia} set={setDescIncidencia} multiline />
            <TouchableOpacity style={styles.btnFullOrangeWrapper} onPress={reportarIncidencia}>
              <LinearGradient colors={GRADIENTS.saveBtn} style={styles.btnFullOrange}>
                <Text style={styles.btnText}>ENVIAR REPORTE</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalIncidencia(false)} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={{ color: COLORS.subtext }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: QR Inspección ══ */}
      <Modal visible={modalQR} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ backgroundColor: 'white', padding: 25, borderRadius: 20, alignItems: 'center', width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#000' }}>INSPECCIÓN OFICIAL</Text>
            <Text style={{ fontSize: 12, color: '#555', marginBottom: 20, textAlign: 'center' }}>
              Presente este código a la autoridad para validar la bitácora digital (NOM-087-SCT).
            </Text>
            {qrUrl !== '' && (
              <Image source={{ uri: qrUrl }} style={{ width: 250, height: 250, marginBottom: 20 }} resizeMode="contain" />
            )}
            <Text style={{ fontSize: 10, color: '#999', marginBottom: 20 }}>ID VIAJE: {jornadaId}</Text>
            <TouchableOpacity
              onPress={() => setModalQR(false)}
              style={{ backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 }}
            >
              <Text style={{ fontWeight: 'bold', color: 'white' }}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Firma ══ */}
      <Modal visible={modalFirma}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <FirmaDigital onOK={confirmarCierreConFirma} onCancel={() => setModalFirma(false)} />
        </View>
      </Modal>
    </View>
  );
}

// ─── InputDark ────────────────────────────────────────────────────────────────
const InputDark = ({ label, val, set, placeholder, flex, multiline }: any) => (
  <View style={[{ marginBottom: 10 }, flex && { flex: 1, marginRight: 5 }]}>
    <Text style={{ color: COLORS.subtext, fontSize: 12, marginBottom: 4 }}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && { height: 80 }]}
      value={val}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor="#555"
      multiline={multiline}
    />
  </View>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  timerCardNew: {
    margin: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.border2, padding: 20, elevation: 8,
  },
  timerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardLabelNew: { color: COLORS.subtext, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  statusBadgeNew: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusTextNew: { color: COLORS.bg, fontSize: 12, fontWeight: 'bold' },
  btnReportarNew: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.warning,
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  txtReportarNew: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  mainTimerContainer: { marginVertical: 15 },
  mainTimerText: { color: COLORS.white, fontSize: 48, fontWeight: 'bold' },
  subTimerText: { color: COLORS.subtext, fontSize: 18, marginLeft: 5 },
  progressBarBgNew: { height: 6, backgroundColor: '#0f172a', borderRadius: 3, marginTop: 5 },
  progressBarFillNew: { height: 6, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progressLabelText: { color: COLORS.subtext, fontSize: 10 },
  dividerNew: { height: 1, backgroundColor: COLORS.border, marginVertical: 15 },
  kmRow: { flexDirection: 'row', alignItems: 'center' },
  kmItem: { flex: 1, alignItems: 'center', gap: 4 },
  kmDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  kmLabel: { color: COLORS.subtext, fontSize: 10, letterSpacing: 1, marginTop: 2 },
  kmValue: { color: COLORS.goldBevel, fontSize: 22, fontWeight: 'bold' },
  kmUnit: { color: COLORS.subtext, fontSize: 12, fontWeight: 'normal' },
  mapContainer: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.border2, height: 350,
  },
  bottomBarBig: {
    position: 'absolute', bottom: 0, width: '100%',
    flexDirection: 'row', padding: 15, paddingBottom: 25,
    backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  btnBigWrapper: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnBigBase: { flex: 1, borderRadius: 12, padding: 15, justifyContent: 'center' },
  btnBigTitle: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  btnBigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.modalOverlay, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
    borderTopWidth: 1, borderColor: COLORS.border2,
  },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: COLORS.goldBevel, marginBottom: 15, letterSpacing: 1 },
  labelSection: { color: COLORS.white, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  input: {
    backgroundColor: COLORS.bg, color: COLORS.text,
    borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pickerBox: {
    backgroundColor: COLORS.bg, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border2, marginBottom: 10, overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
  },
  btnFullOrangeWrapper: { borderRadius: 10, overflow: 'hidden', marginTop: 15 },
  btnFullOrange: { padding: 15, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#010A14', fontSize: 15 },
  footerTimer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: COLORS.subtext, fontSize: 14 },
  footerTimerText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  footerSubTimerText: { color: COLORS.subtext, fontSize: 14, marginLeft: 5 },
});
