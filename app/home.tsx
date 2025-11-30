import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export default function Home() {
  const router = useRouter();
  const [user,setUser] = useState("");

  useEffect(()=>{ SecureStore.getItemAsync("loggedUser").then(u=>{ if(!u) router.replace("/login"); else setUser(u); }); },[]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido, {user}</Text>
      <TouchableOpacity style={styles.btn} onPress={()=>router.push("/jornadaEnCurso")}><Text style={styles.btnText}>Jornada en curso</Text></TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={()=>router.push("/historial")}><Text style={styles.btnText}>Historial</Text></TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={()=>router.push("/registrar")}><Text style={styles.btnText}>Registrar rápida</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:20,backgroundColor:"#071022"},
  title:{fontSize:24,color:"#fff",marginBottom:20},
  btn:{background:"#1976D2",padding:14,borderRadius:8,marginTop:10},
  btnText:{color:"#fff",textAlign:"center"}
});