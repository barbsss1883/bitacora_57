import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { obtenerDetalleJornada, eliminarViaje } from '../db/database';
import { generarPdfMaestro } from '../src/services/PdfMaestro';
import { normalizarRutaCoordenadas } from '../utils/routeUtils';

const COLORS = {
  bg:      '#010A14',
  card:    '#0D2137',
  primary: '#D4AF37',
  text:    '#FFFFFF',
  subtext: '#9DA8B5',
  danger:  '#ef4444',
  success: '#10b981',
  border:  '#12365A',
};

export default function DetalleViaje() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [data, setData] = useState<any>(null);
  const [procesandoPdf, setProcesandoPdf] = useState(false);
  const [coordenadasRuta, setCoordenadasRuta] = useState<number[][]>([]);

  useEffect(() => { cargarDetalle(); }, [id]);

  const cargarDetalle = async () => {
    if (!id) return;
    try {
      const resultado = await obtenerDetalleJornada(Number(id));
      setData(resultado);

      const { jornada, puntosGPS }: { jornada: any; puntosGPS: any[] } = resultado;

      // ── Intento 1: ruta_geojson guardada en la jornada ──
      if (jornada?.ruta_geojson) {
        try {
          const validCoords = normalizarRutaCoordenadas(jornada.ruta_geojson);
          if (validCoords.length > 1) {
            setCoordenadasRuta(validCoords);
            return;
          }
        } catch (e) {
          console.log('Error parseando ruta_geojson:', e);
        }
      }

      // ── Intento 2: puntos_gps de la tabla (fallback siempre disponible) ──
      if (puntosGPS && puntosGPS.length > 1) {
        const validCoords = puntosGPS
          .map((pt: any) => {
            const lat = pt.latitud ?? pt.latitude;
            const lng = pt.longitud ?? pt.longitude;
            if (typeof lat === 'number' && typeof lng === 'number') return [lng, lat] as [number, number];
            return null;
          })
          .filter(Boolean) as [number, number][];
        if (validCoords.length > 1) setCoordenadasRuta(validCoords);
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
        { text: "Eliminar", style: "destructive", onPress: async () => {
            await eliminarViaje(Number(id));
            router.back();
        }}
      ]
    );
  };

  // ✅ SIMPLIFICADO: eliminado el bloque de 60 líneas que construía manualmente
  //    inspeccionFinal y puntosRastreo. PdfMaestro los carga desde SQLite.
  //    La validación PRO también está dentro de PdfMaestro.
  const handleGenerarPDF = async () => {
    if (!data || !data.jornada) return;
    setProcesandoPdf(true);
    try {
      await generarPdfMaestro({ jornadaId: Number(id) });
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
        <Text style={styles.sectionTitle}>Ruta Recorrida</Text>
        <View style={styles.mapContainer}>
          {coordenadasRuta.length > 1 ? (
            <Mapbox.MapView style={{ flex: 1 }} styleURL={Mapbox.StyleURL.Dark} zoomEnabled scrollEnabled>
              <Mapbox.Camera
                centerCoordinate={coordenadasRuta[Math.floor(coordenadasRuta.length / 2)]}
                zoomLevel={13} animationDuration={1500}
              />
              <Mapbox.ShapeSource id={`routeSource-${jornada.id}`} shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: coordenadasRuta }, properties: {} }}>
                <Mapbox.LineLayer id={`routeLayer-${jornada.id}`} style={{ lineColor: '#3b82f6', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
              </Mapbox.ShapeSource>
              <Mapbox.ShapeSource id={`start-${jornada.id}`} shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: coordenadasRuta[0] }, properties: {} }}>
                <Mapbox.CircleLayer id={`startLayer-${jornada.id}`} style={{ circleRadius: 7, circleColor: '#22c55e', circleStrokeWidth: 2, circleStrokeColor: '#ffffff' }} />
              </Mapbox.ShapeSource>
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

        <Text style={styles.sectionTitle}>Información</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Unidad:"   value={jornada.unidad} />
          <InfoRow label="Operador:" value={jornada.operador} />
          <InfoRow label="Inicio:"   value={new Date(jornada.fecha_inicio).toLocaleString()} />
          <InfoRow label="Fin:"      value={jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : 'En curso'} />
          <InfoRow label="Origen:"   value={jornada.origen} />
          <InfoRow label="Destino:"  value={jornada.destino} />
        </View>

        {/* BOTONES */}
        <TouchableOpacity style={styles.btnPrimary} onPress={handleGenerarPDF} disabled={procesandoPdf}>
          {procesandoPdf
            ? <ActivityIndicator color="#000" />
            : <MaterialCommunityIcons name="file-pdf-box" size={20} color="#000" style={{ marginRight: 8 }} />}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#051C33', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  mapContainer: { height: 250, backgroundColor: '#111827', borderRadius: 12, overflow: 'hidden', marginBottom: 25, borderWidth: 1, borderColor: COLORS.border },
  infoCard: { backgroundColor: '#0D2137', borderRadius: 12, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', marginBottom: 10 },
  label: { color: '#7A9BBF', width: 80, fontSize: 14 },
  value: { color: COLORS.text, flex: 1, fontSize: 14, fontWeight: '600' },
  btnPrimary: { backgroundColor: COLORS.primary, flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  btnPrimaryText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  btnDanger: { flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  btnDangerText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 14 },
});
