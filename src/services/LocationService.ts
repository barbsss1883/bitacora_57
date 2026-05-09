import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { insertarPuntoGPS, validarTiemposSCT } from '../../db/database';
import { supabase } from './supabaseClient';

const LOCATION_TASK_NAME = 'BACKGROUND_GPS_TRACKING';
type ResultadoRastreo = { ok: boolean; message?: string };

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("❌ Error en GPS Background:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (location) {
      try {
        const jornadaIdStr = await AsyncStorage.getItem('CURRENT_JORNADA_ID');

        if (jornadaIdStr) {
          const jornadaId = parseInt(jornadaIdStr, 10);

          await insertarPuntoGPS(
            jornadaId,
            location.coords.latitude,
            location.coords.longitude,
            location.coords.speed || 0
          );

          // Enviar posición actual a Supabase para el dashboard familiar
          // Envuelto en try-catch para que un fallo no detenga el GPS
          try {
            await supabase.from('gps_actual').upsert({
              jornada_id:  jornadaIdStr,
              lat:         location.coords.latitude,
              lng:         location.coords.longitude,
              velocidad:   Math.round((location.coords.speed || 0) * 3.6), // m/s → km/h
              updated_at:  new Date().toISOString(),
            }, { onConflict: 'jornada_id' });
          } catch (_) {
            // silencioso — no interrumpir rastreo por fallo de red
          }

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
      accuracy: Location.Accuracy.High,
      // ✅ FIX: 500m producía muy pocos puntos → línea recta al cerrar la app.
      // 80m captura curvas y cruces sin saturar la DB (~450 puntos en 36km).
      distanceInterval: 80,
      // Tiempo mínimo entre actualizaciones (OS puede ignorarlo en background)
      timeInterval: 15000,
      // Acumula hasta 3 puntos antes de despertar la app (eficiencia de batería)
      deferredUpdatesDistance: 80,
      deferredUpdatesInterval: 15000,
      // Mantiene la precisión aunque el OS intente bajarla en background
      pausesUpdatesAutomatically: false,
      // Android: evita que el OS mate la tarea GPS
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Bitácora57 — Ruta activa",
        notificationBody: "Registrando ubicación en segundo plano...",
        notificationColor: "#D4AF37",
        // ✅ killServiceOnDestroy: false evita que Android detenga el GPS
        // cuando el usuario desliza la app del recents
        killServiceOnDestroy: false,
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

export const obtenerDireccion = async (lat?: number, long?: number): Promise<string> => {
  try {
    let latitude = lat;
    let longitude = long;
    if (!latitude || !longitude) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return "Ubicación no disponible (Permiso denegado)";
      
      const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      latitude = currentLoc.coords.latitude;
      longitude = currentLoc.coords.longitude;
    }

    const direcciones = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (direcciones.length > 0) {
      const d = direcciones[0];
      const calle = d.street || d.name || '';
      const numero = d.streetNumber ? `#${d.streetNumber}` : '';
      const colonia = d.district || d.subregion || '';
      const ciudad = d.city || d.region || '';
      const estado = d.region || '';
      const partes = [
        `${calle} ${numero}`.trim(),
        colonia,
        ciudad !== colonia ? ciudad : null, 
        estado !== ciudad ? estado : null
      ].filter(Boolean);
      return partes.join(', ') || `Coordenadas: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }

    return `Ubicación: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

  } catch (error) {
    console.warn("Error obteniendo dirección:", error);
    return lat ? `${lat.toFixed(5)}, ${long.toFixed(5)}` : "Ubicación desconocida";
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, 
    shouldShowList: true,   
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
    await solicitarPermisosNotificacion();
    if (timerNotificationInterval) {
      clearInterval(timerNotificationInterval);
    }
    
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
          const segundos = Math.floor((diff / 1000) % 60);
          const minutos = Math.floor((diff / (1000 * 60)) % 60);
          const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const tiempoManejo = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
          const validacionSCT = await validarTiemposSCT(jornadaId, fechaInicio);
          
          let titulo = `📍 Jornada: ${tiempoManejo}`;
          let cuerpo = `${operador || 'Operador'} | ${unidad || 'Unidad'}`;
          let sonido = false;
          if (validacionSCT) {
            if (validacionSCT.estado === 'AVISO_CONTINUO') {
              titulo = `⚠️ RECORDATORIO SCT`;
              cuerpo = `${validacionSCT.mensaje}\nTipo: Jornada ${tiempoManejo}`;
              sonido = Math.floor(ahora.getTime() / 2000) % 2 === 0;
              if (lastSCTAlertState !== 'ALERTA') {
                lastSCTAlertState = 'ALERTA';
                console.warn('⚠️ ALERTA SCT:', validacionSCT.mensaje);
              }
            } else if (validacionSCT.estado === 'LIMITE_CONTINUO' || validacionSCT.estado === 'LIMITE_JORNADA') {
              titulo = `❌ VIOLACIÓN SCT`;
              cuerpo = `${validacionSCT.mensaje}\nDebes detener la jornada INMEDIATAMENTE`;
              sonido = true;
              if (lastSCTAlertState !== 'LIMITE') {
                lastSCTAlertState = 'LIMITE';
                console.error('❌ LÍMITE SCT:', validacionSCT.mensaje);
              }
            } else {
              cuerpo += `\n⏱️ Conducción: ${(validacionSCT.tiempoConduccion / 60).toFixed(1)}h / 9h`;
              lastSCTAlertState = '';
            }
          }

          if (lastNotificationId) {
            try {
              await Notifications.dismissNotificationAsync(lastNotificationId);
            } catch (e) {
              console.log("No se pudo descartar notificación anterior");
            }
          }

          lastNotificationId = await Notifications.scheduleNotificationAsync({
            identifier: 'bitacora-timer-ruta',
            content: {
              title: titulo,
              body: cuerpo,
              badge: 1,
              sound: sonido ? 'default' : false,
              sticky: validacionSCT?.estado !== 'OK',
            },
            trigger: null,
          });

        }
      } catch (error) {
        console.error("Error actualizando notificación del temporizador:", error);
      }
    }, 1000); 
    
    console.log("✅ Notificación del temporizador iniciada con validación SCT");
  } catch (error) {
    console.error("❌ Error iniciando notificación del temporizador:", error);
  }
};

export const detenerNotificacionTemporizador = async (): Promise<void> => {
  try {
    if (timerNotificationInterval) {
      clearInterval(timerNotificationInterval);
      timerNotificationInterval = null;
    }
    
    lastSCTAlertState = '';
    
    if (lastNotificationId) {
      try {
        
        await Notifications.dismissNotificationAsync(lastNotificationId);
        lastNotificationId = null;
      } catch (e) {
        console.log("No se pudo descartar notificación al detener");
      }
    }
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

