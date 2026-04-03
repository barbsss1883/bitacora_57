import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

Mapbox.setAccessToken("pk.eyJ1IjoibHVpc2cwNDE4IiwiYSI6ImNtbWY2YzhsNTA1YWMycm9rZXhnY3N3ZW8ifQ.4r9JJKMYgs3_BQB-HDZfkA");

const MapaRuta = () => {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [permiso, setPermiso] = useState(false);
  const [descargandoMapa, setDescargandoMapa] = useState(false);
  const [progresoDescarga, setProgresoDescarga] = useState(0);
  const [rutaGrabada, setRutaGrabada] = useState<any>({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]});
  const coordenadasRef = useRef<number[][]>([]); 
  const [velocidad, setVelocidad] = useState(0);
  const [estadoMovimiento, setEstadoMovimiento] = useState("ESPERANDO GPS...");
  const [alertaActiva, setAlertaActiva] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState("");
  
  // Nuevo estado para controlar que la cámara no pierda de vista al tráiler
  const [seguirUsuario, setSeguirUsuario] = useState(true);

  useEffect(() => {
    (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') setPermiso(true);
        
        const rutaGuardada = await AsyncStorage.getItem('RUTA_OFFLINE_CACHE');
        if (rutaGuardada) {
            const coords = JSON.parse(rutaGuardada);
            if (coords.length > 0) {
                coordenadasRef.current = coords;
                actualizarMapaVisual(coords);
            }
        }
    })();
  }, []);

  const descargarZonaOffline = async () => {
    const ultimoPunto = coordenadasRef.current[coordenadasRef.current.length - 1];
    if (!ultimoPunto) { Alert.alert("Sin Ubicación", "Espera señal GPS."); return; }
    setDescargandoMapa(true);
    try {
        // Corrección de coordenadas para el bounds
        const bounds = [
            [ultimoPunto - 0.5, ultimoPunto - 0.5], 
            [ultimoPunto + 0.5, ultimoPunto + 0.5]
        ];
        await Mapbox.offlineManager.createPack({ name: `ruta-${Date.now()}`, styleURL: 'mapbox://styles/mapbox/navigation-night-v1', minZoom: 10, maxZoom: 16, bounds: bounds as any }, (p: any) => setProgresoDescarga(Math.round(p.percentage)));
        Alert.alert("¡Listo!", "Mapa guardado para uso sin internet.");
    } catch (e) { Alert.alert("Error", "Fallo descarga."); } finally { setDescargandoMapa(false); setProgresoDescarga(0); }
  };

  const actualizarMapaVisual = (coords: number[][]) => {
    setRutaGrabada({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
    });
  };

  const alMoverse = async (location: Mapbox.Location) => {
    if (!location?.coords) return;
    const { longitude, latitude, speed, accuracy } = location.coords;

    const vel = speed && speed > 0 ? Math.round(speed * 3.6) : 0;
    setVelocidad(vel);
    setEstadoMovimiento(vel < 2 ? "DETENIDO" : "EN RUTA");

    const nuevoPunto = [longitude, latitude];
    const ultimoPunto = coordenadasRef.current[coordenadasRef.current.length - 1];

    let debeGuardar = false;

    if (!ultimoPunto) {
        debeGuardar = true; 
    } else {
        const from = turf.point(ultimoPunto);
        const to = turf.point(nuevoPunto);
        const distanciaMetros = turf.distance(from, to, { units: 'kilometers' }) * 1000;

        // Guarda punto si te moviste más de 5 metros y el GPS es preciso
        if (distanciaMetros > 5 && (accuracy ? accuracy < 25 : true)) {
            debeGuardar = true;
        }
    }

    if (debeGuardar) {
        coordenadasRef.current = [...coordenadasRef.current, nuevoPunto];
        actualizarMapaVisual(coordenadasRef.current);
        
        AsyncStorage.setItem('RUTA_OFFLINE_CACHE', JSON.stringify(coordenadasRef.current));
    }
  };

  const finalizarViaje = async () => {
    const coords = coordenadasRef.current;
    
    if (coords.length < 2) {
        Alert.alert("Ruta muy corta", "No hay suficientes datos GPS para guardar.");
        return;
    }

    // Usamos Turf para calcular la distancia total de toda la ruta trazada
    const lineaRuta = turf.lineString(coords);
    const kilometrosTotales = turf.length(lineaRuta, { units: 'kilometers' });
    
    const datosFinales = {
        kilometros_recorridos: kilometrosTotales.toFixed(2),
        puntos_gps: coords,
        fecha: new Date().toISOString()
    };

    Alert.alert(
        "Viaje Finalizado", 
        `Recorriste un total de ${kilometrosTotales.toFixed(2)} km.\n\nDatos listos para enviar a la base de datos.`
    );

    // TODO: Aquí integrarás tu función para guardar en la BD de zonas prohibidas/rutas seguras
    console.log("Datos de la ruta listos:", datosFinales);
  };

  const centrarManual = () => { 
      // Si el operador movió el mapa con el dedo, este botón vuelve a "enganchar" la cámara
      setSeguirUsuario(true); 
  };
  
  if (!permiso) return <View style={styles.center}><Text style={styles.textW}>Esperando permisos...</Text></View>;

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <Mapbox.MapView 
            style={styles.map} 
            styleURL={'mapbox://styles/mapbox/navigation-night-v1'} 
            logoEnabled={false} 
            attributionEnabled={false} 
            scaleBarEnabled={false}
            onTouchStart={() => setSeguirUsuario(false)} // Desengancha la cámara si el usuario toca la pantalla para explorar
        >
            <Mapbox.Camera 
                ref={cameraRef} 
                zoomLevel={16} 
                pitch={50} 
                followUserLocation={seguirUsuario} 
                followUserMode={'course' as any} 
                followZoomLevel={16}
            />

            <Mapbox.UserLocation 
                visible={true} 
                showsUserHeadingIndicator={true} 
                androidRenderMode={'gps'} 
                minDisplacement={3}     
                requestsAlwaysUse={true} 
                onUpdate={alMoverse} 
            />
            <Mapbox.ShapeSource id="rutaSource" shape={rutaGrabada}>
                <Mapbox.LineLayer id="rutaLinea" style={{ lineColor: '#0ea5e9', lineWidth: 6, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.8 }} />
            </Mapbox.ShapeSource>
        </Mapbox.MapView>
        
        <View style={styles.speedometer}>
            <Text style={styles.speedText}>{velocidad}</Text><Text style={styles.unitText}>km/h</Text>
            <View style={[styles.statusBadge, { backgroundColor: estadoMovimiento === "DETENIDO" ? '#ef4444' : '#22c55e' }]}><Text style={styles.statusText}>{estadoMovimiento}</Text></View>
        </View>
        
        {alertaActiva && (<View style={styles.alertBox}><Text style={styles.alertText}>{mensajeAlerta}</Text></View>)}
        
        <TouchableOpacity style={styles.recenterBtn} onPress={centrarManual}>
            <MaterialCommunityIcons name="crosshairs-gps" size={30} color="#0f172a" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.recenterBtn, { top: 80, backgroundColor: '#ef4444' }]} onPress={finalizarViaje}>
            <MaterialCommunityIcons name="stop-circle" size={30} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.downloadBtn, descargandoMapa && {backgroundColor: '#334155'}]} onPress={descargarZonaOffline} disabled={descargandoMapa}>
             {descargandoMapa ? (<View style={{alignItems:'center'}}><ActivityIndicator color="white" size="small" /><Text style={{color:'white', fontSize:8}}>{progresoDescarga}%</Text></View>) : (<MaterialCommunityIcons name="cloud-download" size={24} color="white" />)}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0f172a' },
  container: { height: '100%', width: '100%' },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  textW: { color: 'white' },
  speedometer: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#334155', elevation: 10 },
  speedText: { color: 'white', fontSize: 42, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  unitText: { color: '#94a3b8', fontSize: 12, marginBottom: 5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  alertBox: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#7f1d1d', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  alertText: { color: 'white', fontWeight: 'bold', fontSize:16 },
  recenterBtn: { position: 'absolute', top: 20, left: 20, backgroundColor: '#f59e0b', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  downloadBtn: { position: 'absolute', top: 140, right: 20, backgroundColor: '#3b82f6', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 5 }
});

export default MapaRuta;
