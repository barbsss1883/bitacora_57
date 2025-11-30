import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system";
import { Platform } from "react-native";

export async function exportPDF(j) {
  const html = `<html><body style="font-family:Arial;padding:20px;"><h1>Reporte Jornada</h1>
    <table border="1" style="border-collapse:collapse;width:100%"><tr><th>Fecha</th><td>${new Date(j.fecha).toLocaleString()}</td></tr>
    <tr><th>Operador</th><td>${j.operador||''}</td></tr></table></body></html>`;

  const { uri } = await Print.printToFileAsync({ html, orientation: "landscape" });

  if (Platform.OS !== "android") return Sharing.shareAsync(uri);

  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) { alert("Selecciona Descargas"); return; }

  const name = `Reporte_${Date.now()}.pdf`;
  const fileUri = await StorageAccessFramework.createFileAsync(perm.directoryUri, name, "application/pdf");
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri);
  return fileUri;
}