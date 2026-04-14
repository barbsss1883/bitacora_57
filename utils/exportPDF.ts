import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

interface JornadaExport {
  fecha: string | number | Date;
  operador?: string;
  unidad?: string;
  placas?: string;
  origen?: string;
  destino?: string;
  km_totales?: number;
}

export async function exportPDF(j: JornadaExport): Promise<string | null> {
  if (!j) {
    console.error('exportPDF: se recibió un objeto de jornada vacío o nulo');
    return null;
  }

  try {
    const html = `
      <html>
      <body style="font-family:Arial;padding:20px;">
        <h1>Reporte Jornada</h1>
        <table border="1" style="border-collapse:collapse;width:100%">
          <tr><th>Fecha</th><td>${new Date(j.fecha).toLocaleString()}</td></tr>
          <tr><th>Operador</th><td>${j.operador || ''}</td></tr>
          <tr><th>Unidad</th><td>${j.unidad || ''} ${j.placas ? `(${j.placas})` : ''}</td></tr>
          <tr><th>Ruta</th><td>${j.origen || '--'} → ${j.destino || '--'}</td></tr>
          <tr><th>KM Totales</th><td>${j.km_totales ?? '--'} km</td></tr>
        </table>
      </body>
      </html>`;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
    return uri;
  } catch (e) {
    console.error('exportPDF error:', e);
    return null;
  }
}