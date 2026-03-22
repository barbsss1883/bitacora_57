import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native'; 
import { initDatabase } from '../db/database';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function Layout() {
  const [dbLista, setDbLista] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId:"363075260432-73vjlu0ukn1u59sjgf5dpi1mkunda880.apps.googleusercontent.com",
    });
    initDatabase()
      .then(() => {
        console.log("--- BASE DE DATOS LISTA ---");
        setDbLista(true);
      })
      .catch(e => {
        console.error("Error fatal DB:", e);
        setDbLista(true); 
      });
  }, []);
  
  if (!dbLista) {
    return (
      <View style={{flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
        <Stack.Screen name="perfil" />
      </Stack>
    </>
  );
}
