import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Image, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, Polyline, G } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDB } from '../db/database'; 
import jornadaEmitter from '../src/services/EventEmitter'; 

// =========================================================================
// CONFIGURACIÓN GRÁFICA PROFESIONAL
// =========================================================================
const graphHeight = 140; 
const rowHeight = graphHeight / 4;
const ANCHO_TOTAL = 1100; 
const MINUTOS_DIA = 1440;
const ESPACIO_SUPERIOR = 35; 
const LINEAS_HORIZONTALES = [1, 2, 3];

const TICKS_CUADRICULA: number[] = [];
for (let i = 0; i <= 96; i++) { TICKS_CUADRICULA.push(i); }

const coordenadasY: { [key: string]: number } = { 
  'FS': rowHeight * 0.5, 
  'DESC': rowHeight * 1.5, 
  'COND': rowHeight * 2.5, 
  'SERV': rowHeight * 3.5 
};

const horaAX = (h: number, m: number) => (((h * 60) + m) / MINUTOS_DIA) * ANCHO_TOTAL;

const parseDateSeguro = (dStr: any) => {
  if (!dStr) return new Date();
  const safe = typeof dStr === 'string' ? dStr.replace(' ', 'T') : dStr;
  const d = new Date(safe);
  return isNaN(d.getTime()) ? new Date() : d;
};

const parseHoraSegura = (hStr: any) => {
  if (!hStr || !hStr.includes(':')) return { h: 0, m: 0 };
  const p = hStr.split(':');
  return { h: parseInt(p) || 0, m: parseInt(p) || 0 };
};

const generarGrafica = (registros: any[], tiempoActual: Date, esActivo: boolean) => {
  if (!registros || registros.length === 0) return "";
  let puntos: string[] = [];
  let estadoActual = registros.estado || 'FS';
  const h0 = parseHoraSegura(registros.hora);
  puntos.push(`${horaAX(h0.h, h0.m)},${coordenadasY[estadoActual]}`);

  for (let i = 1; i < registros.length; i++) {
    const reg = registros[i];
    const h = parseHoraSegura(reg.hora);
    const x = horaAX(h.h, h.m);
    const yN = coordenadasY[reg.estado] || coordenadasY['FS'];
    const yA = coordenadasY[estadoActual];
    puntos.push(`${x},${yA}`); 
    puntos.push(`${x},${yN}`);    
    estadoActual = reg.estado;
  }
  const xFinal = esActivo ? horaAX(tiempoActual.getHours(), tiempoActual.getMinutes()) : ANCHO_TOTAL;
  puntos.push(`${xFinal},${coordenadasY[estadoActual]}`);
  return puntos.join(" ");
};

const formatearFecha = (fechaStr: string) => {
  if (!fechaStr) return '--';
  const d = parseDateSeguro(fechaStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
};

export default function PantallaELD() {
  const router = useRouter();
  const [puntosGrafico, setPuntosGrafico] = useState("");
  const [horaActual, setHoraActual] = useState(new Date());
  const [eventosDelDia, setEventosDelDia] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [datosJornada, setDatosJornada] = useState<any>({});

  const procesarJornada = useCallback(async (jornada: any, index: number) => {
    if (!jornada) return;
    try {
      const db = await getDB();
      const pausas = await db.getAllAsync('SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC', [jornada.id]);
      const fIni = parseDateSeguro(jornada.fecha_inicio);
      
      let timeline = [
        { hora: "00:00", estado: "FS", ts: new Date(fIni).setHours(0,0,0,0) },
        { hora: `${fIni.getHours().toString().padStart(2, '0')}:${fIni.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: fIni.getTime() }
      ];

      pausas.forEach((p: any) => {
        const d = parseDateSeguro(p.inicio);
        const est = p.motivo?.toLowerCase().includes('comida') || p.motivo?.toLowerCase().includes('descanso') ? 'DESC' : 'SERV';
        timeline.push({ hora: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`, estado: est, ts: d.getTime() });
        if (p.fin) {
          const df = parseDateSeguro(p.fin);
          timeline.push({ hora: `${df.getHours().toString().padStart(2, '0')}:${df.getMinutes().toString().padStart(2, '0')}`, estado: "COND", ts: df.getTime() });
        }
      });

      // BLINDAJE: Si la jornada finalizó, la obligamos a caer a Fuera de Servicio
      if (jornada.estatus === 'finalizado' && jornada.fecha_fin) {
        const fFin = parseDateSeguro(jornada.fecha_fin);
        timeline.push({ 
          hora: `${fFin.getHours().toString().padStart(2, '0')}:${fFin.getMinutes().toString().padStart(2, '0')}`, 
          estado: "FS", 
          ts: fFin.getTime() 
        });
      }

      setDatosJornada(jornada);
      setCurrentIndex(index);
      setEventosDelDia(timeline.sort((a,b) => a.ts - b.ts));
    } catch (e) { console.log(e); }
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      const db = await getDB();
      let lista: any[] = [];
      const activa = await db.getFirstAsync("SELECT * FROM jornadas WHERE estatus = 'activo' ORDER BY id DESC LIMIT 1");
      if (activa) lista.push(activa);

      const queryHist = activa ? `SELECT * FROM jornadas WHERE id != ${activa.id} ORDER BY id DESC LIMIT 7` : `SELECT * FROM jornadas ORDER BY id DESC LIMIT 7`;
      const historialDb = await db.getAllAsync(queryHist);
      if (historialDb) lista = [...lista, ...historialDb];

      if (lista.length > 0) {
        setHistorial(lista);
        setCurrentIndex(0);
        procesarJornada(lista, 0); // CORRECCIÓN: Se envía el objeto lista, no el arreglo completo
      } else {
        setHistorial([]);
        setEventosDelDia([]);
        setDatosJornada({});
        setPuntosGrafico("");
      }
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    const desuscribir = jornadaEmitter.onEstadoCambio(() => {
        if (currentIndex === 0) procesarJornada(historial, 0);
    });
    return () => desuscribir();
  }, [currentIndex, historial, procesarJornada]);

  useEffect(() => {
    const tic = setInterval(() => {
      setHoraActual(new Date());
      if (currentIndex === 0 && datosJornada?.id) {
        procesarJornada(datosJornada, 0);
      }
    }, 2000); 
    return () => clearInterval(tic);
  }, [currentIndex, datosJornada, procesarJornada]);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      cargarDatosIniciales();
      return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
    }, [])
  );

  useEffect(() => {
    if (eventosDelDia.length > 0) {
      // BLINDAJE: Solo se considera activa si el estatus en base de datos realmente lo es
      const viajeEstaActivo = currentIndex === 0 && datosJornada?.estatus === 'activo';
      setPuntosGrafico(generarGrafica(eventosDelDia, horaActual, viajeEstaActivo));
    }
  }, [horaActual, eventosDelDia, currentIndex, datosJornada]);

  const idQr = datosJornada.id_interno || datosJornada.id || '0';
  const urlQr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent("https://bitacora57.com/validar?id="+idQr)}`;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.main}>
        
        <View style={styles.headerCard}>
          <View style={styles.row}>
            <View style={{flexDirection:'row', alignItems:'center', flex: 1}}>
              <MaterialCommunityIcons name="account-circle" size={20} color="#1e3a8a" />
              <Text style={styles.boldText}>{datosJornada.operador || 'SIN OPERADOR'}</Text>
            </View>

            <View style={styles.navContainer}>
              <TouchableOpacity onPress={() => procesarJornada(historial[currentIndex + 1], currentIndex + 1)} disabled={currentIndex >= historial.length - 1}>
                <MaterialCommunityIcons name="arrow-left-drop-circle" size={28} color={currentIndex >= historial.length - 1 ? '#e2e8f0' : '#1e40af'} />
              </TouchableOpacity>
              <Text style={styles.navText}>{currentIndex === 0 ? "HOY: " : "HISTORIAL: "} {formatearFecha(datosJornada.fecha_inicio)}</Text>
              <TouchableOpacity onPress={() => procesarJornada(historial[currentIndex - 1], currentIndex - 1)} disabled={currentIndex <= 0}>
                <MaterialCommunityIcons name="arrow-right-drop-circle" size={28} color={currentIndex <= 0 ? '#e2e8f0' : '#1e40af'} />
              </TouchableOpacity>
            </View>

            <View style={{alignItems: 'flex-end', flex: 1}}><Text style={styles.idText}>ID: {idQr}</Text></View>
          </View>
        </View>

        <View style={styles.graphSection}>
          <View style={styles.legenda}>
            <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#94a3b8'}]}/><Text style={styles.legT}>F.S.</Text></View>
            <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#38bdf8'}]}/><Text style={styles.legT}>DESC</Text></View>
            <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#1e3a8a'}]}/><Text style={styles.legT}>COND</Text></View>
            <View style={styles.legItem}><View style={[styles.dot, {backgroundColor:'#f59e0b'}]}/><Text style={styles.legT}>SERV</Text></View>
          </View>
          
          <View style={styles.graphCard}>
            {/* CORRECCIÓN: Alineación lateral con paddingTop igual al offset del SVG */}
            <View style={styles.yLabels}>
                <Text style={styles.yT}>FS</Text>
                <Text style={styles.yT}>DS</Text>
                <Text style={styles.yT}>CD</Text>
                <Text style={styles.yT}>SV</Text>
            </View>
            <ScrollView horizontal style={styles.svgContainer} showsHorizontalScrollIndicator={true}>
              <Svg height={graphHeight + ESPACIO_SUPERIOR} width={ANCHO_TOTAL}>
                <G y={ESPACIO_SUPERIOR}>
                  {TICKS_CUADRICULA.map(i => {
                    const x = (ANCHO_TOTAL / 96) * i;
                    const esHora = i % 4 === 0;
                    return (
                      <G key={`t-${i}`}>
                        <Line x1={x} y1="0" x2={x} y2={esHora ? graphHeight : 8} stroke="#cbd5e1" strokeWidth={esHora ? 1.2 : 0.5} />
                        {esHora && (
                          <SvgText x={x} y="-12" fontSize="12" fill="#0f172a" fontWeight="bold" textAnchor="middle">
                            {i === 0 ? 'M' : i === 48 ? '12' : i === 96 ? 'M' : i / 4}
                          </SvgText>
                        )}
                      </G>
                    );
                  })}
                  {LINEAS_HORIZONTALES.map(i => <Line key={`l-${i}`} x1="0" y1={rowHeight*i} x2={ANCHO_TOTAL} y2={rowHeight*i} stroke="#e2e8f0" strokeWidth="1" />)}
                  {puntosGrafico !== "" && <Polyline points={puntosGrafico} fill="none" stroke="#1e40af" strokeWidth="4" />}
                </G>
              </Svg>
            </ScrollView>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dataCol}>
            <View style={styles.miniCard}>
              <Text style={styles.title}>UNIDAD</Text>
              <Text style={styles.txt}>Eco: <Text style={styles.bold}>{datosJornada.unidad || '--'}</Text></Text>
              <Text style={styles.txt}>Placas: <Text style={styles.bold}>{datosJornada.placas || '--'}</Text></Text>
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.title}>RUTA</Text>
              <Text style={styles.txt}>Origen: <Text style={styles.bold}>{datosJornada.origen || '--'}</Text></Text>
              <Text style={styles.txt}>Destino: <Text style={styles.bold}>{datosJornada.destino || '--'}</Text></Text>
            </View>
          </View>
          
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}><MaterialCommunityIcons name="shield-check" size={16} color="#1e3a8a" /><Text style={styles.qrTitle}>VERIFICACIÓN OFICIAL NOM-087-SCT</Text></View>
            <View style={styles.qrContent}>
                <View style={styles.qrFrame}><Image source={{uri: urlQr}} style={styles.qrImage} /></View>
                <View style={{flex: 1, marginLeft: 15}}>
                    <Text style={styles.qrSub}>SCT ELD COMPLIANT</Text>
                    <TouchableOpacity style={styles.btnCerrar} onPress={() => router.back()}><Text style={styles.btnT}>CERRAR INSPECCIÓN</Text></TouchableOpacity>
                </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  main: { flex: 1, padding: 8, gap: 6 },
  headerCard: { backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boldText: { fontWeight: 'bold', fontSize: 13, color: '#0f172a', marginLeft: 4 },
  idText: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold' },
  navContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  navText: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
  graphSection: { backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 3 },
  legenda: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 2 },
  legT: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
  graphCard: { flexDirection: 'row' },
  // AJUSTE CLAVE: Se agregó paddingTop para alinear con el SVG
  yLabels: { 
    width: 30, 
    height: graphHeight + ESPACIO_SUPERIOR, 
    justifyContent: 'space-around', 
    paddingTop: ESPACIO_SUPERIOR 
  },
  yT: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textAlign: 'center' },
  svgContainer: { flex: 1, borderLeftWidth: 1, borderColor: '#e2e8f0' },
  footer: { flexDirection: 'row', gap: 8, flex: 1 },
  dataCol: { flex: 1, gap: 6 },
  miniCard: { backgroundColor: '#fff', borderRadius: 8, padding: 8, flex: 1, elevation: 2, justifyContent: 'center' },
  title: { fontSize: 9, fontWeight: 'bold', color: '#1e3a8a', borderBottomWidth: 1, borderColor: '#f1f5f9', marginBottom: 4 },
  txt: { fontSize: 10, color: '#475569' },
  bold: { fontWeight: 'bold', color: '#0f172a' },
  qrCard: { flex: 1.5, backgroundColor: '#fff', borderRadius: 8, padding: 8, elevation: 3 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  qrTitle: { fontSize: 10, fontWeight: 'bold', color: '#1e3a8a' },
  qrContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  qrFrame: { padding: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  qrImage: { width: 75, height: 75 },
  qrSub: { fontSize: 8, color: '#94a3b8', marginBottom: 8, fontWeight: 'bold' },
  btnCerrar: { backgroundColor: '#1e40af', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 10, fontWeight: 'bold' }
});
