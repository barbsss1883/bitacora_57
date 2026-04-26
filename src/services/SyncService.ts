
import AsyncStorage from '@react-native-async-storage/async-storage';
// ✅ CAMBIADO: supabase reemplaza firebase/firestore + firebaseConfig
import { supabase } from './supabaseClient';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoSync =
  | 'jornada_inicio'
  | 'jornada_fin'
  | 'incidencia'
  | 'ruta_maestra'
  | 'pdf_meta';

// ─── Tipos GeoJSON mínimos para la cola ──────────────────────────────────────
interface GeoJSONFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown[] } | null;
  properties: Record<string, unknown>;
}

export interface ItemSync {
  id:           string;
  tipo:         TipoSync;
  payload:      Record<string, unknown>;
  intentos:     number;
  creadoEn:     number;
  ultimoError?: string;
}

const QUEUE_KEY    = 'SYNC_QUEUE';
const MAX_INTENTOS = 5;

// ─── Helpers de cola ──────────────────────────────────────────────────────────

const leerCola = async (): Promise<ItemSync[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const guardarCola = async (cola: ItemSync[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(cola));
};

const generarId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Agrega un item a la cola offline.
 * Llama esto SIEMPRE en lugar de Supabase directamente.
 * Si hay conexión, procesarColaSync() lo enviará de inmediato.
 */
export const encolarSync = async (
  tipo: TipoSync,
  payload: Record<string, unknown>
): Promise<void> => {
  const cola = await leerCola();

  const item: ItemSync = {
    id:       generarId(),
    tipo,
    payload,
    intentos: 0,
    creadoEn: Date.now(),
  };

  cola.push(item);
  await guardarCola(cola);
  console.log(`📥 [SyncQueue] Encolado: ${tipo} | Total en cola: ${cola.length}`);

  // Intento inmediato — si falla, queda en cola para el próximo reintento
  await procesarColaSync();
};

/**
 * Procesa todos los items pendientes en cola.
 * Llama esto al iniciar la app y cada vez que detectes conexión.
 */
export const procesarColaSync = async (): Promise<void> => {
  const cola = await leerCola();
  if (cola.length === 0) return;

  console.log(`🔄 [SyncQueue] Procesando ${cola.length} item(s) pendiente(s)...`);

  const colaActualizada: ItemSync[] = [];

  for (const item of cola) {
    if (item.intentos >= MAX_INTENTOS) {
      console.warn(
        `⚠️ [SyncQueue] Item ${item.id} (${item.tipo}) descartado tras ${MAX_INTENTOS} intentos.`
      );
      continue; // Descarta definitivamente
    }

    try {
      await enviarASupabase(item);
      console.log(`✅ [SyncQueue] Sincronizado: ${item.tipo} | id: ${item.id}`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Error desconocido';
      console.warn(
        `❌ [SyncQueue] Fallo intento ${item.intentos + 1} para ${item.tipo}: ${err}`
      );
      colaActualizada.push({
        ...item,
        intentos:    item.intentos + 1,
        ultimoError: err,
      });
    }
  }

  await guardarCola(colaActualizada);

  if (colaActualizada.length === 0) {
    console.log('✅ [SyncQueue] Cola vacía. Todo sincronizado.');
  } else {
    console.log(`⏳ [SyncQueue] Quedan ${colaActualizada.length} item(s) pendiente(s).`);
  }
};

/**
 * Cuántos items hay pendientes en cola.
 * Útil para mostrar un indicador visual en la UI.
 */
export const contarPendientes = async (): Promise<number> => {
  const cola = await leerCola();
  return cola.length;
};

/**
 * Limpia la cola completa. Usar solo en casos de emergencia / reset de cuenta.
 */
export const limpiarCola = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
  console.log('🧹 [SyncQueue] Cola limpiada.');
};

// ─── Despacho por tipo → Supabase ────────────────────────────────────────────
// ✅ CAMBIADO: enviarAFirestore → enviarASupabase
// Toda la lógica de reintentos y cola permanece igual — solo cambia este bloque.

const enviarASupabase = async (item: ItemSync): Promise<void> => {
  const { tipo, payload } = item;
  const ahora = new Date().toISOString(); // ✅ reemplaza serverTimestamp()

  switch (tipo) {

    // ── Inicio de jornada ────────────────────────────────────────────────────
    // Era: setDoc(doc(db_firestore, 'jornadas', id), datos)
    // Ahora: upsert en viajes — id_local es la clave de deduplicación
    case 'jornada_inicio': {
      const { id_interno, empresa, estatus, fecha_inicio, ...datos } = payload;
      const { error } = await supabase
        .from('viajes')
        .upsert(
          {
            id_local:          id_interno,
            estado:            ['activo','pausado','finalizado','cancelado'].includes(estatus) ? estatus : 'activo',
            inicio_jornada:    fecha_inicio ?? ahora,
            origen_nombre:     datos.origen   ?? null,
            destino_nombre:    datos.destino  ?? null,
            carga_descripcion: datos.tipo_servicio ?? null,
            updated_at:        ahora,
            // Datos del formulario que no tienen columna propia → metadata JSONB
            metadata: {
              permisionario:     empresa,
              unidad:            datos.unidad,
              placas:            datos.placas,
              marca:             datos.marca,
              modalidad:         datos.modalidad,
              operador:          datos.operador,
              licencia:          datos.licencia,
              vigencia:          datos.vigencia,
              remolque1_eco:     datos.remolque1_eco,
              remolque1_placas:  datos.remolque1_placas,
              remolque2_eco:     datos.remolque2_eco,
              remolque2_placas:  datos.remolque2_placas,
            },
          },
          { onConflict: 'id_local' }
        );
      if (error) throw new Error(`jornada_inicio: ${error.message}`);
      break;
    }

    // ── Fin de jornada ───────────────────────────────────────────────────────
    // Era: setDoc completo sobreescribiendo jornadas/{id}
    // Ahora: upsert final con todos los datos de cierre
    case 'jornada_fin': {
      const {
        id_interno, empresa, estatus,
        pausas, incidencias, ruta_geojson,
        km_totales, firma, sello_digital,
        km_calculados, servidor_verificado, ...datos
      } = payload;

      const { error } = await supabase
        .from('viajes')
        .upsert(
          {
            id_local:      id_interno,
            estado:        'finalizado',
            fin_jornada:   ahora,
            km_fin:        km_totales   ?? null,
            firma_digital: firma        ?? null,
            hash_sha256:   sello_digital ?? null,
            observaciones: datos.observaciones ?? null,
            updated_at:    ahora,
            metadata: {
              permisionario:  empresa,
              unidad:         datos.unidad,
              placas:         datos.placas,
              operador:       datos.operador,
              licencia:       datos.licencia,
              origen:         datos.origen,
              destino:        datos.destino,
              km_calculados,
              pausas,
              incidencias,
              ruta_geojson,
            },
          },
          { onConflict: 'id_local' }
        );
      if (error) throw new Error(`jornada_fin: ${error.message}`);
      break;
    }

    // ── Ruta maestra (inteligencia vial colectiva) ────────────────────────────
    // Era: setDoc(doc(db_firestore, 'rutas_maestras', id), datos)
    // Ahora: upsert en rutas_recolectadas
    case 'ruta_maestra': {
      const {
        id_interno, empresa, unidad, operador,
        origen, destino, fecha_inicio,
        km_totales, estatus, ruta, incidencias_count,
      } = payload;

      const { data: { session } } = await supabase.auth.getSession();

      // Parsear ruta si viene como string JSON
      let featureGeoJSON: GeoJSONFeature | null = null;
      if (ruta) {
        try {
          featureGeoJSON = typeof ruta === 'string' ? JSON.parse(ruta) : ruta;
        } catch (_) {}
      }

      const { error } = await supabase
        .from('rutas_recolectadas')
        .upsert(
          {
            id_local:    id_interno,
            usuario_id:  session?.user?.id ?? null,
            tipo_unidad: unidad ?? null,
            datos_viaje: featureGeoJSON
              ? {
                  ...featureGeoJSON,
                  properties: {
                    ...(featureGeoJSON.properties ?? {}),
                    empresa, operador, origen, destino,
                    fecha_inicio, km_totales, estatus,
                    incidencias_count,
                  },
                }
              : {
                  type: 'Feature',
                  geometry: null,
                  properties: { id_interno, empresa, operador, km_totales },
                },
            procesado:   false,
            updated_at:  ahora,
          },
          { onConflict: 'id_local' }
        );
      if (error) throw new Error(`ruta_maestra: ${error.message}`);
      break;
    }

    // ── Incidencia / reporte en ruta ─────────────────────────────────────────
    // Era: addDoc(collection(db_firestore, 'reportes_ruta'), payload)
    // Ahora: insert en eventos_ruta (sin clave única — cada reporte es un nuevo evento)
    case 'incidencia': {
      const { tipo, descripcion, ubicacion, direccion } = payload;

      // Normalizar el tipo al CHECK constraint de la tabla eventos_ruta
      const tipoMap: Record<string, string> = {
        'Puente Bajo':   'puente_bajo',
        'Calle Angosta': 'calle_angosta',
        'Zona Insegura': 'zona_peligrosa',
        'Retén / GN':    'retenimiento',
        'Otro':          'otro',
      };
      const tipoNormalizado = tipoMap[tipo] ?? 'otro';

      const { error } = await supabase
        .from('eventos_ruta')
        .insert({
          tipo:        tipoNormalizado,
          lat:         ubicacion?.lat ?? 0,
          lng:         ubicacion?.lng ?? 0,
          descripcion: descripcion
            ? `${descripcion}${direccion ? ` — ${direccion}` : ''}`
            : direccion ?? null,
          activo:      true,
          created_at:  ahora,
        });
      if (error) throw new Error(`incidencia: ${error.message}`);
      break;
    }

    // ── Metadata del PDF generado ────────────────────────────────────────────
    // Era: updateDoc(doc(db_firestore, 'jornadas', id), { pdf_url })
    // Ahora: update en viajes filtrando por id_local
    case 'pdf_meta': {
      const { id_interno, pdf_url } = payload;
      const { error } = await supabase
        .from('viajes')
        .update({ pdf_url, updated_at: ahora })
        .eq('id_local', id_interno);
      if (error) throw new Error(`pdf_meta: ${error.message}`);
      break;
    }

    default:
      throw new Error(`Tipo de sync desconocido: ${tipo}`);
  }
};
