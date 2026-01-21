import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Importamos las funciones de la base de datos
import { exportarBaseDatos, importarBaseDatos } from '../db/database';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  danger: '#ef4444',
  border: '#334155'
};

export default function Configuracion() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleBackup = async () => {
    setLoading(true);
    const exito = await exportarBaseDatos();
    setLoading(false);
    // Sharing maneja su propia UI
  };

  const handleRestore = async () => {
    Alert.alert(
      "⚠️ Restaurar Datos",
      "Esta acción BORRARÁ todos los datos actuales del celular y pondrá los del archivo de respaldo. \n\n¿Estás seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Restaurar", 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const exito = await importarBaseDatos();
            setLoading(false);
            if (exito) {
              Alert.alert("¡Restauración Exitosa!", "La aplicación necesita reiniciarse para cargar los nuevos datos.", [
                { text: "OK", onPress: () => router.replace('/') }
              ]);
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
      </View>

      <ScrollView contentContainerStyle={{padding: 20}}>
        
        <Text style={styles.sectionTitle}>SEGURIDAD DE DATOS</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="database-check" size={28} color={COLORS.primary} />
            <View style={{marginLeft: 15, flex: 1}}>
              <Text style={styles.cardTitle}>Respaldo Local</Text>
              <Text style={styles.cardSub}>Guarda tus viajes y evidencia en un archivo seguro.</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Botón Exportar */}
          <TouchableOpacity style={styles.optionBtn} onPress={handleBackup} disabled={loading}>
            <View style={[styles.iconContainer, {backgroundColor: 'rgba(16, 185, 129, 0.2)'}]}>
              <MaterialCommunityIcons name="cloud-upload" size={20} color="#10b981" />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.optionTitle}>Crear Copia de Seguridad</Text>
              <Text style={styles.optionSub}>Enviar a WhatsApp, Drive o Email</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.subtext} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Botón Importar */}
          <TouchableOpacity style={styles.optionBtn} onPress={handleRestore} disabled={loading}>
            <View style={[styles.iconContainer, {backgroundColor: 'rgba(239, 68, 68, 0.2)'}]}>
              <MaterialCommunityIcons name="cloud-download" size={20} color={COLORS.danger} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.optionTitle}>Restaurar Copia</Text>
              <Text style={styles.optionSub}>Cargar archivo .db existente</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.subtext} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>INFORMACIÓN DE LA APP</Text>
        <View style={styles.card}>
            <View style={styles.rowBetween}>
                <Text style={{color: COLORS.subtext}}>Versión</Text>
                {/* Aquí escribimos la versión manual para evitar el crash */}
                <Text style={{color: COLORS.text, fontWeight:'bold'}}>1.0.0</Text>
            </View>
            <View style={[styles.rowBetween, {marginTop:15}]}>
                <Text style={{color: COLORS.subtext}}>Compilación (Build)</Text>
                <Text style={{color: COLORS.text, fontWeight:'bold'}}>1</Text>
            </View>
        </View>

        {loading && <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 30}} />}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border
  },
  backBtn: { marginRight: 15, padding: 5 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  sectionTitle: { color: COLORS.subtext, fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginTop: 25, paddingLeft: 5, letterSpacing: 1 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  cardSub: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  optionTitle: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  optionSub: { color: COLORS.subtext, fontSize: 11, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' }
});

