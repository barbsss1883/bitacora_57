import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// AHORA ACEPTA UN 4° ARGUMENTO: inspecciones
export const generarPDF = async (jornada: any, pausas: any[], incidencias: any[], inspecciones: any[]) => {
  if (!jornada) return;

  // --- BLINDAJE ANTI-ERRORES ---
  const listaPausas = pausas || [];
  const listaIncidencias = incidencias || [];
  const listaInspecciones = inspecciones || [];

  // 1. FORMATEO DE FECHAS
  const inicio = new Date(jornada.fecha_inicio).toLocaleString();
  const fin = jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : 'En curso';

  // 2. FILAS DE PAUSAS
  const filasPausas = listaPausas.map((p: any) => `
    <tr>
      <td>${p.motivo || 'Varias'}</td>
      <td>${p.inicio ? new Date(p.inicio).toLocaleTimeString() : '--'}</td>
      <td>${p.fin ? new Date(p.fin).toLocaleTimeString() : '--'}</td>
      <td>${p.duracion ? Number(p.duracion).toFixed(1) + ' min' : '--'}</td>
    </tr>
  `).join('');

  // 3. FILAS DE INCIDENCIAS
  const filasIncidencias = listaIncidencias.map((i: any) => `
    <tr>
      <td>${i.tipo || 'General'}</td>
      <td>${i.descripcion || ''}</td>
      <td>${i.fecha ? new Date(i.fecha).toLocaleString() : '--'}</td>
    </tr>
  `).join('');

  // 4. FILAS DE INSPECCIONES (NUEVO)
  const filasInspecciones = listaInspecciones.map((insp: any) => {
    // Calculamos el resumen del checklist (Ej: 10/10 OK)
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

  // 5. CONSTRUCCIÓN DEL HTML
  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
          h1 { color: #f59e0b; text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
          h2 { color: #1e293b; margin-top: 25px; border-bottom: 1px solid #ccc; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
          .info-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .info-item { width: 45%; font-size: 12px; margin-bottom: 5px; }
          .label { font-weight: bold; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; color: #1e293b; }
          .signature-box { margin-top: 40px; text-align: center; }
          .signature-img { width: 200px; height: 100px; object-fit: contain; border-bottom: 1px solid #000; }
          .footer { margin-top: 50px; font-size: 8px; text-align: center; color: #999; }
        </style>
      </head>
      <body>
        <h1>REPORTE DE VIAJE #${jornada.id}</h1>
        
        <h2>Información General</h2>
        <div class="info-grid">
          <div class="info-item"><span class="label">Operador:</span> ${jornada.operador || '---'}</div>
          <div class="info-item"><span class="label">Unidad:</span> ${jornada.unidad || '---'} (${jornada.placas || ''})</div>
          <div class="info-item"><span class="label">Origen:</span> ${jornada.origen || '---'}</div>
          <div class="info-item"><span class="label">Destino:</span> ${jornada.destino || '---'}</div>
          <div class="info-item"><span class="label">Inicio:</span> ${inicio}</div>
          <div class="info-item"><span class="label">Fin:</span> ${fin}</div>
          <div class="info-item"><span class="label">Tipo Carga:</span> ${jornada.tipo_servicio || 'General'}</div>
          <div class="info-item"><span class="label">Permisionario:</span> ${jornada.permisionario || '---'}</div>
        </div>

        <h2>Inspecciones Visuales (360°)</h2>
        ${listaInspecciones.length > 0 ? `
          <table>
            <thead><tr><th>Momento</th><th>Fecha/Hora</th><th>Checklist</th><th>Observaciones</th></tr></thead>
            <tbody>${filasInspecciones}</tbody>
          </table>
        ` : '<p style="font-size:10px; color:#666; font-style:italic;">No se registraron inspecciones en este viaje.</p>'}

        <h2>Bitácora de Pausas</h2>
        ${listaPausas.length > 0 ? `
          <table>
            <thead><tr><th>Motivo</th><th>Inicio</th><th>Fin</th><th>Duración</th></tr></thead>
            <tbody>${filasPausas}</tbody>
          </table>
        ` : '<p style="font-size:10px; color:#666;">Sin pausas registradas.</p>'}

        <h2>Incidencias Reportadas</h2>
        ${listaIncidencias.length > 0 ? `
          <table>
            <thead><tr><th>Tipo</th><th>Descripción</th><th>Fecha</th></tr></thead>
            <tbody>${filasIncidencias}</tbody>
          </table>
        ` : '<p style="font-size:10px; color:#666;">Sin incidencias.</p>'}

        <div class="signature-box">
          ${jornada.firma ? `<img src="${jornada.firma}" class="signature-img" />` : '<div style="height:50px; border-bottom:1px solid #000; width:200px; margin:auto;"></div>'}
          <p>Firma del Operador</p>
        </div>

        <div class="footer">
          <p>Generado por Bitácora57 App - ${new Date().toLocaleString()}</p>
          <p>Ruta Digital: ${jornada.ruta_geojson ? 'DISPONIBLE EN BASE DE DATOS' : 'NO REGISTRADA'}</p>
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } catch (error) {
    console.error("Error generando PDF:", error);
  }
};