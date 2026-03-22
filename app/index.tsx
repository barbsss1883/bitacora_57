import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [rutaDestino, setRutaDestino] = useState<'/login' | '/home'>('/login');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const user = await AsyncStorage.getItem('USER_SESSION');
      if (user) {
        setRutaDestino('/home');
      } else {
        setRutaDestino('/login');
      }
    } catch (e) {
      console.error("Error leyendo sesión:", e);
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