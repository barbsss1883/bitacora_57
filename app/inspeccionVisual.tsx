import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Alert, Modal, Platform, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import FirmaDigital from '../src/components/FirmaDigital';
import { guardarInspeccion } from '../db/database';
// ✅ CAMBIADO: PdfReporteCompleto → PdfMaestro
import { generarPdfMaestro } from '../src/services/PdfMaestro';

const COLORS = {
  bg: '#010A14',
  card: '#051C33',
  textGold: '#C5A059', 
  textWelcome: '#9DA8B5', 
  goldBevel: '#D4AF37', 
  white: '#FFFFFF',
  success: '#10b981',
  danger: '#ef4444', 
  border: '#2A4A69',
  skeleton: '#081D33'
};

const GRADIENTS = {
  cardRed: ['#450A0A', '#2D0606', '#010A14'], 
  cardGreen: ['#065F46', '#064E3B', '#022C22'], 
  goldBtn: ['#D4AF37', '#C5A059', '#8A6E2F'],
  header: ['#051C33', '#010A14'],
};

const PUNTOS_REVISION = [
  { id: 'frenos', label: 'Sistema Frenos / Aire', icon: 'car-brake-fluid' },
  { id: 'llantas', label: 'Llantas / Rines / Birlos', icon: 'tire' },
  { id: 'quintaRueda', label: '5ta Rueda / Seguros', icon: 'link-variant' },
  { id: 'direccion', label: 'Caja Dirección / Barras', icon: 'steering' },
  { id: 'suspension', label: 'Suspensión / Muelles', icon: 'car-shift-pattern' },
  { id: 'combustible', label: 'Tanques Diesel / Fugas', icon: 'gas-station' },
  { id: 'escape', label: 'Mofle / Sist. Escape', icon: 'smog' },
  { id: 'luces', label: 'Luces Exteriores / Gálibo', icon: 'car-light-high' },
  { id: 'parabrisas', label: 'Parabrisas / Limpiadores', icon: 'wiper' },
  { id: 'espejos', label: 'Espejos Retrovisores', icon: 'car-mirror' },
  { id: 'emergencia', label: 'Extintor / Triángulos', icon: 'fire-extinguisher' },
  { id: 'documentos', label: 'Documentación Oficial', icon: 'file-document-outline' },
];

export default function InspeccionVisual() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true); 
  const [jornadaId, setJornadaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState('inicio'); 
  
  const [checklist, setChecklist] = useState<any>(() => {
    return PUNTOS_REVISION.reduce((acc, item) => ({ ...acc, [item.label]: false }), {});
  });

  const [comentarios, setComentarios] = useState('');
  const [modalFirma, setModalFirma] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTimeout(() => setCargando(false), 800);
    const checkJornada = async () => {
        const id = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        if (id) setJornadaId(Number(id));
    };
    checkJornada();
  }, []);

  const togglePunto = (label: string) => {
    setChecklist((prev: any) => ({ ...prev, [label]: !prev[label] }));
  };

  const solicitarFirma = () => {
    const fallas = Object.values(checklist).filter(v => v === false).length;
    
    if (fallas > 0) {
      Alert.alert(
        "Puntos en Rojo", 
        `Tienes ${fallas} puntos marcados como FALLA.\n\nSegún la NOM-068, el camión podría considerarse fuera de servicio. ¿Deseas continuar con el reporte de daños?`,
        [
          { text: "Revisar más", style: 'cancel' },
          { text: "Sí, Reportar Daños", onPress: () => setModalFirma(true) }
        ]
      );
    } else {
      setModalFirma(true);
    }
  };

  const finalizarGuardado = async (firmaBase64: string) => {
    setModalFirma(false);
    setGuardando(true);
    try {
        const hoy = new Date().toLocaleDateString('en-CA');

        const inspeccionId = await guardarInspeccion(
            jornadaId || 0,
            tipo === 'inicio' ? 'SALIDA (NOM-068)' : 'LLEGADA (NOM-068)',
            checklist,
            comentarios,
            firmaBase64
        );

        await AsyncStorage.setItem('ULTIMA_INSPECCION', hoy);

        Alert.alert(
          "Reporte Certificado",
          "La inspección oficial ha sido guardada y está lista para exportarse en PDF."
        );

        // ✅ CAMBIADO: generarReporteCompleto(inspeccionId, jornadaId)
        //             → generarPdfMaestro({ jornadaId, inspeccionId })
        // El PDF Maestro incluye NOM-068 + ELD + GPS + firma + QR + SHA-256.
        // Solo se genera si hay jornadaId; si la inspección es libre (sin jornada)
        // no se genera PDF automático (se puede hacer desde HistorialInspecciones).
        if (inspeccionId && jornadaId) {
          generarPdfMaestro({ jornadaId, inspeccionId });
        }

        router.replace('/home'); 

    } catch (error) {
        Alert.alert("Error", "No se pudo guardar la inspección.");
    } finally {
        setGuardando(false);
    }
  };

  if (cargando) {
      return <View style={styles.container}><ActivityIndicator size="large" color={COLORS.goldBevel} style={{flex:1}} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={GRADIENTS.header} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={32} color={COLORS.goldBevel} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INSPECCIÓN NOM-068</Text>
        <View style={{width:40}} /> 
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.selectorWrapper}>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'inicio' && styles.selectorActive]} 
                onPress={() => setTipo('inicio')}
            >
                <Text style={[styles.selectorText, tipo === 'inicio' && styles.textActive]}>SALIDA</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'fin' && styles.selectorActive]} 
                onPress={() => setTipo('fin')}
            >
                <Text style={[styles.selectorText, tipo === 'fin' && styles.textActive]}>LLEGADA</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>PUNTOS DE REVISIÓN OFICIAL (ROJO = FALLA | VERDE = OK)</Text>

        <View style={styles.grid}>
            {PUNTOS_REVISION.map((item) => {
                const isOk = checklist[item.label] === true;
                return (
                    <TouchableOpacity 
                        key={item.id} 
                        style={styles.cardWrapper}
                        onPress={() => togglePunto(item.label)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient 
                            colors={isOk ? GRADIENTS.cardGreen : GRADIENTS.cardRed} 
                            style={[styles.cardInner, {borderColor: isOk ? COLORS.success : COLORS.danger}]}
                        >
                            <View style={[styles.iconCircle, {borderColor: isOk ? COLORS.success : COLORS.danger}]}>
                                <MaterialCommunityIcons 
                                    name={item.icon as any} 
                                    size={28} 
                                    color={isOk ? COLORS.success : COLORS.danger} 
                                />
                            </View>
                            <Text style={[styles.cardTitle, {color: COLORS.white}]}>{item.label}</Text>
                            
                            <MaterialCommunityIcons 
                                name={isOk ? "check-circle" : "alert-circle"} 
                                size={20} 
                                color={isOk ? COLORS.success : COLORS.danger} 
                                style={styles.checkBadge}
                            />
                        </LinearGradient>
                    </TouchableOpacity>
                );
            })}
        </View>

        <View style={styles.commentContainer}>
            <Text style={styles.label}>OBSERVACIONES FÍSICO-MECÁNICAS:</Text>
            <TextInput 
                style={styles.input} 
                multiline 
                placeholder="Detalla llantas bajas, mangueras rozando, luces fundidas..." 
                placeholderTextColor="#475569"
                value={comentarios}
                onChangeText={setComentarios}
            />
        </View>

        <TouchableOpacity style={styles.saveBtnWrapper} onPress={solicitarFirma} disabled={guardando}>
            <LinearGradient colors={GRADIENTS.goldBtn} style={styles.saveBtnInner}>
                <Text style={styles.saveBtnText}>CERTIFICAR REPORTE</Text>
                <MaterialCommunityIcons name="fountain-pen-tip" size={22} color={COLORS.bg} />
            </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={modalFirma} animationType="slide">
          <View style={{flex:1, backgroundColor: COLORS.bg}}>
              <FirmaDigital onOK={finalizarGuardado} onCancel={() => setModalFirma(false)} />
          </View>
      </Modal>

      {guardando && (
          <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.goldBevel} />
              <Text style={styles.loadingText}>GENERANDO REPORTE...</Text>
          </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingHorizontal: 15, paddingBottom: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textGold, letterSpacing: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 15, paddingBottom: 50 },
  selectorWrapper: { flexDirection: 'row', backgroundColor: '#031426', borderRadius: 12, padding: 6, borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 20 },
  selectorBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  selectorActive: { backgroundColor: COLORS.goldBevel },
  selectorText: { color: COLORS.textWelcome, fontWeight: 'bold', fontSize: 13 },
  textActive: { color: COLORS.bg },
  sectionLabel: { color: COLORS.textWelcome, fontSize: 10, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardWrapper: { width: '48%', aspectRatio: 1.05, marginBottom: 15 },
  cardInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 2 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 8, backgroundColor: '#010A14' },
  cardTitle: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 5 },
  checkBadge: { position: 'absolute', top: 10, right: 10 },
  commentContainer: { marginTop: 10, marginBottom: 20 },
  label: { color: COLORS.textGold, fontSize: 12, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
  input: { backgroundColor: '#031426', color: COLORS.white, borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top', borderWidth: 1.5, borderColor: COLORS.border },
  saveBtnWrapper: { borderRadius: 15, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  saveBtnInner: { paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  saveBtnText: { color: COLORS.bg, fontWeight: '900', fontSize: 16 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1, 10, 20, 0.9)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.goldBevel, fontWeight: 'bold', marginTop: 15 }
});
