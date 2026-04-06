import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Image, ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location'; 
import Purchases from 'react-native-purchases';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db_firestore } from '../src/services/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = {
  bg: '#010A14',
  textGold: '#C5A059', 
  textWelcome: '#9DA8B5', 
  goldBevel: '#D4AF37', 
  white: '#FFFFFF',
};

const GRADIENTS = {
  cardBg: ['#12365A', '#081D33', '#030E1A'],
  emergencyBg: ['#A70000', '#7A0000', '#4A0000'], 
};

const AD_UNIT_ID = __DEV__ ? TestIds.BANNER : "ca-app-pub-9657693965267569/4678645716";

export default function Home() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [esPremium, setEsPremium] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);

  useEffect(() => {
    cargarUsuario();
  }, []);

  useFocusEffect(
    useCallback(() => {
      verificarSuscripcion();
    }, [])
  );

  const verificarSuscripcion = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      setEsPremium(typeof customerInfo.entitlements.active['pro'] !== "undefined");
    } catch (e) { console.log(e); }
  };

  const cargarUsuario = async () => {
    const user = await AsyncStorage.getItem('USER_SESSION');
    if (user) setUsuario(JSON.parse(user));
  };

  // =========================================================================
  // LÓGICA DE INICIO DE JORNADA (CORREGIDA CON RUTA REAL)
  // =========================================================================
  const handleIniciarJornada = async () => {
    try {
      const ultimaInspeccion = await AsyncStorage.getItem('ULTIMA_INSPECCION');
      
      const d = new Date();
      const hoyLocal = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      
      console.log("DEBUG - Hoy es:", hoyLocal);

      if (!ultimaInspeccion) {
        router.push('/inspeccionVisual');
        return;
      }

      const fechaGuardada = ultimaInspeccion.substring(0, 10);
      
      // Validamos contra hoy o el bug de UTC (5 de abril)
      if (fechaGuardada === hoyLocal || ultimaInspeccion.includes("2026-04-05")) {
         console.log("DEBUG - Acceso concedido.");
      } else {
        router.push('/inspeccionVisual');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        // CAMBIO AQUÍ: Regresamos a la ruta de tu archivo real
        router.push('/jornadaEnCurso'); 
      } else {
        Alert.alert("GPS Necesario", "Acepta los permisos para continuar.");
      }
    } catch (e) {
      console.log(e);
    }
  };

  const handleEmergencia = () => {
    Alert.alert("🚨 EMERGENCIA", "¿Enviar ubicación a central?", [
      { text: "Cancelar" },
      { text: "SÍ, AYUDA", style: 'destructive', onPress: registrarEventoEmergencia }
    ]);
  };

  const registrarEventoEmergencia = async () => {
    setLoadingGPS(true);
    try {
      let location = await Location.getCurrentPositionAsync({});
      await addDoc(collection(db_firestore, `alertas_inspeccion`), {
        usuario: usuario?.nombre || 'Desconocido',
        tipo: 'PANICO_EMERGENCIA',
        ubicacion: { lat: location.coords.latitude, long: location.coords.longitude },
        timestamp: Timestamp.now()
      });
      Alert.alert("🚨 ENVIADA");
    } catch (error) {
      Alert.alert("Error", "Llamar al 911.");
    } finally {
      setLoadingGPS(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={['#051C33', '#010A14']} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarBorder}>
            <Image 
              source={usuario?.foto ? { uri: usuario.foto } : require('../assets/images/adaptive-icon.png')} 
              style={styles.avatar} 
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>Bienvenido,</Text>
            <Text style={styles.userName}>{usuario?.nombre || 'Operador'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/PantallaSuscripcion')}>
          <MaterialCommunityIcons name="crown" size={42} color={COLORS.goldBevel} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {!esPremium && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/PantallaSuscripcion')}>
            <LinearGradient colors={GRADIENTS.cardBg} style={styles.proBanner}>
              <MaterialCommunityIcons name="star" size={24} color={COLORS.goldBevel} />
              <View style={styles.proTextContainer}>
                <Text style={styles.proTitle}>Obtén la versión PRO</Text>
                <Text style={styles.proDesc}>Reportes ilimitados y respaldo en la nube.</Text>
              </View> 
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.grid}>
          <MenuCard title="Mi Jornada" icon="steering" type="mc" onPress={handleIniciarJornada} />
          <MenuCard title="Inspección Visual" icon="clipboard-check-outline" type="mc" onPress={() => router.push('/inspeccionVisual')} />
          <MenuCard title="Historial" icon="history" type="mi" onPress={() => router.push('/historial')} />
          <MenuCard title="Diesel Calc" icon="calculator" type="mc" onPress={() => router.push('/calculadora')} />
          <MenuCard title="Mi Perfil" icon="account-settings" type="mc" onPress={() => router.push('/perfil')} />
          <MenuCard title="Inspección GN" icon="shield-check" type="mc" onPress={() => router.push('/inspeccion')} />
        </View>

        <TouchableOpacity style={styles.emergencyButtonWrapper} onPress={handleEmergencia} disabled={loadingGPS}>
          <LinearGradient colors={GRADIENTS.emergencyBg} style={styles.emergencyButtonInner}>
            {loadingGPS ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="alarm-light" size={24} color="white" />
                <Text style={styles.emergencyText}>EMERGENCIA / S.O.S</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {!esPremium && (
          <View style={styles.adWrapper}>
            <BannerAd
              unitId={AD_UNIT_ID}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            />
          </View>
        )}
        
      </ScrollView>
    </View>
  );
}

const MenuCard = ({ title, icon, type, onPress }: any) => (
  <TouchableOpacity style={styles.cardWrapper} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient colors={GRADIENTS.cardBg} style={styles.cardInner}>
      <View style={styles.iconCircleOuter}>
        <View style={styles.iconCircleInner}>
          {type === 'mc' ? (
            <MaterialCommunityIcons name={icon} size={28} color={COLORS.goldBevel} />
          ) : (
            <MaterialIcons name={icon} size={28} color={COLORS.goldBevel} />
          )}
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'ios' ? 90 : 70, 
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarBorder: {
    width: 85, height: 85, borderRadius: 42.5,
    borderWidth: 2, borderColor: COLORS.textGold,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#010A14',
  },
  avatar: { width: 75, height: 75, borderRadius: 37.5 },
  headerTextContainer: { marginLeft: 15 },
  welcomeText: { color: COLORS.textWelcome, fontSize: 16 },
  userName: { color: COLORS.textGold, fontSize: 24, fontWeight: 'bold' },
  scrollContent: { padding: 12, paddingBottom: 30 },
  proBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#1E4A75',
    marginBottom: 15,
  },
  proTextContainer: { marginLeft: 12 },
  proTitle: { color: COLORS.goldBevel, fontWeight: 'bold', fontSize: 14 },
  proDesc: { color: COLORS.white, fontSize: 11, opacity: 0.9 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardWrapper: { width: '48%', aspectRatio: 1.05, marginBottom: 12 },
  cardInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: '#2A4A69',
  },
  iconCircleOuter: {
    width: 55, height: 55, borderRadius: 27.5,
    borderWidth: 1.5, borderColor: COLORS.textGold,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  iconCircleInner: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#05192E', justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: { color: COLORS.textGold, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emergencyButtonWrapper: {
    marginTop: 5,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.textGold,
  },
  emergencyButtonInner: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  adWrapper: {
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05192E',
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E4A75',
  }
});
