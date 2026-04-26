import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
// ✅ CAMBIADO: PdfGenerator → PdfMaestro
// Se eliminó: import Purchases (la validación PRO está dentro de PdfMaestro)
import { generarPdfMaestro } from '../src/services/PdfMaestro';
import { obtenerJornadas, eliminarViaje, obtenerDetalleJornada } from '../db/database'; 
import { extraerCoordenadaLngLat, extraerFechaPuntoISO, normalizarRutaCoordenadas, parseRutaPuntos } from '../utils/routeUtils';

const COLORS = {
  bg:           '#010A14',
  cardBg:       '#081D33',
  headerBg:     '#051C33',
  white:        '#FFFFFF',
  text:         '#FFFFFF',
  textGold:     '#D4AF37',
  textWelcome:  '#9DA8B5',
  subtext:      '#9DA8B5',
  primary:      '#D4AF37',
  goldBevel:    '#D4AF37',
  mapPath:      '#3b82f6',
  danger:       '#ef4444',
  success:      '#10B981',
  border:       '#12365A',
};

export default function Historial() {
  const router = useRouter();
  const [loading, setLoading]                   = useState(true);
  const [jornadas, setJornadas]                 = useState<any[]>([]);
  const [itemSeleccionado, setItemSeleccionado] = useState<any>(null);
  const [modalVisible, setModalVisible]         = useState(false);
  const [procesandoPdf, setProcesandoPdf]       = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await obtenerJornadas();
      setJornadas(data.sort((a: any, b: any) => b.id - a.id));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const abrirDetalle = async (item: any) => {
    setItemSeleccionado(item);
    setModalVisible(true);
    try {
      const detalle = await obtenerDetalleJornada(Number(item.id));
      const jornadaDetalle = detalle?.jornada ? { ...item, ...detalle.jornada } : { ...item };
      const rutaActual = normalizarRutaCoordenadas(jornadaDetalle?.ruta_geojson);

      if (rutaActual.length === 0) {
        const [jornadaActivaId, rutaCache] = await Promise.all([
          AsyncStorage.getItem('CURRENT_JORNADA_ID'),
          AsyncStorage.getItem('RUTA_OFFLINE_CACHE'),
        ]);
        if (jornadaActivaId && Number(jornadaActivaId) === Number(item.id) && rutaCache && normalizarRutaCoordenadas(rutaCache).length > 0) {
          jornadaDetalle.ruta_geojson = rutaCache;
        }
      }
      setItemSeleccionado((actual: any) =>
        actual && Number(actual.id) === Number(item.id) ? jornadaDetalle : actual
      );
    } catch (e) { console.log('No se pudo cargar detalle completo del viaje', e); }
  };

  const confirmarEliminacion = () => {
    Alert.alert(
      "Eliminar Viaje",
      "¿Estás seguro? Esta acción borrará el registro del celular permanentemente (no afecta la nube).",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "ELIMINAR", style: 'destructive', onPress: async () => {
            if (itemSeleccionado) {
              await eliminarViaje(itemSeleccionado.id);
              setModalVisible(false);
              cargarDatos();
              Alert.alert("Eliminado", "El viaje ha sido borrado del historial.");
            }
        }}
      ]
    );
  };

  // ✅ SIMPLIFICADO: eliminadas ~80 líneas de lógica manual para construir
  //    pausas, incidencias, inspeccion y puntosRastreo.
  //    PdfMaestro los carga desde SQLite con solo el jornadaId.
  //    La validación PRO también ocurre dentro de PdfMaestro.
  const handleGenerarPDF = async () => {
    if (!itemSeleccionado) return;
    setProcesandoPdf(true);
    try {
      await generarPdfMaestro({ jornadaId: Number(itemSeleccionado.id) });
    } catch (error) {
      Alert.alert("Error", "No se pudo generar el PDF.");
    } finally {
      setProcesandoPdf(false);
    }
  };

  // ─── Tarjeta de lista ───────────────────────────────────────────────────
  const renderCard = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => abrirDetalle(item)}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="truck-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardId}> VIAJE #{item.id}</Text>
        </View>
        <Text style={styles.cardDate}>{new Date(item.fecha_inicio).toLocaleDateString()}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Origen:</Text>
        <Text style={styles.value} numberOfLines={1}>{item.origen}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Destino:</Text>
        <Text style={styles.value} numberOfLines={1}>{item.destino}</Text>
      </View>
      <View style={styles.divider} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[styles.status, { color: item.fecha_fin ? COLORS.success : COLORS.primary }]}>
          {item.fecha_fin ? "FINALIZADO" : "PENDIENTE"}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.subtext} />
      </View>
    </TouchableOpacity>
  );

  // ─── Mapa ───────────────────────────────────────────────────────────────
  const MapaHistorial = ({ rutaJson }: { rutaJson: unknown }) => {
    if (!rutaJson) return <View style={styles.mapError}><Text style={{ color: COLORS.subtext }}>Sin datos de ruta</Text></View>;

    const coordenadas = normalizarRutaCoordenadas(rutaJson);
    if (coordenadas.length === 0) return <View style={styles.mapError}><Text style={{ color: COLORS.subtext }}>Ruta vacía o inválida</Text></View>;

    const puntoInicial = coordenadas[0];
    const puntoFinal   = coordenadas[coordenadas.length - 1];
    const latitudes    = coordenadas.map((c) => c[1]);
    const longitudes   = coordenadas.map((c) => c[0]);
    const minLat = Math.min(...latitudes), maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes), maxLng = Math.max(...longitudes);
    const puedeAjustarBounds = coordenadas.length > 1 && (minLat !== maxLat || minLng !== maxLng);

    return (
      <View style={styles.mapContainer}>
        <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Dark} logoEnabled={false} attributionEnabled={false} scaleBarEnabled={false}>
          {puedeAjustarBounds ? (
            <Mapbox.Camera bounds={{ ne: [maxLng, maxLat], sw: [minLng, minLat], paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 }} animationDuration={1000} />
          ) : (
            <Mapbox.Camera centerCoordinate={puntoInicial} zoomLevel={14} animationDuration={1000} />
          )}
          {coordenadas.length > 1 && (
            <Mapbox.ShapeSource id={`routeSourceHistorial-${coordenadas.length}`} shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: coordenadas }, properties: {} }}>
              <Mapbox.LineLayer id={`routeLayerHistorial-${coordenadas.length}`} style={{ lineColor: COLORS.mapPath, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }} />
            </Mapbox.ShapeSource>
          )}
          <Mapbox.ShapeSource id={`startSourceHistorial-${coordenadas.length}`} shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: puntoInicial }, properties: {} }}>
            <Mapbox.CircleLayer id={`startLayerHistorial-${coordenadas.length}`} style={{ circleRadius: 6, circleColor: '#22c55e', circleStrokeWidth: 2, circleStrokeColor: '#fff' }} />
          </Mapbox.ShapeSource>
          {coordenadas.length > 1 && (
            <Mapbox.ShapeSource id={`endSourceHistorial-${coordenadas.length}`} shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: puntoFinal }, properties: {} }}>
              <Mapbox.CircleLayer id={`endLayerHistorial-${coordenadas.length}`} style={{ circleRadius: 6, circleColor: '#ef4444', circleStrokeWidth: 2, circleStrokeColor: '#fff' }} />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>
        <View style={styles.mapOverlay}><Text style={styles.mapOverlayText}>Ruta Grabada</Text></View>
      </View>
    );
  };

  // ─── Render principal ───────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitácora de Viajes</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={jornadas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={<Text style={{ color: COLORS.subtext, textAlign: 'center', marginTop: 50 }}>No hay viajes registrados aún.</Text>}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalBg}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalle del Viaje #{itemSeleccionado?.id}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <MaterialCommunityIcons name="close-circle" size={30} color={COLORS.subtext} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>Ruta Recorrida</Text>
            {normalizarRutaCoordenadas(itemSeleccionado?.ruta_geojson).length > 0 ? (
              <MapaHistorial rutaJson={itemSeleccionado.ruta_geojson} />
            ) : (
              <View style={[styles.mapContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialCommunityIcons name="map-marker-off" size={40} color={COLORS.border} />
                <Text style={{ color: COLORS.subtext, marginTop: 10 }}>No hay datos GPS guardados</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Información</Text>
            <View style={styles.detailBox}>
              <DetailRow label="Unidad"    value={itemSeleccionado?.unidad} />
              <DetailRow label="Operador"  value={itemSeleccionado?.operador} />
              <DetailRow label="Inicio"    value={itemSeleccionado?.fecha_inicio ? new Date(itemSeleccionado.fecha_inicio).toLocaleString() : '---'} />
              <DetailRow label="Fin"       value={itemSeleccionado?.fecha_fin   ? new Date(itemSeleccionado.fecha_fin).toLocaleString()   : 'En curso'} />
              <DetailRow label="Origen"    value={itemSeleccionado?.origen} />
              <DetailRow label="Destino"   value={itemSeleccionado?.destino} />
            </View>

            <View style={{ gap: 15, marginTop: 30, marginBottom: 50 }}>
              <TouchableOpacity style={styles.btnAction} onPress={handleGenerarPDF} disabled={procesandoPdf}>
                {procesandoPdf ? <ActivityIndicator color="#000" /> : <MaterialCommunityIcons name="file-pdf-box" size={24} color="#000" />}
                <Text style={styles.btnText}>{procesandoPdf ? "PROCESANDO..." : "GENERAR PDF / QR"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnAction, { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: COLORS.danger }]} onPress={confirmarEliminacion}>
                <MaterialCommunityIcons name="trash-can" size={24} color={COLORS.danger} />
                <Text style={[styles.btnText, { color: COLORS.danger }]}>ELIMINAR REGISTRO</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const DetailRow = ({ label, value }: any) => (
  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
    <Text style={{ color: COLORS.subtext, width: 80, fontSize: 12 }}>{label}:</Text>
    <Text style={{ color: COLORS.text, flex: 1, fontWeight: 'bold', fontSize: 13 }}>{value || '---'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: COLORS.headerBg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle:  { color: COLORS.textGold, fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardId:       { color: COLORS.goldBevel, fontWeight: 'bold' },
  cardDate:     { color: COLORS.textWelcome, fontSize: 12 },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label:        { color: COLORS.textWelcome, width: 60, fontSize: 12 },
  value:        { color: COLORS.white, fontWeight: '500', flex: 1 },
  divider:      { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  status:       { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  modalBg:      { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { padding: 20, paddingTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.headerBg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:   { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.textGold, marginVertical: 15, fontWeight: 'bold', fontSize: 16 },
  detailBox: { backgroundColor: COLORS.cardBg, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  mapContainer: { height: 250, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.cardBg },
  map:          { width: '100%', height: '100%' },
  mapOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(8,29,51,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border },
  mapOverlayText: { color: COLORS.goldBevel, fontSize: 12, fontWeight: 'bold' },
  mapError: { height: 250, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  btnAction: { backgroundColor: COLORS.goldBevel, padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 14 },
});
