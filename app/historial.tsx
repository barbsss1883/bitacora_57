import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { obtenerHistorialJornadas } from '../db/database';

// Definimos la interfaz de los datos que vienen de la BD
interface Jornada {
  id: number;
  operador: string;
  unidad: string;
  origen: string;
  destino: string;
  fecha: string;
  inicio_jornada: string;
  fin_jornada: string | null;
}

export default function Historial() {
  const router = useRouter();
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // useFocusEffect hace que la lista se actualice cada vez que entras a la pantalla
  useFocusEffect(
    useCallback(() => {
      cargarDatos();
    }, [])
  );

  const cargarDatos = async () => {
    setRefreshing(true);
    const datos = await obtenerHistorialJornadas();
    // @ts-ignore (SQLite a veces retorna tipos any, forzamos el tipo)
    setJornadas(datos);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Jornada }) => {
    // Calculamos si la jornada está cerrada o sigue abierta
    const estatus = item.fin_jornada ? "Finalizado" : "En Curso";
    const colorEstatus = item.fin_jornada ? "#95a5a6" : "#2ecc71";

    // Formatear fecha bonita
    const fechaObj = new Date(item.fecha);
    const fechaTexto = fechaObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          // --- CAMBIO REALIZADO AQUÍ ---
          // Navegamos a la pantalla mapaRuta pasando el ID de esta jornada
          router.push({ pathname: "/mapaRuta", params: { jornadaId: item.id } });
        }}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.fecha}>{fechaTexto}</Text>
          <View style={[styles.badge, { backgroundColor: colorEstatus }]}>
            <Text style={styles.badgeText}>{estatus}</Text>
          </View>
        </View>

        <View style={styles.rutaContainer}>
          <Text style={styles.punto}>{item.origen}</Text>
          <Text style={styles.flecha}>➝</Text>
          <Text style={styles.punto}>{item.destino}</Text>
        </View>

        <View style={styles.infoExtra}>
          <Text style={styles.infoText}>🚛 {item.unidad}</Text>
          <Text style={styles.infoText}>👤 {item.operador}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Bitácora de Viajes</Text>

      {jornadas.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.textoVacio}>No hay registros aún.</Text>
          <Text style={styles.subtextoVacio}>Inicia tu primer viaje en la pantalla principal.</Text>
        </View>
      ) : (
        <FlatList
          data={jornadas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={cargarDatos} tintColor="#fff" />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e272e', padding: 20 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#ecf0f1', marginBottom: 20, textAlign: 'center' },

  card: {
    backgroundColor: '#2d3436',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 5,
    borderLeftColor: '#3498db',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fecha: { color: '#bdc3c7', fontSize: 14, textTransform: 'capitalize' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  rutaContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  punto: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  flecha: { color: '#f39c12', fontSize: 20, marginHorizontal: 10 },

  infoExtra: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#636e72', paddingTop: 10 },
  infoText: { color: '#bdc3c7', fontSize: 14 },

  vacio: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  textoVacio: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  subtextoVacio: { color: '#7f8c8d', marginTop: 10 }
});

