import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const analizarRutaInteligente = onDocumentCreated(
  "jornadas/{jornadaId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const jornadaId = event.params.jornadaId;
    const incidencias = data.incidencias || [];
    
    // --- CORRECCIÓN: Manejo híbrido (Texto/Objeto) para GeoJSON ---
    let geoJsonData = data.ruta_geojson;
    
    // Si viene como string (formato seguro de la App), lo parseamos solo para leerlo aquí
    if (typeof geoJsonData === 'string') {
      try {
        geoJsonData = JSON.parse(geoJsonData);
      } catch (e) {
        console.error("Error parseando GeoJSON interno:", e);
        geoJsonData = null; // Evitar crash si el JSON está corrupto
      }
    }

    // Ahora leemos las coordenadas del objeto ya procesado
    const puntosGps = geoJsonData?.features?.[0]?.geometry?.coordinates || [];
    // -------------------------------------------------------------

    console.log(`Analizando Inteligencia para Jornada: ${jornadaId}`);

    try {
      // 1. PROCESAR ZONAS DE RIESGO
      if (incidencias.length > 0) {
        for (const inc of incidencias) {
          // Tomamos el último punto reportado o null
          const puntoAfectado = puntosGps.length > 0 ?
            puntosGps[puntosGps.length - 1] :
            null;

          if (puntoAfectado) {
            await db.collection("zonas_riesgo").add({
              coordenadas: new admin.firestore.GeoPoint(
                puntoAfectado[1], // Latitud
                puntoAfectado[0] // Longitud
              ),
              tipo: inc.tipo || "General",
              descripcion: inc.descripcion || "Incidencia reportada",
              fecha: admin.firestore.FieldValue.serverTimestamp(),
              jornada_origen: jornadaId,
              nivel_peligro: 1,
            });
          }
        }
      }

      // 2. ACTUALIZAR MAPA DE CALOR (RUTAS MAESTRAS)
      // Guardamos 'data.ruta_geojson' tal cual vino. 
      // Si la App mandó String, guardamos String (y Firestore no se queja).
      await db.collection("rutas_maestras").doc(jornadaId).set({
        ruta: data.ruta_geojson, 
        operador: data.operador,
        unidad_tipo: data.modalidad,
        km_totales: data.km_totales,
        fecha_finalizacion: data.fecha_fin || admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Análisis completado. Riesgos detectados: ${incidencias.length}`);
    } catch (error) {
      console.error("Error en análisis de inteligencia:", error);
    }
  }
);
