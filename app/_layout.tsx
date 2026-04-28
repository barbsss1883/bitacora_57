import { Stack, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { StatusBar, ActivityIndicator, View, Platform, Alert } from 'react-native';
import { initDatabase } from '../db/database';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Purchases from 'react-native-purchases';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../src/services/supabaseClient';
import { procesarColaSync } from '../src/services/SyncService';

const API_KEY = 'goog_DzTkRNvkOzigskDvblAaBCgMPQl';

export default function Layout() {
  const router = useRouter();
  const [dbLista, setDbLista] = useState(false);
  const appLista = useRef(false);

  useEffect(() => {
    // ── Google Sign-In ───────────────────────────────────────────────────────
    GoogleSignin.configure({
      webClientId: '363075260432-8ta514n6ak7dadd1vt4ermj47lk7ogj1.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      offlineAccess: false,
    });

    // ── RevenueCat ───────────────────────────────────────────────────────────
    if (Platform.OS === 'android') {
      Purchases.configure({ apiKey: API_KEY });
      console.log('--- REVENUECAT LISTO ---');
    }

    // ── SQLite ───────────────────────────────────────────────────────────────
    initDatabase()
      .then(() => {
        console.log('--- BASE DE DATOS LISTA ---');
        setDbLista(true);
        appLista.current = true;

        // ✅ AGREGADO: drenar cola offline del viaje/sesión anterior
        procesarColaSync().catch(() => { });
      })
      .catch(e => {
        console.error('Error fatal DB:', e);
        setDbLista(true);
        appLista.current = true;
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!appLista.current) return;

      if (event === 'TOKEN_REFRESHED') {
        console.log('[Layout] Token renovado automáticamente');
        return;
      }

      const sesionPerdida = event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION');
      if (!sesionPerdida) return;

      // ── Verificar si hay jornada en curso ────────────────────────────────
      let jornadaActiva = false;
      try {
        const jornadaId = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        jornadaActiva = !!jornadaId;
      } catch (_) { }

      if (event === 'SIGNED_OUT' && jornadaActiva) {
        // Cierre de sesión manual con jornada activa → pedir confirmación
        Alert.alert(
          'Jornada en curso',
          'Tienes un viaje activo. Si cierras sesión perderás el registro ELD en curso.\n\n¿Deseas finalizar el viaje primero?',
          [
            {
              text: 'Finalizar viaje primero',
              style: 'cancel',
              // No redirigir — el operador va a terminar manualmente
            },
            {
              text: 'Cerrar sesión de todas formas',
              style: 'destructive',
              onPress: async () => {
                await AsyncStorage.multiRemove([
                  'CURRENT_JORNADA_ID',
                  'CURRENT_JORNADA_START',
                  'CURRENT_JORNADA_VISUAL',
                  'CURRENT_PAUSA_START',
                  'CURRENT_PAUSA_TYPE',
                ]);
                router.replace('/login');
              },
            },
          ]
        );
        return;
      }

      if (jornadaActiva) {
        console.warn('[Layout] Sesión expirada con jornada activa — manteniendo pantalla para no interrumpir ELD');
        return;
      }

      // Sin jornada activa → redirigir normalmente
      console.log('[Layout] Sesión cerrada sin jornada activa — redirigiendo a /login');
      router.replace('/login');
    });

    // ✅ AGREGADO: re-sincronizar cola offline al recuperar conexión a internet
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && appLista.current) {
        procesarColaSync().catch(() => { });
      }
    });

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      authListener.subscription.unsubscribe();
      unsubscribeNet();
    };
  }, []);

  if (!dbLista) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
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
