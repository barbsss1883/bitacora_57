import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';

export const generarPDF = async (
  jornada: any, 
  pausas: any[], 
  incidencias: any[], 
  inspeccion: any,      
  puntosRastreo: any[],
  rutaGeojson?: string | null
) => {
  if (!jornada) return;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const esPro = typeof customerInfo.entitlements.active['pro'] !== "undefined";

    if (!esPro) {
      
        Alert.alert(
            "Función Bloqueada",
            "Necesitas una suscripción PRO activa para generar y compartir documentos oficiales."
        );
        return null; 
    }
  } catch (e) {
    console.log("Error de validación en motor PDF", e);
    return null;
  }

  const listaPausas = pausas || [];
  const listaIncidencias = incidencias || [];
  const listaPuntos = puntosRastreo || [];
  const idSello = Number(jornada.id_interno ?? jornada.id ?? 0);
  const kmSello = Number(jornada.km_totales ?? jornada.km_calculados ?? 0) || 0;
  const payloadSello = JSON.stringify({
    id: idSello,
    operador: jornada.operador || '',
    unidad: jornada.unidad || '',
    fecha_inicio: jornada.fecha_inicio || '',
    km_totales: kmSello
  });
  const selloDigital = (jornada.sello_digital || CryptoJS.SHA256(payloadSello).toString()).toLowerCase();
  const baseUrl = "https://bitacora57.com/validar";
  const idValidacion = jornada.id_interno ?? jornada.id;
  const urlValidacion = `${baseUrl}?id=${idValidacion}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlValidacion)}`;

  const inicio = new Date(jornada.fecha_inicio).toLocaleString();
  const fin = jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : 'En curso';

  const filasPausas = listaPausas.map((p: any) => `
    <tr>
      <td>${p.motivo || 'Varias'}</td>
      <td>${p.inicio ? new Date(p.inicio).toLocaleTimeString() : '--'}</td>
      <td>${p.duracion ? Number(p.duracion).toFixed(0) + ' min' : '--'}</td>
      <td style="font-size: 8px;">${p.direccion || 'Ubicación GPS registrada'}</td>
    </tr>
  `).join('');

  const filasIncidencias = listaIncidencias.map((i: any) => `
    <tr>
      <td style="color:#ef4444; font-weight:bold;">${i.tipo}</td>
      <td>${new Date(i.fecha).toLocaleTimeString()}</td>
      <td>${i.descripcion}</td>
      <td style="font-size: 8px;">${i.direccion || 'Ubicación GPS registrada'}</td>
    </tr>
  `).join('');

  let htmlInspeccion = '';
  if (inspeccion) {
    const checklistFuente = (inspeccion.items && typeof inspeccion.items === 'object')
      ? inspeccion.items
      : inspeccion;
    const llavesIgnorar = ['fecha', 'hora', 'comentarios', 'id_jornada', 'firma', 'tipo', 'estatus', 'items'];
    const puntosRevisados = Object.keys(checklistFuente || {}).filter(
      (k) => !llavesIgnorar.includes(k) && checklistFuente[k] === true
    );
    const estadoInspeccion = inspeccion.estatus
      || ((inspeccion.comentarios || '').trim().length > 5 ? 'CON OBSERVACIONES' : 'APROBADO');
    const tipoInspeccion = inspeccion.tipo === 'fin'
      ? 'LLEGADA'
      : inspeccion.tipo === 'inicio'
        ? 'SALIDA'
        : (inspeccion.tipo || 'GENERAL').toUpperCase();
    
    const gridItems = puntosRevisados.map(k => `
      <div style="width: 32%; display: inline-block; margin-bottom: 4px; font-size: 9px;">
        <span style="display:inline-block; width:8px; height:8px; background:#000; margin-right:4px; vertical-align:middle;"></span>
        ${k.toUpperCase().replace(/_/g, ' ')}
      </div>
    `).join('');

    htmlInspeccion = `
      <div style="border: 1px solid #000; padding: 10px; margin-top: 15px;">
        <div style="background:#eee; padding:5px; margin:-10px -10px 10px -10px; border-bottom:1px solid #000; font-weight:bold; font-size:10px;">
          III. REPORTE DE INSPECCIÓN FÍSICO-MECÁNICA (NOM-068-SCT-2-2014)
        </div>
        <div style="font-size:9px; margin-bottom:8px;">
          <strong>Fecha:</strong> ${inspeccion.fecha || '---'} &nbsp;|&nbsp; 
          <strong>Hora:</strong> ${inspeccion.hora || '---'} &nbsp;|&nbsp; 
          <strong>Tipo:</strong> ${tipoInspeccion} &nbsp;|&nbsp;
          <strong>Estado:</strong> ${estadoInspeccion}
        </div>
        <div style="display:flex; flex-wrap:wrap;">
          ${gridItems || 'Sin puntos marcados'}
        </div>
        <div style="margin-top:8px; font-size:9px; font-style:italic; border-top:1px dotted #ccc; padding-top:4px;">
          <strong>Observaciones:</strong> ${inspeccion.comentarios || 'Sin observaciones adicionales.'}
        </div>
      </div>
    `;
  } else {
    htmlInspeccion = `
      <div style="border: 1px dashed #ef4444; padding: 10px; margin-top: 15px; background: #fef2f2;">
        <p style="color:#ef4444; font-size:10px; text-align:center; margin:0; font-weight:bold;">
          ⚠️ NO SE REGISTRÓ INSPECCIÓN VISUAL VINCULADA A ESTE VIAJE
        </p>
      </div>
    `;
  }

  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 25px; color: #111; }
          h1 { color: #f59e0b; text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 5px; font-size: 18px; }
          .cert-header { text-align: center; font-size: 8px; color: #64748b; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          h2 { background: #1e293b; color: #fff; padding: 5px; margin-top: 15px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
          
          .info-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
          .info-item { width: 48%; font-size: 10px; }
          .label { font-weight: bold; color: #334155; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9px; margin-bottom: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px; text-align: left; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
          
          .legal-footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #000; padding-top: 20px; }
          .signature-box { text-align: center; width: 60%; }
          .signature-img { width: 150px; height: 70px; object-fit: contain; }
          .qr-box { text-align: center; width: 30%; }
          .qr-img { width: 80px; height: 80px; }
          .sello-digital { margin-top: 15px; font-family: 'Courier', monospace; font-size: 6px; color: #64748b; word-break: break-all; background: #f8fafc; padding: 5px; border: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="cert-header">Documento de Control de Horas de Servicio - NOM-087-SCT-2-2017</div>
        <h1>BITÁCORA DE VIAJE #${jornada.id}</h1>
        
        <div class="info-grid">
          <div class="info-item"><span class="label">Operador:</span> ${jornada.operador || '---'}</div>
          <div class="info-item"><span class="label">Licencia Federal:</span> <strong>${jornada.licencia || '---'}</strong></div>
          <div class="info-item"><span class="label">Unidad:</span> ${jornada.unidad || '---'} (${jornada.placas || ''})</div>
          <div class="info-item"><span class="label">Empresa:</span> ${jornada.permisionario || '---'}</div>
          <div class="info-item"><span class="label">Origen:</span> ${jornada.origen || '---'}</div>
          <div class="info-item"><span class="label">Destino:</span> ${jornada.destino || '---'}</div>
          <div class="info-item"><span class="label">Inicio:</span> ${inicio}</div>
          <div class="info-item"><span class="label">Fin:</span> ${fin}</div>
          <div class="info-item" style="width:100%"><span class="label">Domicilio Fiscal:</span> ${jornada.domicilio || '---'}</div>
        </div>

        ${htmlInspeccion}

        ${listaPausas.length > 0 ? `
          <h2>II. Registro de Pausas y Descansos</h2>
          <table>
            <thead>
              <tr>
                <th width="15%">Motivo</th>
                <th width="15%">Hora Inicio</th>
                <th width="15%">Duración</th>
                <th width="55%">Ubicación</th>
              </tr>
            </thead>
            <tbody>${filasPausas}</tbody>
          </table>
        ` : '<p style="font-size:9px; color:#999; margin:10px 0;">* Sin pausas registradas en este trayecto.</p>'}

        ${listaIncidencias.length > 0 ? `
          <h2>Reporte de Incidencias</h2>
          <table>
            <thead>
              <tr>
                <th width="15%">Tipo</th>
                <th width="15%">Hora</th>
                <th width="30%">Descripción</th>
                <th width="40%">Ubicación</th>
              </tr>
            </thead>
            <tbody>${filasIncidencias}</tbody>
          </table>
        ` : ''}





        <div class="legal-footer">
          <div class="signature-box">
            ${jornada.firma ? `<img src="${jornada.firma}" class="signature-img" />` : '<div style="height:50px;"></div>'}
            <div style="border-top:1px solid #000; width:80%; margin:5px auto 0 auto;"></div>
            <p style="font-size:9px; margin-top:2px; font-weight:bold;">Firma del Operador</p>
            <p style="font-size:7px; margin:0;">Bajo protesta de decir verdad</p>
          </div>
          <div class="qr-box">
            <img src="${qrUrl}" class="qr-img" />
            <p style="font-size:7px; margin-top:5px; color:#64748b;">Escanear para Validar</p>
          </div>
        </div>

        <div class="sello-digital">
          <strong>SELLO DIGITAL SHA-256:</strong> ${selloDigital}
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    return uri;
  } catch (error) {
    console.error("Error generando PDF:", error);
    return null;
  }
};
