import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertarPuntoGPS } from './database'; // 👈 Tu archivo de BD actualizado

const LOCATION_TASK_NAME = 'background-location-task';

/**
 * Define la tarea GLOBALMENTE (fuera de cualquier componente React).
 * Esta función se ejecuta incluso si la app está minimizada.
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("❌ Error en tarea de fondo:", error);
    return;
  }

  if (data) {
    const { locations } = data;
    
    try {
      // 1. Recuperamos el ID de la jornada activa
      const jornadaIdStr = await AsyncStorage.getItem('JORNADA_ACTIVA_ID');
      
      if (!jornadaIdStr) {
        // Si no hay jornada activa, detenemos el rastreo para ahorrar batería
        console.log("⚠️ No hay jornada activa, deteniendo GPS...");
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        return;
      }

      const jornadaId = parseInt(jornadaIdStr, 10);

      // 2. Insertamos cada punto recibido (a veces llegan varios juntos)
      for (const location of locations) {
        const { latitude, longitude, speed } = location.coords;
        
        // speed puede venir como -1 si es inválida, lo convertimos a 0
        const velocidadReal = speed < 0 ? 0 : speed;

        await insertarPuntoGPS(jornadaId, latitude, longitude, velocidadReal);
        
        console.log(`📍 Punto guardado: [${latitude}, ${longitude}] V:${velocidadReal}`);
      }
      
    } catch (err) {
      console.error("❌ Error guardando puntos GPS:", err);
    }
  }
});

/**
 * Función para INICIAR el rastreo
 * Llámala cuando el usuario pulse "Iniciar Jornada"
 */
export async function iniciarRastreo(jornadaId) {
  try {
    // 1. Pedir permisos
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      alert('Se requiere permiso de ubicación al usar la app.');
      return;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      alert('Se requiere permiso de ubicación en segundo plano para rastrear la ruta.');
      return;
    }

    // 2. Guardar el ID en Storage para que la Task lo pueda leer
    await AsyncStorage.setItem('JORNADA_ACTIVA_ID', jornadaId.toString());

    // 3. Iniciar el servicio
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // Mínimo 5 segundos entre puntos
      distanceInterval: 10, // Mínimo 10 metros de movimiento
      showsBackgroundLocationIndicator: true, // Muestra la burbuja azul en iOS/Android 11+
      foregroundService: {
        notificationTitle: "Rastreando ruta",
        notificationBody: "Tu ubicación está siendo registrada.",
        notificationColor: "#FF0000",
      },
    });

    console.log("✅ Rastreo iniciado para jornada:", jornadaId);

  } catch (e) {
    console.log("❌ Error al iniciar rastreo:", e);
  }
}

/**
 * Función para DETENER el rastreo
 * Llámala cuando el usuario pulse "Finalizar Jornada"
 */
export async function detenerRastreo() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await AsyncStorage.removeItem('JORNADA_ACTIVA_ID'); // Limpiamos el ID
      console.log("🛑 Rastreo detenido correctamente.");
    }
  } catch (e) {
    console.log("❌ Error al detener rastreo:", e);
  }
}
