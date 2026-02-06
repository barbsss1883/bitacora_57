import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Image, ScrollView, Alert, ActivityIndicator, Linking 
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location'; 
import Purchases from 'react-native-purchases'; 
// --- IMPORTACIÓN DE ADMOB ---
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// FIREBASE
import { collection, getDocs, query, limit, orderBy, addDoc, Timestamp } from 'firebase/firestore';
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

// ID de tu bloque de anuncios
const AD_UNIT_ID = __DEV__ ? TestIds.BANNER : "ca-app-pub-9657693965267569/4678645716";

export default function Home() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [esPremium, setEsPremium] = useState(false);
  
  const [riesgos, setRiesgos] = useState<number>(0);
  const [loadingIntel, setLoadingIntel] = useState(true);
  const [loadingGPS, setLoadingGPS] = useState(false);

  useEffect(() => {
    cargarUsuario();
    cargarInteligencia();
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
    } catch (e) {
      console.log("Error verificando suscripción", e);
    }
  };

  const cargarUsuario = async () => {
    const user = await AsyncStorage.getItem('USER_SESSION');
    if (user) setUsuario(JSON.parse(user));
  };

  const cargarInteligencia = async () => {
    try {
        const q = query(collection(db_firestore, "zonas_riesgo"), orderBy("fecha", "desc"), limit(5));
        const snapshot = await getDocs(q);
        setRiesgos(snapshot.size);
    } catch (e) { console.log("Offline"); } finally { setLoadingIntel(false); }
  };

  const cerrarSesion = async () => {
    await AsyncStorage.removeItem('USER_SESSION');
    router.replace('/');
  };

  const handleIniciarJornada = async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0]; 
      const ultimaInspeccion = await AsyncStorage.getItem('ULTIMA_INSPECCION');
      if (ultimaInspeccion !== hoy) {
        Alert.alert("⚠️ Inspección Requerida", "Realiza tu revisión mecánica diaria antes de iniciar.", [{ text: "HACER INSPECCIÓN", onPress: () => router.push('/inspeccionVisual') }]);
        return; 
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') router.push('/jornadaEnCurso');
    } catch (e) {}
  };

  const handleEmergencia = async () => {
    Alert.alert("🚨 EMERGENCIA", "¿Enviar ubicación a central?", [{ text: "Cancelar" }, { text: "SÍ, AYUDA", style: 'destructive', onPress: async () => await registrarEventoEmergencia() }]);
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
      Alert.alert("🚨 ENVIADA", "Central notificada.");
    } catch (error) { Alert.alert("Error", "Llamar al 911."); } finally { setLoadingGPS(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <Image source={usuario?.foto ? { uri: usuario.foto } : require('../assets/images/adaptive-icon.png')} style={styles.avatar} />
            <View>
                <Text style={styles.welcomeText}>Bienvenido,</Text>
                <Text style={styles.userName}>{usuario?.nombre || 'Operador'}{esPremium && <Text style={{color: COLORS.primary}}> PRO</Text>}</Text>
            </View>
        </View>
        {!esPremium && (
            <TouchableOpacity onPress={() => router.push('/PantallaSuscripcion')}>
                <MaterialCommunityIcons name="crown" size={26} color={COLORS.primary} />
            </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 50}}>
        
        <TouchableOpacity style={styles.intelCard} onPress={() => Linking.openURL('https://device-streaming-61499c4a.web.app/monitor.html')}>
            <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.intelTitle}>CENTRO DE MONITOREO</Text>
                <MaterialCommunityIcons name="radar" size={24} color={COLORS.primary} />
            </View>
            <View style={{marginTop: 10, flexDirection:'row', alignItems:'center'}}>
                {!loadingIntel && <Text style={[styles.intelNumber, {color: riesgos > 0 ? COLORS.danger : COLORS.text}]}>{riesgos} <Text style={{fontSize:14}}>Zonas Activas</Text></Text>}
            </View>
        </TouchableOpacity>

        <View style={styles.grid}>
            <MenuCard title="Mi Jornada" icon="steering" color={COLORS.primary} onPress={handleIniciarJornada} />
            <MenuCard title="Inspección" icon="clipboard-check-outline" color="#8b5cf6" onPress={() => router.push('/inspeccionVisual')} />
            <MenuCard title="Historial" icon="history" color="#3b82f6" onPress={() => router.push('/historial')} />
            <MenuCard title="Diesel Calc" icon="calculator" color="#22c55e" onPress={() => router.push('/calculadora')} />
            <MenuCard title="Mi Perfil" icon="account-cog" color="#94a3b8" onPress={() => router.push('/perfil')} />
            {!esPremium && <MenuCard title="Hazte PRO" icon="crown" color={COLORS.primary} onPress={() => router.push('/PantallaSuscripcion')} />}
        </View>

        {/* --- BANNER REAL DE ADMOB --- */}
        {!esPremium && (
            <View style={styles.adContainer}>
                <Text style={styles.adLabel}>PUBLICIDAD</Text>
                <BannerAd
                    unitId={AD_UNIT_ID}
                    size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                    requestOptions={{ requestNonPersonalizedAdsOnly: true }}
                    onAdFailedToLoad={(error) => console.log('Ad Error:', error)}
                />
            </View>
        )}

        <TouchableOpacity style={styles.officialBtn} onPress={handleEmergencia} disabled={loadingGPS}>
          {loadingGPS ? <ActivityIndicator color="white" /> : <><MaterialCommunityIcons name="alarm-light" size={28} color="white" /><Text style={styles.officialBtnText}>EMERGENCIA / S.O.S</Text></>}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const MenuCard = ({ title, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
        <View style={[styles.iconBox, {backgroundColor: `${color}25`}]}>
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
  intelCard: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 16, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: '#334155' },
  intelTitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },
  intelNumber: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  card: { width: '48%', backgroundColor: COLORS.card, borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 10 },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  officialBtn: { backgroundColor: COLORS.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 12, marginTop: 25 },
  officialBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  adContainer: { marginTop: 20, alignItems: 'center', width: '100%', minHeight: 60 },
  adLabel: { color: '#475569', fontSize: 8, marginBottom: 5, letterSpacing: 2 }
});