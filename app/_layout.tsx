import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native'; 
import { initDatabase } from '../db/database';

export default function Layout() {
  const [dbLista, setDbLista] = useState(false);

  useEffect(() => {
    // Iniciamos la BD y esperamos a que termine
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

  // MIENTRAS CARGA LA BD, MOSTRAMOS PANTALLA NEGRA CON SPINNER
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
        {/* AGREGADO: Registramos perfil para evitar error de ruta */}
        <Stack.Screen name="perfil" />
      </Stack>
    </>
  );
}