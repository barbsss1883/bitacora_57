import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertarPuntoGPS, validarTiemposSCT } from '../../db/database';

const LOCATION_TASK_NAME = 'BACKGROUND_GPS_TRACKING';
type ResultadoRastreo = { ok: boolean; message?: string };

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

export const validarPermisosRastreoBackground = async (): Promise<ResultadoRastreo> => {
  const foregroundActual = await Location.getForegroundPermissionsAsync();
  let foregroundStatus = foregroundActual.status;

  if (foregroundStatus !== 'granted') {
    const foregroundSolicitado = await Location.requestForegroundPermissionsAsync();
    foregroundStatus = foregroundSolicitado.status;
  }

  if (foregroundStatus !== 'granted') {
    return {
      ok: false,
      message: 'Debes permitir ubicación precisa para iniciar la jornada.',
    };
  }

  const backgroundActual = await Location.getBackgroundPermissionsAsync();
  let backgroundStatus = backgroundActual.status;

  if (backgroundStatus !== 'granted') {
    const backgroundSolicitado = await Location.requestBackgroundPermissionsAsync();
    backgroundStatus = backgroundSolicitado.status;
  }

  if (backgroundStatus !== 'granted') {
    return {
      ok: false,
      message: 'Debes permitir "Ubicación todo el tiempo" para registrar la ruta en segundo plano.',
    };
  }

  return { ok: true };
};

export const iniciarRastreoBackground = async (): Promise<ResultadoRastreo> => {
  const permisos = await validarPermisosRastreoBackground();
  if (!permisos.ok) {
    console.log(`❌ ${permisos.message}`);
    return permisos;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) return { ok: true };

  try {
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
    return { ok: true };
  } catch (error) {
    console.error("❌ No se pudo iniciar el rastreo:", error);
    return {
      ok: false,
      message: 'No se pudo activar el rastreo en segundo plano. Revisa permisos y batería del dispositivo.',
    };
  }
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

// ==============================================
// NOTIFICACIONES DEL TEMPORIZADOR
// ==============================================

// Configurar el canal de notificación (Android)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let timerNotificationInterval: NodeJS.Timeout | null = null;
let lastSCTAlertState: string = '';
let lastNotificationId: string | null = null;

export const solicitarPermisosNotificacion = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn("Error solicitando permisos de notificación:", error);
    return false;
  }
};

export const iniciarNotificacionTemporizador = async (): Promise<void> => {
  try {
    // Solicitar permisos
    await solicitarPermisosNotificacion();
    
    // Detener si ya hay un intervalo activo
    if (timerNotificationInterval) {
      clearInterval(timerNotificationInterval);
    }
    
    // Actualizar notificación cada segundo
    timerNotificationInterval = setInterval(async () => {
      try {
        const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        const fechaInicio = await AsyncStorage.getItem('CURRENT_JORNADA_START');
        const operador = await AsyncStorage.getItem('CURRENT_JORNADA_OPERADOR');
        const unidad = await AsyncStorage.getItem('CURRENT_JORNADA_UNIDAD');
        
        if (jornadaIdStr && fechaInicio) {
          const jornadaId = parseInt(jornadaIdStr, 10);
          const ahora = new Date();
          const inicio = new Date(fechaInicio);
          const diff = ahora.getTime() - inicio.getTime();
          
          // ------ TIEMPO TOTAL DE LA JORNADA ------
          const segundos = Math.floor((diff / 1000) % 60);
          const minutos = Math.floor((diff / (1000 * 60)) % 60);
          const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const tiempoManejo = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
          
          // ------ VALIDAR TIEMPOS SCT ------
          const validacionSCT = await validarTiemposSCT(jornadaId, fechaInicio);
          
          let titulo = `📍 Jornada: ${tiempoManejo}`;
          let cuerpo = `${operador || 'Operador'} | ${unidad || 'Unidad'}`;
          let sonido = false;
          
          // Si hay alerta o límite SCT, actualizar notificación
          if (validacionSCT.estado === 'ALERTA') {
            titulo = `⚠️ RECORDATORIO SCT`;
            cuerpo = `${validacionSCT.mensaje}\nTipo: Jornada ${tiempoManejo}`;
            sonido = Math.floor(ahora.getTime() / 2000) % 2 === 0; // Suena cada 2 segundos
            
            // Evitar spam: solo mostrar alerta si cambió el estado
            if (lastSCTAlertState !== 'ALERTA') {
              lastSCTAlertState = 'ALERTA';
              console.warn('⚠️ ALERTA SCT:', validacionSCT.mensaje);
            }
          } else if (validacionSCT.estado === 'LIMITE') {
            titulo = `❌ VIOLACIÓN SCT`;
            cuerpo = `${validacionSCT.mensaje}\nDebes detener la jornada INMEDIATAMENTE`;
            sonido = true;
            
            // Evitar spam: solo mostrar alerta si cambió el estado
            if (lastSCTAlertState !== 'LIMITE') {
              lastSCTAlertState = 'LIMITE';
              console.error('❌ LÍMITE SCT:', validacionSCT.mensaje);
            }
          } else {
            // Estado normal
            cuerpo += `\n⏱️ Conducción: ${(validacionSCT.tiempoConduccion / 60).toFixed(1)}h / 9h`;
            lastSCTAlertState = '';
          }
          
          // Descartar notificación anterior antes de mostrar la nueva
          if (lastNotificationId) {
            try {
              await Notifications.dismissNotificationAsync(lastNotificationId);
            } catch (e) {
              console.log("No se pudo descartar notificación anterior");
            }
          }
          
          lastNotificationId = await Notifications.presentNotificationAsync({
            title: titulo,
            body: cuerpo,
            badge: 1,
            sound: sonido ? 'default' : false,
            sticky: validacionSCT.estado !== 'NORMAL',
          });
        }
      } catch (error) {
        console.error("Error actualizando notificación del temporizador:", error);
      }
    }, 1000); // Actualizar cada segundo
    
    console.log("✅ Notificación del temporizador iniciada con validación SCT");
  } catch (error) {
    console.error("❌ Error iniciando notificación del temporizador:", error);
  }
};

export const detenerNotificacionTemporizador = async (): Promise<void> => {
  try {
    // Detener el intervalo
    if (timerNotificationInterval) {
      clearInterval(timerNotificationInterval);
      timerNotificationInterval = null;
    }
    
    lastSCTAlertState = '';
    
    // Descartar la última notificación que se mostró
    if (lastNotificationId) {
      try {
        await Notifications.dismissNotificationAsync(lastNotificationId);
        lastNotificationId = null;
      } catch (e) {
        console.log("No se pudo descartar notificación al detener");
      }
    }
    
    // Descartar notificaciones pendientes del temporizador (por si acaso)
    const notifications = await Notifications.getPresentedNotificationsAsync();
    const notificacionesTimer = notifications.filter(n => 
      n.request.content.title?.includes('Jornada') || 
      n.request.content.title?.includes('RECORDATORIO') ||
      n.request.content.title?.includes('VIOLACIÓN')
    );
    
    for (const notif of notificacionesTimer) {
      await Notifications.dismissNotificationAsync(notif.request.identifier);
    }
    
    console.log("🛑 Notificación del temporizador detenida");
  } catch (error) {
    console.error("Error deteniendo notificación del temporizador:", error);
  }
};

