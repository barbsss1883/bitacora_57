import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Alert, Modal, Animated
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FirmaDigital from '../src/components/FirmaDigital';
import { guardarInspeccion } from '../db/database';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', // Naranja Bitácora
  text: '#f8fafc', subtext: '#94a3b8', success: '#10b981', danger: '#ef4444',
  border: '#334155', white: '#ffffff', skeleton: '#334155'
};

const Skeleton = ({ width, height, style }: any) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ opacity, width, height, backgroundColor: COLORS.skeleton, borderRadius: 6 }, style]} />;
};

const PUNTOS_REVISION = [
  { id: 'frenos', label: '1. Frenos / Aire', icon: 'car-brake-abs' },
  { id: 'luces', label: '2. Luces / Faros', icon: 'car-light-high' },
  { id: 'llantas', label: '3. Llantas / Rines', icon: 'tire' },
  { id: 'direccion', label: '4. Dirección', icon: 'steering' },
  { id: 'parabrisas', label: '5. Parabrisas', icon: 'wiper' },
  { id: 'espejos', label: '6. Espejos', icon: 'car-mirror' },
  { id: 'claxon', label: '7. Claxon', icon: 'bullhorn' },
  { id: 'niveles', label: '8. Niveles (Aceite)', icon: 'oil' },
  { id: 'combustible', label: '9. Tanques Diesel', icon: 'gas-station' },
  { id: 'escape', label: '10. Sist. Escape', icon: 'smog' },
  { id: 'acoplamiento', label: '11. 5ta Rueda', icon: 'link-variant' },
  { id: 'seguridad', label: '12. Extintor/Triang', icon: 'fire-extinguisher' },
  { id: 'documentos', label: '13. Documentos', icon: 'file-document-outline' },
];

export default function InspeccionVisual() {
  const router = useRouter();

  const [cargando, setCargando] = useState(true); 
  const [jornadaId, setJornadaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState('inicio'); 
  const [checklist, setChecklist] = useState<any>({});
  const [comentarios, setComentarios] = useState('');

  const [modalFirma, setModalFirma] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTimeout(() => setCargando(false), 600);

    const checkJornada = async () => {
        const id = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        if (id) setJornadaId(Number(id));
        else setJornadaId(0); 
    };
    checkJornada();
  }, []);

  const togglePunto = (id: string) => {
    setChecklist((prev: any) => ({ ...prev, [id]: !prev[id] }));
  };

  const solicitarFirma = () => {
    // Validación rápida
    if (Object.keys(checklist).length < 5) { // Al menos 5 puntos
        Alert.alert("Inspección Incompleta", "Por favor verifica los puntos críticos.");
        return;
    }
    setModalFirma(true);
  };

  const finalizarGuardado = async (firmaBase64: string) => {
    setModalFirma(false);
    setGuardando(true); // Bloqueo UI sutil

    try {
        const hoy = new Date().toISOString().split('T')[0];
        const hora = new Date().toLocaleTimeString();

        await guardarInspeccion(
            jornadaId || 0,
            tipo === 'inicio' ? 'SALIDA (NOM-068)' : 'LLEGADA (NOM-068)',
            checklist,
            comentarios,
            firmaBase64
        );

        await AsyncStorage.setItem('ULTIMA_INSPECCION', hoy);

        const datosParaPDF = {
            fecha: hoy, hora: hora, tipo: tipo,
            items: checklist, // {frenos: true, ...}
            comentarios: comentarios,
            estatus: comentarios.length > 5 ? 'CON OBSERVACIONES' : 'APROBADO'
        };
        await AsyncStorage.setItem(`INSPECCION_${hoy}`, JSON.stringify(datosParaPDF));

        Alert.alert("Inspección Registrada", "Unidad validada correctamente.");
        router.back();

    } catch (error) {
        Alert.alert("Error", "Intenta de nuevo.");
    } finally {
        setGuardando(false);
    }
  };

  if (cargando) {
      return (
        <View style={styles.container}>
            <View style={{padding:20, paddingTop:60}}>
                <Skeleton width={200} height={30} style={{marginBottom:20}} />
                <View style={{flexDirection:'row', gap:10, marginBottom:20}}>
                    <Skeleton width="48%" height={50} />
                    <Skeleton width="48%" height={50} />
                </View>
                <View style={{flexDirection:'row', flexWrap:'wrap', gap:10}}>
                    {[1,2,3,4,5,6].map(i => <Skeleton key={i} width="48%" height={100} style={{marginBottom:10}} />)}
                </View>
            </View>
        </View>
      );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{padding:5}}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INSPECCIÓN 360°</Text>
        <View style={{width:30}} /> 
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.selectorContainer}>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'inicio' && {backgroundColor: COLORS.primary}]} 
                onPress={() => setTipo('inicio')}
            >
                <Text style={[styles.selectorText, tipo === 'inicio' && {fontWeight:'bold', color: COLORS.bg}]}>SALIDA</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'fin' && {backgroundColor: COLORS.primary}]} 
                onPress={() => setTipo('fin')}
            >
                <Text style={[styles.selectorText, tipo === 'fin' && {fontWeight:'bold', color: COLORS.bg}]}>LLEGADA</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>Verifica el estado físico de la unidad:</Text>

        {/* GRID DE CHECKLIST */}
        <View style={styles.grid}>
            {PUNTOS_REVISION.map((item) => {
                const isChecked = checklist[item.id] === true;
                return (
                    <TouchableOpacity 
                        key={item.id} 
                        style={[styles.checkItem, isChecked && styles.checkItemActive]}
                        onPress={() => togglePunto(item.id)}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons 
                            name={isChecked ? "check-circle" : "checkbox-blank-circle-outline"} 
                            size={24} 
                            color={isChecked ? COLORS.success : COLORS.subtext} 
                            style={{position:'absolute', top:8, right:8}}
                        />
                        <MaterialCommunityIcons name={item.icon as any} size={32} color={isChecked ? COLORS.white : COLORS.subtext} style={{marginBottom:8}} />
                        <Text style={[styles.checkLabel, isChecked && {color: COLORS.white}]}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>

        <View style={styles.commentBox}>
            <Text style={styles.label}>Observaciones / Daños:</Text>
            <TextInput 
                style={styles.input} 
                multiline 
                placeholder="Ej: Golpe en defensa trasera, llanta baja..." 
                placeholderTextColor="#666"
                value={comentarios}
                onChangeText={setComentarios}
            />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={solicitarFirma}>
            <Text style={styles.saveBtnText}>{guardando ? "GUARDANDO..." : "FIRMAR Y GUARDAR"}</Text>
            {!guardando && <MaterialCommunityIcons name="draw" size={20} color={COLORS.bg} />}
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={modalFirma} animationType="slide">
          <View style={{flex:1, backgroundColor: COLORS.bg}}>
              <FirmaDigital onOK={finalizarGuardado} onCancel={() => setModalFirma(false)} />
          </View>
      </Modal>

      {guardando && (
          <View style={StyleSheet.absoluteFillObject}>
              <View style={{flex:1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center'}}>
                  <Text style={{color: COLORS.primary, fontWeight:'bold', marginTop:10}}>ENCRIPTANDO REPORTE...</Text>
              </View>
          </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },

  selectorContainer: {
    flexDirection: 'row', backgroundColor: COLORS.card, margin: 20, borderRadius: 10, padding: 5,
    borderWidth: 1, borderColor: COLORS.border
  },
  selectorBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  selectorText: { color: COLORS.subtext },

  instruction: { color: COLORS.subtext, marginLeft: 20, marginBottom: 10, fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, justifyContent: 'space-between' },
  checkItem: {
    width: '48%', aspectRatio: 1, backgroundColor: COLORS.card, marginBottom: 15, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent'
  },
  checkItemActive: { borderColor: COLORS.success, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  checkLabel: { color: COLORS.subtext, fontSize: 12, fontWeight: 'bold', marginTop: 5, textAlign: 'center' },

  commentBox: { margin: 20 },
  label: { color: COLORS.text, marginBottom: 8, fontWeight:'bold' },
  input: { 
    backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 10, padding: 15, height: 100, 
    textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border 
  },

  saveBtn: {
    backgroundColor: COLORS.primary, margin: 20, padding: 18, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10
  },
  saveBtnText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 }
});