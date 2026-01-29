import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto'; 

let cachedDb: SQLite.SQLiteDatabase | null = null;

// --- FUNCIÓN DE CONEXIÓN PRINCIPAL ---
const getDB = async () => {
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

// ==========================================
// 1. INICIALIZAR LA BASE DE DATOS
// ==========================================
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
        fecha TEXT
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
    } catch (e) {
      // Ignoramos si ya existen
    }

    console.log('BD Inicializada correctamente');
    return true;
  } catch (error) {
    console.error('Error inicializando BD:', error);
    cachedDb = null;
    throw error;
  }
};

// ==========================================
// SEGURIDAD: GENERACIÓN DE SELLO DIGITAL
// ==========================================
export const generarSelloDigital = async (id: number, fechaFin: string, operador: string, km: number) => {
  try {
    const dataString = `B57-${id}-${operador}-${fechaFin}-${km}`;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      dataString
    );
    return hash.substring(0, 16).toUpperCase(); 
  } catch (e) {
    console.error('Error generando sello:', e);
    return "ERROR_HASH";
  }
};

// ==========================================
// FUNCIONES DE JORNADA
// ==========================================

export const iniciarNuevaJornada = async (datos: any) => {
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
        datos.destino, datos.tipo_servicio, fecha
      ]
    );
    return res.lastInsertRowId;
  } catch (e) {
    console.error('iniciarNuevaJornada error:', e);
    return null;
  }
};

export const finalizarJornada = async (id: number, firma: string, rutaGeoJson: string | null, kmTotales: number = 0) => {
  try {
    const db = await getDB();
    const fin = new Date().toISOString();
    
    const jornada: any = await db.getFirstAsync('SELECT operador FROM jornadas WHERE id = ?', [id]);
    const operador = jornada?.operador || "Anonimo";
    
    const sello = await generarSelloDigital(id, fin, operador, kmTotales);

    await db.runAsync(
      `UPDATE jornadas SET 
        fecha_fin = ?, 
        firma = ?, 
        ruta_geojson = ?, 
        km_totales = ?, 
        sello_digital = ?, 
        estatus = 'finalizado' 
      WHERE id = ?`, 
      [fin, firma || '', rutaGeoJson || null, kmTotales, sello, id]
    );
    return true;
  } catch (e) {
    console.error('finalizarJornada error:', e);
    return false;
  }
};

export const loginUsuario = async (email: string, pass: string) => {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync('SELECT * FROM usuarios WHERE email = ? AND password = ?', [email, pass]);
    return row || null;
  } catch (e) {
    console.error('loginUsuario error:', e);
    return null;
  }
};

export const registrarUsuario = async (nombre: string, email: string, pass: string) => {
  try {
    const db = await getDB();
    const res = await db.runAsync('INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)', [nombre || '', email || '', pass || '']);
    return res.lastInsertRowId;
  } catch (e) {
    console.error('registrarUsuario error:', e);
    return null;
  }
};

// --- FUNCIÓN DE LOGIN GOOGLE MEJORADA Y ROBUSTA ---
export const loginConGoogle = async (googleUser: any) => {
  try {
    console.log("RECIBIDO EN DB:", JSON.stringify(googleUser));
    
    const db = await getDB();
    
    // Detectamos si los datos vienen anidados en 'user' o planos
    const datosUsuario = googleUser.user || googleUser; 

    const email = datosUsuario.email;
    const name = datosUsuario.name || datosUsuario.givenName || 'Usuario Google';
    const photo = datosUsuario.photo || datosUsuario.photoUrl || '';

    if (!email) {
        console.error("❌ Error: No se encontró el email en el objeto googleUser");
        return null;
    }

    const existing: any = await db.getFirstAsync('SELECT * FROM usuarios WHERE email = ?', [email]);
    
    if (existing) {
        return existing;
    }

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
// ----------------------------------------------------

export const obtenerDocumentosUsuario = async (usuarioId: number) => {
  try {
    const db = await getDB();
    const rows = await db.getAllAsync('SELECT * FROM documentos WHERE usuario_id = ?', [usuarioId]);
    return rows || [];
  } catch (e) {
    console.error('obtenerDocumentosUsuario error:', e);
    return [];
  }
};

export const guardarDocumento = async (usuarioId: number, nombre: string, uri: string, tipo: string) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync('INSERT INTO documentos (usuario_id, nombre, uri, tipo, fecha) VALUES (?, ?, ?, ?, ?)', [usuarioId, nombre, uri, tipo, fecha]);
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

export const guardarInspeccion = async (jornadaId: number, tipo: string, detalles: any, comentarios: string, firma: string) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(`INSERT INTO inspecciones (jornada_id, tipo, detalles_json, comentarios, firma, fecha) VALUES (?,?,?,?,?,?)`, [jornadaId, tipo || 'general', JSON.stringify(detalles || {}), comentarios || '', firma || '', fecha]);
    return true;
  } catch (e) {
    console.error('guardarInspeccion error:', e);
    return false;
  }
};

export const insertarPuntoGPS = async (jornadaId: number, lat: number, long: number, vel: number | null) => {
  if (!jornadaId) return false;
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(`INSERT INTO puntos_gps (jornada_id, latitud, longitud, velocidad, fecha) VALUES (?,?,?,?,?)`, [jornadaId, lat, long, vel || 0, fecha]);
    return true;
  } catch (e) {
    console.error('insertarPuntoGPS error:', e);
    return false;
  }
};

export const insertarPausa = async (jornadaId: number, motivo: string, inicio: string, fin: string, duracion: number, direccion: string = '') => {
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

export const insertarIncidencia = async (jornadaId: number, tipo: string, descripcion: string, fotoUri: string | null, direccion: string = '') => {
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

export const obtenerHistorialJornadas = async () => {
  try {
    const db = await getDB();
    const rows = await db.getAllAsync('SELECT * FROM jornadas ORDER BY id DESC');
    return rows || [];
  } catch (e) {
    console.error('obtenerHistorialJornadas error:', e);
    return [];
  }
};

export const obtenerDetalleJornada = async (id: number) => {
  try {
    const db = await getDB();
    const jornada = await db.getFirstAsync('SELECT * FROM jornadas WHERE id = ?', [id]);
    const pausas = await db.getAllAsync('SELECT * FROM pausas WHERE jornada_id = ?', [id]);
    const incidencias = await db.getAllAsync('SELECT * FROM incidencias WHERE jornada_id = ?', [id]);
    const inspecciones = await db.getAllAsync('SELECT * FROM inspecciones WHERE jornada_id = ?', [id]);
    return { jornada: jornada || null, pausas: pausas || [], incidencias: incidencias || [], inspecciones: inspecciones || [] };
  } catch (e) {
    console.error('obtenerDetalleJornada error:', e);
    return { jornada: null, pausas: [], incidencias: [], inspecciones: [] };
  }
};

export const exportarBaseDatos = async () => {
  try {
    const dbUri = (FileSystem as any).documentDirectory + 'SQLite/bitacora.db';
    const info = await FileSystem.getInfoAsync(dbUri);
    if (!info.exists) return false;
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
    const resAny: any = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!resAny || !resAny.uri) return false;
    const src = resAny.uri;
    const dest = (FileSystem as any).documentDirectory + 'SQLite/bitacora.db';
    await FileSystem.copyAsync({ from: src, to: dest });
    cachedDb = null;
    return true;
  } catch (e) {
    console.error('importarBaseDatos error:', e);
    return false;
  }
};

export const obtenerEstadisticasUsuario = async (usuarioId?: number) => {
  try {
    const db = await getDB();
    const filas: any = await db.getFirstAsync('SELECT COUNT(*) as total, SUM(km_totales) as km FROM jornadas');
    return { viajes: filas?.total || 0, km: filas?.km || 0 };
  } catch (e) {
    console.error('obtenerEstadisticasUsuario error:', e);
    return { viajes: 0, km: 0 };
  }
};

export const vincularInspeccionAViaje = async (nuevoJornadaId: number) => {
  try {
    const db = await getDB();

    const hoyStart = new Date();
    hoyStart.setHours(0, 0, 0, 0);
    const hoyEnd = new Date();
    hoyEnd.setHours(23, 59, 59, 999);

    const result: any = await db.runAsync(
      `UPDATE inspecciones 
       SET jornada_id = ? 
       WHERE jornada_id = 0 
       AND fecha >= ? AND fecha <= ?`,
      [nuevoJornadaId, hoyStart.toISOString(), hoyEnd.toISOString()]
    );

    console.log(`Inspecciones vinculadas al viaje ${nuevoJornadaId}: ${result.changes}`);
    return result.changes > 0;
  } catch (e) {
    console.error('Error vincularInspeccionAViaje:', e);
    return false;
  }
};

// ==========================================
// NUEVAS FUNCIONES CORREGIDAS PARA HISTORIAL
// ==========================================

export const obtenerJornadas = async () => {
  try {
    const db = await getDB();
    const resultados = await db.getAllAsync('SELECT * FROM jornadas ORDER BY id DESC');
    return resultados;
  } catch (error) {
    console.error("Error al obtener jornadas:", error);
    return [];
  }
};

export const eliminarViaje = async (id: number) => {
  try {
    const db = await getDB();
    // Usamos runAsync y el nombre correcto de columna 'jornada_id'
    await db.runAsync('DELETE FROM jornadas WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM pausas WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM incidencias WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM inspecciones WHERE jornada_id = ?', [id]);
    await db.runAsync('DELETE FROM puntos_gps WHERE jornada_id = ?', [id]);
    console.log(`Viaje ${id} eliminado correctamente.`);
  } catch (error) {
    console.error("Error al eliminar viaje:", error);
  }
};