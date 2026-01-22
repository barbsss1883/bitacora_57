import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export async function exportPDF(j) {
  const html = `<html><body style="font-family:Arial;padding:20px;"><h1>Reporte Jornada</h1>
    <table border="1" style="border-collapse:collapse;width:100%"><tr><th>Fecha</th><td>${new Date(j.fecha).toLocaleString()}</td></tr>
    <tr><th>Operador</th><td>${j.operador||''}</td></tr></table></body></html>`;

  // Print to file
  const { uri } = await Print.printToFileAsync({ html });

  // Share the generated file (cross-platform)
  await Sharing.shareAsync(uri);
  return uri;
}