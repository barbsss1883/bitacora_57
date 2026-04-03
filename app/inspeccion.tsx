import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, Polyline, G } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDB } from '../db/database'; 

// =========================================================================
// MOTOR GRÁFICO (BLINDADO Y OPTIMIZADO)
// =========================================================================
const graphHeight = 140; 
const rowHeight = graphHeight / 4;
const ANCHO_TOTAL = 1100; 
const MINUTOS_DIA = 1440;
const ESPACIO_SUPERIOR = 35; 

const LINEAS_HORIZONTALES = [1, 2, 3];

const TICKS_CUADRICULA: number[] = [];
for (let i = 0; i <= 96; i++) {
  TICKS_CUADRICULA.push(i);
}

const coordenadasY: { [key: string]: number } = { 
  'FS': rowHeight * 0.5, 
  'DESC': rowHeight * 1.5, 
  'COND': rowHeight * 2.5, 
  'SERV': rowHeight * 3.5 
};

const horaAX = (horas: number, min: number) => {
  return (((horas * 60) + min) / MINUTOS_DIA) * ANCHO_TOTAL;
};

// SALVAVIDAS: Arregla formato de fecha para Android
const parseDateSeguro = (dateStr: any) => {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'string') {
    const safeStr = dateStr.replace(' ', 'T');
    const d = new Date(safeStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof dateStr === 'number') return new Date(dateStr);
  return new Date();
};

const parseHoraSegura = (horaStr: any) => {
  if (!horaStr || typeof horaStr !== 'string' || !horaStr.includes(':')) return { h: 0, m: 0 };
  const partes = horaStr.split(':');
  const hNum = Number(partes);
  const mNum = Number(partes);
  return { h: isNaN(hNum) ? 0 : hNum, m: isNaN(mNum) ? 0 : mNum };
};

const generarGrafica = (registros: any[], tiempoActual: Date, esActivo: boolean) => {
  if (!registros || !Array.isArray(registros) || registros.length === 0) return "";
  
  let puntos: string[] = [];
  const primerRegistro = registros || {};
  let estadoActual = primerRegistro.estado || 'FS';
  
  const horaObj0 = parseHoraSegura(primerRegistro.hora);
  let xAnterior = horaAX(horaObj0.h, horaObj0.m);
  
  puntos.push(`${xAnterior},${coordenadasY[estadoActual] || coordenadasY['FS']}`);

  for (let i = 1; i < registros.length; i++) {
    const reg = registros[i] || {};
    const horaObj = parseHoraSegura(reg.hora);
    const xNuevo = horaAX(horaObj.h, horaObj.m);
    
    const yNuevo = coordenadasY[reg.estado] || coordenadasY['FS'];
    const yAnterior = coordenadasY[estadoActual] || coordenadasY['FS'];
    
    puntos.push(`${xNuevo},${yAnterior}`); 
    puntos.push(`${xNuevo},${yNuevo}`);    
    
    estadoActual = reg.estado || 'FS';
    xAnterior = xNuevo;
  }
  
  if (esActivo && tiempoActual) {
    const xAhora = horaAX(tiempoActual.getHours(), tiempoActual.getMinutes());
    puntos.push(`${xAhora},${coordenadasY[estadoActual] || coordenadasY['FS']}`);
  } else {
    puntos.push(`${ANCHO_TOTAL},${coordenadasY[estadoActual] || coordenadasY['FS']}`);
  }
  
  const resultadoFinal = puntos.join(" ");
  if (resultadoFinal.includes("NaN")) return "";
  
  return resultadoFinal;
};

// NUEVA FUNCIÓN: Agrega la hora para diferenciar viajes del mismo día
const formatearFecha = (fechaStr: string) => {
  if (!fechaStr) return '--';
  const d = parseDateSeguro(fechaStr);
  const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  
  let horas = d.getHours();
  const minutos = d.getMinutes().toString().padStart(2, '0');
  const ampm = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12;
  horas = horas ? horas : 12; 
  const horaStrFormat = `${horas.toString().padStart(2, '0')}:${minutos} ${ampm}`;

  return `${fecha} - ${horaStrFormat}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PantallaELD() {
  const router = useRouter();
  const [puntosGrafico, setPuntosGrafico] = useState("");
  const [horaActual, setHoraActual] = useState(new Date());
  const [eventosDelDia, setEventosDelDia] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [datosJornada, setDatosJornada] = useState<any>({});

  const pan = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      cargarDatosIniciales();
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  // EFECTO MAESTRO: Actualiza Reloj Y Base de Datos al mismo tiempo
  useEffect(() => {
    const tic = setInterval(() => {
      setHoraActual(new Date());
      // Si estamos viendo la pantalla de HOY, recargamos las pausas en vivo
      if (currentIndex === 0 && datosJornada?.id) {
        sincronizarBDEnVivo();
      }
    }, 30000); // Cada 30 segundos
    return () => clearInterval(tic);
  }, [currentIndex, datosJornada?.id]);

  useEffect(() => {
    if (eventosDelDia.length > 0) {
      const esActivo = currentIndex === 0; // Se dibuja en vivo SOLO si estamos viendo el día actual (HOY)
      setPuntosGrafico(generarGrafica(eventosDelDia, horaActual, esActivo));
    }
  }, [horaActual, eventosDelDia, currentIndex]);

  const cargarDatosIniciales = async () => {
    try {
      const db = await getDB();
      let lista: any[] = [];
      
      const activa = await db.getFirstAsync("SELECT * FROM jornadas WHERE estatus = 'activo' ORDER BY id DESC LIMIT 1");
      if (activa) lista.push(activa);

      const queryHistorial = activa 
        ? `SELECT * FROM jornadas WHERE id != ${activa.id} ORDER BY id DESC LIMIT 7`
        : `SELECT * FROM jornadas ORDER BY id DESC LIMIT 7`;
        
      const historialDb = await db.getAllAsync(queryHistorial);
      if (historialDb && historialDb.length > 0) {
        lista = [...lista, ...historialDb];
      }

      if (lista.length > 0) {
        setHistorial(lista);
        procesarJornada(lista, 0, db);
      } else {
        setDatosJornada({ operador: 'SIN VIAJE ACTIVO', estatus: 'inactivo', fecha_inicio: new Date().toISOString() });
        setEventosDelDia([{ hora: "00:00", estado: "FS" }]);
      }
    } catch (e) { console.log("Error DB Inicial:", e); }
  };

  // Función para re-leer la DB sin reiniciar la vista
  const sincronizarBDEnVivo = async () => {
    try {
      const db = await getDB();
      const pausas = await db.getAllAsync('SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC', [datosJornada.id]);
      const fIni = parseDateSeguro(datosJornada.fecha_inicio);
      
      let timeline = [
        { hora: "00:00", estado: "FS", ts: new Date(fIni).setHours(0,0,0,0) },
        { hora: `${fIni.getHours().toString().padStart(2, '0')}:${fIni.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: fIni.getTime() }
      ];
      
      (pausas || []).forEach(p => {
        if (!p.inicio) return;
        const d = parseDateSeguro(p.inicio);
        timeline.push({ hora: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, estado: p.motivo?.toLowerCase().includes('dormir') ? 'DESC' : 'FS', ts: d.getTime() });
        if (p.fin) {
          const df = parseDateSeguro(p.fin);
          timeline.push({ hora: `${df.getHours().toString().padStart(2, '0')}:${df.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: df.getTime() });
        }
      });
      setEventosDelDia(timeline.sort((a,b) => a.ts - b.ts));
    } catch (e) {}
  };

  const ejecutarAnimacionPaseHoja = (esHaciaAtras: boolean, alFinalizar: () => void) => {
    const offsetOutput = esHaciaAtras ? -SCREEN_WIDTH : SCREEN_WIDTH;

    Animated.parallel([
      Animated.timing(pan, { toValue: offsetOutput, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true })
    ]).start(() => {
      alFinalizar();
      pan.setValue(-offsetOutput);
      Animated.parallel([
        Animated.timing(pan, { toValue: 0, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    });
  };

  const procesarJornada = async (jornada: any, index: number, dbInstance?: any) => {
    const db = dbInstance || await getDB();
    const fIni = parseDateSeguro(jornada.fecha_inicio);
    
    let timeline = [
      { hora: "00:00", estado: "FS", ts: new Date(fIni).setHours(0,0,0,0) },
      { hora: `${fIni.getHours().toString().padStart(2, '0')}:${fIni.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: fIni.getTime() }
    ];
    
    try {
       const pausas = await db.getAllAsync('SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC', [jornada.id]);
       (pausas || []).forEach(p => {
         if (!p.inicio) return;
         const d = parseDateSeguro(p.inicio);
         timeline.push({ hora: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, estado: p.motivo?.toLowerCase().includes('dormir') ? 'DESC' : 'FS', ts: d.getTime() });
         
         if (p.fin) {
           const df = parseDateSeguro(p.fin);
           timeline.push({ hora: `${df.getHours().toString().padStart(2, '0')}:${df.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: df.getTime() });
         }
       });
    } catch (err) {}

    setDatosJornada(jornada);
    setCurrentIndex(index);
    setEventosDelDia(timeline.sort((a,b) => a.ts - b.ts));
  };

  const idQr = datosJornada.id_interno || datosJornada.id || '0';
  const urlQr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("https://bitacora57.com/validar?id="+idQr)}`;

  const mainAnimatedStyle = { transform: [{ translateX: pan }], opacity: opacity };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.main}>
        
        {/* ENCABEZADO Y NAVEGADOR (FIJO) */}
        <View style={styles.headerCard}>
          <View style={styles.row}>
            <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
              <MaterialCommunityIcons name="account-check" size={20} color="#16a34a" />
              <Text style={styles.boldText}>{datosJornada.operador_nombre || datosJornada.operador || 'SIN VIAJE'}</Text>
            </View>
            
            <View style={styles.navContainer}>
              <TouchableOpacity 
                onPress={() => ejecutarAnimacionPaseHoja(true, () => procesarJornada(historial[currentIndex + 1], currentIndex + 1)) } 
                disabled={currentIndex >= historial.length - 1 || historial.length === 0} 
                style={styles.navBtn}
              >
                <MaterialCommunityIcons name="arrow-left-drop-circle" size={30} color={currentIndex >= historial.length - 1 ? '#e2e8f0' : '#1e40af'} />
              </TouchableOpacity>
              
              <Text style={styles.navText}>
                {currentIndex === 0 ? "HOY: " : "ANTERIOR: "} 
                <Text style={{color: '#0f172a', fontWeight: 'bold'}}>{formatearFecha(datosJornada.fecha_inicio)}</Text>
              </Text>

              <TouchableOpacity 
                onPress={() => ejecutarAnimacionPaseHoja(false, () => procesarJornada(historial[currentIndex - 1], currentIndex - 1)) } 
                disabled={currentIndex <= 0} 
                style={styles.navBtn}
              >
                <MaterialCommunityIcons name="arrow-right-drop-circle" size={30} color={currentIndex <= 0 ? '#e2e8f0' : '#1e40af'} />
              </TouchableOpacity>
            </View>

            <View style={{alignItems: 'flex-end', flex: 1}}>
              <Text style={styles.idText}>ID: {datosJornada.id || '--'}</Text>
            </View>
          </View>
        </View>

        {/* CONTENIDO ANIMADO */}
        <Animated.View style={[styles.animatedContent, mainAnimatedStyle]}>
          <View style={styles.graphSection}>
            <View style={styles.legenda}>
              <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#94a3b8'}]}/><Text style={styles.legT}>F.S.</Text></View>
              <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#38bdf8'}]}/><Text style={styles.legT}>DESC</Text></View>
              <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#1e3a8a'}]}/><Text style={styles.legT}>COND</Text></View>
              <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#f59e0b'}]}/><Text style={styles.legT}>SERV</Text></View>
            </View>
            
            <View style={styles.graphCard}>
              <View style={styles.yLabels}>
                <Text style={styles.yT}>FS</Text><Text style={styles.yT}>DS</Text><Text style={styles.yT}>CD</Text><Text style={styles.yT}>SV</Text>
              </View>
              <ScrollView horizontal style={styles.svgContainer} showsHorizontalScrollIndicator={true}>
                <Svg height={graphHeight + ESPACIO_SUPERIOR} width={ANCHO_TOTAL}>
                  <G y={ESPACIO_SUPERIOR}>
                    <Rect x="0" y="0" width={ANCHO_TOTAL} height={rowHeight} fill="#f1f5f9" />
                    <Rect x="0" y={rowHeight * 2} width={ANCHO_TOTAL} height={rowHeight} fill="#f1f5f9" />
                    
                    {TICKS_CUADRICULA.map(i => {
                      const x = (ANCHO_TOTAL / 96) * i;
                      let h = 8, sw = 0.5, c = "#cbd5e1";
                      if (i % 4 === 0) { h = graphHeight; sw = 1.5; c = "#64748b"; }
                      else if (i % 2 === 0) { h = 15; sw = 1; c = "#94a3b8"; }
                      
                      return (
                        <G key={`tick-${i}`}>
                          <Line x1={x} y1="0" x2={x} y2={h} stroke={c} strokeWidth={sw} />
                          {i % 4 === 0 && (
                            <SvgText x={x} y="-10" fontSize="12" fill="#0f172a" fontWeight="bold" textAnchor="middle">
                              {i === 0 ? 'M' : i === 48 ? '12' : i === 96 ? 'M' : i/4}
                            </SvgText>
                          )}
                        </G>
                      );
                    })}
                    {LINEAS_HORIZONTALES.map(i => (
                      <Line key={`h-${i}`} x1="0" y1={rowHeight*i} x2={ANCHO_TOTAL} y2={rowHeight*i} stroke="#475569" strokeWidth="1" />
                    ))}
                    {/* TRUCO MAESTRO: key dinámico para forzar redibujado en Android */}
                    {puntosGrafico !== "" && (
                      <Polyline 
                        key={puntosGrafico} 
                        points={puntosGrafico} 
                        fill="none" 
                        stroke="#1e40af" 
                        strokeWidth="4" 
                        strokeLinejoin="round" 
                      />
                    )}
                  </G>
                </Svg>
              </ScrollView>
            </View>
          </View>

          {/* PIE DE PÁGINA: DATOS Y QR */}
          <View style={styles.footer}>
            <View style={styles.dataCol}>
              <View style={styles.miniCard}>
                <Text style={styles.title}>UNIDAD Y CONDUCTOR</Text>
                <Text style={styles.txt}>Licencia: <Text style={styles.bold}>{datosJornada.licencia || '--'}</Text></Text>
                <Text style={styles.txt}>Placas: <Text style={styles.bold}>{datosJornada.placas || '--'}</Text></Text>
              </View>
              <View style={styles.miniCard}>
                <Text style={styles.title}>RUTA DE VIAJE</Text>
                <Text style={styles.txt}>Origen: <Text style={styles.bold}>{datosJornada.origen?.toUpperCase() || '--'}</Text></Text>
                <Text style={styles.txt}>Destino: <Text style={styles.bold}>{datosJornada.destino?.toUpperCase() || '--'}</Text></Text>
              </View>
            </View>
            
            <View style={styles.qrCard}>
              <View style={styles.sictHeader}>
                <MaterialCommunityIcons name="scale-balance" size={14} color="#1e3a8a" />
                <Text style={styles.qrHeaderTitle}>VERIFICACIÓN S.I.C.T.</Text>
              </View>
              
              <View style={styles.qrRowContent}>
                <View style={styles.qrCardWhite}>
                  <Image source={{uri: urlQr}} style={styles.qrImage} />
                </View>
                <View style={styles.qrRightContent}>
                  <Text style={styles.qrSub}>NOM-087-SCT-2-2017</Text>
                  
                  <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
                    <Text style={styles.btnT}>FINALIZAR INSPECCIÓN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            
          </View>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  main: { flex: 1, padding: 8, gap: 6 },
  headerCard: { backgroundColor: '#fff', borderRadius: 10, padding: 8, elevation: 3, zIndex: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boldText: { fontWeight: 'bold', fontSize: 13, marginLeft: 5, color: '#0f172a' },
  idText: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold' },
  navContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#e2e8f0', flex: 1.5, justifyContent: 'space-between' },
  navBtn: { padding: 0 },
  navText: { fontSize: 13, color: '#64748b' },
  animatedContent: { flex: 1, gap: 6 },
  graphSection: { backgroundColor: '#fff', borderRadius: 10, padding: 8, elevation: 3 },
  legenda: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  legItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 2, marginRight: 5 },
  legT: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  graphCard: { flexDirection: 'row' },
  yLabels: { width: 35, justifyContent: 'space-around', alignItems: 'center', paddingTop: ESPACIO_SUPERIOR },
  yT: { fontWeight: 'bold', fontSize: 11, color: '#334155' },
  svgContainer: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' },
  
  footer: { flexDirection: 'row', gap: 10, flex: 1, minHeight: 110 },
  dataCol: { flex: 1.2, gap: 6 },
  miniCard: { backgroundColor: '#fff', borderRadius: 10, padding: 8, flex: 1, justifyContent: 'center', elevation: 2 },
  title: { fontSize: 10, fontWeight: 'bold', color: '#1e40af', borderBottomWidth: 1, borderColor: '#e2e8f0', marginBottom: 4, paddingBottom: 2 },
  txt: { fontSize: 11, color: '#475569', marginBottom: 2 },
  bold: { fontWeight: 'bold', color: '#0f172a' },
  
  qrCard: { flex: 1.8, backgroundColor: '#fff', borderRadius: 10, padding: 8, elevation: 3 },
  sictHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 4 },
  qrHeaderTitle: { fontSize: 11, fontWeight: 'bold', color: '#1e3a8a' },
  qrRowContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', flex: 1 },
  qrCardWhite: { backgroundColor: '#fff', borderRadius: 8, padding: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  qrImage: { width: 75, height: 75 },
  qrRightContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 10 },
  qrSub: { fontSize: 9, fontWeight: 'bold', color: '#64748b', marginBottom: 8, textAlign: 'center' },
  btn: { backgroundColor: '#ef4444', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, width: '100%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  btnT: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});
