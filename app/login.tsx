import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function Login() {
  const [user,setUser] = useState("");
  const router = useRouter();

  const login = async () => {
    if (!user) return alert("Escribe nombre");
    await SecureStore.setItemAsync("loggedUser", user);
    router.replace("/home");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bitacora57</Text>
      <TextInput placeholder="Nombre" value={user} onChangeText={setUser} style={styles.input}/>
      <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnText}>Entrar</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1,justifyContent:"center",padding:20,backgroundColor:"#071022"},
  title: {fontSize:32,color:"#fff",textAlign:"center",marginBottom:20},
  input:{background:"#fff",padding:12,borderRadius:8,marginBottom:12},
  btn:{background:"#1976D2",padding:14,borderRadius:8},
  btnText:{color:"#fff",textAlign:"center"}
});