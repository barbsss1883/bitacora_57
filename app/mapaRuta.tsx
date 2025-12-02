import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { useLocalSearchParams } from 'expo-router';
import { obtainingPuntosGPS } from '../db/database'; // Asegúrate que el nombre coincida con tu export en database.ts

// Configuración básica de MapLibre (Opcional: Token si usas MapTiler, null para Demo)
MapLibreGL.setAccessToken(null);

export default function MapaRuta() {
  // Recibimos el ID de la jornada desde la pantalla anterior
  const { jornadaId } = useLocalSearchParams();
  
  const [puntos, setPuntos] = useState<number[][]>([]);
  const [cargando, setCargando] = useState(true);
  const [centro, setCentro] = useState<number[]>([-102.5528, 23.6345]); // Centro de México por defecto

  useEffect(() => {
    cargarRuta();
  }, [jornadaId]);

  const cargarRuta = async () => {
    if (!jornadaId) return;

    try {
      // 1. Obtenemos los puntos de la BD (asumiendo que exportaste obtenerPuntosGPS)
      // Nota: Verifica que en database.ts la función se llame 'obtenerPuntosGPS'
      // Si usaste mi código anterior, la función devuelve objetos { latitud, longitud }
      const resultados = await obtainingPuntosGPS(Number(jornadaId));
      
      if (resultados && resultados.length > 0) {
        // 2. MapLibre necesita formato [Longitud, Latitud] (GeoJSON standard)
        // SQLite suele devolver { latitud: x, longitud: y }
        // @ts-ignore
        const coordenadas = resultados.map(p => [p.longitud, p.latitud]);
        
        setPuntos(coordenadas);
        
        // Centrar el mapa en el último punto registrado
        setCentro(coordenadas[coordenadas.length - 1]);
      } else {
        Alert.alert("Aviso", "Esta jornada no tiene puntos GPS registrados.");
      }
    } catch (e) {
      console.error("Error cargando mapa:", e);
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={{ color: 'white', marginTop: 10 }}>Cargando ruta...</Text>
      </View>
    );
  }

  // Estructura GeoJSON para la línea
  const routeGeoJSON = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: puntos,
    },
  };

  return (
    <View style={styles.page}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL="https://demotiles.maplibre.org/style.json" // Estilo gratuito de prueba
        logoEnabled={false}
      >
        {/* Cámara: Controla el zoom y la posición inicial */}
        <MapLibreGL.Camera
          zoomLevel={12}
          centerCoordinate={centro}
          animationMode="flyTo"
          animationDuration={2000}
        />

        {/* Capa de la Línea (La Ruta) */}
        {puntos.length > 0 && (
          <MapLibreGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="routeFill"
              style={{
                lineColor: '#e74c3c', // Rojo intenso
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.8
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

      </MapLibreGL.MapView>

      {/* Panel flotante con info simple */}
      <View style={styles.panel}>
        <Text style={styles.infoText}>📍 Puntos: {puntos.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  map: { flex: 1 },
  loading: { flex: 1, backgroundColor: '#1e272e', justifyContent: 'center', alignItems: 'center' },
  panel: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  infoText: { color: 'white', fontWeight: 'bold' }
});
