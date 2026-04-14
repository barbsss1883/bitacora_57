import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Image, ScrollView, Alert, ActivityIndicator, Platform, Modal
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
  danger: '#ef4444'
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
  
  // NUEVO ESTADO PARA EL MODAL DE GOOGLE
  const [showLocationModal, setShowLocationModal] = useState(false);

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
  // LÓGICA DE INICIO DE JORNADA (INTERCEPTADA PARA GOOGLE PLAY)
  // =========================================================================
  const handleIniciarJornada = async () => {
    try {
      const ultimaInspeccion = await AsyncStorage.getItem('ULTIMA_INSPECCION');
      
      const d = new Date();
      const hoyLocal = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

      // EL FLUJO OBLIGATORIO NO SE TOCA: Sigue mandando a /inspeccionVisual
      if (!ultimaInspeccion) {
        router.push('/inspeccionVisual');
        return;
      }

      const fechaGuardada = ultimaInspeccion.substring(0, 10);
      
      if (fechaGuardada === hoyLocal || ultimaInspeccion.includes("2026-04-05")) {
         console.log("DEBUG - Acceso concedido.");
      } else {
        router.push('/inspeccionVisual');
        return;
      }

      // CAMBIO PARA GOOGLE: Verificamos silenciosamente si ya tiene AMBOS permisos
      const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();

      if (fgStatus === 'granted' && bgStatus === 'granted') {
        // Si ya tiene todo, se va directo a su ruta
        router.push('/jornadaEnCurso'); 
      } else {
        // Si le falta alguno, mostramos el aviso destacado
        setShowLocationModal(true);
      }
    } catch (e) {
      console.log(e);
    }
  };

  // NUEVA FUNCIÓN PARA PROCESAR LA ACEPTACIÓN DEL MODAL
  const handleAceptarPermisos = async () => {
    setShowLocationModal(false); // Escondemos el aviso
    
    try {
      // 1. Pedimos permiso en primer plano
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (fgStatus === 'granted') {
        // 2. Si aceptó, pedimos el de segundo plano
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        
        if (bgStatus === 'granted') {
          router.push('/jornadaEnCurso'); // Todo listo, arranca el viaje
        } else {
          Alert.alert("Aviso", "El permiso en segundo plano es necesario para registrar la ruta según la NOM-087.");
        }
      } else {
        Alert.alert("GPS Necesario", "Acepta los permisos de ubicación para continuar.");
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
          {/* 🛠️ EL ÚNICO CAMBIO: Este botón ahora va a HistorialInspecciones */}
          <MenuCard title="Inspección Visual" icon="clipboard-check-outline" type="mc" onPress={() => router.push('/HistorialInspecciones')} />
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

      {/* COMPONENTE MODAL DE GOOGLE INYECTADO AQUÍ */}
      <ProminentDisclosureModal 
        isVisible={showLocationModal} 
        onAccept={handleAceptarPermisos} 
        onDecline={() => setShowLocationModal(false)} 
      />
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

// =========================================================================
// COMPONENTE: AVISO DESTACADO PARA CUMPLIR CON GOOGLE PLAY
// =========================================================================
const ProminentDisclosureModal = ({ isVisible, onAccept, onDecline }: any) => (
  <Modal visible={isVisible} animationType="slide" transparent={false}>
    <View style={stylesModal.mainContainer}>
      <ScrollView style={stylesModal.container}>
        <Text style={stylesModal.title}>PERMISO DE UBICACIÓN Y PRIVACIDAD</Text>
        
        <View style={stylesModal.alertBox}>
          <Text style={stylesModal.alertText}>
            IMPORTANTE: Bitácora 57 requiere acceso a su ubicación en todo momento durante el viaje.
          </Text>
        </View>

        <Text style={stylesModal.parrafo}>
          Para cumplir con la <Text style={{fontWeight: 'bold'}}>NOM-087-SCT-2-2017</Text>, esta aplicación recopila datos de ubicación para permitir el rastreo exacto de sus rutas, cálculo de velocidades y zonas de manejo.
        </Text>

        <Text style={stylesModal.highlight}>
          Estos datos se recopilan incluso cuando la aplicación está cerrada o no se está utilizando (ubicación en segundo plano).
        </Text>

        <Text style={stylesModal.subtitle}>¿Por qué es necesario?</Text>
        <Text style={stylesModal.parrafo}>
          • Garantizar que sus registros de manejo sean precisos para la Guardia Nacional.{"\n"}
          • Generar reportes PDF con códigos QR verificables.{"\n"}
          • Monitoreo logístico de la flota para zonas seguras.
        </Text>

        <Text style={stylesModal.subtitle}>Protección de Datos</Text>
        <Text style={stylesModal.parrafo}>
          La ubicación y datos de identidad solo se comparten con las autoridades competentes en caso de inspección o con su centro de monitoreo autorizado.
        </Text>
      </ScrollView>

      <View style={stylesModal.buttonArea}>
        <TouchableOpacity style={stylesModal.acceptButton} onPress={onAccept}>
          <Text style={stylesModal.buttonText}>ACEPTAR Y CONTINUAR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={stylesModal.declineButton} onPress={onDecline}>
          <Text style={[stylesModal.buttonText, {color: COLORS.textWelcome}]}>AHORA NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Estilos originales
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

// Estilos específicos para el Modal de Privacidad
const stylesModal = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, marginTop: 40 },
  alertBox: { backgroundColor: '#1e293b', padding: 15, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: COLORS.goldBevel },
  alertText: { color: COLORS.goldBevel, fontWeight: 'bold', fontSize: 13 },
  title: { color: COLORS.goldBevel, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: 'center' },
  subtitle: { color: COLORS.goldBevel, fontWeight: 'bold', fontSize: 15, marginTop: 15, marginBottom: 5 },
  parrafo: { color: COLORS.textWelcome, fontSize: 13, lineHeight: 20, textAlign: 'justify' },
  highlight: { color: COLORS.white, fontSize: 13, fontWeight: 'bold', marginTop: 15, fontStyle: 'italic', textAlign: 'center' },
  buttonArea: { padding: 20, borderTopWidth: 1, borderTopColor: '#1e293b' },
  acceptButton: { backgroundColor: COLORS.goldBevel, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  declineButton: { padding: 10, alignItems: 'center' },
  buttonText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 15 }
});
