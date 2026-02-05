import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, StatusBar, 
  Image, ScrollView, Alert, ActivityIndicator, Linking 
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location'; 

// FIREBASE
import { collection, getDocs, query, limit, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { db_firestore } from '../src/services/firebaseConfig';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  danger: '#ef4444', // ROJO PARA EMERGENCIA
  success: '#22c55e'
};

export default function Home() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  
  // Estados de Inteligencia Vial
  const [riesgos, setRiesgos] = useState<number>(0);
  const [loadingIntel, setLoadingIntel] = useState(true);

  // Estado para el Botón de Pánico
  const [loadingGPS, setLoadingGPS] = useState(false);

  useEffect(() => {
    cargarUsuario();
    cargarInteligencia();
  }, []);

  const cargarUsuario = async () => {
    const user = await AsyncStorage.getItem('USER_SESSION');
    if (user) setUsuario(JSON.parse(user));
  };

  const cargarInteligencia = async () => {
    try {
        const q = query(collection(db_firestore, "zonas_riesgo"), orderBy("fecha", "desc"), limit(5));
        const snapshot = await getDocs(q);
        setRiesgos(snapshot.size);
    } catch (e) {
        console.log("Modo Offline: No se pudo cargar inteligencia");
    } finally {
        setLoadingIntel(false);
    }
  };

  const cerrarSesion = async () => {
    await AsyncStorage.removeItem('USER_SESSION');
    router.replace('/');
  };

  // --- NUEVO: ABRIR CENTRO DE MONITOREO ---
  const abrirMonitor = () => {
    Linking.openURL('https://device-streaming-61499c4a.web.app/monitor.html');
  };

  const handleIniciarJornada = async () => {
    try {
      // A. Verificar Inspección del Día
      const hoy = new Date().toISOString().split('T')[0]; 
      const ultimaInspeccion = await AsyncStorage.getItem('ULTIMA_INSPECCION');
      
      if (ultimaInspeccion !== hoy) {
        Alert.alert(
          "⚠️ Inspección Requerida",
          "No puedes iniciar jornada sin realizar tu revisión mecánica diaria (NOM-068).",
          [
            { text: "Cancelar", style: "cancel" },
            { 
              text: "HACER INSPECCIÓN", 
              onPress: () => router.push('/inspeccionVisual') 
            }
          ]
        );
        return; 
      }

      // B. Permisos GPS
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
          Alert.alert(
              "Permiso Requerido", 
              "Para iniciar el viaje y activar el mapa, necesitamos acceso a tu ubicación.",
              [{ text: "Entendido" }]
          );
          return;
      }

      // C. Navegar
      router.push('/jornadaEnCurso');

    } catch (e) {
      console.error("Error validando inicio", e);
      Alert.alert("Error", "Ocurrió un problema al validar el inicio de jornada.");
    }
  };

  // --- LÓGICA BOTÓN DE PÁNICO / EMERGENCIA ---
  const handleEmergencia = async () => {
    Alert.alert(
      "🚨 ALERTA DE SEGURIDAD",
      "¿Estás en una situación de peligro? Se enviará tu ubicación inmediata a la central de monitoreo y soporte.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "SÍ, SOLICITAR AYUDA", 
          style: 'destructive', // Pone el botón en rojo en iOS
          onPress: async () => {
            await registrarEventoEmergencia();
          }
        }
      ]
    );
  };

  const registrarEventoEmergencia = async () => {
    setLoadingGPS(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Error', 'Se requiere permiso de ubicación para enviar la alerta.');
        setLoadingGPS(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: location.coords.latitude,
        long: location.coords.longitude,
        fecha: new Date().toISOString()
      };

      // Guardamos en la misma colección pero con TIPO 'PANICO_EMERGENCIA'
      await addDoc(collection(db_firestore, `alertas_inspeccion`), {
          usuario: usuario?.nombre || 'Desconocido',
          licencia: usuario?.licencia || 'S/N',
          empresa: usuario?.empresa || 'S/N',
          tipo: 'PANICO_EMERGENCIA', // <--- CAMBIO IMPORTANTE PARA EL MONITOR
          ubicacion: coords,
          timestamp: Timestamp.now(),
          detalles: 'BOTÓN DE PÁNICO ACTIVADO POR EL OPERADOR'
      });

      Alert.alert(
          "🚨 ALERTA ENVIADA", 
          `La central ha recibido tu solicitud de ayuda.\nUbicación: ${coords.lat.toFixed(5)}, ${coords.long.toFixed(5)}`,
          [{ text: "Entendido" }] 
      );

    } catch (error) {
      Alert.alert("Error de Conexión", "No se pudo enviar la alerta a la nube. Intenta llamar al 911.");
      console.error(error);
    } finally {
      setLoadingGPS(false);
    }
  };

  // --- FUNCIÓN PARA IR A SUSCRIPCIONES ---
  const irAPremium = () => {
      // Asegúrate de que el nombre del archivo coincida con la ruta
      router.push('/PantallaSuscripcion'); 
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <Image 
                source={usuario?.foto ? { uri: usuario.foto } : require('../assets/images/adaptive-icon.png')} 
                style={styles.avatar} 
            />
            <View>
                <Text style={styles.welcomeText}>Bienvenido,</Text>
                <Text style={styles.userName}>{usuario?.nombre || 'Operador'}</Text>
            </View>
        </View>

        <View style={{flexDirection:'row', alignItems:'center', gap: 15}}>
            {/* 👑 BOTÓN CORONA EN EL HEADER (Acceso Rápido) */}
            <TouchableOpacity onPress={irAPremium}>
                <MaterialCommunityIcons name="crown" size={26} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={cerrarSesion}>
                <MaterialCommunityIcons name="logout" size={24} color={COLORS.subtext} />
            </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 50}}>
        
        {/* WIDGET CENTRO DE MONITOREO */}
        <TouchableOpacity 
            style={styles.intelCard} 
            onPress={abrirMonitor}
            activeOpacity={0.8}
        >
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
                <View>
                    <Text style={styles.intelTitle}>CENTRO DE MONITOREO</Text>
                    <Text style={styles.intelSub}>Ver mapa de flota y riesgos</Text>
                </View>
                <MaterialCommunityIcons name="radar" size={24} color={COLORS.primary} />
            </View>
            
            <View style={{marginTop: 15, flexDirection:'row', alignItems:'center'}}>
                {loadingIntel ? (
                    <ActivityIndicator color={COLORS.primary} size="small"/>
                ) : (
                    <>
                        <Text style={[styles.intelNumber, {color: riesgos > 0 ? COLORS.danger : COLORS.text}]}>
                            {riesgos}
                        </Text>
                        <Text style={styles.intelLabel}>
                            {riesgos === 1 ? 'Zona de Riesgo Activa' : 'Zonas de Riesgo Activas'}
                        </Text>
                    </>
                )}
                <MaterialCommunityIcons name="open-in-new" size={16} color={COLORS.subtext} style={{marginLeft:'auto'}} />
            </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>OPERACIÓN</Text>
        
        <View style={styles.grid}>
            {/* 1. JORNADA */}
            <TouchableOpacity style={styles.card} onPress={handleIniciarJornada}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(245, 158, 11, 0.2)'}]}>
                    <MaterialCommunityIcons name="steering" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.cardTitle}>Mi Jornada</Text>
                <Text style={styles.cardSub}>Bitácora y GPS</Text>
            </TouchableOpacity>

            {/* 2. INSPECCIÓN */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/inspeccionVisual')}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(139, 92, 246, 0.2)'}]}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={32} color="#8b5cf6" />
                </View>
                <Text style={styles.cardTitle}>Inspección</Text>
                <Text style={styles.cardSub}>Revisión 360°</Text>
            </TouchableOpacity>

            {/* 3. HISTORIAL */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/historial')}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(59, 130, 246, 0.2)'}]}>
                    <MaterialCommunityIcons name="history" size={32} color="#3b82f6" />
                </View>
                <Text style={styles.cardTitle}>Historial</Text>
                <Text style={styles.cardSub}>Viajes pasados</Text>
            </TouchableOpacity>

            {/* 4. CALCULADORA */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/calculadora')}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(34, 197, 94, 0.2)'}]}>
                    <MaterialCommunityIcons name="calculator" size={32} color="#22c55e" />
                </View>
                <Text style={styles.cardTitle}>Diesel Calc</Text>
                <Text style={styles.cardSub}>Control de consumo</Text>
            </TouchableOpacity>

            {/* 5. PERFIL */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/perfil')}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(148, 163, 184, 0.2)'}]}>
                    <MaterialCommunityIcons name="account-cog" size={32} color="#94a3b8" />
                </View>
                <Text style={styles.cardTitle}>Mi Perfil</Text>
                <Text style={styles.cardSub}>Ajustes de cuenta</Text>
            </TouchableOpacity>

            {/* 6. 🔥 HAZTE PRO (NUEVO BOTÓN INTEGRADO AL GRID) */}
            <TouchableOpacity style={styles.card} onPress={irAPremium}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(255, 215, 0, 0.15)'}]}>
                    <MaterialCommunityIcons name="crown" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.cardTitle}>Hazte PRO</Text>
                <Text style={styles.cardSub}>Sin límites</Text>
            </TouchableOpacity>
        </View>

        {/* Banner */}
        <View style={styles.banner}>
            <MaterialCommunityIcons name="shield-check" size={40} color="rgba(255,255,255,0.2)" />
            <View style={{marginLeft: 15, flex:1}}>
                <Text style={{color:'white', fontWeight:'bold'}}>Modo Seguro Activo</Text>
                <Text style={{color:COLORS.subtext, fontSize:12}}>Tu base de datos está blindada contra fallos.</Text>
            </View>
        </View>

        {/* BOTÓN DE EMERGENCIA */}
        <Text style={[styles.sectionTitle, {marginTop: 25, color: COLORS.danger}]}>ZONA DE SEGURIDAD</Text>
        
        <TouchableOpacity 
          style={styles.officialBtn} 
          onPress={handleEmergencia}
          disabled={loadingGPS}
        >
          {loadingGPS ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              {/* CAMBIAMOS EL ÍCONO A ALARMA/LUZ DE POLICÍA */}
              <MaterialCommunityIcons name="alarm-light" size={28} color="white" />
              <Text style={styles.officialBtnText}>EMERGENCIA / S.O.S</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={{textAlign:'center', color: COLORS.subtext, fontSize: 10, marginTop: 5}}>
          Presiona solo en caso de accidente, robo o peligro inminente.
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderBottomWidth:1, borderBottomColor: '#334155'
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#333' },
  welcomeText: { color: COLORS.subtext, fontSize: 12 },
  userName: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  
  // WIDGET INTELIGENCIA (BOTÓN)
  intelCard: {
      backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: '#334155',
      borderRadius: 16, padding: 15, marginBottom: 25
  },
  intelTitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  intelSub: { color: COLORS.subtext, fontSize: 10 },
  intelNumber: { fontSize: 24, fontWeight: 'bold', marginRight: 10 },
  intelLabel: { color: COLORS.text, fontSize: 14 },

  sectionTitle: { color: COLORS.subtext, fontSize: 12, fontWeight:'bold', marginBottom: 15, letterSpacing:1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  
  card: {
    width: '47%', backgroundColor: COLORS.card, borderRadius: 16, padding: 15,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 3,
    marginBottom: 10
  },
  iconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cardSub: { color: COLORS.subtext, fontSize: 10, textAlign:'center' },

  banner: {
      marginTop: 20, backgroundColor: COLORS.card, padding: 20, borderRadius: 16,
      flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155'
  },

  officialBtn: {
    backgroundColor: COLORS.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 18, borderRadius: 12, shadowColor: COLORS.danger, shadowOpacity: 0.4, shadowOffset: {width:0, height:4}, elevation: 5
  },
  officialBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 10, letterSpacing: 0.5 }
});