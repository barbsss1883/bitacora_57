import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import CryptoJS from 'crypto-js';
import { getDB } from '../../db/database';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OpcionesPdf {
  jornadaId: number;
  inspeccionId?: number; // opcional — si no se pasa, se busca en DB
}

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

const safeDate = (d: any): Date => {
  if (!d) return new Date();
  if (typeof d === 'number') return new Date(d);
  const parsed = new Date(String(d).replace(' ', 'T'));
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const toMin = (d: Date) => d.getHours() * 60 + d.getMinutes();

const minAHora = (min: number) =>
  `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;

const calcTotales = (segs: SegmentoELD[]) => {
  const t = { FS: 0, DESC: 0, COND: 0, SERV: 0 };
  segs.forEach(s => { t[s.estado] += s.finMin - s.inicioMin; });
  return t;
};

const fmtDuracion = (min: number) =>
  `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;

// ─── 1. Mapa SVG offline ──────────────────────────────────────────────────────

const buildMapaSVG = (rutaGeojson: string | null | undefined): string => {
  if (!rutaGeojson) return '';
  try {
    const parsed = JSON.parse(rutaGeojson);
    let coords: [number, number][] = [];

    if (parsed?.type === 'Feature' && parsed?.geometry?.type === 'LineString') {
      coords = parsed.geometry.coordinates;
    } else if (Array.isArray(parsed)) {
      coords = parsed
        .map((p: any) => {
          const lat = p.latitud ?? p.latitude ?? p.lat;
          const lng = p.longitud ?? p.longitude ?? p.lng;
          return lat != null && lng != null ? [lng, lat] as [number, number] : null;
        })
        .filter(Boolean) as [number, number][];
    }

    if (coords.length < 2) return '';

    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const W = 500, H = 200, PAD = 20;
    const rangoLat = maxLat - minLat || 0.001;
    const rangoLng = maxLng - minLng || 0.001;
    const toX = (lng: number) => PAD + ((lng - minLng) / rangoLng) * (W - PAD * 2);
    const toY = (lat: number) => PAD + ((maxLat - lat) / rangoLat) * (H - PAD * 2);
    const puntos = coords.map(c => `${toX(c[0]).toFixed(1)},${toY(c[1]).toFixed(1)}`).join(' ');
    const [x0, y0] = [toX(coords[0][0]), toY(coords[0][1])];
    const [xN, yN] = [toX(coords[coords.length - 1][0]), toY(coords[coords.length - 1][1])];

    return `
      <div style="margin-bottom:28px; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
        <div style="background:#051C33; padding:8px 14px;">
          <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
            V. TRAZABILIDAD GPS — RUTA RECORRIDA
          </span>
          <span style="color:#9DA8B5; font-size:9px; margin-left:12px;">
            ${coords.length} puntos registrados
          </span>
        </div>
        <div style="background:#e8f0fe; padding:8px; text-align:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
               viewBox="0 0 ${W} ${H}" style="display:block; margin:0 auto;">
            <!-- Fondo -->
            <rect width="${W}" height="${H}" fill="#dce8f5" rx="4"/>
            <!-- Cuadrícula -->
            ${Array.from({ length: 6 }, (_, i) =>
              `<line x1="${PAD + i * (W - PAD*2) / 5}" y1="${PAD}"
                     x2="${PAD + i * (W - PAD*2) / 5}" y2="${H - PAD}"
                     stroke="#b0c4de" stroke-width="0.6" stroke-dasharray="3,3"/>`
            ).join('')}
            ${Array.from({ length: 5 }, (_, i) =>
              `<line x1="${PAD}" y1="${PAD + i * (H - PAD*2) / 4}"
                     x2="${W - PAD}" y2="${PAD + i * (H - PAD*2) / 4}"
                     stroke="#b0c4de" stroke-width="0.6" stroke-dasharray="3,3"/>`
            ).join('')}
            <!-- Borde área del mapa -->
            <rect x="${PAD}" y="${PAD}" width="${W-PAD*2}" height="${H-PAD*2}"
                  fill="none" stroke="#7094b5" stroke-width="1" rx="2"/>
            <!-- Ruta -->
            <polyline points="${puntos}" fill="none" stroke="#1a56db" stroke-width="3"
                      stroke-linecap="round" stroke-linejoin="round"/>
            <!-- Sombra ruta -->
            <polyline points="${puntos}" fill="none" stroke="#ffffff" stroke-width="1"
                      stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.4"/>
            <!-- Marcador origen -->
            <circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="7" fill="#059669" opacity="0.9"/>
            <circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="3.5" fill="#fff"/>
            <!-- Marcador destino -->
            <circle cx="${xN.toFixed(1)}" cy="${yN.toFixed(1)}" r="7" fill="#dc2626" opacity="0.9"/>
            <circle cx="${xN.toFixed(1)}" cy="${yN.toFixed(1)}" r="3.5" fill="#fff"/>
            <!-- Etiquetas -->
            <rect x="${(x0+10).toFixed(1)}" y="${(y0-8).toFixed(1)}" width="40" height="12"
                  fill="#059669" rx="2"/>
            <text x="${(x0+30).toFixed(1)}" y="${(y0+2).toFixed(1)}"
                  font-size="8" fill="#fff" font-weight="bold" text-anchor="middle">ORIGEN</text>
            <rect x="${(xN+10).toFixed(1)}" y="${(yN-8).toFixed(1)}" width="44" height="12"
                  fill="#dc2626" rx="2"/>
            <text x="${(xN+32).toFixed(1)}" y="${(yN+2).toFixed(1)}"
                  font-size="8" fill="#fff" font-weight="bold" text-anchor="middle">DESTINO</text>
          </svg>
        </div>
        <div style="background:#f1f5f9; padding:5px 14px; display:flex; gap:20px;">
          <span style="font-size:8px; color:#64748b;">
            <span style="color:#059669;">●</span>
            Origen: ${coords[0][1].toFixed(4)}, ${coords[0][0].toFixed(4)}
          </span>
          <span style="font-size:8px; color:#64748b;">
            <span style="color:#dc2626;">●</span>
            Destino: ${coords[coords.length-1][1].toFixed(4)}, ${coords[coords.length-1][0].toFixed(4)}
          </span>
        </div>
      </div>`;
  } catch {
    return '';
  }
};

// ─── 2. Sección NOM-068 Inspección ────────────────────────────────────────────

const buildSeccionInspeccion = (inspeccion: any): string => {
  if (!inspeccion) {
    return `
      <div style="border:1px dashed #ef4444; padding:14px; margin-bottom:28px;
                  background:#fef2f2; border-radius:6px; text-align:center;">
        <p style="color:#ef4444; font-size:11px; margin:0; font-weight:bold;">
          ⚠️ NO SE REGISTRÓ INSPECCIÓN FÍSICO-MECÁNICA VINCULADA A ESTA JORNADA
        </p>
      </div>`;
  }

  let detalles: Record<string, boolean> = {};
  try {
    // Soporte para ambos formatos: detalles_json (PdfReporteCompleto) o items (PdfGenerator)
    const raw = inspeccion.detalles_json || inspeccion.items;
    detalles = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch (_) {}

  // Filtrar llaves internas que no son ítems de inspección
  const llavesIgnorar = ['fecha', 'hora', 'comentarios', 'id_jornada', 'firma',
                          'tipo', 'estatus', 'items', 'id', 'operador', 'unidad', 'placas'];

  const filas = Object.entries(detalles)
    .filter(([k]) => !llavesIgnorar.includes(k))
    .map(([pieza, ok]) => `
      <tr>
        <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;
                   font-size:11px; color:#1e293b;">
          ${pieza.replace(/_/g, ' / ').toUpperCase()}
        </td>
        <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;
                   text-align:right; font-weight:bold; font-size:11px;
                   color:${ok ? '#059669' : '#dc2626'};">
          ${ok ? 'PASÓ (✓)' : 'FALLA (✗)'}
        </td>
      </tr>`)
    .join('');

  const hayFallas = Object.values(detalles).some(v => v === false);
  const badgeColor = hayFallas ? '#dc2626' : '#059669';
  const badgeTexto = inspeccion.estatus || (hayFallas ? 'CON FALLAS' : 'APROBADO');

  const tipo = (inspeccion.tipo === 'fin' ? 'LLEGADA'
    : inspeccion.tipo === 'inicio' ? 'SALIDA (NOM-068)'
    : (inspeccion.tipo || 'GENERAL').toUpperCase());

  const fecha = inspeccion.fecha
    ? new Date(inspeccion.fecha).toLocaleString('es-MX')
    : (inspeccion.fecha_hora || '---');

  return `
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
      <div style="background:#f8fafc; padding:10px 14px; border:1px solid #e2e8f0;
                  border-top:none; font-size:11px; color:#334155;
                  display:flex; gap:16px; flex-wrap:wrap;">
        <span><strong>Operador:</strong> ${inspeccion.operador || 'No registrado'}</span>
        <span><strong>Unidad:</strong> ${inspeccion.unidad || 'N/A'} (${inspeccion.placas || '--'})</span>
        <span><strong>Tipo:</strong> ${tipo}</span>
        <span><strong>Fecha/Hora:</strong> ${fecha}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <thead>
          <tr style="background:#051C33; color:#fff;">
            <th style="padding:9px 10px; text-align:left; font-size:11px;">Elemento Revisado</th>
            <th style="padding:9px 10px; text-align:right; font-size:11px;">Estado Físico</th>
          </tr>
        </thead>
        <tbody>
          ${filas || '<tr><td colspan="2" style="text-align:center; padding:14px; color:#94a3b8; font-size:11px;">Sin detalles de inspección registrados</td></tr>'}
        </tbody>
      </table>
      ${inspeccion.comentarios ? `
        <div style="margin-top:8px; padding:8px 14px; border-left:4px solid #D4AF37;
                    background:#fffbeb; font-size:10px; color:#334155;">
          <strong style="color:#b45309;">Observaciones:</strong>
          <span style="font-style:italic;"> "${inspeccion.comentarios}"</span>
        </div>` : ''}
    </div>`;
};

// ─── 3. Sección NOM-087 ELD ───────────────────────────────────────────────────

const buildSeccionELD = (eld: DatosELD, operador: string, jornadaEnCurso: boolean): string => {
  const COLORES: Record<string, string> = {
    FS: '#94a3b8', DESC: '#38bdf8', COND: '#1e3a8a', SERV: '#f59e0b',
  };
  const ETIQUETAS: Record<string, string> = {
    FS: 'Fuera de Servicio', DESC: 'Descanso', COND: 'Conduciendo', SERV: 'En Servicio',
  };

  const W = 500, H = 96, ROW = H / 4, LABEL_H = 16;
  const SVG_H = H + LABEL_H;
  const FILAS = ['FS', 'DESC', 'COND', 'SERV'];
  const xMin = (min: number) => (min / 1440) * W;

  const segsEfectivos: SegmentoELD[] = eld.sinActividad
    ? [{ estado: 'FS', inicioMin: 0, finMin: 1440 }]
    : eld.segmentos;

  // Fondos alternados por fila
  const rectsFondos = FILAS.map((_, i) =>
    `<rect x="0" y="${LABEL_H + i * ROW}" width="${W}" height="${ROW}"
           fill="${i % 2 === 0 ? '#f1f5f9' : '#e8edf2'}" />`
  ).join('');

  // Líneas horizontales entre filas
  const lineasH = [0,1,2,3,4].map(i =>
    `<line x1="0" y1="${LABEL_H + i * ROW}" x2="${W}" y2="${LABEL_H + i * ROW}"
           stroke="#94a3b8" stroke-width="0.8"/>`
  ).join('');

  // Líneas verticales cada hora + etiquetas cada 3h
  const lineasV = Array.from({ length: 25 }, (_, h) => {
    const x = xMin(h * 60);
    const esPrincipal = h % 6 === 0;
    const label = (h % 3 === 0)
      ? `<text x="${x}" y="${LABEL_H - 3}" font-size="${esPrincipal ? 8 : 7}"
               fill="${esPrincipal ? '#475569' : '#94a3b8'}"
               font-weight="${esPrincipal ? 'bold' : 'normal'}"
               text-anchor="middle">${h}</text>`
      : '';
    return `<line x1="${x}" y1="${LABEL_H}" x2="${x}" y2="${SVG_H}"
                  stroke="${esPrincipal ? '#64748b' : '#cbd5e1'}"
                  stroke-width="${esPrincipal ? 0.8 : 0.4}"
                  stroke-dasharray="${esPrincipal ? '' : '2,2'}"/>
            ${label}`;
  }).join('');

  // Barras de actividad
  const barras = segsEfectivos.map(s => {
    const filaIdx = FILAS.indexOf(s.estado);
    if (filaIdx < 0) return '';
    const y = LABEL_H + filaIdx * ROW;
    const x = xMin(s.inicioMin);
    const w = Math.max(xMin(s.finMin) - x, 1);
    return `<rect x="${x}" y="${y + ROW * 0.15}" width="${w}" height="${ROW * 0.7}"
                  fill="${eld.sinActividad ? '#cbd5e1' : COLORES[s.estado]}" rx="1"/>`;
  }).join('');

  const celdaTotales = Object.entries(eld.totales).map(([k, v]) => `
    <td style="text-align:center; padding:8px; border:1px solid #e2e8f0;">
      <div style="font-size:9px; color:#64748b; margin-bottom:2px;">${ETIQUETAS[k]}</div>
      <div style="font-size:13px; font-weight:bold; color:${COLORES[k]};">
        ${fmtDuracion(v)}
      </div>
    </td>`).join('');

  const filasEventos = segsEfectivos.map((s, i) => `
    <tr style="${i % 2 === 0 ? 'background:#f8fafc;' : ''}">
      <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:10px; color:#475569;">
        ${minAHora(s.inicioMin)} – ${minAHora(s.finMin)}
      </td>
      <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9;">
        <span style="font-size:10px; font-weight:bold; color:${COLORES[s.estado]};">
          ${ETIQUETAS[s.estado]}
        </span>
      </td>
      <td style="padding:5px 8px; border-bottom:1px solid #f1f5f9;
                 font-size:10px; color:#64748b;">
        ${fmtDuracion(s.finMin - s.inicioMin)}
      </td>
    </tr>`).join('');

  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();

  return `
    <div style="margin-bottom:28px;">
      <div style="background:#051C33; padding:8px 14px; border-radius:6px 6px 0 0;
                  display:flex; justify-content:space-between; align-items:center;">
        <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
          II. CONTROL DE HORAS DE SERVICIO — NOM-087-SCT-2-2017 (ELD)
        </span>
        <span style="color:#94a3b8; font-size:10px;">${fechaHoy}</span>
      </div>

      <div style="background:#f8fafc; padding:10px 14px; border:1px solid #e2e8f0;
                  border-top:none; font-size:11px; color:#334155;
                  display:flex; justify-content:space-between; align-items:center;">
        <span><strong>Operador:</strong> ${operador || 'No registrado'}</span>
        ${jornadaEnCurso ? `
          <span style="background:#f59e0b; color:#000; font-size:9px; font-weight:bold;
                        padding:3px 10px; border-radius:20px;">
            ● JORNADA EN CURSO — DATOS PARCIALES
          </span>` : ''}
      </div>

      ${eld.sinActividad ? `
        <div style="padding:14px; border:1px solid #e2e8f0; border-top:none;
                    text-align:center; color:#94a3b8; font-size:11px; font-style:italic;">
          Sin actividad de conducción registrada para este día.
        </div>` : ''}

      <div style="border:1px solid #e2e8f0; border-top:none; padding:14px; background:#fff;">
        <div style="font-size:10px; color:#64748b; margin-bottom:6px;
                    font-weight:bold; letter-spacing:0.5px;">
          GRÁFICA DIARIA DE ACTIVIDAD
        </div>
        <div style="display:flex; gap:16px; margin-bottom:8px; flex-wrap:wrap;">
          ${Object.entries(COLORES).map(([k, c]) => `
            <span style="font-size:9px; color:#475569;">
              <span style="display:inline-block; width:10px; height:10px; background:${c};
                           border-radius:2px; vertical-align:middle; margin-right:3px;"></span>
              ${ETIQUETAS[k]}
            </span>`).join('')}
        </div>
        <div style="display:flex; align-items:flex-start;">
          <div style="width:32px; margin-right:4px; margin-top:8px;">
            ${FILAS.map(f => `
              <div style="height:${ROW}px; display:flex; align-items:center;
                          justify-content:flex-end; padding-right:4px;">
                <span style="font-size:8px; font-weight:bold; color:#64748b;">${f}</span>
              </div>`).join('')}
          </div>
          <svg xmlns="http://www.w3.org/2000/svg"
               width="${W}" height="${SVG_H}"
               viewBox="0 0 ${W} ${SVG_H}"
               style="display:block; border:1px solid #e2e8f0; border-radius:4px;">
            <rect width="${W}" height="${SVG_H}" fill="#fff"/>
            <g>${rectsFondos}</g>
            <g>${lineasV}</g>
            <g>${lineasH}</g>
            <g>${barras}</g>
          </svg>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <tbody><tr>${celdaTotales}</tr></tbody>
      </table>

      ${!eld.sinActividad && segsEfectivos.length > 0 ? `
        <div style="border:1px solid #e2e8f0; border-top:none;">
          <div style="background:#f1f5f9; padding:6px 10px; font-size:10px;
                      font-weight:bold; color:#475569; letter-spacing:1px;">
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

// ─── 4. Sección Pausas y Rastreo ──────────────────────────────────────────────

const buildSeccionPausas = (pausas: any[], incidencias?: any[]): string => {
  const hayPausas = pausas && pausas.length > 0;
  const hayIncidencias = incidencias && incidencias.length > 0;
  if (!hayPausas && !hayIncidencias) return '';

  // pausas: columnas reales → motivo, inicio, fin, duracion, direccion
  const filasPausas = hayPausas ? pausas.map(p => `
    <tr>
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9;">${p.motivo || '---'}</td>
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9;">${p.inicio ? new Date(p.inicio).toLocaleTimeString('es-MX') : '---'}</td>
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9;">${p.duracion ? `${Math.round(Number(p.duracion))} min` : '---'}</td>
      <td style="padding:6px 8px; font-size:9px; color:#64748b; border-bottom:1px solid #f1f5f9;">${p.direccion || '---'}</td>
    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:10px;color:#94a3b8;font-size:10px;">Sin pausas registradas</td></tr>';

  // incidencias: columnas reales → tipo, fecha, descripcion, direccion
  const filasIncidencias = hayIncidencias ? incidencias!.map(inc => `
    <tr style="background:#fff8f8;">
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9; color:#dc2626; font-weight:bold;">${inc.tipo || '---'}</td>
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9;">${inc.fecha ? new Date(inc.fecha).toLocaleTimeString('es-MX') : '---'}</td>
      <td style="padding:6px 8px; font-size:10px; border-bottom:1px solid #f1f5f9;">${inc.descripcion || '---'}</td>
      <td style="padding:6px 8px; font-size:9px; color:#64748b; border-bottom:1px solid #f1f5f9;">${inc.direccion || '---'}</td>
    </tr>`).join('') : '';

  const tituloIncidencias = hayIncidencias ? ' + INCIDENCIAS EN RUTA' : '';

  return `
    <div style="margin-bottom:28px;">
      <div style="background:#051C33; padding:8px 14px; border-radius:6px 6px 0 0;">
        <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
          III. REGISTRO DE PAUSAS Y DESCANSOS${tituloIncidencias}
        </span>
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Motivo / Tipo</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Hora</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Duración / Detalle</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Ubicación</th>
          </tr>
        </thead>
        <tbody>${filasPausas}${filasIncidencias}</tbody>
      </table>
    </div>`;
};

const buildSeccionRastreo = (puntos: any[]): string => {
  if (!puntos || puntos.length === 0) return '';
  const filas = puntos.map(pt => `
    <tr>
      <td style="padding:5px 8px; font-weight:bold; font-size:9px;
                 border-bottom:1px solid #f1f5f9;">
        ${new Date(pt.hora).toLocaleTimeString('es-MX')}
      </td>
      <td style="padding:5px 8px; font-size:9px; border-bottom:1px solid #f1f5f9;">
        ${pt.tipo || '---'}
      </td>
      <td style="padding:5px 8px; font-family:monospace; font-size:8px;
                 border-bottom:1px solid #f1f5f9;">
        ${pt.ubicacion || '---'}
      </td>
      <td style="padding:5px 8px; font-size:8px; color:#64748b;
                 border-bottom:1px solid #f1f5f9;">
        ${pt.detalle || '---'}
      </td>
    </tr>`).join('');

  return `
    <div style="margin-bottom:28px;">
      <div style="background:#051C33; padding:8px 14px; border-radius:6px 6px 0 0;">
        <span style="color:#D4AF37; font-weight:bold; font-size:13px; letter-spacing:1px;">
          IV. TRAZABILIDAD SATELITAL (PUNTOS DE CONTROL)
        </span>
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Hora</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Evento</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Coordenadas</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; color:#334155;">Detalle</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
};

// ─── 5. Obtener ELD del día desde SQLite ──────────────────────────────────────

const obtenerELDDelDia = async (jornadaId: number): Promise<DatosELD> => {
  try {
    const db = await getDB();
    const hoy = new Date();
    const fechaISO = hoy.toISOString().substring(0, 10);

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
        const motivo = (p.motivo ?? '').toLowerCase();
        const estPausa: 'DESC' | 'SERV' =
          motivo.includes('comida') || motivo.includes('descanso') ? 'DESC' : 'SERV';
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
    return { segmentos, sinActividad: false, totales: calcTotales(segmentos) };
  } catch (e) {
    console.error('[PdfMaestro] obtenerELDDelDia error:', e);
    return { segmentos: [], sinActividad: true, totales: { FS: 1440, DESC: 0, COND: 0, SERV: 0 } };
  }
};

// ─── FUNCIÓN PRINCIPAL EXPORTADA ─────────────────────────────────────────────

export const generarPdfMaestro = async (opciones: OpcionesPdf): Promise<string | null> => {
  const { jornadaId, inspeccionId } = opciones;

  // ── 1. Validar PRO ────────────────────────────────────────────────────────
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const esPro = typeof customerInfo.entitlements.active['pro'] !== 'undefined';
    if (!esPro) {
      Alert.alert(
        'Función Bloqueada',
        'Necesitas una suscripción PRO activa para generar documentos oficiales.'
      );
      return null;
    }
  } catch (e) {
    console.log('[PdfMaestro] Error validación PRO:', e);
    return null;
  }

  // ── 2. Cargar datos de la jornada ─────────────────────────────────────────
  let jornada: any = null;
  let inspeccion: any = null;
  let pausas: any[] = [];
  let incidencias: any[] = [];
  let puntosRastreo: any[] = [];

  try {
    const db = await getDB();

    jornada = await db.getFirstAsync('SELECT * FROM jornadas WHERE id = ?', [jornadaId]);
    if (!jornada) {
      Alert.alert('Error', 'No se encontró la jornada.');
      return null;
    }

    pausas = await db.getAllAsync(
      'SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC',
      [jornadaId]
    ) || [];

    incidencias = await db.getAllAsync(
      'SELECT * FROM incidencias WHERE jornada_id = ? ORDER BY fecha ASC',
      [jornadaId]
    ) || [];

    // No existe tabla 'rastreo' — los puntos GPS están en 'puntos_gps'
    // Se normalizan al formato { hora, tipo, ubicacion, detalle } que usa buildSeccionRastreo
    const puntosGPS: any[] = await db.getAllAsync(
      'SELECT latitud, longitud, velocidad, fecha, timestamp FROM puntos_gps WHERE jornada_id = ? ORDER BY id ASC',
      [jornadaId]
    ) || [];

    // Submuestrear (máx 15 puntos para no saturar el PDF)
    const paso = Math.max(1, Math.floor(puntosGPS.length / 15));
    puntosRastreo = puntosGPS
      .filter((_, i) => i % paso === 0)
      .map(pt => ({
        hora:      pt.fecha || new Date(pt.timestamp || 0).toISOString(),
        tipo:      'RASTREO',
        ubicacion: `${Number(pt.latitud).toFixed(5)}, ${Number(pt.longitud).toFixed(5)}`,
        detalle:   pt.velocidad ? `${Number(pt.velocidad * 3.6).toFixed(0)} km/h` : 'En ruta',
      }));

    // Cargar inspección: primero por inspeccionId si se pasó, luego buscar vinculada
    const idInsp = inspeccionId ?? jornada.inspeccion_id;
    if (idInsp) {
      inspeccion = await db.getFirstAsync(
        `SELECT i.*, j.operador, j.unidad, j.placas
         FROM inspecciones i
         LEFT JOIN jornadas j ON j.id = ?
         WHERE i.id = ?`,
        [jornadaId, idInsp]
      );
    }
    // Si no se encontró con JOIN, intentar sin join
    if (!inspeccion && idInsp) {
      inspeccion = await db.getFirstAsync('SELECT * FROM inspecciones WHERE id = ?', [idInsp]);
    }

  } catch (e) {
    console.error('[PdfMaestro] Error cargando datos:', e);
    Alert.alert('Error', 'No se pudieron cargar los datos de la jornada.');
    return null;
  }

  // ── 3. ELD del día ────────────────────────────────────────────────────────
  const eld = await obtenerELDDelDia(jornadaId);

  // ── 4. Sello SHA-256 ──────────────────────────────────────────────────────
  // SOLUCIÓN AL BUG DEL QR:
  // El sello se calcula SOLO con campos que existen desde el inicio de la jornada.
  // NO usamos km_totales porque no existe mientras la jornada está en curso.
  // Esto garantiza que el QR sea válido incluso antes de terminar la jornada.
  const jornadaEnCurso = !jornada.fecha_fin;
  const payloadSello = JSON.stringify({
    id: jornada.id_interno ?? jornada.id,
    operador: jornada.operador || '',
    unidad: jornada.unidad || '',
    fecha_inicio: jornada.fecha_inicio || '',
    // ⚠️ km_totales EXCLUIDO intencionalmente para que el hash sea estable
  });
  const selloDigital = (jornada.sello_digital || CryptoJS.SHA256(payloadSello).toString()).toLowerCase();
  const idValidacion = jornada.id_interno ?? jornada.id;
  const urlValidacion = `https://bitacora57.com/validar?id=${idValidacion}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(urlValidacion)}`;

  // ── 5. Metadatos del documento ────────────────────────────────────────────
  const operador = jornada.operador || inspeccion?.operador || 'No registrado';
  const inicio = new Date(jornada.fecha_inicio).toLocaleString('es-MX');
  const fin = jornada.fecha_fin
    ? new Date(jornada.fecha_fin).toLocaleString('es-MX')
    : '— En curso';
  const fechaDoc = new Date().toLocaleString('es-MX');

  // ── 6. Construir HTML ─────────────────────────────────────────────────────
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
            line-height: 1.5;
          }
        </style>
      </head>
      <body>

        <!-- ══ ENCABEZADO ══ -->
        <div style="border-bottom:3px solid #D4AF37; padding-bottom:14px;
                    margin-bottom:22px; display:flex; justify-content:space-between;
                    align-items:flex-end;">
          <div>
            <h1 style="font-size:26px; color:#051C33; margin-bottom:2px; letter-spacing:-0.5px;">
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
            ${jornadaEnCurso ? `
              <p style="font-size:9px; color:#f59e0b; font-weight:bold; margin-top:4px;">
                ● JORNADA EN CURSO
              </p>` : `
              <p style="font-size:9px; color:#059669; font-weight:bold; margin-top:4px;">
                ✓ JORNADA FINALIZADA
              </p>`}
          </div>
        </div>

        <!-- ══ INFO GENERAL ══ -->
        <div style="background:#f1f5f9; padding:12px 16px; border-radius:6px;
                    margin-bottom:22px; border:1px solid #e2e8f0;">
          <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:11px; color:#334155;">
            <span><strong>Operador:</strong> ${operador}</span>
            <span><strong>Licencia:</strong> ${jornada.licencia || '---'}</span>
            <span><strong>Unidad:</strong> ${jornada.unidad || '---'} (${jornada.placas || '---'})</span>
            <span><strong>Empresa:</strong> ${jornada.permisionario || '---'}</span>
          </div>
          <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:11px;
                      color:#334155; margin-top:8px; padding-top:8px;
                      border-top:1px dashed #cbd5e1;">
            <span><strong>Origen:</strong> ${jornada.origen || '---'}</span>
            <span><strong>Destino:</strong> ${jornada.destino || '---'}</span>
            <span><strong>Inicio:</strong> ${inicio}</span>
            <span><strong>Fin:</strong> ${fin}</span>
            ${jornada.km_totales ? `<span><strong>KM Totales:</strong> ${jornada.km_totales} km</span>` : ''}
          </div>
        </div>

        <!-- ══ SECCIONES PRINCIPALES ══ -->
        ${buildSeccionInspeccion(inspeccion)}
        ${buildSeccionELD(eld, operador, jornadaEnCurso)}
        ${buildSeccionPausas(pausas, incidencias)}
        ${buildSeccionRastreo(puntosRastreo)}
        ${buildMapaSVG(jornada.ruta_geojson)}

        <!-- ══ PIE LEGAL: FIRMA + QR + SELLO ══ -->
        <div style="margin-top:30px; padding-top:20px; border-top:2px solid #000;
                    display:flex; justify-content:space-between; align-items:flex-end;">
          <div style="text-align:center; width:55%;">
            ${jornada.firma
              ? `<img src="${jornada.firma}"
                      style="width:150px; height:70px; object-fit:contain; display:block; margin:0 auto;" />`
              : '<div style="height:60px;"></div>'}
            <div style="border-top:1px solid #000; width:80%; margin:6px auto 0 auto;"></div>
            <p style="font-size:10px; margin-top:3px; font-weight:bold;">Firma del Operador</p>
            <p style="font-size:8px; margin:0; color:#64748b;">Bajo protesta de decir verdad</p>
          </div>
          <div style="text-align:center; width:35%;">
            <img src="${qrUrl}" width="90" height="90" />
            <p style="font-size:8px; margin-top:4px; color:#64748b;">Escanear para Validar</p>
          </div>
        </div>

        <!-- ══ SELLO DIGITAL ══ -->
        <div style="margin-top:14px; font-family:'Courier New', monospace; font-size:7px;
                    color:#64748b; word-break:break-all; background:#f8fafc;
                    padding:8px 10px; border:1px solid #e2e8f0; border-radius:4px;">
          <strong>SELLO DIGITAL SHA-256:</strong> ${selloDigital}
        </div>

        <!-- ══ NOTA AL PIE ══ -->
        <div style="margin-top:16px; font-size:8px; color:#94a3b8; text-align:center;">
          <p>Documento generado automáticamente por Bitácora 57.</p>
          <p style="margin-top:2px;">
            Válido como evidencia de cumplimiento ante la SICT y la Guardia Nacional.
          </p>
        </div>

      </body>
    </html>`;

  // ── 7. Generar y compartir ────────────────────────────────────────────────
  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      UTI: '.pdf',
      mimeType: 'application/pdf',
      dialogTitle: `Bitácora de Viaje #${jornada.id} — ${jornadaEnCurso ? 'En Curso' : 'Finalizada'}`,
    });
    return uri;
  } catch (error) {
    console.error('[PdfMaestro] Error generando PDF:', error);
    Alert.alert('Error', 'No se pudo generar el documento PDF.');
    return null;
  }
};
