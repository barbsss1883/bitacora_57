import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as Location from "expo-location";
import { insertarPuntoRuta, runAsync } from "../db/database";
import { useRouter } from "expo-router";

export default function JornadaEnCurso() {
  const router = useRouter();
  const [jornadaId, setJornadaId] = useState(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const locSubRef = useRef(null);
  const startTsRef = useRef(0);

  const startTimer = () => {
    startTsRef.current = Date.now();
    setRunning(true);
    timerRef.current = setInterval(()=> setElapsed(Date.now() - startTsRef.current), 1000);
  };
  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); setRunning(false); };

  const pedirPermiso = async ()=> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso GPS denegado"); return false; }
    return true;
  };

  const startTracking = async (id) => {
    const ok = await pedirPermiso(); if(!ok) return;
    locSubRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 }, async (loc)=>{
      const { latitude, longitude } = loc.coords;
      const ts = new Date().toISOString();
      try { await insertarPuntoRuta(id, latitude, longitude, ts); } catch(e){ console.log(e); }
    });
  };

  const stopTracking = async () => {
    if (locSubRef.current) { locSubRef.current.remove(); locSubRef.current = null; }
  };

  const iniciar = async () => {
    const fecha = new Date().toISOString();
    await runAsync(`INSERT INTO jornadas (fecha) VALUES (?)`, [fecha]);
    const res: any = await runAsync(`SELECT id FROM jornadas ORDER BY id DESC LIMIT 1`);
    const newId = res.insertId || (res.rows && res.rows.item(0).id);
    setJornadaId(newId);
    startTimer();
    startTracking(newId);
    Alert.alert("Jornada iniciada");
  };

  const finalizar = async () => {
    stopTimer(); stopTracking();
    const fin = new Date().toISOString();
    const horas = (elapsed / (1000*60*60));
    await runAsync(`UPDATE jornadas SET fin_jornada=?, horas_trabajadas=? WHERE id=?`, [fin, horas, jornadaId]);
    Alert.alert("Jornada finalizada");
    router.push("/historial");
  };

  useEffect(()=>{ return ()=>{ if(timerRef.current) clearInterval(timerRef.current); if(locSubRef.current) locSubRef.current.remove(); } },[]);

  const fmt = (ms)=> { const s=Math.floor(ms/1000)%60; const m=Math.floor(ms/60000)%60; const h=Math.floor(ms/3600000); return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };

  return (
    <View style={{flex:1,padding:16,backgroundColor:"#071022"}}>
      <View style={styles.topBar}><Text style={{color:'#fff',fontWeight:'bold'}}>{fmt(elapsed)}</Text></View>
      <View style={{marginTop:20}}>
        {!jornadaId ? (
          <TouchableOpacity style={styles.btn} onPress={iniciar}><Text style={styles.btnText}>Iniciar Jornada</Text></TouchableOpacity>
        ) : (
          <>
            {running ? <TouchableOpacity style={styles.btn} onPress={()=>{ stopTimer(); stopTracking(); }}><Text style={styles.btnText}>Pausar</Text></TouchableOpacity>
            : <TouchableOpacity style={styles.btn} onPress={()=>{ startTimer(); startTracking(jornadaId); }}><Text style={styles.btnText}>Reanudar</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.btn,{backgroundColor:'red',marginTop:10}]} onPress={finalizar}><Text style={styles.btnText}>Finalizar Jornada</Text></TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar:{height:48,backgroundColor:'#0b1320',justifyContent:'center',alignItems:'center',borderRadius:6},
  btn:{padding:14,backgroundColor:'#1976D2',borderRadius:8,alignItems:'center',marginTop:10},
  btnText:{color:'#fff',fontWeight:'bold'}
});