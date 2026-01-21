import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

// 1. Configuración inicial
// Lo ideal es poner esto en un archivo .env, pero para probar pégalo aquí directo.
MapboxGL.setAccessToken('pk.eyJ1IjoibHVpc2cwNDE4IiwiYSI6ImNtaXhoeDVxMTA0Z28zZ3B2d3d1M2Z6M20ifQ.uOyMfGrAILud_KpxGFEOig');

const MapScreen = () => {

  useEffect(() => {
    // Esto pide permiso de ubicación al abrir la pantalla (Android)
    MapboxGL.requestAndroidLocationPermissions(); 
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        
        {/* 2. El Mapa Base */}
        <MapboxGL.MapView 
            style={styles.map} 
            logoEnabled={false} // Oculta logo pequeño (opcional)
            attributionEnabled={false} // Oculta la atribución "i" (opcional)
        >
          
          {/* 3. La Cámara: Dónde empieza a mirar el mapa */}
          <MapboxGL.Camera
            zoomLevel={10}
            centerCoordinate={[-99.1332, 19.4326]} // Coordenadas del Zócalo CDMX por defecto
            animationMode={'flyTo'}
            animationDuration={2000}
            followUserLocation={true} // ¡Esto hace que la cámara siga al chofer!
            followUserMode={'course'} // 'course' rota el mapa según hacia dónde vas (como Waze)
          />

          {/* 4. El punto azul del usuario */}
          <MapboxGL.UserLocation 
            visible={true}
            showsUserHeadingIndicator={true} // Muestra la "flechita" de hacia dónde mira
          />

        </MapboxGL.MapView>

        {/* Un panel flotante simple para ver datos (futuro velocímetro) */}
        <View style={styles.overlay}>
            <Text style={styles.text}>Modo: Copiloto Activo</Text>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF'
  },
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'tomato'
  },
  map: {
    flex: 1
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'center'
  },
  text: {
    color: 'white',
    fontWeight: 'bold'
  }
});

export default MapScreen;
