import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { runAsync } from "../db/database";
import { useRouter } from "expo-router";

export default function Historial(){
  const [jornadas,setJornadas] = useState([]);
  const router = useRouter();

  const cargar = async ()=>{
    const res: any = await runAsync(`SELECT * FROM jornadas ORDER BY id DESC`);
    // res.rows may exist
    const items = res.rows ? Array.from({length: res.rows.length}, (_,i)=>res.rows.item(i)) : [];
    setJornadas(items);
  };

  useEffect(()=>{ cargar(); },[]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Historial</Text>
      {jornadas.map(j=>(
        <View key={j.id} style={styles.card}>
          <Text style={styles.cardTitle}>{j.operador || "—"}</Text>
          <Text>Fecha: {new Date(j.fecha).toLocaleString()}</Text>
          <Text>Ruta: {j.origen} → {j.destino}</Text>
          <TouchableOpacity style={styles.mapBtn} onPress={()=>router.push(`/mapaRuta?id=${j.id}`)}><Text style={{color:'#fff'}}>Ver ruta</Text></TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:12,backgroundColor:"#071022"},
  title:{fontSize:24,color:'#fff',textAlign:'center',marginBottom:10},
  card:{background:'#0f1720',padding:12,borderRadius:8,marginBottom:10},
  cardTitle:{fontSize:18,color:'#fff',marginBottom:6},
  mapBtn:{marginTop:8,backgroundColor:'#1976D2',padding:10,borderRadius:6}
});