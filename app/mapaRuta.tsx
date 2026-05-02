import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ AGREGADO: Supabase para persistir puntos GPS y eventos en la nube
import { supabase } from '../src/services/supabaseClient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { insertarPuntoGPS, calcularDistanciaTotalKm } from '../db/database';

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

        // ✅ FIX: Al reabrir la app, cargar puntos desde SQLite en lugar del cache.
        // La tarea background siguió insertando en puntos_gps mientras la app estuvo
        // cerrada. El cache de AsyncStorage solo tiene puntos hasta que se cerró la app,
        // por eso al reconectar se formaba una línea recta con el hueco.
        try {
            const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
            if (jornadaIdStr) {
                const { getDB } = await import('../db/database');
                const db = await getDB();
                const puntos: any[] = await db.getAllAsync(
                    'SELECT latitud, longitud FROM puntos_gps WHERE jornada_id = ? ORDER BY id ASC',
                    [parseInt(jornadaIdStr, 10)]
                );
                if (puntos && puntos.length >= 2) {
                    // Convertir al formato [lng, lat] que usa Mapbox
                    const coords = puntos.map(p => [p.longitud, p.latitud]);
                    coordenadasRef.current = coords;
                    actualizarMapaVisual(coords);

                    // Sincronizar el cache con los datos reales de SQLite
                    const geojsonCache = JSON.stringify({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: coords },
                        properties: {}
                    });
                    await AsyncStorage.setItem('RUTA_OFFLINE_CACHE', geojsonCache);
                    return; // SQLite tiene datos completos, no necesitamos el cache viejo
                }
            }
        } catch (e) {
            console.warn('[MapaRuta] Error cargando puntos desde SQLite:', e);
        }

        // Fallback: si no hay jornada activa o SQLite está vacío, usar el cache
        const rutaGuardada = await AsyncStorage.getItem('RUTA_OFFLINE_CACHE');
        if (rutaGuardada) {
            try {
                const parsed = JSON.parse(rutaGuardada);
                // Soporte para ambos formatos: GeoJSON Feature o array simple
                const coords = parsed?.type === 'Feature'
                    ? parsed.geometry.coordinates
                    : Array.isArray(parsed) ? parsed : [];
                if (coords.length > 0) {
                    coordenadasRef.current = coords;
                    actualizarMapaVisual(coords);
                }
            } catch (_) {}
        }
    })();
  }, []);

  const descargarZonaOffline = async () => {
    const ultimoPunto = coordenadasRef.current[coordenadasRef.current.length - 1];
    if (!ultimoPunto) { Alert.alert("Sin Ubicación", "Espera señal GPS."); return; }
    setDescargandoMapa(true);
    try {
        const bounds = [
            [ultimoPunto[0] - 0.5, ultimoPunto[1] - 0.5],
            [ultimoPunto[0] + 0.5, ultimoPunto[1] + 0.5]
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
    const { longitude, latitude, speed, accuracy, altitude } = location.coords;

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
        const nuevasCoords = [...coordenadasRef.current, nuevoPunto];
        coordenadasRef.current = nuevasCoords;
        actualizarMapaVisual(nuevasCoords);

        // ✅ FIX 1: Guardar en SQLite para que el contador de KM funcione en tiempo real
        // y para que finalizarJornada tenga puntos reales aunque la app se haya cerrado.
        try {
            const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
            if (jornadaIdStr) {
                await insertarPuntoGPS(
                    parseInt(jornadaIdStr, 10),
                    latitude,
                    longitude,
                    speed || 0
                );
            }
        } catch (e) {
            console.warn('[MapaRuta] Error insertando punto GPS en SQLite:', e);
        }

        // ✅ AGREGADO: Enviar punto GPS a Supabase de forma silenciosa (no bloquea UI)
        AsyncStorage.getItem('CURRENT_JORNADA_ID').then(async (jornadaIdStr) => {
            if (!jornadaIdStr) return;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                // Encolar en puntos_gps — falla silenciosamente si no hay conexión
                await supabase.from('puntos_gps_temp').insert({
                    viaje_id_local: parseInt(jornadaIdStr, 10),
                    lat:            latitude,
                    lng:            longitude,
                    velocidad_kmh:  vel,
                    timestamp:      new Date().toISOString(),
                });
            } catch (_) { /* offline: SQLite como fuente de verdad */ }
        }).catch(() => {});

        // ✅ FIX 2: Guardar en RUTA_OFFLINE_CACHE con formato GeoJSON Feature
        // (antes se guardaba como array simple [[lng,lat]] que finalizarJornada no reconocía)
        const geojsonCache = JSON.stringify({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: nuevasCoords },
            properties: { timestamps: [Date.now()] }
        });
        AsyncStorage.setItem('RUTA_OFFLINE_CACHE', geojsonCache);
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

    // ✅ CAMBIADO: enviar ruta finalizada a Supabase (rutas_recolectadas)
    try {
        const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        const modalidad = 'Sencillo'; // Se puede leer de FORM_PRESETS si se necesita
        const featureGeoJSON = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {
                id_interno:  jornadaIdStr ? parseInt(jornadaIdStr, 10) : null,
                km_totales:  parseFloat(kilometrosTotales.toFixed(2)),
                fecha:       new Date().toISOString(),
            }
        };
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('rutas_recolectadas').insert([{
            usuario_id:  session?.user?.id ?? null,
            tipo_unidad: modalidad,
            datos_viaje: featureGeoJSON,
            procesado:   false,
        }]);
    } catch (e) {
        console.warn('[MapaRuta] No se pudo enviar ruta a Supabase (se guardó local):', e);
    }
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
