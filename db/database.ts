import * as SQLite from 'expo-sqlite';

let cachedDb: SQLite.SQLiteDatabase | null = null;

const getDB = async () => {
  if (cachedDb) return cachedDb;
  try {
    cachedDb = await SQLite.openDatabaseAsync('bitacora.db');
    return cachedDb;
  } catch (error) {
    console.error('Error opening database:', error);
    throw error;
  }
};

// ==========================================
// 1. INICIALIZAR LA BASE DE DATOS
// ==========================================
export const initDatabase = async () => {
  try {
    const db = await getDB();
    
    // Create all tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT, email TEXT UNIQUE, password TEXT, foto TEXT
      );
      CREATE TABLE IF NOT EXISTS documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER, tipo TEXT, uri TEXT, fecha_vencimiento TEXT
      );
      CREATE TABLE IF NOT EXISTS jornadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, permisionario TEXT, domicilio TEXT, unidad TEXT, placas TEXT,
        marca TEXT, modelo TEXT, modalidad TEXT, remolque1_eco TEXT, remolque1_placas TEXT,
        remolque2_eco TEXT, remolque2_placas TEXT, operador TEXT, licencia TEXT, vigencia TEXT,
        origen TEXT, destino TEXT, tipo_servicio TEXT, fecha_inicio TEXT, fecha_fin TEXT,
        estatus TEXT DEFAULT 'activo', firma TEXT, ruta_geojson TEXT
      );
      CREATE TABLE IF NOT EXISTS inspecciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT, jornada_id INTEGER, tipo TEXT, detalles_json TEXT,
        comentarios TEXT, firma TEXT, fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS puntos_gps (
        id INTEGER PRIMARY KEY AUTOINCREMENT, jornada_id INTEGER, latitud REAL, longitud REAL, velocidad REAL, fecha TEXT
      );
      CREATE TABLE IF NOT EXISTS pausas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, jornada_id INTEGER, motivo TEXT, inicio TEXT, fin TEXT, duracion REAL
      );
      CREATE TABLE IF NOT EXISTS incidencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT, jornada_id INTEGER, tipo TEXT, descripcion TEXT, foto_uri TEXT, fecha TEXT
      );
    `);
    
    console.log("BD Inicializada correctamente");
    return true;
  } catch (error) {
    console.error("Error iniciando BD:", error);
    cachedDb = null;
    throw error;
  }
};

// ==========================================
// FUNCIONES DE CONSULTA
// ==========================================

export const loginUsuario = async (email: string, pass: string) => {
  try {
    const db = await getDB();
    const result = await db.getFirstAsync(
      'SELECT * FROM usuarios WHERE email = ? AND password = ?',
      [email, pass]
    );
    return result || null;
  } catch (e) {
    console.error('Error in loginUsuario:', e);
    return null;
  }
};

export const registrarUsuario = async (nombre: string, email: string, pass: string) => {
  try {
    const db = await getDB();
    const result = await db.runAsync(
      'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
      [nombre, email, pass]
    );
    return result.lastInsertRowId;
  } catch (e) {
    console.error('Error in registrarUsuario:', e);
    return null;
  }
};

export const loginConGoogle = async (googleUser: any) => {
  try {
    const db = await getDB();
    const { email, name, photo } = googleUser;
    const existing = await db.getFirstAsync('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (existing) return existing;
    
    const result = await db.runAsync(
      'INSERT INTO usuarios (nombre, email, foto, password) VALUES (?, ?, ?, ?)',
      [name, email, photo, 'google_oauth']
    );
    return { id: result.lastInsertRowId, nombre: name, email, foto: photo };
  } catch (e) {
    console.error('Error in loginConGoogle:', e);
    return null;
  }
};

export const obtenerDocumentosUsuario = async (usuarioId: number) => {
  try {
    const db = await getDB();
    const results = await db.getAllAsync('SELECT * FROM documentos WHERE usuario_id = ?', [usuarioId]);
    return results || [];
  } catch (e) {
    console.error('Error in obtenerDocumentosUsuario:', e);
    return [];
  }
};

export const guardarDocumento = async (usuarioId: number, tipo: string, uri: string, vencimiento: string) => {
  try {
    const db = await getDB();
    await db.runAsync(
      'INSERT INTO documentos (usuario_id, tipo, uri, fecha_vencimiento) VALUES (?, ?, ?, ?)',
      [usuarioId, tipo, uri, vencimiento]
    );
    return true;
  } catch (e) {
    console.error('Error in guardarDocumento:', e);
    return false;
  }
};

export const iniciarNuevaJornada = async (datos: any) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO jornadas (permisionario, domicilio, unidad, placas, marca, modelo, modalidad, remolque1_eco, remolque1_placas, remolque2_eco, remolque2_placas, operador, licencia, vigencia, origen, destino, tipo_servicio, fecha_inicio, estatus) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'activo')`,
      [datos.permisionario, datos.domicilio, datos.unidad, datos.placas, datos.marca, datos.modelo, datos.modalidad, datos.remolque1_eco, datos.remolque1_placas, datos.remolque2_eco, datos.remolque2_placas, datos.operador, datos.licencia, datos.vigencia, datos.origen, datos.destino, datos.tipo_servicio, fecha]
    );
    return result.lastInsertRowId;
  } catch (e) {
    console.error('Error in iniciarNuevaJornada:', e);
    return null;
  }
};

export const finalizarJornada = async (id: number, firma: string, rutaGeoJson: string | null) => {
  try {
    const db = await getDB();
    const fin = new Date().toISOString();
    await db.runAsync(
      `UPDATE jornadas SET fecha_fin = ?, firma = ?, ruta_geojson = ?, estatus = 'finalizado' WHERE id = ?`,
      [fin, firma, rutaGeoJson, id]
    );
    return true;
  } catch (e) {
    console.error('Error in finalizarJornada:', e);
    return false;
  }
};

export const guardarInspeccion = async (jornadaId: number, tipo: string, detalles: any, comentarios: string, firma: string) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO inspecciones (jornada_id, tipo, detalles_json, comentarios, firma, fecha) VALUES (?,?,?,?,?,?)`,
      [jornadaId, tipo, JSON.stringify(detalles), comentarios, firma, fecha]
    );
    return true;
  } catch (e) {
    console.error('Error in guardarInspeccion:', e);
    return false;
  }
};

export const insertarPuntoGPS = async (jornadaId: number, lat: number, long: number, vel: number | null) => {
  if (!jornadaId) return false;
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO puntos_gps (jornada_id, latitud, longitud, velocidad, fecha) VALUES (?,?,?,?,?)`,
      [jornadaId, lat, long, vel || 0, fecha]
    );
    return true;
  } catch (e) {
    console.error('Error in insertarPuntoGPS:', e);
    return false;
  }
};

export const insertarPausa = async (jornadaId: number, motivo: string, inicio: string, fin: string, duracion: number) => {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO pausas (jornada_id, motivo, inicio, fin, duracion) VALUES (?,?,?,?,?)`,
      [jornadaId, motivo, inicio, fin, duracion]
    );
    return true;
  } catch (e) {
    console.error('Error in insertarPausa:', e);
    return false;
  }
};

export const insertarIncidencia = async (jornadaId: number, tipo: string, descripcion: string, fotoUri: string | null) => {
  try {
    const db = await getDB();
    const fecha = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO incidencias (jornada_id, tipo, descripcion, foto_uri, fecha) VALUES (?,?,?,?,?)`,
      [jornadaId, tipo, descripcion, fotoUri, fecha]
    );
    return true;
  } catch (e) {
    console.error('Error in insertarIncidencia:', e);
    return false;
  }
};

export const obtenerHistorialJornadas = async () => {
  try {
    const db = await getDB();
    const results = await db.getAllAsync('SELECT * FROM jornadas ORDER BY id DESC');
    return results || [];
  } catch (e) {
    console.error('Error in obtenerHistorialJornadas:', e);
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

    return { 
      jornada: jornada || null,
      pausas: pausas || [], 
      incidencias: incidencias || [], 
      inspecciones: inspecciones || [] 
    };
  } catch (e) {
    console.error('Error in obtenerDetalleJornada:', e);
    return { jornada: null, pausas: [], incidencias: [], inspecciones: [] };
  }
};