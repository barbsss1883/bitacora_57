import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabase("jornadas.db");

export function initDatabase() {
  db.transaction((tx) => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS jornadas (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         operador TEXT, unidad TEXT, origen TEXT, destino TEXT,
         fecha TEXT, inicio_jornada TEXT, fin_jornada TEXT,
         horas_trabajadas REAL, option_c TEXT, firma TEXT
       );`
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS rutas (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         jornada_id INTEGER, lat REAL, lon REAL, timestamp TEXT
       );`
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS pausas (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         jornada_id INTEGER, tipo TEXT, inicio TEXT, fin TEXT, duracion REAL
       );`
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS incidencias (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         jornada_id INTEGER, tipo TEXT, descripcion TEXT, fecha TEXT, foto TEXT
       );`
    );
  }, (e) => console.log("DB error init", e), () => console.log("📦 BD lista"));
}

// helpers (promisify quick)
export function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(sql, params,
        (_, result) => resolve(result),
        (_, err) => reject(err)
      );
    });
  });
}

export async function insertarPuntoRuta(jornadaId, lat, lon, ts) {
  await runAsync(`INSERT INTO rutas (jornada_id, lat, lon, timestamp) VALUES (?, ?, ?, ?)`, [jornadaId, lat, lon, ts]);
}

export async function obtenerRuta(jornadaId) {
  const res: any = await runAsync(`SELECT lat, lon FROM rutas WHERE jornada_id=? ORDER BY id ASC`, [jornadaId]);
  return res.rows ? Array.from({length: res.rows.length}, (_,i)=>res.rows.item(i)) : [];
}