import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

let cachedDb: SQLite.SQLiteDatabase | null = null;
const PASSWORD_HASH_PREFIX = 'sha256$';

// ─── Tipos de dominio ─────────────────────────────────────────────────────────

export interface DatosJornada {
  permisionario: string;
  domicilio?: string;
  unidad: string;
  placas: string;
  marca: string;
  modelo?: string;
  modalidad: string;
  remolque1_eco?: string;
  remolque1_placas?: string;
  remolque2_eco?: string;
  remolque2_placas?: string;
  operador: string;
  licencia: string;
  vigencia?: string;
  origen: string;
  destino: string;
  tipo_servicio?: string;
}

export interface RowJornada {
  id: number;
  permisionario: string;
  unidad: string;
  placas: string;
  marca: string;
  modalidad: string;
  operador: string;
  licencia: string;
  origen: string;
  destino: string;
  fecha_inicio: string;
  fecha_fin?: string;
  estatus: string;
  firma?: string;
  ruta_geojson?: string;
  km_totales: number;
  sello_digital?: string;
}

export interface RowPuntoGPS {
  latitud: number;
  longitud: number;
  velocidad: number;
  fecha: string;
  timestamp?: number;
  precision_gps?: number;
}

export interface RowUsuario {
  id: number;
  nombre: string;
  email: string;
  password: string;
  foto?: string;
}

export interface GoogleUserInput {
  user?: { email?: string; name?: string; givenName?: string; photo?: string; photoUrl?: string };
  email?: string;
  name?: string;
  givenName?: string;
  photo?: string;
  photoUrl?: string;
}

export interface RowPausa {
  id: number;
  jornada_id: number;
  motivo: string;
  inicio: string;
  fin: string;
  duracion: number;
  direccion?: string;
}

export interface ValidacionSCT {
  estado: 'OK' | 'AVISO_CONTINUO' | 'LIMITE_CONTINUO' | 'LIMITE_JORNADA';
  mensaje?: string;
  tiempoConduccion: number;
  tiempoJornada?: number;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const hasPasswordHashPrefix = (value: string) => value.startsWith(PASSWORD_HASH_PREFIX);

const hashPassword = async (plainPassword: string) => {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `B57-PASSWORD-V1:${plainPassword}`
  );
  return `${PASSWORD_HASH_PREFIX}${digest}`;
};

export const getDB = async () => {
  if (cachedDb) return cachedDb;
  try {
    cachedDb = await SQLite.openDatabaseAsync('bitacora.db');
    await cachedDb.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);
    return cachedDb;
  } catch (error) {
    console.error('Error opening DB:', error);
    throw error;
  }
};

export const initDatabase = async () => {
  try {
    const db = await getDB();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        email TEXT UNIQUE,
        password TEXT,
        foto TEXT
      );
      CREATE TABLE IF NOT EXISTS documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        nombre TEXT,
        uri TEXT,
        tipo TEXT,
        fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS jornadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permisionario TEXT,
        domicilio TEXT,
        unidad TEXT,
        placas TEXT,
        marca TEXT,
        modelo TEXT,
        modalidad TEXT,
        remolque1_eco TEXT,
        remolque1_placas TEXT,
        remolque2_eco TEXT,
        remolque2_placas TEXT,
        operador TEXT,
        licencia TEXT,
        vigencia TEXT,
        origen TEXT,
        destino TEXT,
        tipo_servicio TEXT,
        fecha_inicio TEXT,
        fecha_fin TEXT,
        estatus TEXT DEFAULT 'activo',
        firma TEXT,
        ruta_geojson TEXT,
        km_totales REAL DEFAULT 0,
        sello_digital TEXT
      );
      CREATE TABLE IF NOT EXISTS inspecciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        tipo TEXT,
        detalles_json TEXT,
        comentarios TEXT,
        firma TEXT,
        fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS puntos_gps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        latitud REAL,
        longitud REAL,
        velocidad REAL,
        fecha TEXT,
        timestamp REAL,
        precision_gps REAL
      );
      CREATE TABLE IF NOT EXISTS pausas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        motivo TEXT,
        inicio TEXT,
        fin TEXT,
        duracion REAL,
        direccion TEXT
      );
      CREATE TABLE IF NOT EXISTS incidencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        tipo TEXT,
        descripcion TEXT,
        foto_uri TEXT,
        fecha TEXT,
        direccion TEXT
      );
    `);
    try {
      await db.execAsync(`ALTER TABLE jornadas ADD COLUMN km_totales REAL DEFAULT 0;`);
      await db.execAsync(`ALTER TABLE jornadas ADD COLUMN sello_digital TEXT;`);
      await db.execAsync(`ALTER TABLE pausas ADD COLUMN direccion TEXT;`);
      await db.execAsync(`ALTER TABLE incidencias ADD COLUMN direccion TEXT;`);
      await db.execAsync(`ALTER TABLE puntos_gps ADD COLUMN timestamp REAL;`);
      await db.execAsync(`ALTER TABLE puntos_gps ADD COLUMN precision_gps REAL;`);
    } catch (_) {
      // Columnas ya existen — ignorar
    }
    console.log('BD Inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error inicializando BD:', error);
    cachedDb = null;
    throw error;
  }
};

export const generarSelloDigital = async (
  id: number,
  fechaInicio: string,
  operador: string,
  unidad: string
): Promise<string> => {
  try {
    const payload = JSON.stringify({ id, operador, unidad, fecha_inicio: fechaInicio });
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  } catch (e) {
    console.error('Error generando sello:', e);
    return 'ERROR_HASH';
  }
};

// ─── Jornadas ─────────────────────────────────────────────────────────────────

export const iniciarNuevaJornada = async (datos: DatosJornada): Promise<number | null> => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    const res = await db.runAsync(
      `INSERT INTO jornadas (
        permisionario, domicilio, unidad, placas, marca, modelo, modalidad,
        remolque1_eco, remolque1_placas, remolque2_eco, remolque2_placas,
        operador, licencia, vigencia, origen, destino, tipo_servicio,
        fecha_inicio, estatus, km_totales
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'activo', 0)`,
      [
        datos.permisionario, datos.domicilio, datos.unidad, datos.placas,
        datos.marca, datos.modelo, datos.modalidad, datos.remolque1_eco,
        datos.remolque1_placas, datos.remolque2_eco, datos.remolque2_placas,
        datos.operador, datos.licencia, datos.vigencia, datos.origen,
        datos.destino, datos.tipo_servicio, fecha,
      ]
    );
    const id = res.lastInsertRowId;
    if (id) {
      const sello = await generarSelloDigital(id, fecha, datos.operador, datos.unidad);
      await db.runAsync('UPDATE jornadas SET sello_digital = ? WHERE id = ?', [sello, id]);
    }
    return id;
  } catch (e) {
    console.error('iniciarNuevaJornada error:', e);
    return null;
  }
};

export const finalizarJornada = async (
  id: number,
  firma: string,
  rutaGeoJson: string | null,
  kmTotales: number = 0
) => {
  try {
    const db = await getDB();
    const fin = new Date().toISOString();
    let rutaFinal = rutaGeoJson;
    if (!rutaFinal) {
      const puntosGPS = await db.getAllAsync<RowPuntoGPS>(
        'SELECT latitud, longitud, velocidad, timestamp, precision_gps FROM puntos_gps WHERE jornada_id = ? ORDER BY id ASC',
        [id]
      );
      if (puntosGPS && puntosGPS.length > 0) {
        rutaFinal = JSON.stringify({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: puntosGPS.map(p => [p.longitud, p.latitud]),
          },
          properties: {
            velocidades: puntosGPS.map(p => p.velocidad || 0),
            timestamps: puntosGPS.map(p => p.timestamp || 0),
            precision_gps: puntosGPS.map(p => p.precision_gps || 0),
          },
        });
      }
    }

    await db.runAsync(
      `UPDATE jornadas SET fecha_fin = ?, firma = ?, ruta_geojson = ?, km_totales = ?, estatus = 'finalizado' WHERE id = ?`,
      [fin, firma || '', rutaFinal || null, kmTotales, id]
    );
    return true;
  } catch (e) {
    console.error('finalizarJornada error:', e);
    return false;
  }
};

export const obtenerHistorialJornadas = async () => {
  try {
    const db = await getDB();
    return await db.getAllAsync('SELECT * FROM jornadas ORDER BY id DESC') || [];
  } catch (e) {
    console.error('obtenerHistorialJornadas error:', e);
    return [];
  }
};

export const obtenerJornadas = async () => {
  try {
    const db = await getDB();
    return await db.getAllAsync('SELECT * FROM jornadas ORDER BY id DESC');
  } catch (error) {
    console.error('Error al obtener jornadas:', error);
    return [];
  }
};

export const obtenerDetalleJornada = async (id: number) => {
  try {
    const db = await getDB();
    const jornada = await db.getFirstAsync<RowJornada>('SELECT * FROM jornadas WHERE id = ?', [id]);
    const pausas = await db.getAllAsync('SELECT * FROM pausas WHERE jornada_id = ?', [id]);
    const incidencias = await db.getAllAsync('SELECT * FROM incidencias WHERE jornada_id = ?', [id]);
    const inspecciones = await db.getAllAsync('SELECT * FROM inspecciones WHERE jornada_id = ?', [id]);
    const puntosGPS = await db.getAllAsync('SELECT latitud, longitud, velocidad, fecha FROM puntos_gps WHERE jornada_id = ? ORDER BY fecha ASC', [id]);

    let rutaGeojson = jornada?.ruta_geojson || null;
    if (puntosGPS && puntosGPS.length > 0 && !rutaGeojson) {
      rutaGeojson = JSON.stringify(puntosGPS);
    }
    if (jornada && jornada.estatus === 'activo' && puntosGPS.length > 0 && !jornada.ruta_geojson) {
      await db.runAsync('UPDATE jornadas SET ruta_geojson = ? WHERE id = ?', [rutaGeojson, id]);
    }

    return {
      jornada: jornada ? { ...jornada, ruta_geojson: rutaGeojson } : null,
      pausas: pausas || [],
      incidencias: incidencias || [],
      inspecciones: inspecciones || [],
      puntosGPS: puntosGPS || [],
    };
  } catch (e) {
    console.error('obtenerDetalleJornada error:', e);
    return { jornada: null, pausas: [], incidencias: [], inspecciones: [], puntosGPS: [] };
  }
};

export const eliminarViaje = async (id: number) => {
  try {
    const db = await getDB();
    await db.runAsync('DELETE FROM jornadas WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM pausas WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM incidencias WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM inspecciones WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM puntos_gps WHERE jornada_id = ?', [id]);
  } catch (error) {
    console.error('Error al eliminar viaje:', error);
  }
};

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export const loginUsuario = async (email: string, pass: string) => {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<RowUsuario>('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (!row) return null;
    const passwordGuardada = row.password || '';
    if (hasPasswordHashPrefix(passwordGuardada)) {
      const hashIngresado = await hashPassword(pass || '');
      return hashIngresado === passwordGuardada ? row : null;
    }
    if ((pass || '') !== passwordGuardada) return null;
    const hashMigrado = await hashPassword(pass || '');
    await db.runAsync('UPDATE usuarios SET password = ? WHERE id = ?', [hashMigrado, row.id]);
    return row;
  } catch (e) {
    console.error('loginUsuario error:', e);
    return null;
  }
};

export const registrarUsuario = async (nombre: string, email: string, pass: string) => {
  try {
    const db = await getDB();
    const passwordHash = await hashPassword(pass || '');
    const res = await db.runAsync(
      'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre || '', email || '', passwordHash]
    );
    return res.lastInsertRowId;
  } catch (e) {
    console.error('registrarUsuario error:', e);
    return null;
  }
};

export const loginConGoogle = async (googleUser: GoogleUserInput) => {
  try {
    const db = await getDB();
    const datosUsuario = googleUser.user || googleUser;
    const email = datosUsuario.email;
    const name = datosUsuario.name || datosUsuario.givenName || 'Usuario Google';
    const photo = datosUsuario.photo || datosUsuario.photoUrl || '';
    if (!email) {
      console.error('❌ Error: No se encontró el email en el objeto googleUser');
      return null;
    }
    const existing = await db.getFirstAsync<RowUsuario>('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (existing) return existing;
    const res = await db.runAsync(
      'INSERT INTO usuarios (nombre, email, foto, password) VALUES (?, ?, ?, ?)',
      [name, email, photo, 'google_oauth']
    );
    return { id: res.lastInsertRowId, nombre: name, email, foto: photo };
  } catch (e) {
    console.error('❌ CRASH en loginConGoogle:', e);
    return null;
  }
};

export const obtenerEstadisticasUsuario = async (_usuarioId?: number) => {
  try {
    const db = await getDB();
    const filas = await db.getFirstAsync<{ total: number; km: number }>(
      'SELECT COUNT(*) as total, SUM(km_totales) as km FROM jornadas'
    );
    return { viajes: filas?.total || 0, km: filas?.km || 0 };
  } catch (e) {
    console.error('obtenerEstadisticasUsuario error:', e);
    return { viajes: 0, km: 0 };
  }
};

export const eliminarCuentaYDatosLocales = async () => {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await getDB();
    await db.execAsync('BEGIN IMMEDIATE TRANSACTION;');
    await db.runAsync('DELETE FROM puntos_gps');
    await db.runAsync('DELETE FROM pausas');
    await db.runAsync('DELETE FROM incidencias');
    await db.runAsync('DELETE FROM inspecciones');
    await db.runAsync('DELETE FROM jornadas');
    await db.runAsync('DELETE FROM documentos');
    await db.runAsync('DELETE FROM usuarios');
    await db.execAsync('COMMIT;');
    return true;
  } catch (error) {
    if (db) { try { await db.execAsync('ROLLBACK;'); } catch (_) {} }
    console.error('Error al eliminar cuenta:', error);
    cachedDb = null;
    return false;
  }
};

// ─── Documentos ───────────────────────────────────────────────────────────────

export const obtenerDocumentosUsuario = async (usuarioId: number) => {
  try {
    const db = await getDB();
    return await db.getAllAsync('SELECT * FROM documentos WHERE usuario_id = ?', [usuarioId]) || [];
  } catch (e) {
    console.error('obtenerDocumentosUsuario error:', e);
    return [];
  }
};

export const guardarDocumento = async (usuarioId: number, nombre: string, uri: string, tipo: string) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO documentos (usuario_id, nombre, uri, tipo, fecha) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, nombre, uri, tipo, fecha]
    );
    return true;
  } catch (e) {
    console.error('guardarDocumento error:', e);
    return false;
  }
};

export const eliminarDocumento = async (id: number) => {
  try {
    const db = await getDB();
    await db.runAsync('DELETE FROM documentos WHERE id = ?', [id]);
    return true;
  } catch (e) {
    console.error('eliminarDocumento error:', e);
    return false;
  }
};

// ─── Inspecciones ─────────────────────────────────────────────────────────────

export const guardarInspeccion = async (
  jornadaId: number,
  tipo: string,
  detalles: Record<string, boolean>,
  comentarios: string,
  firma: string
): Promise<number | null> => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO inspecciones (jornada_id, tipo, detalles_json, comentarios, firma, fecha)
       VALUES (?,?,?,?,?,?)`,
      [jornadaId, tipo || 'general', JSON.stringify(detalles || {}), comentarios || '', firma || '', fecha]
    );
    const inspeccionId = result.lastInsertRowId ?? null;

    // ── Guardar ID exacto para vinculación precisa (Punto 3) ──────────────
    // Si no hay jornada activa al hacer la inspección, persistir el ID para que
    // vincularInspeccionAViaje() lo use de forma exacta al iniciar el viaje.
    if (inspeccionId && jornadaId === 0) {
      try {
        await AsyncStorage.setItem('PENDING_INSPECCION_ID', String(inspeccionId));
      } catch (storageErr) {
        console.warn('[DB] No se pudo guardar PENDING_INSPECCION_ID:', storageErr);
      }
    }

    return inspeccionId;
  } catch (e) {
    console.error('guardarInspeccion error:', e);
    return null;
  }
};

export const vincularInspeccionAViaje = async (nuevoJornadaId: number) => {
  try {
    const db = await getDB();

    // ── Intento 1: ID exacto guardado por guardarInspeccion() ────────────
    const pendingIdStr = await AsyncStorage.getItem('PENDING_INSPECCION_ID');
    if (pendingIdStr) {
      const pendingId = parseInt(pendingIdStr, 10);
      if (!isNaN(pendingId)) {
        const result = await db.runAsync(
          `UPDATE inspecciones SET jornada_id = ? WHERE id = ? AND jornada_id = 0`,
          [nuevoJornadaId, pendingId]
        );
        await AsyncStorage.removeItem('PENDING_INSPECCION_ID');
        if (result.changes > 0) {
          console.log(`[DB] Inspección #${pendingId} vinculada a jornada #${nuevoJornadaId} (por ID exacto)`);
          return true;
        }
        console.warn(`[DB] Inspección #${pendingId} ya tenía jornada asignada o no existe`);
        return false;
      }
    }

    // ── Intento 2: Fallback — solo la más reciente del día ────────────────
    const hoyStart = new Date(); hoyStart.setHours(0, 0, 0, 0);
    const hoyEnd = new Date();   hoyEnd.setHours(23, 59, 59, 999);

    const masReciente = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM inspecciones WHERE jornada_id = 0 AND fecha >= ? AND fecha <= ? ORDER BY fecha DESC LIMIT 1`,
      [hoyStart.toISOString(), hoyEnd.toISOString()]
    );
    if (!masReciente) return false;

    const result = await db.runAsync(
      `UPDATE inspecciones SET jornada_id = ? WHERE id = ?`,
      [nuevoJornadaId, masReciente.id]
    );
    console.log(`[DB] Inspección #${masReciente.id} vinculada a jornada #${nuevoJornadaId} (fallback fecha)`);
    return result.changes > 0;

  } catch (e) {
    console.error('Error vincularInspeccionAViaje:', e);
    return false;
  }
};

// ─── GPS y Kilometraje ────────────────────────────────────────────────────────

export const insertarPuntoGPS = async (
  jornadaId: number,
  lat: number,
  long: number,
  vel: number | null,
  timestamp: number = 0,
  accuracy: number = 0
) => {
  if (!jornadaId) return false;
  try {
    const db = await getDB();
    const fecha = timestamp > 0 ? new Date(timestamp).toISOString() : new Date().toISOString();
    await db.runAsync(
      `INSERT INTO puntos_gps (jornada_id, latitud, longitud, velocidad, fecha, timestamp, precision_gps) VALUES (?,?,?,?,?,?,?)`,
      [jornadaId, lat, long, vel || 0, fecha, timestamp, accuracy]
    );
    return true;
  } catch (e) {
    console.error('insertarPuntoGPS error:', e);
    return false;
  }
};

export const calcularDistanciaTotalKm = (puntos: RowPuntoGPS[]): number => {
  if (!puntos || puntos.length < 2) return 0;
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  let distanciaTotal = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    if (p1.latitud && p1.longitud && p2.latitud && p2.longitud) {
      distanciaTotal += getDistanceFromLatLonInKm(p1.latitud, p1.longitud, p2.latitud, p2.longitud);
    }
  }
  return parseFloat(distanciaTotal.toFixed(2));
};

export const obtenerKmTotalesJornada = async (jornadaId: number): Promise<number> => {
  try {
    const db = await getDB();
    const puntosGPS = await db.getAllAsync<RowPuntoGPS>(
      'SELECT latitud, longitud FROM puntos_gps WHERE jornada_id = ? ORDER BY fecha ASC',
      [jornadaId]
    );
    return calcularDistanciaTotalKm(puntosGPS || []);
  } catch (e) {
    console.error('obtenerKmTotalesJornada error:', e);
    return 0;
  }
};

// ─── Pausas ───────────────────────────────────────────────────────────────────

export const insertarPausa = async (
  jornadaId: number,
  motivo: string,
  inicio: string,
  fin: string,
  duracion: number,
  direccion: string = ''
) => {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO pausas (jornada_id, motivo, inicio, fin, duracion, direccion) VALUES (?,?,?,?,?,?)`,
      [jornadaId, motivo || 'Varios', inicio, fin, duracion || 0, direccion]
    );
    return true;
  } catch (e) {
    console.error('insertarPausa error:', e);
    return false;
  }
};

export const obtenerPausasJornada = async (jornadaId: number): Promise<RowPausa[]> => {
  try {
    const db = await getDB();
    return await db.getAllAsync<RowPausa>(
      'SELECT * FROM pausas WHERE jornada_id = ? ORDER BY inicio ASC',
      [jornadaId]
    ) || [];
  } catch (e) {
    console.error('obtenerPausasJornada error:', e);
    return [];
  }
};

// ─── Incidencias ──────────────────────────────────────────────────────────────

export const insertarIncidencia = async (
  jornadaId: number,
  tipo: string,
  descripcion: string,
  fotoUri: string | null,
  direccion: string = ''
) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO incidencias (jornada_id, tipo, descripcion, foto_uri, fecha, direccion) VALUES (?,?,?,?,?,?)`,
      [jornadaId, tipo || 'General', descripcion || '', fotoUri || null, fecha, direccion]
    );
    return true;
  } catch (e) {
    console.error('insertarIncidencia error:', e);
    return false;
  }
};

// ─── Cumplimiento NOM-087-SCT ────────────────────────────────────────────────

export const calcularTiempoConduccionNeto = async (jornadaId: number, fechaInicio: string): Promise<number> => {
  try {
    const ahora = new Date();
    const inicio = new Date(fechaInicio);
    const tiempoTotalMs = ahora.getTime() - inicio.getTime();
    const pausas = await obtenerPausasJornada(jornadaId);
    let tiempoPausasMs = 0;
    for (const pausa of pausas) {
      if (pausa.inicio && pausa.fin) {
        tiempoPausasMs += new Date(pausa.fin).getTime() - new Date(pausa.inicio).getTime();
      }
    }
    return tiempoTotalMs - tiempoPausasMs;
  } catch (e) {
    console.error('calcularTiempoConduccionNeto error:', e);
    return 0;
  }
};

/**
 * LÓGICA NOM-087-SCT — Validación de tiempos de servicio
 *
 * Límites aplicables:
 *   - 5 horas de conducción CONTINUA sin pausa → descanso de 30 min obligatorio
 *   - 11 horas de JORNADA TOTAL (manejo neto) → fin de jornada obligatorio
 *
 * ✅ ACTUALIZADO: ahora evalúa ambos límites y devuelve estado granular
 *    para que jornadaEnCurso.tsx pueda distinguir aviso de límite.
 */
export const validarTiemposSCT = async (jornadaId: number, fechaInicio: string): Promise<ValidacionSCT | null> => {
  try {
    const tiempoManejoMs = await calcularTiempoConduccionNeto(jornadaId, fechaInicio);
    const minutosConduccion = Math.floor(tiempoManejoMs / (1000 * 60));

    // Límite 1: 11 horas de jornada total (660 minutos)
    if (minutosConduccion >= 660) {
      return {
        estado: 'LIMITE_JORNADA',
        mensaje: 'Has alcanzado las 11 horas de manejo neto. Fin de jornada obligatorio — NOM-087-SCT-2-2017.',
        tiempoConduccion: minutosConduccion,
        tiempoJornada: minutosConduccion,
      };
    }

    // Aviso preventivo: 10 horas (600 minutos)
    if (minutosConduccion >= 600) {
      return {
        estado: 'AVISO_CONTINUO',
        mensaje: 'Has acumulado 10 horas de manejo. Tienes 1 hora para planificar tu parada final.',
        tiempoConduccion: minutosConduccion,
        tiempoJornada: minutosConduccion,
      };
    }

    // Límite 2: 5 horas de conducción continua (300 minutos)
    if (minutosConduccion >= 300) {
      return {
        estado: 'LIMITE_CONTINUO',
        mensaje: 'Has superado las 5 horas de conducción continua. Debes tomar una pausa de 30 minutos.',
        tiempoConduccion: minutosConduccion,
      };
    }

    return { estado: 'OK', tiempoConduccion: minutosConduccion };
  } catch (e) {
    console.error('validarTiemposSCT error:', e);
    return null;
  }
};

// ─── Exportar / Importar BD ──────────────────────────────────────────────────

export const exportarBaseDatos = async () => {
  try {
    // ✅ Nueva API unificada sin expo-file-system/legacy ni (as any)
    const { File } = await import('expo-file-system');
    const dbUri = FileSystem.documentDirectory + 'SQLite/bitacora.db';
    const dbFile = new File(dbUri);
    if (!(await dbFile.exists)) return false;
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(dbUri, { mimeType: 'application/x-sqlite3', dialogTitle: 'Respaldo Bitácora 57' });
    return true;
  } catch (e) {
    console.error('exportarBaseDatos error:', e);
    return false;
  }
};

export const importarBaseDatos = async () => {
  try {
    // ✅ File.copy() reemplaza FileSystem.copyAsync() deprecado
    const { File } = await import('expo-file-system');
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!res || !res.uri) return false;
    const src  = new File(res.uri);
    const dest = new File(FileSystem.documentDirectory + 'SQLite/bitacora.db');
    await src.copy(dest);
    cachedDb = null;
    return true;
  } catch (e) {
    console.error('importarBaseDatos error:', e);
    return false;
  }
};
