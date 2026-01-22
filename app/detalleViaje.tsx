import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import QRCode from 'react-native-qrcode-svg'; // Importación real para el QR
import { obtenerDetalleJornada } from '../db/database'; 
import { generarPDF } from '../src/services/PdfGenerator';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibHVpc2cwNDE4IiwiYSI6ImNtaXhoeDVxMTA0Z28zZ3B2d3d1M2Z6M20ifQ.uOyMfGrAILud_KpxGFEOig';
MapboxGL.setAccessToken(MAPBOX_TOKEN);

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', text: '#f8fafc', subtext: '#94a3b8', success: '#22c55e'
};

export default function detalleViaje() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [rutaGeoJson, setRutaGeoJson] = useState<any>(null);

  useEffect(() => {
    cargarDetalles();
  }, [id]);

  const cargarDetalles = async () => {
    if (!id) return;
    try {
      const resultado = await obtenerDetalleJornada(Number(id));
      setData(resultado);

      if (resultado.jornada && resultado.jornada.ruta_geojson) {
          try {
              let parsed = typeof resultado.jornada.ruta_geojson === 'string' 
                           ? JSON.parse(resultado.jornada.ruta_geojson) 
                           : resultado.jornada.ruta_geojson;

              if (Array.isArray(parsed)) {
                  const mapboxCoords = parsed.map((c: any) => [c.longitude, c.latitude]);
                  parsed = {
                      type: 'FeatureCollection',
                      features: [{
                          type: 'Feature',
                          properties: {},
                          geometry: { type: 'LineString', coordinates: mapboxCoords }
                      }]
                  };
              }
              setRutaGeoJson(parsed);
          } catch (e) {
              console.log("Error procesando ruta para mapa:", e);
          }
      }
    } catch (e) {
      console.log("Error cargando detalle:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
      if (!data || !data.jornada) return;
      setLoading(true);
      try {
          await generarPDF(data.jornada, data.pausas, data.incidencias, data.inspecciones);
      } catch (e) {
          Alert.alert("Error", "No se pudo generar el PDF.");
      } finally {
          setLoading(false);
      }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={{color:'white', marginTop:10}}>Cargando Bitácora...</Text></View>;
  }

  if (!data || !data.jornada) {
    return <View style={styles.center}><Text style={{color:'white'}}>No se encontró el viaje.</Text></View>;
  }

  const { jornada, pausas } = data;

  // URL Real de validación para el oficial
  const urlValidacion = `https://bitacora57.web.app/verify?id=${jornada.id}&sello=${jornada.sello_digital}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitácora #{jornada.id}</Text>
        
        <TouchableOpacity onPress={handleExportPDF} style={styles.pdfBtn}>
            <MaterialCommunityIcons name="file-pdf-box" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
        
        <View style={styles.mapContainer}>
            {rutaGeoJson ? (
                <MapboxGL.MapView 
                    style={styles.map} 
                    styleURL={MapboxGL.StyleURL.TrafficNight}
                    logoEnabled={false}
                    attributionEnabled={false}
                >
                    <MapboxGL.Camera 
                        defaultSettings={{ centerCoordinate: [-100, 22], zoomLevel: 4 }}
                        bounds={rutaGeoJson.bbox ? {
                            ne: [rutaGeoJson.bbox[2], rutaGeoJson.bbox[3]],
                            sw: [rutaGeoJson.bbox[0], rutaGeoJson.bbox[1]],
                        } : undefined}
                        padding={{top: 50, bottom: 50, left: 50, right: 50}}
                        animationMode="flyTo"
                        animationDuration={2000}
                    />
                    
                    <MapboxGL.ShapeSource id="routeSource" shape={rutaGeoJson}>
                        <MapboxGL.LineLayer 
                            id="routeLine" 
                            style={{
                                lineColor: COLORS.primary,
                                lineWidth: 4,
                                lineCap: 'round',
                                lineJoin: 'round',
                                lineOpacity: 0.9
                            }} 
                        />
                    </MapboxGL.ShapeSource>
                </MapboxGL.MapView>
            ) : (
                <View style={styles.noMap}>
                    <MaterialCommunityIcons name="map-marker-off" size={40} color={COLORS.subtext} />
                    <Text style={{color: COLORS.subtext, marginTop: 10}}>Sin ruta GPS registrada</Text>
                </View>
            )}
            
            <View style={styles.overlayInfo}>
                <View style={styles.overlayBadge}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="white" />
                    <Text style={styles.overlayText}>
                        {jornada.fecha_fin 
                            ? ((new Date(jornada.fecha_fin).getTime() - new Date(jornada.fecha_inicio).getTime()) / 3600000).toFixed(1) + ' hrs'
                            : 'En curso'}
                    </Text>
                </View>
                <View style={[styles.overlayBadge, {backgroundColor: COLORS.primary}]}>
                    <MaterialCommunityIcons name="map-marker-distance" size={14} color="black" />
                    <Text style={[styles.overlayText, {color:'black'}]}>
                        {jornada.km_totales ? Number(jornada.km_totales).toFixed(1) : 0} km
                    </Text>
                </View>
            </View>
        </View>

        <View style={styles.content}>
            
            {/* --- SELLO DIGITAL Y QR DE VALIDACIÓN --- */}
            {jornada.sello_digital && (
                <View style={styles.sealContainer}>
                    <View style={styles.sealInfoSide}>
                        <View style={styles.sealHeader}>
                            <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.success} />
                            <Text style={styles.sealTitle}>CERTIFICADO DIGITAL</Text>
                        </View>
                        <Text style={styles.sealCode}>{jornada.sello_digital}</Text>
                        <Text style={styles.sealSub}>
                            Validación NOM-087-SCT-2-2017
                        </Text>
                    </View>
                    
                    <View style={styles.qrSide}>
                        <QRCode
                            value={urlValidacion}
                            size={80}
                            color="black"
                            backgroundColor="white"
                        />
                    </View>
                </View>
            )}

            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={{flex:1}}>
                        <Text style={styles.label}>ORIGEN</Text>
                        <Text style={styles.value} numberOfLines={2}>{jornada.origen}</Text>
                        <Text style={styles.date}>{new Date(jornada.fecha_inicio).toLocaleString()}</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right-thin" size={30} color={COLORS.subtext} style={{marginHorizontal:10}}/>
                    <View style={{flex:1, alignItems:'flex-end'}}>
                        <Text style={styles.label}>DESTINO</Text>
                        <Text style={styles.value} numberOfLines={2}>{jornada.destino}</Text>
                        <Text style={styles.date}>{jornada.fecha_fin ? new Date(jornada.fecha_fin).toLocaleString() : '---'}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.infoGrid}>
                <View style={styles.miniCard}>
                    <Text style={styles.miniLabel}>UNIDAD</Text>
                    <Text style={styles.miniValue}>{jornada.unidad}</Text>
                </View>
                <View style={styles.miniCard}>
                    <Text style={styles.miniLabel}>PLACAS</Text>
                    <Text style={styles.miniValue}>{jornada.placas}</Text>
                </View>
                <View style={styles.miniCard}>
                    <Text style={styles.miniLabel}>OPERADOR</Text>
                    <Text style={styles.miniValue}>{jornada.operador ? jornada.operador.split(' ')[0] : '---'}</Text>
                </View>
            </View>

            {pausas.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⏱️ REGISTRO DE PAUSAS</Text>
                    {pausas.map((p: any) => (
                        <View key={p.id} style={styles.rowItem}>
                            <View style={{flex:1}}>
                                <Text style={styles.itemTitle}>{p.motivo}</Text>
                                <Text style={styles.itemSub} numberOfLines={1}>{p.ubicacion || 'En ruta'}</Text>
                            </View>
                            <Text style={styles.itemValue}>{p.duracion.toFixed(0)} min</Text>
                        </View>
                    ))}
                </View>
            )}

            {jornada.firma ? (
                <View style={styles.firmaContainer}>
                    <Text style={styles.label}>FIRMA DE CONFORMIDAD</Text>
                    <Image source={{uri: jornada.firma}} style={styles.firmaImg} resizeMode="contain" />
                </View>
            ) : (
                <View style={[styles.firmaContainer, {borderStyle:'dashed', opacity: 0.5, backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.subtext}]}>
                    <Text style={{color: COLORS.subtext}}>Sin firma registrada</Text>
                </View>
            )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { 
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
      paddingTop: 45, paddingHorizontal: 20, paddingBottom: 15,
      backgroundColor: COLORS.bg, zIndex: 10
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },
  pdfBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 8 },
  mapContainer: { height: 350, width: '100%', position: 'relative' },
  map: { flex: 1 },
  noMap: { flex: 1, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  overlayInfo: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', gap: 10 },
  overlayBadge: { backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  overlayText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  content: { padding: 20, marginTop: -20, backgroundColor: COLORS.bg, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  
  // Estilos mejorados para Sello + QR
  sealContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  sealInfoSide: { flex: 1, paddingRight: 10 },
  qrSide: { backgroundColor: 'white', padding: 5, borderRadius: 8 },
  sealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  sealTitle: { color: '#475569', fontWeight: 'bold', marginLeft: 5, fontSize: 10, letterSpacing: 0.5 },
  sealCode: { color: '#0f172a', fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', letterSpacing: 1, marginVertical: 2 },
  sealSub: { color: COLORS.success, fontSize: 9, fontWeight: '600' },

  card: { backgroundColor: COLORS.card, padding: 20, borderRadius: 16, marginBottom: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: COLORS.subtext, fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  value: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  date: { color: COLORS.primary, fontSize: 11, marginTop: 2 },
  infoGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  miniCard: { flex: 1, backgroundColor: COLORS.card, padding: 10, borderRadius: 10, alignItems: 'center' },
  miniLabel: { color: COLORS.subtext, fontSize: 9 },
  miniValue: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  section: { marginBottom: 20 },
  sectionTitle: { color: COLORS.subtext, fontWeight: 'bold', marginBottom: 10 },
  rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#334155' },
  itemTitle: { color: 'white', fontSize: 14 },
  itemSub: { color: COLORS.subtext, fontSize: 11 },
  itemValue: { color: COLORS.primary, fontWeight: 'bold' },
  firmaContainer: { alignItems: 'center', marginTop: 10, padding: 20, backgroundColor: 'white', borderRadius: 10 },
  firmaImg: { width: 200, height: 80, marginTop: 10 }
});
