import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, ActivityIndicator, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { exportarBaseDatos, importarBaseDatos } from '../db/database';

const COLORS = {
  bg:        '#010A14',
  card:      '#051C33',
  goldBevel: '#D4AF37',
  gold2:     '#C5A059',
  text:      '#FFFFFF',
  subtext:   '#9DA8B5',
  border:    '#12365A',
  border2:   '#2A4A69',
  danger:    '#ef4444',
  success:   '#10B981',
};

const GRADIENTS = {
  header:  ['#051C33', '#010A14'] as const,
  cardBg:  ['#12365A', '#081D33', '#030E1A'] as const,
  dangerBg: ['#450A0A', '#2D0606', '#010A14'] as const,
};

export default function Configuracion() {
  const router = useRouter();
  const [loadingBackup,  setLoadingBackup]  = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleBackup = async () => {
    setLoadingBackup(true);
    try {
      const exito = await exportarBaseDatos();
      if (!exito) {
        Alert.alert('Error', 'No se pudo exportar la base de datos.');
      }
      // Si exito === true, el sistema de compartir nativo maneja su propia UI
    } catch (e) {
      Alert.alert('Error', 'Ocurrió un error al intentar exportar.');
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      '⚠️ Restaurar Datos',
      'Esta acción BORRARÁ todos los datos actuales del dispositivo y los reemplazará con los del archivo de respaldo.\n\n¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Restaurar',
          style: 'destructive',
          onPress: async () => {
            setLoadingRestore(true);
            try {
              const exito = await importarBaseDatos();
              if (exito) {
                Alert.alert(
                  '¡Restauración Exitosa!',
                  'La aplicación necesita reiniciarse para cargar los nuevos datos.',
                  [{ text: 'OK', onPress: () => router.replace('/') }]
                );
              } else {
                Alert.alert('Error', 'No se pudo restaurar la base de datos. Verifica que el archivo sea válido.');
              }
            } catch (e) {
              Alert.alert('Error', 'Ocurrió un error al intentar restaurar.');
            } finally {
              setLoadingRestore(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <LinearGradient colors={GRADIENTS.header} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.goldBevel} />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={{ width: 28 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Sección: Datos ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>GESTIÓN DE DATOS</Text>

        {/* Respaldo */}
        <TouchableOpacity
          onPress={handleBackup}
          disabled={loadingBackup}
          activeOpacity={0.8}
          style={styles.cardWrapper}
        >
          <LinearGradient colors={GRADIENTS.cardBg} style={styles.cardInner}>
            <View style={styles.iconCircleOuter}>
              <View style={styles.iconCircleInner}>
                <MaterialCommunityIcons name="database-export" size={26} color={COLORS.goldBevel} />
              </View>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Respaldar Base de Datos</Text>
              <Text style={styles.cardDesc}>
                Exporta un archivo .db con todos tus viajes, inspecciones y datos. Guárdalo en Google Drive o compártelo.
              </Text>
            </View>
            {loadingBackup
              ? <ActivityIndicator color={COLORS.goldBevel} style={{ marginLeft: 8 }} />
              : <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.border2} />
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* Restaurar */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={loadingRestore}
          activeOpacity={0.8}
          style={styles.cardWrapper}
        >
          <LinearGradient colors={GRADIENTS.dangerBg} style={styles.cardInner}>
            <View style={styles.iconCircleOuter}>
              <View style={[styles.iconCircleInner, { borderColor: 'rgba(239,68,68,0.5)' }]}>
                <MaterialCommunityIcons name="database-import" size={26} color={COLORS.danger} />
              </View>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: COLORS.danger }]}>Restaurar Datos</Text>
              <Text style={styles.cardDesc}>
                Reemplaza los datos actuales con un respaldo previo. Esta acción no se puede deshacer.
              </Text>
            </View>
            {loadingRestore
              ? <ActivityIndicator color={COLORS.danger} style={{ marginLeft: 8 }} />
              : <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(239,68,68,0.4)" />
            }
          </LinearGradient>
        </TouchableOpacity>

        {/* Aviso */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.gold2} style={{ marginTop: 1 }} />
          <Text style={styles.infoText}>
            El respaldo incluye jornadas, puntos GPS, pausas, incidencias e inspecciones. No incluye tu foto de perfil ni documentos adjuntos.
          </Text>
        </View>

        {/* ── Sección: App ───────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>ACERCA DE LA APP</Text>

        <LinearGradient colors={GRADIENTS.cardBg} style={styles.infoCard}>
          <InfoRow icon="identifier"        label="Versión"          value="3.0.2" />
          <InfoRow icon="android"           label="Plataforma"       value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
          <InfoRow icon="shield-check"      label="NOM-087-SCT"      value="Habilitada" valueColor={COLORS.success} />
          <InfoRow icon="clipboard-check"   label="NOM-068-SCT"      value="Habilitada" valueColor={COLORS.success} />
          <InfoRow icon="email-outline"     label="Soporte"          value="soportebitacora57@gmail.com" small />
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-componente fila de info ───────────────────────────────────────────────
function InfoRow({
  icon, label, value, valueColor, small,
}: {
  icon: string; label: string; value: string; valueColor?: string; small?: boolean;
}) {
  return (
    <View style={infoRowStyles.row}>
      <MaterialCommunityIcons name={icon as any} size={18} color={COLORS.goldBevel} style={{ marginRight: 10 }} />
      <Text style={infoRowStyles.label}>{label}</Text>
      <Text style={[infoRowStyles.value, valueColor ? { color: valueColor } : {}, small && { fontSize: 11 }]}>
        {value}
      </Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(18,54,90,0.6)',
  },
  label: { flex: 1, color: COLORS.subtext, fontSize: 13 },
  value: { color: COLORS.text, fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 8 },
});

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn:  { padding: 2 },
  title:    { color: COLORS.goldBevel, fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },

  scroll: { padding: 16, paddingTop: 24 },

  sectionLabel: {
    color: COLORS.gold2,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
    paddingLeft: 4,
  },

  // Cards de acción
  cardWrapper: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.border2,
    marginBottom: 10,
  },
  cardInner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 14,
  },
  iconCircleOuter: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: COLORS.goldBevel,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  iconCircleInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#05192E',
    justifyContent: 'center', alignItems: 'center',
  },
  cardText:  { flex: 1 },
  cardTitle: { color: COLORS.goldBevel, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  cardDesc:  { color: COLORS.subtext, fontSize: 12, lineHeight: 17 },

  // Info box aviso
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10, padding: 12, marginTop: 6,
  },
  infoText: { flex: 1, color: COLORS.subtext, fontSize: 12, lineHeight: 18 },

  // Tarjeta de info app
  infoCard: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: COLORS.border2,
    paddingHorizontal: 16,
  },
});
