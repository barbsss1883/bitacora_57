import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8'
};

export default function Home() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);

  useEffect(() => {
    cargarUsuario();
  }, []);

  const cargarUsuario = async () => {
    const user = await AsyncStorage.getItem('USER_SESSION');
    if (user) setUsuario(JSON.parse(user));
  };

  const cerrarSesion = async () => {
    await AsyncStorage.removeItem('USER_SESSION');
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
            <Image 
                source={usuario?.foto ? { uri: usuario.foto } : require('../assets/images/icon.png')} 
                style={styles.avatar} 
            />
            <View>
                <Text style={styles.welcomeText}>Bienvenido,</Text>
                <Text style={styles.userName}>{usuario?.nombre || 'Operador'}</Text>
            </View>
        </View>
        <TouchableOpacity onPress={cerrarSesion}>
            <MaterialCommunityIcons name="logout" size={24} color={COLORS.subtext} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
        
        <Text style={styles.sectionTitle}>OPERACIÓN</Text>
        
        <View style={styles.grid}>
            {/* 1. JORNADA */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/jornadaEnCurso')}>
                <View style={[styles.iconBox, {backgroundColor: 'rgba(245, 158, 11, 0.2)'}]}>
                    <MaterialCommunityIcons name="steering" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.cardTitle}>Mi Jornada</Text>
                <Text style={styles.cardSub}>Bitácora y GPS</Text>
            </TouchableOpacity>

            {/* 2. INSPECCIÓN (RECUPERADA) */}
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

            {/* 4. CALCULADORA DIESEL */}
            <TouchableOpacity style={styles.card} onPress={() => router.push('/calculadoraDiesel')}>
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
        </View>

        {/* Banner */}
        <View style={styles.banner}>
            <MaterialCommunityIcons name="shield-check" size={40} color="rgba(255,255,255,0.2)" />
            <View style={{marginLeft: 15, flex:1}}>
                <Text style={{color:'white', fontWeight:'bold'}}>Modo Seguro Activo</Text>
                <Text style={{color:COLORS.subtext, fontSize:12}}>Tu base de datos está blindada contra fallos.</Text>
            </View>
        </View>

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
  }
});