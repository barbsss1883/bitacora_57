import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  StatusBar, ActivityIndicator, Alert 
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// BD Y SERVICIOS
import { obtenerHistorialJornadas, obtenerDetalleJornada } from '../db/database';
import { generarPDF } from '../src/services/PdfGenerator';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', 
  text: '#f8fafc', subtext: '#94a3b8', success: '#22c55e', danger: '#ef4444'
};

export default function Historial() {
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generandoPdfId, setGenerandoPdfId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  const cargarDatos = async () => {
    setLoading(true);
    try {
        const datos: any = await obtenerHistorialJornadas();
        setJornadas(datos || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const exportarPDF = async (id: number) => {
    setGenerandoPdfId(id);
    try {
        // 1. OBTENEMOS DATOS COMPLETOS DE LA BD
        // Esto ya trae: jornada, pausas, incidencias E INSPECCIONES
        const datos = await obtenerDetalleJornada(id);

        if (!datos || !datos.jornada) {
            Alert.alert("Error", "Información no encontrada.");
            return;
        }
        
        // 2. GENERAMOS EL PDF
        // Pasamos el 4° argumento: datos.inspecciones
        await generarPDF(
            datos.jornada, 
            datos.pausas, 
            datos.incidencias, 
            datos.inspecciones // <--- ¡AQUÍ ESTÁ EL CAMBIO!
        );

    } catch (error) {
        console.error("Error PDF:", error);
        Alert.alert("Error", "No se pudo crear el reporte.");
    } finally {
        setGenerandoPdfId(null);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
            <Text style={styles.dateText}>{new Date(item.fecha_inicio).toLocaleDateString()}</Text>
            <Text style={styles.timeText}>{new Date(item.fecha_inicio).toLocaleTimeString()}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: item.estatus === 'activo' ? COLORS.success : '#334155' }]}>
            <Text style={styles.badgeText}>{item.estatus === 'activo' ? 'EN RUTA' : 'FINALIZADO'}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.row}>
            <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.primary} />
            <Text style={styles.routeText}>{item.origen} ➝ {item.destino}</Text>
        </View>
        <Text style={styles.unitText}>Unidad: {item.unidad} | Op: {item.operador}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.idText}>ID: {item.id}</Text>
        <TouchableOpacity style={styles.pdfBtn} onPress={() => exportarPDF(item.id)} disabled={generandoPdfId === item.id}>
            {generandoPdfId === item.id ? <ActivityIndicator size="small" color="#fff" /> : 
            <><MaterialCommunityIcons name="printer" size={18} color="#fff" /><Text style={styles.pdfBtnText}>REPORTE</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}><Text style={styles.title}>HISTORIAL DE VIAJES</Text></View>
      {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 50}} /> : 
      <FlatList data={jornadas} keyExtractor={(item: any) => item.id.toString()} renderItem={renderItem} contentContainerStyle={{ padding: 20 }}
      ListEmptyComponent={<Text style={{color: COLORS.subtext, textAlign: 'center', marginTop: 50}}>No hay viajes registrados.</Text>} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingTop: 50, backgroundColor: COLORS.card, borderBottomWidth:1, borderColor: '#334155' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  card: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: 'rgba(0,0,0,0.2)' },
  dateText: { color: COLORS.text, fontWeight: 'bold' },
  timeText: { color: COLORS.subtext, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  cardBody: { padding: 15 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  routeText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginLeft: 5 },
  unitText: { color: COLORS.subtext, fontSize: 12, marginTop: 5 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: '#334155' },
  idText: { color: '#555', fontSize: 10 },
  pdfBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', gap: 5 },
  pdfBtnText: { color: 'black', fontWeight: 'bold', fontSize: 12 }
});