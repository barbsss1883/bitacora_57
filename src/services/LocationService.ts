import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertarPuntoGPS } from '../../db/database';

const LOCATION_TASK_NAME = 'BACKGROUND_GPS_TRACKING';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("❌ Error en GPS Background:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0]; // Tomamos la más reciente

    if (location) {
      try {
        // 1. Recuperamos el ID de la jornada actual desde el almacenamiento
        const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        
        if (jornadaIdStr) {
          const jornadaId = parseInt(jornadaIdStr, 10);
          
          // 2. Guardamos en SQLite usando tu función existente
          await insertarPuntoGPS(
            jornadaId,
            location.coords.latitude,
            location.coords.longitude,
            location.coords.speed || 0 // Si la velocidad es null, ponemos 0
          );
          
          console.log(`📍 Guardado: ID ${jornadaId} - [${location.coords.latitude}, ${location.coords.longitude}]`);
        } else {
          console.log("⚠️ GPS activo pero sin jornada seleccionada.");
        }
      } catch (err) {
        console.error("Error guardando punto GPS:", err);
      }
    }
  }
});

export const iniciarRastreoBackground = async () => {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    console.log('❌ Permiso de background denegado');
    return;
  }
  
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 500, // 500 metros
    timeInterval: 10000,   // 10 segundos
    deferredUpdatesInterval: 5000,
    foregroundService: {
      notificationTitle: "Bitácora57",
      notificationBody: "Ruta activa: Registrando ubicación...",
      notificationColor: "#2980b9",
    },
  });
  console.log("✅ Rastreo iniciado");
};

export const detenerRastreo = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("🛑 Rastreo detenido");
  }
};

/**
 * NUEVA FUNCIÓN: GEOCODIFICACIÓN INVERSA
 * Convierte coordenadas (lat, long) en una dirección legible (Calle, Ciudad, Estado).
 * Si no se pasan argumentos, usa la ubicación actual del dispositivo.
 */
export const obtenerDireccion = async (lat?: number, long?: number): Promise<string> => {
  try {
    let latitude = lat;
    let longitude = long;

    // Si no se proveen coordenadas, obtenemos la posición actual (Foregound)
    if (!latitude || !longitude) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return "Ubicación no disponible (Permiso denegado)";
      
      const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      latitude = currentLoc.coords.latitude;
      longitude = currentLoc.coords.longitude;
    }

    // Usamos el servicio nativo de Expo para Reverse Geocoding
    const direcciones = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (direcciones.length > 0) {
      const d = direcciones[0];
      // Construimos una cadena limpia evitando valores nulos
      const calle = d.street || d.name || '';
      const numero = d.streetNumber ? `#${d.streetNumber}` : '';
      const colonia = d.district || d.subregion || '';
      const ciudad = d.city || d.region || '';
      const estado = d.region || '';
      
      // Formato preferido: "Calle #123, Colonia, Ciudad"
      // Filtramos partes vacías para que no queden comas sueltas
      const partes = [
        `${calle} ${numero}`.trim(),
        colonia,
        ciudad !== colonia ? ciudad : null, // Evitar duplicados si ciudad y distrito son iguales
        estado !== ciudad ? estado : null
      ].filter(Boolean);

      return partes.join(', ') || `Coordenadas: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return `Ubicación: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  } catch (error) {
    console.warn("Error obteniendo dirección:", error);
    // En caso de error (sin internet, etc.), devolvemos las coordenadas como respaldo
    return lat ? `${lat.toFixed(5)}, ${long.toFixed(5)}` : "Ubicación desconocida";
  }
};