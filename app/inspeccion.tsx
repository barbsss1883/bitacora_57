import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import Svg, { Line, Text as SvgText, Polyline, G, Rect } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDB } from '../db/database';
import jornadaEmitter from '../src/services/EventEmitter';

const graphHeight = 140;
const rowHeight = graphHeight / 4;
const ANCHO_TOTAL = 1100;
const MINUTOS_DIA = 1440;
const ESPACIO_SUPERIOR = 35;

const coordenadasY: { [key: string]: number } = {
  FS:   rowHeight * 0.5,
  DESC: rowHeight * 1.5,
  COND: rowHeight * 2.5,
  SERV: rowHeight * 3.5,
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SegmentoELD {
  estado: 'FS' | 'DESC' | 'COND' | 'SERV';
  inicioMin: number;
  finMin: number;
}

interface DiaHistorial {
  fecha: Date;
  segmentos: SegmentoELD[];
  sinActividad: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORES_ESTADO: { [key: string]: string } = {
  FS:   '#94a3b8',
  DESC: '#38bdf8',
  COND: '#1e3a8a',
  SERV: '#f59e0b',
};

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}

function minutosAHora(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ─── Mini gráfico ─────────────────────────────────────────────────────────────
const MINI_W = 220;
const MINI_H = 48;
const MINI_ROW = MINI_H / 4;
const FILAS = ['FS', 'DESC', 'COND', 'SERV'];

function MiniGrafico({ segmentos, sinActividad }: { segmentos: SegmentoELD[]; sinActividad: boolean }) {
  const xMin = (min: number) => (min / MINUTOS_DIA) * MINI_W;
  const segsEfectivos: SegmentoELD[] = sinActividad
    ? [{ estado: 'FS', inicioMin: 0, finMin: 1440 }]
    : segmentos;

  return (
    <Svg width={MINI_W} height={MINI_H}>
      {FILAS.map((f, i) => (
        <Rect key={f} x={0} y={i * MINI_ROW} width={MINI_W} height={MINI_ROW}
          fill={i % 2 === 0 ? '#0f172a' : '#0a1628'} />
      ))}
      {[0, 6, 12, 18, 24].map((h) => (
        <Line key={h} x1={xMin(h * 60)} y1={0} x2={xMin(h * 60)} y2={MINI_H}
          stroke="#1e3a5f" strokeWidth={1} />
      ))}
      {segsEfectivos.map((s, i) => {
        const filaIdx = FILAS.indexOf(s.estado);
        if (filaIdx < 0) return null;
        const y = filaIdx * MINI_ROW;
        const x = xMin(s.inicioMin);
        const w = xMin(s.finMin) - x;
        return (
          <G key={i}>
            <Rect x={x} y={y + MINI_ROW * 0.25} width={w} height={MINI_ROW * 0.5}
              fill={sinActividad ? '#334155' : COLORES_ESTADO[s.estado] + '44'} />
            <Line x1={x} y1={y + MINI_ROW * 0.5} x2={x + w} y2={y + MINI_ROW * 0.5}
              stroke={sinActividad ? '#64748b' : COLORES_ESTADO[s.estado]} strokeWidth={2} />
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PantallaELD() {
  const router = useRouter();

  const [jornadaActiva, setJornadaActiva] = useState<any>(null);
  const [timeline, setTimeline]           = useState<any[]>([]);
  const [puntosGrafico, setPuntosGrafico] = useState('');
  const [cargando, setCargando]           = useState(true);
  const [horaActual, setHoraActual]       = useState(new Date());

  const [vistaActiva, setVistaActiva]         = useState<'hoy' | 'historial'>('hoy');
  const [historial, setHistorial]             = useState<DiaHistorial[]>([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<number>(0);

  // ─── Carga jornada activa (hoy) ───────────────────────────────────────────
  const cargarTodoElELD = async () => {
    setCargando(true);
    try {
      const db      = await getDB();
      const jornada = await db.getFirstAsync(
        "SELECT * FROM jornadas WHERE estatus = 'activo' ORDER BY id DESC LIMIT 1"
      );

      if (jornada) {
        setJornadaActiva(jornada);
        const pausas = await db.getAllAsync(
          'SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC',
          [jornada.id]
        );

        const safeDate = (dStr: any) => {
          if (!dStr) return new Date();
          return new Date(typeof dStr === 'string' ? dStr.replace(' ', 'T') : dStr);
        };

        const fIni = safeDate(jornada.fecha_inicio);

        let tempTimeline = [
          { hora: '00:00', estado: 'FS', ts: new Date(fIni).setHours(0, 0, 0, 0) },
          {
            hora: `${fIni.getHours().toString().padStart(2, '0')}:${fIni.getMinutes().toString().padStart(2, '0')}`,
            estado: 'COND',
            ts: fIni.getTime(),
          },
        ];

        pausas.forEach((p: any) => {
          const d           = safeDate(p.inicio);
          const motivoLower = p.motivo?.toLowerCase() || '';
          const est = motivoLower.includes('comida') || motivoLower.includes('descanso') ? 'DESC' : 'SERV';

          tempTimeline.push({
            hora: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
            estado: est,
            ts: d.getTime(),
          });

          if (p.fin) {
            const df = safeDate(p.fin);
            tempTimeline.push({
              hora: `${df.getHours().toString().padStart(2, '0')}:${df.getMinutes().toString().padStart(2, '0')}`,
              estado: 'COND',
              ts: df.getTime(),
            });
          }
        });

        setTimeline(tempTimeline.sort((a, b) => a.ts - b.ts));
      } else {
        const user = await AsyncStorage.getItem('USER_SESSION');
        if (user) setJornadaActiva({ operador: JSON.parse(user).nombre });
      }
    } catch (e) {
      console.log('Error ELD Autónomo:', e);
    } finally {
      setCargando(false);
    }
  };

  // ─── Carga historial: hoy (idx 0) + 4 días anteriores = 5 días ───────────
  // FIX: antes empezaba en daysAgo=1 (ayer), ahora incluye hoy (daysAgo=0)
  // FIX: query con substr() como fallback por si DATE() no normaliza el formato
  // FIX: safeDate soporta timestamps numéricos y valida isNaN
  const cargarHistorial = useCallback(async () => {
    try {
      const db  = await getDB();
      const dias: DiaHistorial[] = [];

      for (let daysAgo = 0; daysAgo <= 4; daysAgo++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - daysAgo);

        const yyyy     = fecha.getFullYear();
        const mm       = String(fecha.getMonth() + 1).padStart(2, '0');
        const dd       = String(fecha.getDate()).padStart(2, '0');
        const fechaISO = `${yyyy}-${mm}-${dd}`;

        console.log(`[HISTORIAL] Buscando: ${fechaISO}`);

        const jornadas: any[] = await db.getAllAsync(
          `SELECT * FROM jornadas
           WHERE DATE(fecha_inicio) = DATE(?)
              OR substr(fecha_inicio, 1, 10) = ?
           ORDER BY id ASC`,
          [fechaISO, fechaISO]
        );

        console.log(`[HISTORIAL] ${fechaISO}: ${jornadas.length} jornada(s)`);

        if (!jornadas || jornadas.length === 0) {
          dias.push({ fecha, segmentos: [], sinActividad: true });
          continue;
        }

        const safeDate = (dStr: any) => {
          if (!dStr) return new Date();
          if (typeof dStr === 'number') return new Date(dStr);
          const normalized = String(dStr).replace(' ', 'T');
          const d = new Date(normalized);
          return isNaN(d.getTime()) ? new Date() : d;
        };

        const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes();

        let segmentos: SegmentoELD[] = [];

        for (const jornada of jornadas) {
          const fIni   = safeDate(jornada.fecha_inicio);
          const fFin   = jornada.fecha_fin ? safeDate(jornada.fecha_fin) : null;
          const iniMin = toMin(fIni);
          // Si es hoy y la jornada sigue activa, usar hora actual como fin
          const finMin = fFin
            ? toMin(fFin)
            : daysAgo === 0
              ? toMin(new Date())
              : 1440;

          console.log(`[HISTORIAL] ID ${jornada.id}: inicio=${jornada.fecha_inicio} fin=${jornada.fecha_fin}`);

          if (iniMin > 0) {
            segmentos.push({ estado: 'FS', inicioMin: 0, finMin: iniMin });
          }

          const pausas: any[] = await db.getAllAsync(
            'SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC',
            [jornada.id]
          );

          let cursor = iniMin;

          for (const p of pausas) {
            const pIni  = safeDate(p.inicio);
            const pIniM = toMin(pIni);

            if (pIniM > cursor) {
              segmentos.push({ estado: 'COND', inicioMin: cursor, finMin: pIniM });
            }

            const motivoLower = (p.motivo ?? '').toLowerCase();
            const estPausa: 'DESC' | 'SERV' =
              motivoLower.includes('comida') || motivoLower.includes('descanso') ? 'DESC' : 'SERV';

            const pFinM = p.fin ? toMin(safeDate(p.fin)) : Math.min(pIniM + 30, 1440);
            segmentos.push({ estado: estPausa, inicioMin: pIniM, finMin: pFinM });
            cursor = pFinM;
          }

          if (finMin > cursor) {
            segmentos.push({ estado: 'COND', inicioMin: cursor, finMin: finMin });
          }

          // FS al final solo si la jornada ya cerró
          if (fFin && finMin < 1440) {
            segmentos.push({ estado: 'FS', inicioMin: finMin, finMin: 1440 });
          }
        }

        segmentos.sort((a, b) => a.inicioMin - b.inicioMin);
        dias.push({ fecha, segmentos, sinActividad: false });
      }

      console.log(`[HISTORIAL] Total: ${dias.length} días`);
      setHistorial(dias);
    } catch (e) {
      console.log('[HISTORIAL] Error:', e);
    }
  }, []);

  // ─── Puntos gráfico (hoy) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline || timeline.length === 0) return;

    const horaAX = (h: number, m: number) => {
      const x = ((h * 60 + m) / MINUTOS_DIA) * ANCHO_TOTAL;
      return isNaN(x) ? 0 : Math.round(x);
    };
    const getCoordY = (estado: string) => coordenadasY[estado] ?? 0;
    const parseH    = (hStr: string) => {
      if (!hStr || typeof hStr !== 'string') return { h: 0, m: 0 };
      const parts = hStr.split(':');
      return { h: parseInt(parts[0], 10) || 0, m: parseInt(parts[1], 10) || 0 };
    };

    let puntos: string[] = [];
    let estadoActual = timeline[0].estado;
    const h0 = parseH(timeline[0].hora);
    puntos.push(`${horaAX(h0.h, h0.m)},${getCoordY(estadoActual)}`);

    for (let i = 1; i < timeline.length; i++) {
      const h = parseH(timeline[i].hora);
      const x = horaAX(h.h, h.m);
      puntos.push(`${x},${getCoordY(estadoActual)}`);
      puntos.push(`${x},${getCoordY(timeline[i].estado)}`);
      estadoActual = timeline[i].estado;
    }

    const xFinal = horaAX(horaActual.getHours(), horaActual.getMinutes());
    puntos.push(`${xFinal},${getCoordY(estadoActual)}`);
    setPuntosGrafico(puntos.join(' ').trim());
  }, [timeline, horaActual]);

  // ─── Ciclo de vida ────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      cargarTodoElELD();
      cargarHistorial();
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [cargarHistorial])
  );

  useEffect(() => {
    const desuscribir = jornadaEmitter.onEstadoCambio(() => {
      cargarTodoElELD();
      cargarHistorial();
    });
    return () => desuscribir();
  }, [cargarHistorial]);

  useEffect(() => {
    const interval = setInterval(() => setHoraActual(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loaderT}>SINCRONIZANDO BITÁCORA...</Text>
      </View>
    );
  }

  const idReal = jornadaActiva?.id || '---';
  const urlQr  = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    'https://bitacora57.com/validar?id=' + idReal
  )}`;

  // ─── Gráfico grande historial ─────────────────────────────────────────────
  const renderGraficoHistorial = () => {
    if (historial.length === 0) return null;
    const dia  = historial[diaSeleccionado];
    const xMin = (min: number) => (min / MINUTOS_DIA) * ANCHO_TOTAL;

    const segsEfectivos: SegmentoELD[] = dia.sinActividad
      ? [{ estado: 'FS', inicioMin: 0, finMin: 1440 }]
      : dia.segmentos;

    let puntos: string[] = [];
    segsEfectivos.forEach((s) => {
      const yRow = coordenadasY[s.estado] ?? 0;
      if (puntos.length === 0) {
        puntos.push(`${xMin(s.inicioMin)},${yRow}`);
      } else {
        puntos.push(`${xMin(s.inicioMin)},${puntos[puntos.length - 1].split(',')[1]}`);
        puntos.push(`${xMin(s.inicioMin)},${yRow}`);
      }
      puntos.push(`${xMin(s.finMin)},${yRow}`);
    });

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg height={graphHeight + ESPACIO_SUPERIOR} width={ANCHO_TOTAL}>
          <G y={ESPACIO_SUPERIOR}>
            {Array.from({ length: 97 }).map((_, i) => {
              const x           = (ANCHO_TOTAL / 96) * i;
              const esHora      = i % 4 === 0;
              const esMediaHora = i % 2 === 0 && !esHora;
              return (
                <G key={`ghv-${i}`}>
                  <Line x1={x} y1={0} x2={x} y2={graphHeight}
                    stroke="#cbd5e1"
                    strokeWidth={esHora ? 1.2 : esMediaHora ? 0.7 : 0.4}
                    strokeDasharray={esHora ? undefined : '3,3'} />
                  {esHora && (
                    <SvgText x={x} y={-10} fontSize="11" fill="#0f172a"
                      fontWeight="bold" textAnchor="middle">
                      {(i / 4).toString()}
                    </SvgText>
                  )}
                </G>
              );
            })}
            {[...Array(5)].map((_, index) => (
              <Line key={`ghh-${index}`} x1={0} y1={rowHeight * index}
                x2={ANCHO_TOTAL} y2={rowHeight * index}
                stroke="#cbd5e1" strokeWidth={1} />
            ))}
            {segsEfectivos.map((s, i) => {
              const filaIdx = FILAS.indexOf(s.estado);
              if (filaIdx < 0) return null;
              return (
                <Rect key={`fr-${i}`}
                  x={xMin(s.inicioMin)}
                  y={filaIdx * rowHeight}
                  width={xMin(s.finMin - s.inicioMin)}
                  height={rowHeight}
                  fill={dia.sinActividad ? '#1e293b' : COLORES_ESTADO[s.estado] + '22'} />
              );
            })}
            {puntos.length > 0 && (
              <Polyline points={puntos.join(' ')} fill="none"
                stroke={dia.sinActividad ? '#475569' : '#1e40af'}
                strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            )}
          </G>
        </Svg>
      </ScrollView>
    );
  };

  // ─── Totales ──────────────────────────────────────────────────────────────
  const calcTotales = (dia: DiaHistorial) => {
    const t: { [key: string]: number } = { FS: 0, DESC: 0, COND: 0, SERV: 0 };
    if (dia.sinActividad) { t.FS = 1440; return t; }
    dia.segmentos.forEach((s) => { t[s.estado] = (t[s.estado] || 0) + (s.finMin - s.inicioMin); });
    return t;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <View style={styles.main}>

        {/* ── Header ── */}
        <View style={styles.headerCard}>
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1.5 }}>
              <MaterialCommunityIcons name="account-circle" size={20} color="#1e3a8a" />
              <Text style={styles.boldText}>{jornadaActiva?.operador || 'DESCONOCIDO'}</Text>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, vistaActiva === 'hoy' && styles.tabActivo]}
                onPress={() => setVistaActiva('hoy')}
              >
                <Text style={[styles.tabT, vistaActiva === 'hoy' && styles.tabTActivo]}>HOY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, vistaActiva === 'historial' && styles.tabActivo]}
                onPress={() => setVistaActiva('historial')}
              >
                <MaterialCommunityIcons name="history" size={12}
                  color={vistaActiva === 'historial' ? '#fff' : '#64748b'} />
                <Text style={[styles.tabT, vistaActiva === 'historial' && styles.tabTActivo]}>
                  {' '}HISTORIAL
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBadge}>
              <Text style={styles.infoT}>NOM-087-SCT (ELD)</Text>
            </View>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.idText}>VIAJE ID: {idReal}</Text>
            </View>
          </View>
        </View>

        {/* ════ VISTA HOY ════ */}
        {vistaActiva === 'hoy' && (
          <>
            <View style={styles.graphSection}>
              <View style={styles.legenda}>
                {['FS', 'DESC', 'COND', 'SERV'].map((l, idx) => (
                  <View key={l} style={styles.legItem}>
                    <View style={[styles.dot, { backgroundColor: ['#94a3b8', '#38bdf8', '#1e3a8a', '#f59e0b'][idx] }]} />
                    <Text style={styles.legT}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.graphCard}>
                <View style={styles.yLabels}>
                  {['FS', 'DS', 'CD', 'SV'].map((label) => (
                    <View key={label} style={styles.yLabelRow}>
                      <Text style={styles.yT}>{label}</Text>
                    </View>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Svg height={graphHeight + ESPACIO_SUPERIOR} width={ANCHO_TOTAL}>
                    <G y={ESPACIO_SUPERIOR}>
                      {Array.from({ length: 97 }).map((_, i) => {
                        const x           = (ANCHO_TOTAL / 96) * i;
                        const esHora      = i % 4 === 0;
                        const esMediaHora = i % 2 === 0 && !esHora;
                        return (
                          <G key={`grid-v-${i}`}>
                            <Line x1={x} y1={0} x2={x} y2={graphHeight}
                              stroke="#cbd5e1"
                              strokeWidth={esHora ? 1.2 : esMediaHora ? 0.7 : 0.4}
                              strokeDasharray={esHora ? undefined : '3,3'} />
                            {esHora && (
                              <SvgText x={x} y={-10} fontSize="11" fill="#0f172a"
                                fontWeight="bold" textAnchor="middle">
                                {(i / 4).toString()}
                              </SvgText>
                            )}
                          </G>
                        );
                      })}
                      {[...Array(5)].map((_, index) => (
                        <Line key={`grid-h-${index}`} x1={0} y1={rowHeight * index}
                          x2={ANCHO_TOTAL} y2={rowHeight * index}
                          stroke="#cbd5e1" strokeWidth={1} />
                      ))}
                      {puntosGrafico.length > 0 && (
                        <Polyline points={puntosGrafico} fill="none"
                          stroke="#1e40af" strokeWidth="3"
                          strokeLinejoin="round" strokeLinecap="round" />
                      )}
                    </G>
                  </Svg>
                </ScrollView>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={styles.miniCard}>
                <Text style={styles.title}>DETALLES DEL VIAJE</Text>
                <Text style={styles.txt}>Unidad: <Text style={styles.bold}>{jornadaActiva?.unidad || '--'}</Text></Text>
                <Text style={styles.txt}>Ruta: <Text style={styles.bold}>{jornadaActiva?.origen || '--'} ➔ {jornadaActiva?.destino || '--'}</Text></Text>
              </View>
              <View style={styles.qrCard}>
                <Image source={{ uri: urlQr }} style={styles.qrImage} />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.qrSub}>VERIFICACIÓN GUARDIA NACIONAL</Text>
                  <TouchableOpacity style={styles.btnCerrar} onPress={() => router.back()}>
                    <Text style={styles.btnT}>VOLVER AL MAPA</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ════ VISTA HISTORIAL ════ */}
        {vistaActiva === 'historial' && (
          <View style={styles.histContainer}>

            <View style={styles.histSidebar}>
              <Text style={styles.sidebarTitle}>ÚLTIMOS 5 DÍAS</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {historial.map((dia, idx) => {
                  const totales      = calcTotales(dia);
                  const seleccionado = diaSeleccionado === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.diaCard, seleccionado && styles.diaCardActivo]}
                      onPress={() => setDiaSeleccionado(idx)}
                    >
                      <View style={styles.diaHeader}>
                        <Text style={styles.diaFecha}>{formatFecha(dia.fecha)}</Text>
                        {dia.sinActividad && (
                          <View style={styles.badgeSinAct}>
                            <Text style={styles.badgeSinActT}>SIN ACTIVIDAD</Text>
                          </View>
                        )}
                        {!dia.sinActividad && idx === 0 && (
                          <View style={styles.badgeHoy}>
                            <Text style={styles.badgeHoyT}>HOY</Text>
                          </View>
                        )}
                      </View>
                      <MiniGrafico segmentos={dia.segmentos} sinActividad={dia.sinActividad} />
                      {!dia.sinActividad && (
                        <View style={styles.diaResumen}>
                          {Object.entries(totales).filter(([, v]) => v > 0).map(([k, v]) => (
                            <Text key={k} style={[styles.diaResumenT, { color: COLORES_ESTADO[k] }]}>
                              {k} {Math.floor(v / 60)}h{v % 60 > 0 ? `${v % 60}m` : ''}
                            </Text>
                          ))}
                        </View>
                      )}
                      {dia.sinActividad && (
                        <Text style={styles.diaFSTotal}>FS 24 hrs</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.histMain}>
              {historial.length > 0 && (() => {
                const dia     = historial[diaSeleccionado];
                const totales = calcTotales(dia);
                return (
                  <>
                    <View style={styles.histDayHeader}>
                      <Text style={styles.histDayTitle}>
                        {dia.fecha.toLocaleDateString('es-MX', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                        }).toUpperCase()}
                      </Text>
                      {dia.sinActividad && (
                        <View style={styles.alertaSinAct}>
                          <MaterialCommunityIcons name="alert-circle" size={14} color="#f87171" />
                          <Text style={styles.alertaSinActT}>
                            Sin actividad registrada · Fuera de Servicio las 24 hrs
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.legenda}>
                      {['FS', 'DESC', 'COND', 'SERV'].map((l, idx2) => (
                        <View key={l} style={styles.legItem}>
                          <View style={[styles.dot, { backgroundColor: ['#94a3b8', '#38bdf8', '#1e3a8a', '#f59e0b'][idx2] }]} />
                          <Text style={styles.legT}>{l}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={[styles.graphSection, { marginBottom: 8 }]}>
                      <View style={styles.graphCard}>
                        <View style={styles.yLabels}>
                          {['FS', 'DS', 'CD', 'SV'].map((label) => (
                            <View key={label} style={styles.yLabelRow}>
                              <Text style={styles.yT}>{label}</Text>
                            </View>
                          ))}
                        </View>
                        {renderGraficoHistorial()}
                      </View>
                    </View>

                    <View style={styles.totalesRow}>
                      {Object.entries(totales).map(([k, v]) => (
                        <View key={k} style={[styles.totalCard, { borderColor: COLORES_ESTADO[k] + '55' }]}>
                          <Text style={styles.totalLabel}>
                            {k === 'COND' ? 'Conduciendo' : k === 'DESC' ? 'Descanso' : k === 'SERV' ? 'En Servicio' : 'Fuera Serv.'}
                          </Text>
                          <Text style={[styles.totalVal, { color: COLORES_ESTADO[k] }]}>
                            {Math.floor(v / 60)}h {v % 60 > 0 ? `${v % 60}m` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {!dia.sinActividad && dia.segmentos.length > 0 && (
                      <View style={styles.eventosList}>
                        <Text style={styles.eventosTitle}>REGISTRO DE EVENTOS</Text>
                        <ScrollView style={{ maxHeight: 90 }}>
                          {dia.segmentos.map((s, i) => (
                            <View key={i} style={styles.eventoRow}>
                              <View style={[styles.eventoColor, { backgroundColor: COLORES_ESTADO[s.estado] }]} />
                              <Text style={styles.eventoT}>
                                {minutosAHora(s.inicioMin)} – {minutosAHora(s.finMin)}
                              </Text>
                              <Text style={[styles.eventoEstado, { color: COLORES_ESTADO[s.estado] }]}>
                                {s.estado}
                              </Text>
                              <Text style={styles.eventoDur}>
                                ({Math.floor((s.finMin - s.inicioMin) / 60)}h {(s.finMin - s.inicioMin) % 60}m)
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>

          </View>
        )}

      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010A14' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#010A14' },
  loaderT: { color: '#D4AF37', marginTop: 15, fontWeight: 'bold', letterSpacing: 1 },

  main: { flex: 1, padding: 10, gap: 8 },

  // Header
  headerCard: { backgroundColor: '#051C33', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#12365A' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boldText: { fontWeight: 'bold', fontSize: 14, color: '#fff', marginLeft: 6 },
  idText: { fontSize: 10, color: '#9DA8B5', fontWeight: 'bold' },
  infoBadge: { backgroundColor: '#1e40af', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15 },
  infoT: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#1e293b', backgroundColor: '#0a1628' },
  tabActivo: { backgroundColor: '#1e40af', borderColor: '#3b82f6' },
  tabT: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
  tabTActivo: { color: '#fff' },

  // Gráfico
  graphSection: { backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  legenda: { flexDirection: 'row', justifyContent: 'center', gap: 25, marginBottom: 10 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 3 },
  legT: { fontSize: 11, color: '#475569', fontWeight: 'bold' },
  graphCard: { flexDirection: 'row' },
  yLabels: { width: 35, height: graphHeight + ESPACIO_SUPERIOR, paddingTop: ESPACIO_SUPERIOR, flexDirection: 'column' },
  yLabelRow: { height: rowHeight, justifyContent: 'center', alignItems: 'center' },
  yT: { fontSize: 11, fontWeight: 'bold', color: '#64748b' },

  // Footer
  footer: { flexDirection: 'row', gap: 10, flex: 1 },
  miniCard: { flex: 1, backgroundColor: '#051C33', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#12365A', justifyContent: 'center' },
  title: { fontSize: 10, fontWeight: 'bold', color: '#D4AF37', marginBottom: 8, letterSpacing: 1 },
  txt: { fontSize: 12, color: '#fff', marginBottom: 4 },
  bold: { color: '#D4AF37', fontWeight: 'bold' },
  qrCard: { flex: 1.2, backgroundColor: '#fff', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center' },
  qrImage: { width: 85, height: 85 },
  qrSub: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold', marginBottom: 10 },
  btnCerrar: { backgroundColor: '#010A14', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnT: { color: '#D4AF37', fontSize: 11, fontWeight: 'bold' },

  // Historial
  histContainer: { flex: 1, flexDirection: 'row', gap: 10 },
  histSidebar: { width: 260, backgroundColor: '#051C33', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#12365A' },
  sidebarTitle: { fontSize: 9, color: '#475569', letterSpacing: 2, marginBottom: 8 },

  diaCard: { backgroundColor: '#0a1628', borderRadius: 8, padding: 8, marginBottom: 6, borderWidth: 1, borderColor: '#1e293b' },
  diaCardActivo: { borderColor: '#3b82f6', backgroundColor: '#0f2744' },
  diaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  diaFecha: { fontSize: 11, fontWeight: 'bold', color: '#e2e8f0', textTransform: 'capitalize' },
  badgeSinAct: { backgroundColor: '#1c0a0a', borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  badgeSinActT: { color: '#f87171', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  badgeHoy: { backgroundColor: '#1e3a8a', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  badgeHoyT: { color: '#bfdbfe', fontSize: 8, fontWeight: 'bold' },
  diaResumen: { flexDirection: 'row', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  diaResumenT: { fontSize: 9 },
  diaFSTotal: { color: '#64748b', fontSize: 9, marginTop: 4 },

  histMain: { flex: 1, backgroundColor: '#051C33', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#12365A' },
  histDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  histDayTitle: { fontSize: 11, fontWeight: 'bold', color: '#f1f5f9' },
  alertaSinAct: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c0a0a', borderWidth: 1, borderColor: '#7f1d1d', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  alertaSinActT: { color: '#f87171', fontSize: 9, fontWeight: 'bold' },

  totalesRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  totalCard: { flex: 1, backgroundColor: '#0a1628', borderRadius: 6, padding: 8, borderWidth: 1, alignItems: 'center' },
  totalLabel: { fontSize: 8, color: '#64748b', marginBottom: 2 },
  totalVal: { fontSize: 16, fontWeight: 'bold' },

  eventosList: { backgroundColor: '#0a1628', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#1e293b' },
  eventosTitle: { fontSize: 8, color: '#475569', letterSpacing: 2, marginBottom: 6 },
  eventoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  eventoColor: { width: 8, height: 8, borderRadius: 2 },
  eventoT: { fontSize: 10, color: '#94a3b8', width: 110 },
  eventoEstado: { fontSize: 10, fontWeight: 'bold', width: 40 },
  eventoDur: { fontSize: 9, color: '#475569' },
});
