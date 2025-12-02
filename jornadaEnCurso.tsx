import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// --- IMPORTACIONES DE TUS COMPONENTES Y SERVICIOS ---
import MonitorFatiga from '../components/MonitorFatiga';
import { iniciarRastreoBackground, detenerRastreo } from '../services/LocationService';
import { iniciarNuevaJornada, finalizarJornada } from '../db/database';

export default function JornadaEnCurso() {
  const router = useRouter();
  
  // Estados para controlar la interfaz
  const [cargando, setCargando] = useState(true);
  const [jornadaId, setJornadaId] = useState<number | null>(null);
  const [fechaInicio, setFechaInicio] = useState<string | null>(null);
  const [datosViaje, setDatosViaje] = useState({
    operador: "Juan Pérez", // Aquí podrías jalarlo de un login real
    unidad: "T-800",
    origen: "CEDIS México",
    destino: "Monterrey"
  });

  // 1. Al abrir la pantalla, verificamos si ya hay un viaje activo recuperándolo de la memoria
  useEffect(() => {
    verificarSesionActiva();
  }, []);

  const verificarSesionActiva = async () => {
    try {
      const idGuardado = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
      const fechaGuardada = await AsyncStorage.getItem('CURRENT_JORNADA_START');
      
      if (idGuardado && fechaGuardada) {
        console.log("🔄 Recuperando sesión activa del viaje ID:", idGuardado);
        setJornadaId(parseInt(idGuardado, 10));
        setFechaInicio(fechaGuardada);
      }
    } catch (e) {
      console.error("Error recuperando sesión:", e);
    } finally {
      setCargando(false);
    }
  };

  // 2. Función para INICIAR el viaje
  const handleIniciarViaje = async () => {
    setCargando(true);
    try {
      // A) Crear el registro en la base de datos local (SQLite)
      const nuevoId = await iniciarNuevaJornada(
        datosViaje.operador,
        datosViaje.unidad,
        datosViaje.origen,
        datosViaje.destino
      );

      const fechaActual = new Date().toISOString();

      // B) Guardar en memoria del teléfono (AsyncStorage) para persistencia
      await AsyncStorage.setItem('CURRENT_JORNADA_ID', nuevoId.toString());
      await AsyncStorage.setItem('CURRENT_JORNADA_START', fechaActual);

      // C) Activar el GPS en segundo plano
      await iniciarRastreoBackground();

      // D) Actualizar la pantalla
      setJornadaId(nuevoId);
      setFechaInicio(fechaActual);
      
      Alert.alert("Buen Viaje 🚛", "La ruta se está registrando correctamente.");
    } catch (e) {
      Alert.alert("Error", "No se pudo iniciar la jornada. Verifica tu base de datos.");
      console.error(e);
    } finally {
      setCargando(false);
    }
  };

  // 3. Función para FINALIZAR el viaje
  const handleFinalizarViaje = async () => {
    Alert.alert(
      "Finalizar Jornada",
      "¿Estás seguro de que deseas terminar el viaje?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Finalizar", 
          style: "destructive",
          onPress: async () => {
            await ejecutarCierre();
          }
        }
      ]
    );
  };

  const ejecutarCierre = async () => {
    setCargando(true);
    if (!jornadaId) return;

    try {
      // A) Detener el GPS para ahorrar batería
      await detenerRastreo();

      // B) Cerrar el registro en la base de datos
      await finalizarJornada(jornadaId);

      // C) Limpiar la memoria del teléfono
      await AsyncStorage.removeItem('CURRENT_JORNADA_ID');
      await AsyncStorage.removeItem('CURRENT_JORNADA_START');

      // D) Resetear la pantalla
      setJornadaId(null);
      setFechaInicio(null);

      Alert.alert("Jornada Finalizada", "Tus datos y ruta han sido guardados exitosamente.");
    } catch (e) {
      console.error("Error al finalizar:", e);
      Alert.alert("Error", "Hubo un problema al cerrar la jornada.");
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={{ marginTop: 10, color: '#bdc3c7' }}>Procesando...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Bitácora de Viaje</Text>
        <Text style={styles.subtitulo}>{datosViaje.unidad} • {datosViaje.operador}</Text>
      </View>

      {/* --- MONITOR DE FATIGA (NOM-087) --- */}
      <View style={styles.card}>
        <MonitorFatiga 
          jornadaActiva={!!jornadaId} 
          fechaInicio={fechaInicio} 
        />
      </View>

      {/* --- INFORMACIÓN DE LA RUTA --- */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Origen:</Text>
          <Text style={styles.valor}>{datosViaje.origen}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Destino:</Text>
          <Text style={styles.valor}>{datosViaje.destino}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Estatus:</Text>
          <Text style={[styles.valor, { color: jornadaId ? '#2ecc71' : '#e74c3c' }]}>
            {jornadaId ? 'EN RUTA 🟢' : 'DETENIDO 🔴'}
          </Text>
        </View>
      </View>

      {/* --- BOTONES DE ACCIÓN (Grandes para el operador) --- */}
      <View style={styles.botonera}>
        {!jornadaId ? (
          <TouchableOpacity 
            style={[styles.boton, styles.botonIniciar]} 
            onPress={handleIniciarViaje}
            activeOpacity={0.7}
          >
            <Text style={styles.textoBoton}>INICIAR JORNADA</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.boton, styles.botonFinalizar]} 
            onPress={handleFinalizarViaje}
            activeOpacity={0.7}
          >
            <Text style={styles.textoBoton}>FINALIZAR VIAJE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Botón auxiliar para ver mapa (Opcional) */}
      {jornadaId && (
        <TouchableOpacity 
          style={styles.botonSecundario}
          onPress={() => router.push('/mapaRuta')}
        >
          <Text style={styles.textoSecundario}>🗺 Ver Mapa en Tiempo Real</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e272e' },
  scrollContainer: { flexGrow: 1, padding: 20, backgroundColor: '#1e272e' },
  center: { justifyContent: 'center', alignItems: 'center' },
  
  header: { marginBottom: 20, alignItems: 'center' },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#ecf0f1', textTransform: 'uppercase' },
  subtitulo: { fontSize: 16, color: '#bdc3c7', marginTop: 5 },

  card: { marginBottom: 20 },

  infoContainer: { 
    backgroundColor: '#2d3436', 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#485460'
  },
  infoRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#485460',
    paddingBottom: 5
  },
  label: { color: '#bdc3c7', fontSize: 16 },
  valor: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },

  botonera: { marginBottom: 20 },
  boton: {
    paddingVertical: 25,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  botonIniciar: { backgroundColor: '#27ae60' },
  botonFinalizar: { backgroundColor: '#c0392b' },
  textoBoton: { color: 'white', fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },

  botonSecundario: { padding: 15, alignItems: 'center' },
  textoSecundario: { color: '#3498db', fontSize: 18, textDecorationLine: 'underline' }
});
