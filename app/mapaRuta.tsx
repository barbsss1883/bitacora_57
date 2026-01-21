import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Vibration, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// 1. TU TOKEN
Mapbox.setAccessToken('pk.eyJ1IjoibHVpc2cwNDE4IiwiYSI6ImNtaXhoeDVxMTA0Z28zZ3B2d3d1M2Z6M20ifQ.uOyMfGrAILud_KpxGFEOig');

const trampasData = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'trampa1', properties: { titulo: 'PUENTE 3.8M', tipo: 'altura', color: '#ef4444' }, geometry: { type: 'Point', coordinates: [-99.6015, 19.2878] } },
    { type: 'Feature', id: 'trampa2', properties: { titulo: 'CACHIMBA SEGURA', tipo: 'seguridad', color: '#22c55e' }, geometry: { type: 'Point', coordinates: [-97.5050, 25.8690] } },
  ],
};

const MapaRuta = () => {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [permiso, setPermiso] = useState(false);
  const [primerZoomHecho, setPrimerZoomHecho] = useState(false);
  const [descargandoMapa, setDescargandoMapa] = useState(false);
  const [progresoDescarga, setProgresoDescarga] = useState(0);

  // RUTA
  const [rutaGrabada, setRutaGrabada] = useState<any>({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }]});
  const coordenadasRef = useRef<number[][]>([]); // Aquí guardamos la memoria de la ruta
  
  // ESTADO
  const [velocidad, setVelocidad] = useState(0);
  const [estadoMovimiento, setEstadoMovimiento] = useState("ESPERANDO GPS...");
  const [alertaActiva, setAlertaActiva] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState("");

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
        const bounds = [[ultimoPunto[0] - 0.5, ultimoPunto[1] - 0.5], [ultimoPunto[0] + 0.5, ultimoPunto[1] + 0.5]];
        await Mapbox.offlineManager.createPack({ name: `ruta-${Date.now()}`, styleURL: 'mapbox://styles/mapbox/navigation-night-v1', minZoom: 10, maxZoom: 16, bounds: bounds }, (p) => setProgresoDescarga(Math.round(p.percentage)));
        Alert.alert("¡Listo!", "Mapa guardado para uso sin internet.");
    } catch (e) { Alert.alert("Error", "Fallo descarga."); } finally { setDescargandoMapa(false); setProgresoDescarga(0); }
  };

  const actualizarMapaVisual = (coords: number[][]) => {
    setRutaGrabada({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
    });
  };

  // --- CEREBRO DEL RASTREO (Optimizado para curvas suaves) ---
  const alMoverse = async (location: Mapbox.Location) => {
    if (!location?.coords) return;
    const { longitude, latitude, speed, accuracy } = location.coords;

    // 1. ZOOM INICIAL
    if (!primerZoomHecho && cameraRef.current) {
        setPrimerZoomHecho(true);
        cameraRef.current.setCamera({ centerCoordinate: [longitude, latitude], zoomLevel: 17, animationDuration: 2000 });
    }

    // 2. VELOCIDAD
    const vel = speed && speed > 0 ? Math.round(speed * 3.6) : 0;
    setVelocidad(vel);
    setEstadoMovimiento(vel < 2 ? "DETENIDO" : "EN RUTA");

    // 3. GRABADO DE RUTA INTELIGENTE (SUAVIZADO)
    const nuevoPunto = [longitude, latitude];
    const ultimoPunto = coordenadasRef.current[coordenadasRef.current.length - 1];

    let debeGuardar = false;

    if (!ultimoPunto) {
        debeGuardar = true; // Primer punto siempre se guarda
    } else {
        // Usamos TURF para medir la distancia real en metros
        const from = turf.point(ultimoPunto);
        const to = turf.point(nuevoPunto);
        const distanciaMetros = turf.distance(from, to, { units: 'kilometers' }) * 1000;

        // REGLA DE ORO:
        // Solo guardamos si avanzó más de 5 metros Y la precisión del GPS es decente (< 20m)
        // Esto evita líneas rectas gigantes y evita el "temblor" cuando estás parado.
        if (distanciaMetros > 5 && (accuracy ? accuracy < 25 : true)) {
            debeGuardar = true;
        }
    }

    if (debeGuardar) {
        coordenadasRef.current = [...coordenadasRef.current, nuevoPunto];
        actualizarMapaVisual(coordenadasRef.current);
        // Guardar en disco (sin await para no frenar la UI)
        AsyncStorage.setItem('RUTA_OFFLINE_CACHE', JSON.stringify(coordenadasRef.current));
    }

    // 4. RADAR
    const miPunto = turf.point([longitude, latitude]);
    let peligro = false;
    trampasData.features.forEach((trampa) => {
      const dist = turf.distance(miPunto, turf.point(trampa.geometry.coordinates), { units: 'kilometers' });
      if (dist < 2.0) { peligro = true; setAlertaActiva(true); setMensajeAlerta(`⚠️ ${trampa.properties.titulo} a ${dist.toFixed(1)}km`); }
    });
    if (!peligro) setAlertaActiva(false);
  };

  const centrarManual = () => { setPrimerZoomHecho(false); };
  if (!permiso) return <View style={styles.center}><Text style={styles.textW}>Esperando permisos...</Text></View>;

  return (
    <View style={styles.page}>
      <View style={styles.container}>
        <Mapbox.MapView style={styles.map} styleURL={'mapbox://styles/mapbox/navigation-night-v1'} logoEnabled={false} attributionEnabled={false} scaleBarEnabled={false}>
            <Mapbox.Camera ref={cameraRef} zoomLevel={4} followUserMode={'course'} pitch={50} />
            
            {/* CONFIGURACIÓN CRÍTICA PARA CURVAS SUAVES: minDisplacement={3} */}
            <Mapbox.UserLocation 
                visible={true} 
                showsUserHeadingIndicator={true} 
                androidRenderMode={'gps'} // Forzar uso de GPS nativo de alta precisión
                minDisplacement={3}     // Notificar cambios cada 3 metros
                requestsAlwaysUse={true} // Pedir prioridad al sistema
                onUpdate={alMoverse} 
            />

            <Mapbox.ShapeSource id="rutaSource" shape={rutaGrabada}>
                {/* lineJoin: 'round' hace que las esquinas de la línea sean redondas, no picudas */}
                <Mapbox.LineLayer id="rutaLinea" style={{ lineColor: '#0ea5e9', lineWidth: 6, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.8 }} />
            </Mapbox.ShapeSource>

            <Mapbox.ShapeSource id="trampasSource" shape={trampasData}>
                <Mapbox.CircleLayer id="trampasCirculo" style={{ circleRadius: 8, circleColor: ['get', 'color'], circleStrokeWidth: 2, circleStrokeColor: '#ffffff' }} />
                <Mapbox.SymbolLayer id="trampasTexto" style={{ textField: ['get', 'titulo'], textSize: 10, textColor: '#ffffff', textOffset: [0, -1.5] }} />
            </Mapbox.ShapeSource>
        </Mapbox.MapView>

        <View style={styles.speedometer}>
            <Text style={styles.speedText}>{velocidad}</Text><Text style={styles.unitText}>km/h</Text>
            <View style={[styles.statusBadge, { backgroundColor: estadoMovimiento === "DETENIDO" ? '#ef4444' : '#22c55e' }]}><Text style={styles.statusText}>{estadoMovimiento}</Text></View>
        </View>
        {alertaActiva && (<View style={styles.alertBox}><Text style={styles.alertText}>{mensajeAlerta}</Text></View>)}
        
        <TouchableOpacity style={styles.recenterBtn} onPress={centrarManual}><MaterialCommunityIcons name="crosshairs-gps" size={30} color="#0f172a" /></TouchableOpacity>
        
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