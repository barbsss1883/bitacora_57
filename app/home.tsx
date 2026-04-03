import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Image, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location'; 
import Purchases from 'react-native-purchases';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db_firestore } from '../src/services/firebaseConfig';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  danger: '#ef4444', 
  success: '#22c55e'
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

  const handleIniciarJornada = async () => {
    try {
      // FECHA LOCAL BLINDADA
      const hoy = new Date().toLocaleDateString('en-CA'); 
      const ultimaInspeccion = await AsyncStorage.getItem('ULTIMA_INSPECCION');

      if (!ultimaInspeccion || !ultimaInspeccion.includes(hoy)) {
        router.push('/inspeccionVisual');
        return; 
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') router.push('/jornadaEnCurso');
    } catch (e) {}
  };

  const handleEmergencia = () => {
    Alert.alert(
      "🚨 EMERGENCIA",
      "¿Enviar ubicación a central?",
      [
        { text: "Cancelar" },
        { text: "SÍ, AYUDA", style: 'destructive', onPress: registrarEventoEmergencia }
      ]
    );
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Image 
            source={usuario?.foto ? { uri: usuario.foto } : require('../assets/images/adaptive-icon.png')} 
            style={styles.avatar} 
          />
          <View>
            <Text style={styles.welcomeText}>Bienvenido,</Text>
            <Text style={styles.userName}>
              {usuario?.nombre || 'Operador'}
              {esPremium && <Text style={{color: COLORS.primary}}> PRO</Text>}
            </Text>
          </View>
        </View>

        {!esPremium && (
          <TouchableOpacity onPress={() => router.push('/PantallaSuscripcion')}>
            <MaterialCommunityIcons name="crown" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

        {/* BANNER PRO */}
        {!esPremium && (
          <TouchableOpacity style={styles.bannerPro} onPress={() => router.push('/PantallaSuscripcion')}>
            <MaterialCommunityIcons name="star-shooting" size={24} color={COLORS.primary} />
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.bannerTitle}>Obtén la versión PRO</Text>
              <Text style={styles.bannerDesc}>Genera PDFs oficiales y reportes sin límite.</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* GRID DE 6 BOTONES (LA MARAVILLA QUE ARMAMOS) */}
        <View style={styles.grid}>
          <MenuCard title="Mi Jornada" icon="steering" color={COLORS.primary} onPress={handleIniciarJornada} />
          <MenuCard title="Inspección" icon="clipboard-check-outline" color="#8b5cf6" onPress={() => router.push('/inspeccionVisual')} />
          <MenuCard title="Historial" icon="history" color="#3b82f6" onPress={() => router.push('/historial')} />
          <MenuCard title="Diesel Calc" icon="calculator" color="#22c55e" onPress={() => router.push('/calculadora')} />
          <MenuCard title="Mi Perfil" icon="account-cog" color="#94a3b8" onPress={() => router.push('/perfil')} />
          <MenuCard title="Inspección GN" icon="shield-star" color="#fbbf24" onPress={() => router.push('/inspeccion')} />
        </View>

        {/* PUBLICIDAD */}
        {!esPremium && (
          <View style={styles.adContainer}>
            <Text style={styles.adLabel}>PUBLICIDAD</Text>
            <BannerAd
              unitId={AD_UNIT_ID}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            />
          </View>
        )}

        {/* EMERGENCIA S.O.S */}
        <TouchableOpacity style={styles.officialBtn} onPress={handleEmergencia} disabled={loadingGPS}>
          {loadingGPS ? <ActivityIndicator color="white" /> : (
            <>
              <MaterialCommunityIcons name="alarm-light" size={28} color="white" />
              <Text style={styles.officialBtnText}>EMERGENCIA / S.O.S</Text>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const MenuCard = ({ title, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: `${color}25` }]}>
      <MaterialCommunityIcons name={icon} size={32} color={color} />
    </View>
    <Text style={styles.cardTitle}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.card },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  welcomeText: { color: COLORS.subtext, fontSize: 12 },
  userName: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  bannerPro: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 25, backgroundColor: 'rgba(245,158,11,0.1)' },
  bannerTitle: { color: COLORS.primary, fontWeight: 'bold' },
  bannerDesc: { color: COLORS.text, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', aspectRatio: 1.1, backgroundColor: COLORS.card, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: 'white', fontWeight: 'bold' },
  adContainer: { marginTop: 20, alignItems: 'center' },
  adLabel: { fontSize: 8, color: '#475569', marginBottom: 5 },
  officialBtn: { backgroundColor: COLORS.danger, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 18, borderRadius: 12, marginTop: 25 },
  officialBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 10 }
});
