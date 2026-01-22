import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import CryptoJS from 'crypto-js';

export const generarPDF = async (jornada: any, pausas: any[], incidencias: any[], inspecciones: any[]) => {
  if (!jornada) return;

  const listaPausas = pausas || [];
  const listaIncidencias = incidencias || [];
  const listaInspecciones = inspecciones || [];

  // --- 1. GENERACIÓN DE SELLO DIGITAL (SHA1) ---
  const cadenaOriginal = `${jornada.id}|${jornada.operador}|${jornada.licencia || 'SIN_LIC'}|${jornada.fecha_inicio}|${jornada.permisionario}`;
  const selloDigital = CryptoJS.algo.SHA1.create().update(cadenaOriginal).finalize().toString().toUpperCase();

  // --- 2. GENERACIÓN DE QR DE VALIDACIÓN ---
  const urlValidacion = `https://device-streaming-61499c4a.web.app/validar.html?id=${jornada.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlValidacion)}`;

  const inicio = new Date(jornada.fecha_inicio).toLocaleString();
  const fin = jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : 'En curso';

  // --- GENERACIÓN DE FILAS (PAUSAS) CON DIRECCIÓN ---
  const filasPausas = listaPausas.map((p: any) => `
    <tr>
      <td>${p.motivo || 'Varias'}</td>
      <td>${p.inicio ? new Date(p.inicio).toLocaleTimeString() : '--'}</td>
      <td>${p.duracion ? Number(p.duracion).toFixed(0) + ' min' : '--'}</td>
      <td style="font-size: 8px;">${p.direccion || 'Ubicación GPS registrada'}</td>
    </tr>
  `).join('');

  // --- GENERACIÓN DE FILAS (INCIDENCIAS) ---
  const filasIncidencias = listaIncidencias.map((i: any) => `
    <tr>
      <td style="color:#ef4444; font-weight:bold;">${i.tipo}</td>
      <td>${new Date(i.fecha).toLocaleTimeString()}</td>
      <td>${i.descripcion}</td>
      <td style="font-size: 8px;">${i.direccion || 'Ubicación GPS registrada'}</td>
    </tr>
  `).join('');

  // --- GENERACIÓN DE FILAS (INSPECCIONES) ---
  const filasInspecciones = listaInspecciones.map((insp: any) => {
    let resumen = "Sin detalles";
    try {
        const detalles = JSON.parse(insp.detalles_json);
        const total = Object.keys(detalles).length;
        const ok = Object.values(detalles).filter(v => v === true).length;
        resumen = `${ok} de ${total} Puntos OK`;
    } catch (e) { resumen = "Datos ilegibles"; }

    return `
      <tr>
        <td style="text-transform:uppercase; font-weight:bold;">${insp.tipo}</td>
        <td>${new Date(insp.fecha).toLocaleString()}</td>
        <td>${resumen}</td>
        <td>${insp.comentarios || 'Sin observaciones'}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
          h1 { color: #f59e0b; text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; margin-bottom: 5px; }
          .cert-header { text-align: center; font-size: 8px; color: #64748b; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          h2 { color: #1e293b; margin-top: 15px; border-bottom: 1px solid #ccc; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
          .info-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .info-item { width: 45%; font-size: 10px; margin-bottom: 5px; }
          .label { font-weight: bold; color: #64748b; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9px; margin-bottom: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
          th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; }
          
          .legal-footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #eee; padding-top: 20px; }
          .signature-box { text-align: center; width: 60%; }
          .signature-img { width: 180px; height: 80px; object-fit: contain; border-bottom: 1px solid #000; }
          .qr-box { text-align: center; width: 30%; }
          .qr-img { width: 100px; height: 100px; }
          .sello-digital { margin-top: 20px; font-family: 'Courier', monospace; font-size: 7px; color: #64748b; word-break: break-all; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="cert-header">Documento de Control de Horas de Servicio - NOM-087-SCT-2-2017</div>
        <h1>REPORTE DE VIAJE #${jornada.id}</h1>
        
        <div class="info-grid">
          <div class="info-item"><span class="label">Operador:</span> ${jornada.operador || '---'}</div>
          <div class="info-item"><span class="label">Licencia Federal:</span> <strong>${jornada.licencia || '---'}</strong></div>
          <div class="info-item"><span class="label">Unidad:</span> ${jornada.unidad || '---'} (${jornada.placas || ''})</div>
          <div class="info-item"><span class="label">Empresa:</span> ${jornada.permisionario || '---'}</div>
          <div class="info-item"><span class="label">Origen:</span> ${jornada.origen || '---'}</div>
          <div class="info-item"><span class="label">Destino:</span> ${jornada.destino || '---'}</div>
          <div class="info-item"><span class="label">Inicio:</span> ${inicio}</div>
          <div class="info-item"><span class="label">Fin:</span> ${fin}</div>
        </div>

        ${listaPausas.length > 0 ? `
          <h2>Bitácora de Pausas (Descanso / Comida)</h2>
          <table>
            <thead>
              <tr>
                <th width="15%">Motivo</th>
                <th width="15%">Hora</th>
                <th width="15%">Duración</th>
                <th width="55%">Ubicación Geocodificada</th>
              </tr>
            </thead>
            <tbody>${filasPausas}</tbody>
          </table>
        ` : '<p style="font-size:9px; color:#999;">No se registraron pausas en este trayecto.</p>'}

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

        ${listaInspecciones.length > 0 ? `
          <h2>Inspecciones Mecánicas</h2>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Resultado</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>${filasInspecciones}</tbody>
          </table>
        ` : ''}

        <div class="legal-footer">
          <div class="signature-box">
            ${jornada.firma ? `<img src="${jornada.firma}" class="signature-img" />` : '<div style="height:80px;"></div>'}
            <p style="font-size:10px; margin-top:5px;">Firma del Operador Responsable</p>
          </div>
          <div class="qr-box">
            <img src="${qrUrl}" class="qr-img" />
            <p style="font-size:8px; margin-top:5px; color:#64748b;">Escanear para validación SCT</p>
          </div>
        </div>

        <div class="sello-digital">
          <strong>SELLO DIGITAL SHA1 (Cadena Original):</strong><br/>
          ${selloDigital}
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