import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import { getDB } from '../../db/database';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface SegmentoELD {
  estado: 'FS' | 'DESC' | 'COND' | 'SERV';
  inicioMin: number;
  finMin: number;
}

interface DatosELD {
  segmentos: SegmentoELD[];
  sinActividad: boolean;
  totales: { FS: number; DESC: number; COND: number; SERV: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeDate = (dStr: any): Date => {
  if (!dStr) return new Date();
  if (typeof dStr === 'number') return new Date(dStr);
  const d = new Date(String(dStr).replace(' ', 'T'));
  return isNaN(d.getTime()) ? new Date() : d;
};

const toMin = (d: Date): number => d.getHours() * 60 + d.getMinutes();

const minAHora = (min: number): string => {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const calcTotales = (segs: SegmentoELD[]) => {
  const t = { FS: 0, DESC: 0, COND: 0, SERV: 0 };
  segs.forEach((s) => { t[s.estado] += s.finMin - s.inicioMin; });
  return t;
};

// ─── Consulta ELD del día ─────────────────────────────────────────────────────

/**
 * Reconstruye los segmentos ELD del día a partir de jornadas + pausas,
 * usando la misma lógica que inspeccion.tsx → cargarHistorial().
 */
const obtenerELDDelDia = async (): Promise<DatosELD> => {
  try {
    const db = await getDB();
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    const fechaISO = `${yyyy}-${mm}-${dd}`;

    const jornadas: any[] = await db.getAllAsync(
      `SELECT * FROM jornadas
       WHERE DATE(fecha_inicio) = DATE(?)
          OR substr(fecha_inicio, 1, 10) = ?
       ORDER BY id ASC`,
      [fechaISO, fechaISO]
    );

    if (!jornadas || jornadas.length === 0) {
      return { segmentos: [], sinActividad: true, totales: { FS: 1440, DESC: 0, COND: 0, SERV: 0 } };
    }

    let segmentos: SegmentoELD[] = [];

    for (const jornada of jornadas) {
      const fIni = safeDate(jornada.fecha_inicio);
      const fFin = jornada.fecha_fin ? safeDate(jornada.fecha_fin) : null;
      const iniMin = toMin(fIni);
      const finMin = fFin ? toMin(fFin) : toMin(new Date());

      if (iniMin > 0) {
        segmentos.push({ estado: 'FS', inicioMin: 0, finMin: iniMin });
      }

      const pausas: any[] = await db.getAllAsync(
        'SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC',
        [jornada.id]
      );

      let cursor = iniMin;

      for (const p of pausas) {
        const pIniM = toMin(safeDate(p.inicio));
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

      if (fFin && finMin < 1440) {
        segmentos.push({ estado: 'FS', inicioMin: finMin, finMin: 1440 });
      }
    }

    segmentos.sort((a, b) => a.inicioMin - b.inicioMin);
    const totales = calcTotales(segmentos);

    return { segmentos, sinActividad: false, totales };
  } catch (e) {
    console.error('[PdfReporteCompleto] obtenerELDDelDia error:', e);
    return { segmentos: [], sinActividad: true, totales: { FS: 1440, DESC: 0, COND: 0, SERV: 0 } };
  }
};

// ─── Bloque HTML: Sección NOM-068 ─────────────────────────────────────────────

const buildSeccionInspeccion = (inspeccion: any): string => {
  let detalles: Record<string, boolean> = {};
  try {
    detalles = JSON.parse(inspeccion.detalles_json || '{}');
  } catch (_) {}

  const filas = Object.entries(detalles)
    .map(
      ([pieza, ok]) => `
      <tr>
        <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-size:12px; color:#1e293b;">
          ${pieza}
        </td>
        <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right;
                   font-weight:bold; font-size:12px; color:${ok ? '#059669' : '#dc2626'};">
          ${ok ? 'PASÓ (✓)' : 'FALLA (✗)'}
        </td>
      </tr>`
    )
    .join('');

  const tipo = (inspeccion.tipo || 'GENERAL').toUpperCase();
  const fecha = inspeccion.fecha
    ? new Date(inspeccion.fecha).toLocaleString('es-MX')
    : '---';

  const hayFallas = Object.values(detalles).includes(false);
  const badgeColor = hayFallas ? '#dc2626' : '#059669';
  const badgeTexto = hayFallas ? 'CON FALLAS' : 'APROBADO';

  return `
    <!-- ══ SECCIÓN I: NOM-068 ══ -->
    <div style="margin-bottom:28px;">
      <div style="background:#051C33; padding:8px 14px; border-radius:6px 6px 0 0;
                  display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
          I. INSPECCIÓN FÍSICO-MECÁNICA — NOM-068-SCT-2-2014
        </span>
        <span style="background:${badgeColor}; color:#fff; font-size:10px;
                     font-weight:bold; padding:3px 10px; border-radius:20px;">
          ${badgeTexto}
        </span>
      </div>

      <div style="background:#f8fafc; padding:12px 14px; border:1px solid #e2e8f0;
                  border-top:none; font-size:12px; color:#334155;
                  display:flex; gap:20px; flex-wrap:wrap;">
        <span><strong>Operador:</strong> ${inspeccion.operador || 'No registrado'}</span>
        <span><strong>Unidad:</strong> ${inspeccion.unidad || 'N/A'} (${inspeccion.placas || '--'})</span>
        <span><strong>Tipo:</strong> ${tipo}</span>
        <span><strong>Fecha/Hora:</strong> ${fecha}</span>
      </div>

      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <thead>
          <tr style="background:#051C33; color:#fff;">
            <th style="padding:10px; text-align:left; font-size:12px;">Elemento Revisado</th>
            <th style="padding:10px; text-align:right; font-size:12px;">Estado Físico</th>
          </tr>
        </thead>
        <tbody>
          ${filas || '<tr><td colspan="2" style="text-align:center; padding:16px; color:#94a3b8; font-size:12px;">Sin detalles registrados</td></tr>'}
        </tbody>
      </table>

      ${inspeccion.comentarios ? `
        <div style="margin-top:10px; padding:10px 14px; border-left:4px solid #D4AF37;
                    background:#fffbeb; border-radius:0 4px 4px 0; font-size:11px; color:#334155;">
          <strong style="color:#b45309;">Observaciones del operador:</strong>
          <span style="font-style:italic;"> "${inspeccion.comentarios}"</span>
        </div>` : ''}
    </div>`;
};

// ─── Bloque HTML: Sección NOM-087 / ELD ───────────────────────────────────────

const buildSeccionELD = (eld: DatosELD, operador: string): string => {
  const COLORES: Record<string, string> = {
    FS: '#94a3b8', DESC: '#38bdf8', COND: '#1e3a8a', SERV: '#f59e0b',
  };
  const ETIQUETAS: Record<string, string> = {
    FS: 'Fuera de Servicio', DESC: 'Descanso', COND: 'Conduciendo', SERV: 'En Servicio',
  };

  // ── Mini gráfica SVG (texto, no imagen — funciona en expo-print) ──────────
  const W = 520; // ancho SVG en puntos
  const H = 80;
  const ROW = H / 4;
  const FILAS = ['FS', 'DESC', 'COND', 'SERV'];
  const xMin = (min: number) => (min / 1440) * W;

  const segsEfectivos: SegmentoELD[] = eld.sinActividad
    ? [{ estado: 'FS', inicioMin: 0, finMin: 1440 }]
    : eld.segmentos;

  const rectsFondos = FILAS.map(
    (f, i) =>
      `<rect x="0" y="${i * ROW}" width="${W}" height="${ROW}"
             fill="${i % 2 === 0 ? '#f1f5f9' : '#e2e8f0'}" />`
  ).join('');

  const lineasHora = [0, 6, 12, 18, 24]
    .map((h) => {
      const x = xMin(h * 60);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#94a3b8" stroke-width="0.5"/>
              <text x="${x + 2}" y="-3" font-size="7" fill="#64748b">${h}h</text>`;
    })
    .join('');

  const barras = segsEfectivos
    .map((s) => {
      const filaIdx = FILAS.indexOf(s.estado);
      if (filaIdx < 0) return '';
      const y = filaIdx * ROW;
      const x = xMin(s.inicioMin);
      const w = Math.max(xMin(s.finMin) - x, 1);
      return `<rect x="${x}" y="${y + ROW * 0.2}" width="${w}" height="${ROW * 0.6}"
                    fill="${eld.sinActividad ? '#cbd5e1' : COLORES[s.estado]}" rx="1"/>`;
    })
    .join('');

  // ── Tabla de totales ──────────────────────────────────────────────────────
  const celdaTotales = Object.entries(eld.totales)
    .map(
      ([k, v]) => `
      <td style="text-align:center; padding:8px; border:1px solid #e2e8f0;">
        <div style="font-size:10px; color:#64748b; margin-bottom:2px;">${ETIQUETAS[k]}</div>
        <div style="font-size:14px; font-weight:bold; color:${COLORES[k]};">
          ${Math.floor(v / 60)}h ${v % 60 > 0 ? `${v % 60}m` : '00m'}
        </div>
      </td>`
    )
    .join('');

  // ── Tabla de eventos ──────────────────────────────────────────────────────
  const filasEventos = segsEfectivos
    .map(
      (s, i) => `
      <tr style="${i % 2 === 0 ? 'background:#f8fafc;' : ''}">
        <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:10px; color:#475569;">
          ${minAHora(s.inicioMin)} – ${minAHora(s.finMin)}
        </td>
        <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9;">
          <span style="font-size:10px; font-weight:bold; color:${COLORES[s.estado]};">
            ${ETIQUETAS[s.estado]}
          </span>
        </td>
        <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:10px; color:#64748b;">
          ${Math.floor((s.finMin - s.inicioMin) / 60)}h ${(s.finMin - s.inicioMin) % 60}m
        </td>
      </tr>`
    )
    .join('');

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();

  return `
    <!-- ══ SECCIÓN II: NOM-087 ELD ══ -->
    <div style="margin-bottom:28px;">
      <div style="background:#051C33; padding:8px 14px; border-radius:6px 6px 0 0;
                  display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
          II. CONTROL DE HORAS DE SERVICIO — NOM-087-SCT-2-2017 (ELD)
        </span>
        <span style="color:#94a3b8; font-size:10px;">${fechaHoy}</span>
      </div>

      <div style="background:#f8fafc; padding:10px 14px; border:1px solid #e2e8f0;
                  border-top:none; font-size:12px; color:#334155;">
        <strong>Operador:</strong> ${operador || 'No registrado'}
      </div>

      ${eld.sinActividad ? `
        <div style="padding:14px; border:1px solid #e2e8f0; border-top:none;
                    text-align:center; color:#94a3b8; font-size:11px; font-style:italic;">
          Sin actividad de conducción registrada para este día.
        </div>` : ''}

      <!-- Gráfica SVG -->
      <div style="border:1px solid #e2e8f0; border-top:none; padding:14px; background:#fff;">
        <div style="font-size:10px; color:#64748b; margin-bottom:6px; font-weight:bold;
                    letter-spacing:0.5px;">
          GRÁFICA DIARIA DE ACTIVIDAD
        </div>

        <!-- Leyenda -->
        <div style="display:flex; gap:16px; margin-bottom:8px; flex-wrap:wrap;">
          ${Object.entries(COLORES).map(([k, c]) => `
            <span style="font-size:9px; color:#475569;">
              <span style="display:inline-block; width:10px; height:10px;
                           background:${c}; border-radius:2px; vertical-align:middle;
                           margin-right:3px;"></span>
              ${ETIQUETAS[k]}
            </span>`).join('')}
        </div>

        <!-- Etiquetas Y -->
        <div style="display:flex; align-items:flex-start;">
          <div style="width:30px; margin-right:4px; margin-top:8px;">
            ${FILAS.map((f) => `
              <div style="height:${ROW}px; display:flex; align-items:center;
                          justify-content:flex-end; padding-right:4px;">
                <span style="font-size:8px; font-weight:bold; color:#64748b;">${f}</span>
              </div>`).join('')}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg"
               width="${W}" height="${H + 12}"
               viewBox="0 -12 ${W} ${H + 12}"
               style="overflow:visible; display:block;">
            <g>${rectsFondos}</g>
            <g>${lineasHora}</g>
            <g>${barras}</g>
          </svg>
        </div>
      </div>

      <!-- Totales -->
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0;
                    border-top:none;">
        <tbody><tr>${celdaTotales}</tr></tbody>
      </table>

      <!-- Registro de eventos -->
      ${!eld.sinActividad && segsEfectivos.length > 0 ? `
        <div style="border:1px solid #e2e8f0; border-top:none;">
          <div style="background:#f1f5f9; padding:6px 10px; font-size:10px; font-weight:bold;
                      color:#475569; letter-spacing:1px;">
            REGISTRO DE EVENTOS DEL DÍA
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:6px 8px; text-align:left; font-size:10px;
                           color:#334155; border-bottom:1px solid #e2e8f0;">Período</th>
                <th style="padding:6px 8px; text-align:left; font-size:10px;
                           color:#334155; border-bottom:1px solid #e2e8f0;">Estado</th>
                <th style="padding:6px 8px; text-align:left; font-size:10px;
                           color:#334155; border-bottom:1px solid #e2e8f0;">Duración</th>
              </tr>
            </thead>
            <tbody>${filasEventos}</tbody>
          </table>
        </div>` : ''}
    </div>`;
};

// ─── Función principal exportada ──────────────────────────────────────────────

/**
 * generarReporteCompleto
 *
 * Llama esta función justo después de guardar la inspección en SQLite.
 *
 * @param inspeccionId  — id de la inspección recién guardada
 * @param jornadaId     — jornada_id vinculada (puede ser 0 si aún no hay jornada activa)
 */
export const generarReporteCompleto = async (
  inspeccionId: number,
  jornadaId: number
): Promise<string | null> => {

  // ── 1. Validar suscripción PRO (mismo patrón que PdfGenerator.ts) ─────────
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const esPro = typeof customerInfo.entitlements.active['pro'] !== 'undefined';
    if (!esPro) {
      Alert.alert(
        'Función Bloqueada',
        'Necesitas una suscripción PRO activa para generar el Reporte Completo oficial.'
      );
      return null;
    }
  } catch (e) {
    console.log('[PdfReporteCompleto] Error validación PRO:', e);
    return null;
  }

  // ── 2. Obtener datos de la inspección ─────────────────────────────────────
  let inspeccion: any = null;
  try {
    const db = await getDB();

    // Si tiene jornada vinculada, traemos también los datos del operador/unidad
    if (jornadaId && jornadaId > 0) {
      inspeccion = await db.getFirstAsync(
        `SELECT i.*, j.operador, j.unidad, j.placas
         FROM inspecciones i
         LEFT JOIN jornadas j ON j.id = ?
         WHERE i.id = ?`,
        [jornadaId, inspeccionId]
      );
    } else {
      inspeccion = await db.getFirstAsync(
        'SELECT * FROM inspecciones WHERE id = ?',
        [inspeccionId]
      );
    }
  } catch (e) {
    console.error('[PdfReporteCompleto] Error cargando inspección:', e);
    return null;
  }

  if (!inspeccion) {
    console.warn('[PdfReporteCompleto] Inspección no encontrada, id:', inspeccionId);
    return null;
  }

  // ── 3. Obtener datos ELD del día ──────────────────────────────────────────
  const eld = await obtenerELDDelDia();

  // ── 4. Construir HTML ─────────────────────────────────────────────────────
  const operador = inspeccion.operador || 'No registrado';
  const fechaDoc = new Date().toLocaleString('es-MX');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    `https://bitacora57.com/validar?inspeccion=${inspeccionId}`
  )}`;

  const seccionInspeccion = buildSeccionInspeccion(inspeccion);
  const seccionELD = buildSeccionELD(eld, operador);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0,
              maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            padding: 32px 36px;
            color: #010A14;
            font-size: 12px;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>

        <!-- ══ ENCABEZADO ══ -->
        <div style="border-bottom:3px solid #D4AF37; padding-bottom:14px;
                    margin-bottom:22px; display:flex; justify-content:space-between;
                    align-items:flex-end;">
          <div>
            <h1 style="font-size:26px; color:#051C33; margin-bottom:2px;">
              BITÁCORA <span style="color:#D4AF37;">57</span>
            </h1>
            <p style="font-size:10px; color:#64748b; letter-spacing:1px; font-weight:bold;">
              REPORTE OFICIAL DE CUMPLIMIENTO NORMATIVO
            </p>
          </div>
          <div style="text-align:right;">
            <p style="font-size:9px; color:#94a3b8;">Generado: ${fechaDoc}</p>
            <p style="font-size:9px; color:#94a3b8; margin-top:2px;">
              NOM-068-SCT-2-2014 &nbsp;|&nbsp; NOM-087-SCT-2-2017
            </p>
          </div>
        </div>

        <!-- ══ INFO GENERAL ══ -->
        <div style="background:#f1f5f9; padding:12px 16px; border-radius:6px;
                    margin-bottom:22px; border:1px solid #e2e8f0;
                    display:flex; gap:20px; flex-wrap:wrap;">
          <span><strong>Operador:</strong> ${operador}</span>
          <span><strong>Unidad:</strong> ${inspeccion.unidad || 'N/A'} (${inspeccion.placas || '--'})</span>
          <span><strong>Tipo revisión:</strong> ${(inspeccion.tipo || 'GENERAL').toUpperCase()}</span>
        </div>

        ${seccionInspeccion}
        ${seccionELD}

        <!-- ══ PIE DE PÁGINA ══ -->
        <div style="margin-top:30px; padding-top:16px; border-top:1px dashed #cbd5e1;
                    display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="font-size:9px; color:#94a3b8; max-width:70%;">
            <p>Documento generado automáticamente por Bitácora 57.</p>
            <p style="margin-top:3px;">
              Válido como evidencia de cumplimiento ante la SICT y la Guardia Nacional.
            </p>
          </div>
          <div style="text-align:center;">
            <img src="${qrUrl}" width="80" height="80" />
            <p style="font-size:8px; color:#94a3b8; margin-top:4px;">Escanear para validar</p>
          </div>
        </div>

      </body>
    </html>`;

  // ── 5. Generar y compartir ────────────────────────────────────────────────
  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: 'Reporte Completo NOM-068 + ELD',
    });
    return uri;
  } catch (error) {
    console.error('[PdfReporteCompleto] Error generando PDF:', error);
    Alert.alert('Error', 'No se pudo generar el Reporte Completo.');
    return null;
  }
};
