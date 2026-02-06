import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, 
  Alert, Modal, ScrollView, Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps'; 
import Purchases from 'react-native-purchases'; // <--- INTEGRACIÓN REVENUECAT

// BD y Servicios
import { obtenerJornadas, eliminarViaje } from '../db/database'; 
import { generarPDF } from '../src/services/PdfGenerator';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  danger: '#ef4444',
  success: '#10b981',
  border: '#334155',
  mapPath: '#3b82f6'
};

const { width } = Dimensions.get('window');

export default function Historial() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [itemSeleccionado, setItemSeleccionado] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [procesandoPdf, setProcesandoPdf] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const data = await obtenerJornadas();
      // Ordenar del más reciente al más antiguo
      const ordenados = data.sort((a: any, b: any) => b.id - a.id);
      setJornadas(ordenados);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalle = (item: any) => {
    setItemSeleccionado(item);
    setModalVisible(true);
  };

  // --- LÓGICA DE ELIMINAR ---
  const confirmarEliminacion = () => {
    Alert.alert(
      "Eliminar Viaje",
      "¿Estás seguro? Esta acción borrará el registro del celular permanentemente (no afecta la nube).",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "ELIMINAR", 
          style: 'destructive', 
          onPress: async () => {
            if (itemSeleccionado) {
              await eliminarViaje(itemSeleccionado.id);
              setModalVisible(false);
              cargarDatos(); // Recargar lista
              Alert.alert("Eliminado", "El viaje ha sido borrado del historial.");
            }
          }
        }
      ]
    );
  };

  const handleGenerarPDF = async () => {
    if (!itemSeleccionado) return;

    // --- BLOQUEO PREMIUM INICIO ---
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        const esPro = typeof customerInfo.entitlements.active['pro'] !== "undefined";

        if (!esPro) {
            Alert.alert(
                "Función Premium ⭐",
                "La generación de reportes PDF oficiales y códigos QR es exclusiva para usuarios PRO.\n\nEvita multas de la Guardia Nacional y profesionaliza tu trabajo.",
                [
                    { text: "Más tarde", style: "cancel" },
                    { text: "VER PLANES", onPress: () => {
                        setModalVisible(false); // Cerramos modal para ir a suscripción
                        router.push('/PantallaSuscripcion');
                    }}
                ]
            );
            return; // Detenemos la ejecución aquí
        }
    } catch (e) {
        console.log("Error verificando estatus pro", e);
    }
    // --- BLOQUEO PREMIUM FIN ---

    setProcesandoPdf(true);
    try {
        // Parsear datos que vienen como JSON string desde SQLite
        let pausas = [], incidencias = [], inspeccion = null;
        
        try { pausas = JSON.parse(itemSeleccionado.pausas_json || '[]'); } catch(e){}
        try { incidencias = JSON.parse(itemSeleccionado.incidencias_json || '[]'); } catch(e){}
        try { inspeccion = JSON.parse(itemSeleccionado.inspeccion_json || 'null'); } catch(e){}
        
        // Reconstruir puntos de rastreo para el PDF
        let puntosRastreo = [];
        if (itemSeleccionado.ruta_geojson) {
             try {
                const coords = JSON.parse(itemSeleccionado.ruta_geojson);
                // Muestreo para no saturar el PDF
                if (Array.isArray(coords)) {
                    const paso = Math.max(1, Math.floor(coords.length / 10));
                    for (let i = 0; i < coords.length; i += paso) {
                        if(coords[i] && coords[i].latitude && coords[i].longitude) {
                            puntosRastreo.push({
                                tipo: 'RASTREO',
                                hora: new Date(coords[i].timestamp || Date.now()).toISOString(),
                                ubicacion: `${coords[i].latitude.toFixed(4)}, ${coords[i].longitude.toFixed(4)}`,
                                detalle: 'Historial GPS'
                            });
                        }
                    }
                }
             } catch(e) { console.log("Error parseando ruta para PDF", e); }
        }

        await generarPDF(
            itemSeleccionado, 
            pausas, 
            incidencias, 
            inspeccion,
            puntosRastreo
        );
    } catch (error) {
        Alert.alert("Error", "No se pudo generar el PDF.");
    } finally {
        setProcesandoPdf(false);
    }
  };

  const renderCard = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => abrirDetalle(item)}>
      <View style={styles.cardHeader}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
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
      
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
          <Text style={[styles.status, {color: item.fecha_fin ? COLORS.success : COLORS.primary}]}>
            {item.fecha_fin ? "FINALIZADO" : "PENDIENTE"}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.subtext} />
      </View>
    </TouchableOpacity>
  );

  const MapaHistorial = ({ rutaJson }: { rutaJson: string }) => {
      if (!rutaJson) return <View style={styles.mapError}><Text style={{color:'#aaa'}}>Sin datos de ruta</Text></View>;
      
      let coordenadas = [];
      try {
          const parsed = JSON.parse(rutaJson);
          if (!Array.isArray(parsed)) return <View style={styles.mapError}><Text style={{color:'#aaa'}}>Error de datos</Text></View>;

          coordenadas = parsed
            .filter((p: any) => p && !isNaN(parseFloat(p.latitude)) && !isNaN(parseFloat(p.longitude)))
            .map((p: any) => ({
              latitude: parseFloat(p.latitude),
              longitude: parseFloat(p.longitude)
          }));

      } catch (e) { return <View style={styles.mapError}><Text style={{color:'#aaa'}}>Error al leer mapa</Text></View>; }

      if (coordenadas.length === 0) return <View style={styles.mapError}><Text style={{color:'#aaa'}}>Ruta vacía o inválida</Text></View>;

      const inicial = coordenadas[0];

      return (
          <View style={styles.mapContainer}>
              <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  initialRegion={{
                      latitude: inicial.latitude,
                      longitude: inicial.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                  }}
              >
                  <Polyline 
                      coordinates={coordenadas}
                      strokeColor={COLORS.mapPath}
                      strokeWidth={4}
                  />
                  <Marker coordinate={coordenadas[0]} title="Inicio" pinColor="green" />
                  <Marker coordinate={coordenadas[coordenadas.length-1]} title="Fin" pinColor="red" />
              </MapView>
              <View style={styles.mapOverlay}>
                  <Text style={styles.mapOverlayText}>Ruta Grabada</Text>
              </View>
          </View>
      );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bitácora de Viajes</Text>
        <View style={{width:28}} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={jornadas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 20 }}
          ListEmptyComponent={
            <Text style={{color: COLORS.subtext, textAlign: 'center', marginTop: 50}}>
                No hay viajes registrados aún.
            </Text>
          }
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
            
            <ScrollView contentContainerStyle={{padding: 20}}>
                <Text style={styles.sectionTitle}>Ruta Recorrida</Text>
                {itemSeleccionado?.ruta_geojson ? (
                    <MapaHistorial rutaJson={itemSeleccionado.ruta_geojson} />
                ) : (
                    <View style={[styles.mapContainer, {justifyContent:'center', alignItems:'center'}]}>
                        <MaterialCommunityIcons name="map-marker-off" size={40} color={COLORS.border} />
                        <Text style={{color: COLORS.subtext, marginTop:10}}>No hay datos GPS guardados</Text>
                    </View>
                )}

                <Text style={styles.sectionTitle}>Información</Text>
                <View style={styles.detailBox}>
                    <DetailRow label="Unidad" value={itemSeleccionado?.unidad} />
                    <DetailRow label="Operador" value={itemSeleccionado?.operador} />
                    <DetailRow label="Inicio" value={itemSeleccionado?.fecha_inicio ? new Date(itemSeleccionado.fecha_inicio).toLocaleString() : '---'} />
                    <DetailRow label="Fin" value={itemSeleccionado?.fecha_fin ? new Date(itemSeleccionado.fecha_fin).toLocaleString() : 'En curso'} />
                    <DetailRow label="Origen" value={itemSeleccionado?.origen} />
                    <DetailRow label="Destino" value={itemSeleccionado?.destino} />
                </View>

                <View style={{gap: 15, marginTop: 30, marginBottom: 50}}>
                    <TouchableOpacity 
                        style={styles.btnAction} 
                        onPress={handleGenerarPDF}
                        disabled={procesandoPdf}
                    >
                        {procesandoPdf ? <ActivityIndicator color="#000"/> : <MaterialCommunityIcons name="file-pdf-box" size={24} color="#000" />}
                        <Text style={styles.btnText}>GENERAR PDF / QR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.btnAction, {backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth:1, borderColor: COLORS.danger}]} 
                        onPress={confirmarEliminacion}
                    >
                        <MaterialCommunityIcons name="trash-can" size={24} color={COLORS.danger} />
                        <Text style={[styles.btnText, {color: COLORS.danger}]}>ELIMINAR REGISTRO</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const DetailRow = ({ label, value }: any) => (
    <View style={{flexDirection:'row', marginBottom: 8}}>
        <Text style={{color: COLORS.subtext, width: 80, fontSize:12}}>{label}:</Text>
        <Text style={{color: COLORS.text, flex:1, fontWeight:'bold', fontSize:13}}>{value || '---'}</Text>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: COLORS.card, flexDirection: 'row', justifyContent:'space-between', alignItems: 'center'
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 15, marginBottom: 15,
    borderWidth: 1, borderColor: COLORS.border
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardId: { color: COLORS.primary, fontWeight: 'bold' },
  cardDate: { color: COLORS.subtext, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label: { color: COLORS.subtext, width: 60, fontSize: 12 },
  value: { color: COLORS.text, fontWeight: '500', flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  status: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { 
      padding: 20, paddingTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderBottomWidth: 1, borderBottomColor: COLORS.border
  },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.primary, marginVertical: 15, fontWeight: 'bold', fontSize: 16 },
  detailBox: { backgroundColor: COLORS.card, padding: 15, borderRadius: 10 },
  mapContainer: { height: 250, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111', borderWidth:1, borderColor: COLORS.border },
  map: { width: '100%', height: '100%' },
  mapOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 5 },
  mapOverlayText: { color: 'white', fontSize: 10 },
  mapError: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 250 },
  btnAction: { 
      flexDirection: 'row', backgroundColor: COLORS.primary, padding: 15, 
      borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 10 
  },
  btnText: { fontWeight: 'bold', color: '#000' }
});