import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../src/services/supabaseClient';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [rutaDestino, setRutaDestino] = useState<'/login' | '/home'>('/login');

  useEffect(() => {
    checkSession();

    // Escucha cambios de sesión en tiempo real (logout desde otra pantalla, token expirado, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setRutaDestino(session ? '/home' : '/login');
      setIsLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setRutaDestino(session ? '/home' : '/login');
    } catch (e) {
      console.error('Error leyendo sesión:', e);
      setRutaDestino('/login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return <Redirect href={rutaDestino} />;
}
