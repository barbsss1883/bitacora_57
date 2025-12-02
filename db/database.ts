import * as SQLite from "expo-sqlite";

// Inicializamos la conexión a la base de datos (Expo SDK 54+)
export const db = SQLite.openDatabaseSync("jornadas.db");

/**
 * Inicializa la estructura de la base de datos.
 * Llama a esta función en tu _layout.tsx o App.tsx al arrancar.
 */
export async function initDatabase() {
  try {
    // 1. Limpieza (Opcional: comenta esta línea si ya tienes datos que quieres conservar en producción)
    // await db.execAsync(`DROP TABLE IF EXISTS rutas;`); 

    // 2. Tabla JORNADAS (El viaje principal)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS jornadas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operador TEXT,
        unidad TEXT,
        origen TEXT,
        destino TEXT,
        fecha TEXT,            -- Fecha de creación (ISO String)
        inicio_jornada TEXT,   -- Fecha/Hora inicio real
        fin_jornada TEXT,      -- Fecha/Hora fin real
        horas_trabajadas REAL,
        comentarios TEXT,
        firma TEXT
      );
    `);

    // 3. Tabla PAUSAS (Para cumplir la NOM-087)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pausas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        tipo TEXT,       -- Ejemplo: "Alimentos", "Descanso", "Carga combustible"
        inicio TEXT,
        fin TEXT,
        duracion REAL,   -- En minutos u horas
        FOREIGN KEY(jornada_id) REFERENCES jornadas(id)
      );
    `);

    // 4. Tabla INCIDENCIAS
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS incidencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        tipo TEXT,
        descripcion TEXT,
        fecha TEXT,
        foto TEXT,       -- URI de la imagen local
        FOREIGN KEY(jornada_id) REFERENCES jornadas(id)
      );
    `);

    // 5. Tabla PUNTOS_GPS (Rastreo)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS puntos_gps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        jornada_id INTEGER,
        latitud REAL,
        longitud REAL,
        velocidad REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(jornada_id) REFERENCES jornadas(id)
      );
    `);

    // 6. Índices para optimizar mapas y consultas
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_puntos_gps_jornada ON puntos_gps(jornada_id);
      CREATE INDEX IF NOT EXISTS idx_jornadas_fecha ON jornadas(fecha);
    `);

    console.log("✅ Base de datos inicializada correctamente.");
  } catch (e) {
    console.error("❌ Error inicializando BD:", e);
  }
}

// ==========================================
// 🚛 GESTIÓN DE JORNADAS (Iniciar / Finalizar)
// ==========================================

/**
 * Crea una nueva jornada y retorna su ID.
 * Este ID es vital para vincular el GPS.
 */
export async function iniciarNuevaJornada(operador: string, unidad: string, origen: string, destino: string) {
  const fechaHoy = new Date().toISOString();
  
  try {
    const result = await db.runAsync(
      `INSERT INTO jornadas (operador, unidad, origen, destino, fecha, inicio_jornada) VALUES (?, ?, ?, ?, ?, ?)`,
      [operador, unidad, origen, destino, fechaHoy, fechaHoy]
    );
    // Retornamos el ID de la fila recién creada
    return result.lastInsertRowId;
  } catch (e) {
    console.error("Error al iniciar jornada:", e);
    throw e;
  }
}

/**
 * Cierra la jornada actual estableciendo la fecha de fin.
 */
export async function finalizarJornada(id: number) {
  const fin = new Date().toISOString();
  try {
    await db.runAsync(
      `UPDATE jornadas SET fin_jornada = ? WHERE id = ?`,
      [fin, id]
    );
    console.log(`🏁 Jornada ${id} finalizada a las ${fin}`);
  } catch (e) {
    console.error("Error al finalizar jornada:", e);
  }
}

/**
 * Obtiene el historial de todas las jornadas para la pantalla de "Historial".
 */
export async function obtenerHistorialJornadas() {
  try {
    return await db.getAllAsync(`SELECT * FROM jornadas ORDER BY id DESC`);
  } catch (e) {
    console.error("Error obteniendo historial:", e);
    return [];
  }
}

// ==========================================
// 📍 GESTIÓN DE GPS (Rastreo)
// ==========================================

/**
 * Inserta un punto GPS. Usado por el servicio en segundo plano.
 */
export async function insertarPuntoGPS(jornadaId: number, latitud: number, longitud: number, velocidad: number = 0) {
  try {
    await db.runAsync(
      `INSERT INTO puntos_gps (jornada_id, latitud, longitud, velocidad) VALUES (?, ?, ?, ?)`,
      [jornadaId, latitud, longitud, velocidad]
    );
  } catch (e) {
    // No usamos console.error aquí para no saturar los logs si falla un punto
    console.log("Error guardando punto GPS:", e);
  }
}

/**
 * Obtiene todos los puntos de una jornada específica para pintarlos en el mapa.
 */
export async function obtenerPuntosGPS(jornadaId: number) {
  try {
    return await db.getAllAsync(
      `SELECT latitud, longitud FROM puntos_gps WHERE jornada_id = ? ORDER BY id ASC`,
      [jornadaId]
    );
  } catch (e) {
    console.error("Error recuperando ruta:", e);
    return [];
  }
}

// ==========================================
// ☕ GESTIÓN DE PAUSAS E INCIDENCIAS
// ==========================================

export async function insertarPausa(jornadaId: number, tipo: string, inicio: string, fin: string, duracion: number) {
  try {
    await db.runAsync(
      `INSERT INTO pausas (jornada_id, tipo, inicio, fin, duracion) VALUES (?, ?, ?, ?, ?)`,
      [jornadaId, tipo, inicio, fin, duracion]
    );
  } catch (e) {
    console.error("Error insertando pausa:", e);
  }
}

export async function insertarIncidencia(jornadaId: number, tipo: string, descripcion: string, foto: string | null = null) {
  const fecha = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO incidencias (jornada_id, tipo, descripcion, fecha, foto) VALUES (?, ?, ?, ?, ?)`,
      [jornadaId, tipo, descripcion, fecha, foto]
    );
  } catch (e) {
    console.error("Error insertando incidencia:", e);
  }
}
