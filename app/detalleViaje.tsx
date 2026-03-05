import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <-- AGREGADO
import Mapbox from '@rnmapbox/maps';
import Purchases from 'react-native-purchases'; // <-- AGREGADO

import { obtenerDetalleJornada, eliminarViaje } from '../db/database';
import { generarPDF } from '../src/services/PdfGenerator';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  border: '#334155'
};

export default function DetalleViaje() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<any>(null);
  
  // Estado para procesar el PDF
  const [procesandoPdf, setProcesandoPdf] = useState(false);
  
  // Estado para guardar las coordenadas ya filtradas para Mapbox
  const [coordenadasRuta, setCoordenadasRuta] = useState<number[][]>([]);

  useEffect(() => {
    cargarDetalle();
  }, [id]);

  const cargarDetalle = async () => {
    if (!id) return;
    try {
      const resultado = await obtenerDetalleJornada(Number(id));
      setData(resultado);

      const { jornada }: { jornada: any } = resultado;

      // --- BLINDAJE Y LIMPIEZA DE RUTA GPS ---
      if (jornada && jornada.ruta_geojson) {
        try {
          let parsedCoords = typeof jornada.ruta_geojson === 'string' 
            ? JSON.parse(jornada.ruta_geojson) 
            : jornada.ruta_geojson;
          
          if (Array.isArray(parsedCoords) && parsedCoords.length > 0) {
            // Mapbox exige estrictamente un arreglo [longitud, latitud]
            const validCoords = parsedCoords
              .filter((pt: any) => pt && typeof pt.latitude === 'number' && typeof pt.longitude === 'number')
              .map((pt: any) => [pt.longitude, pt.latitude]);
            
            // Solo dibujamos si hay al menos un punto inicial y uno final
            if (validCoords.length > 1) {
              setCoordenadasRuta(validCoords);
            }
          }
        } catch (e) {
          console.log("Error parseando ruta para el mapa:", e);
        }
      }

    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el detalle del viaje');
    } finally {
      setCargando(false);
    }
  };

  const handleEliminar = () => {
    Alert.alert(
      "Eliminar Registro",
      "¿Estás seguro de que deseas eliminar esta bitácora? Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive",
          onPress: async () => {
            await eliminarViaje(Number(id));
            router.back();
          }
        }
      ]
    );
  };

  const handleGenerarPDF = async () => {
    if (!data || !data.jornada) return;

    // --- VERIFICACIÓN PRO ---
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        const esPro = typeof customerInfo.entitlements.active['pro'] !== "undefined";
        if (!esPro) {
            Alert.alert("Función Premium ⭐", "La generación de reportes PDF oficiales es exclusiva para usuarios PRO.",
                [{ text: "Más tarde", style: "cancel" }, { text: "VER PLANES", onPress: () => router.push('/PantallaSuscripcion') }]
            );
            return; 
        }
    } catch (e) { console.log("Error verificando estatus pro", e); }

    setProcesandoPdf(true);
    try {
      // --- 1. BUSCAMOS LA INSPECCIÓN DEL DÍA DIRECTO EN EL TELÉFONO ---
      let inspeccionFinal = null;
      try {
         const inspeccionesDB = Array.isArray(data.inspecciones) ? data.inspecciones : [];
         if (inspeccionesDB.length > 0) {
            const ultimaInspeccion = [...inspeccionesDB].sort(
              (a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()
            )[0];
            let items = {};
            try { items = JSON.parse(ultimaInspeccion.detalles_json || '{}'); } catch (e) {}
            const fechaInspeccion = ultimaInspeccion.fecha ? new Date(ultimaInspeccion.fecha) : null;
            inspeccionFinal = {
              fecha: fechaInspeccion ? fechaInspeccion.toISOString().split('T')[0] : '---',
              hora: fechaInspeccion ? fechaInspeccion.toLocaleTimeString() : '---',
              tipo: ultimaInspeccion.tipo || 'general',
              items,
              comentarios: ultimaInspeccion.comentarios || '',
              estatus: (ultimaInspeccion.comentarios || '').trim().length > 5 ? 'CON OBSERVACIONES' : 'APROBADO'
            };
         }

         if (!inspeccionFinal) {
           const fechaViaje = data.jornada.fecha_inicio.split('T')[0];
           const inspeccionRaw = await AsyncStorage.getItem(`INSPECCION_${fechaViaje}`);
           if (inspeccionRaw) inspeccionFinal = JSON.parse(inspeccionRaw);
         }

         if (!inspeccionFinal) {
           const ultimaFecha = await AsyncStorage.getItem('ULTIMA_INSPECCION');
           if (ultimaFecha) {
              const inspeccionRaw = await AsyncStorage.getItem(`INSPECCION_${ultimaFecha}`);
              if (inspeccionRaw) inspeccionFinal = JSON.parse(inspeccionRaw);
           }
         }

         if (!inspeccionFinal && data.jornada.inspeccion_json) {
           inspeccionFinal = JSON.parse(data.jornada.inspeccion_json);
         }
      } catch(e) { console.log("Error leyendo inspección", e); }

      // --- 2. PROCESAMOS LOS PUNTOS DE RUTA PARA EL PDF ---
      let puntosRastreo: any[] = [];
      if (coordenadasRuta.length > 0) {
          const paso = Math.max(1, Math.floor(coordenadasRuta.length / 10));
          for (let i = 0; i < coordenadasRuta.length; i += paso) {
              puntosRastreo.push({
                  tipo: 'RASTREO',
                  hora: new Date().toISOString(), // Fallback de hora
                  ubicacion: `${coordenadasRuta[i][1].toFixed(4)}, ${coordenadasRuta[i][0].toFixed(4)}`, // lat, lng
                  detalle: 'Historial GPS'
              });
          }
      }

      // 3. GENERAMOS EL PDF
      const uri = await generarPDF(data.jornada, data.pausas || [], data.incidencias || [], inspeccionFinal, puntosRastreo);
      if (!uri) {
         Alert.alert('Aviso', 'No se pudo generar el documento.');
      }
    } catch (error) {
      Alert.alert('Error', 'Fallo al procesar el documento oficial.');
    } finally {
      setProcesandoPdf(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!data || !data.jornada) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: COLORS.subtext }}>No se encontró el viaje.</Text>
      </View>
    );
  }

  const { jornada } = data;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
          <MaterialCommunityIcons name="close-circle" size={28} color={COLORS.subtext} />
        </TouchableOpacity>
        <Text style={styles.title}>Detalle del Viaje #{jornada.id}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* MAPA DE LA RUTA BLINDADO */}
        <Text style={styles.sectionTitle}>Ruta Recorrida</Text>
        <View style={styles.mapContainer}>
          {coordenadasRuta.length > 1 ? (
            <Mapbox.MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Dark} zoomEnabled={true} scrollEnabled={true}>
              
              {/* Centro dinámico en lugar de bounds para evitar crasheos */}
              <Mapbox.Camera
                centerCoordinate={coordenadasRuta[Math.floor(coordenadasRuta.length / 2)]}
                zoomLevel={13}
                animationDuration={1500}
              />
              
              {/* Línea principal */}
              <Mapbox.ShapeSource id={`routeSource-${jornada.id}`} shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: coordenadasRuta }, properties: {} }}>
                <Mapbox.LineLayer id={`routeLayer-${jornada.id}`} style={{ lineColor: '#3b82f6', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
              </Mapbox.ShapeSource>

              {/* Punto de Inicio (Verde) seguro */}
              <Mapbox.ShapeSource id={`start-${jornada.id}`} shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: coordenadasRuta[0] }, properties: {} }}>
                  <Mapbox.CircleLayer id={`startLayer-${jornada.id}`} style={{ circleRadius: 7, circleColor: '#22c55e', circleStrokeWidth: 2, circleStrokeColor: '#ffffff' }} />
              </Mapbox.ShapeSource>

              {/* Punto de Fin (Rojo) seguro */}
              <Mapbox.ShapeSource id={`end-${jornada.id}`} shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: coordenadasRuta[coordenadasRuta.length - 1] }, properties: {} }}>
                  <Mapbox.CircleLayer id={`endLayer-${jornada.id}`} style={{ circleRadius: 7, circleColor: '#ef4444', circleStrokeWidth: 2, circleStrokeColor: '#ffffff' }} />
              </Mapbox.ShapeSource>

            </Mapbox.MapView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
              <Text style={{ color: COLORS.subtext }}>Ruta vacía o viaje demasiado corto</Text>
            </View>
          )}
        </View>

        {/* INFORMACIÓN DEL VIAJE */}
        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Unidad:" value={jornada.unidad} />
          <InfoRow label="Operador:" value={jornada.operador} />
          <InfoRow label="Inicio:" value={new Date(jornada.fecha_inicio).toLocaleString()} />
          <InfoRow label="Fin:" value={jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : 'En curso'} />
          <InfoRow label="Origen:" value={jornada.origen} />
          <InfoRow label="Destino:" value={jornada.destino} />
        </View>

        {/* BOTONES DE ACCIÓN */}
        <TouchableOpacity style={styles.btnPrimary} onPress={handleGenerarPDF} disabled={procesandoPdf}>
          {procesandoPdf ? <ActivityIndicator color="#000" /> : <MaterialCommunityIcons name="file-pdf-box" size={20} color="#000" style={{ marginRight: 8 }} />}
          <Text style={styles.btnPrimaryText}>{procesandoPdf ? "PROCESANDO..." : "GENERAR PDF / QR"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDanger} onPress={handleEliminar}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.btnDangerText}>ELIMINAR REGISTRO</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value || '---'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card, paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  mapContainer: { height: 250, backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden', marginBottom: 25, borderWidth: 1, borderColor: COLORS.border },
  infoCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 15, marginBottom: 25 },
  row: { flexDirection: 'row', marginBottom: 10 },
  label: { color: COLORS.subtext, width: 80, fontSize: 14 },
  value: { color: COLORS.text, flex: 1, fontSize: 14, fontWeight: '500' },
  btnPrimary: { backgroundColor: COLORS.primary, flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  btnPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  btnDanger: { flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.danger, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  btnDangerText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 14 }
});
