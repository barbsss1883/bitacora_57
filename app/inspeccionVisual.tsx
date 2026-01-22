import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Alert, Modal, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// COMPONENTES Y BD
import FirmaDigital from '../src/components/FirmaDigital';
import { guardarInspeccion } from '../db/database';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#8b5cf6', // Morado para Inspección
  text: '#f8fafc', subtext: '#94a3b8', success: '#22c55e', danger: '#ef4444',
  border: '#334155', white: '#ffffff'
};

// --- ACTUALIZACIÓN NOM-006-SCT-2-2023 ---
const PUNTOS_REVISION = [
  // Grupo 1: Seguridad Crítica
  { id: 'frenos', label: '1. Frenos / Aire', icon: 'car-brake-abs' },
  { id: 'luces', label: '2. Luces / Faros', icon: 'car-light-high' },
  { id: 'llantas', label: '3. Llantas / Rines', icon: 'tire' },
  { id: 'direccion', label: '4. Dirección', icon: 'steering' },
  
  // Grupo 2: Visibilidad y Cabina
  { id: 'parabrisas', label: '5. Parabrisas', icon: 'wiper' },
  { id: 'espejos', label: '6. Espejos', icon: 'car-mirror' },
  { id: 'claxon', label: '7. Claxon', icon: 'bullhorn' },
  
  // Grupo 3: Motor y Fluidos
  { id: 'niveles', label: '8. Niveles (Aceite)', icon: 'oil' },
  { id: 'combustible', label: '9. Tanques Diesel', icon: 'gas-station' },
  { id: 'escape', label: '10. Sist. Escape', icon: 'smog' },
  
  // Grupo 4: Complementarios
  { id: 'acoplamiento', label: '11. 5ta Rueda', icon: 'link-variant' },
  { id: 'seguridad', label: '12. Extintor/Triang', icon: 'fire-extinguisher' },
  { id: 'documentos', label: '13. Documentos', icon: 'file-document-outline' },
];

export default function InspeccionVisual() {
  const router = useRouter();
  
  const [jornadaId, setJornadaId] = useState<number | null>(null);
  const [tipo, setTipo] = useState('inicio'); // 'inicio' (Salida) o 'fin' (Llegada)
  const [checklist, setChecklist] = useState<any>({});
  const [comentarios, setComentarios] = useState('');
  
  const [modalFirma, setModalFirma] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Verificar si hay una jornada activa para asociar la inspección
    const checkJornada = async () => {
        const id = await AsyncStorage.getItem('CURRENT_JORNADA_ID');
        if (id) {
            setJornadaId(Number(id));
        } else {
            Alert.alert("Atención", "No tienes un viaje activo. Esta inspección quedará registrada sin viaje asociado (Pruebas).");
            setJornadaId(0); // 0 indica sin viaje
        }
    };
    checkJornada();
  }, []);

  const togglePunto = (id: string) => {
    setChecklist((prev: any) => ({
        ...prev,
        [id]: !prev[id] // Invierte el valor (true/false)
    }));
  };

  const solicitarFirma = () => {
    // Validar que al menos haya revisado algo
    if (Object.keys(checklist).length === 0) {
        Alert.alert("Checklist Vacío", "Por favor marca los puntos revisados antes de firmar.");
        return;
    }
    setModalFirma(true);
  };

  const finalizarGuardado = async (firmaBase64: string) => {
    setModalFirma(false);
    setGuardando(true);

    try {
        await guardarInspeccion(
            jornadaId || 0,
            tipo === 'inicio' ? 'SALIDA (NOM-068)' : 'LLEGADA (NOM-068)',
            checklist,
            comentarios,
            firmaBase64
        );
        Alert.alert("¡Inspección Guardada!", "Tu revisión ha sido registrada correctamente.");
        router.back();
    } catch (error) {
        console.error(error);
        Alert.alert("Error", "No se pudo guardar la inspección.");
    } finally {
        setGuardando(false);
    }
  };

  if (guardando) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INSPECCIÓN 360°</Text>
        <MaterialCommunityIcons name="clipboard-check" size={24} color={COLORS.primary} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* TIPO DE INSPECCIÓN */}
        <View style={styles.selectorContainer}>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'inicio' && {backgroundColor: COLORS.primary}]} 
                onPress={() => setTipo('inicio')}
            >
                <Text style={[styles.selectorText, tipo === 'inicio' && {fontWeight:'bold', color:'white'}]}>SALIDA</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.selectorBtn, tipo === 'fin' && {backgroundColor: COLORS.primary}]} 
                onPress={() => setTipo('fin')}
            >
                <Text style={[styles.selectorText, tipo === 'fin' && {fontWeight:'bold', color:'white'}]}>LLEGADA</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.instruction}>Marca los puntos que están en BUEN estado:</Text>

        {/* GRID DE CHECKLIST ACTUALIZADO */}
        <View style={styles.grid}>
            {PUNTOS_REVISION.map((item) => {
                const isChecked = checklist[item.id] === true;
                return (
                    <TouchableOpacity 
                        key={item.id} 
                        style={[styles.checkItem, isChecked && {borderColor: COLORS.success, backgroundColor: 'rgba(34, 197, 94, 0.1)'}]}
                        onPress={() => togglePunto(item.id)}
                    >
                        <MaterialCommunityIcons 
                            name={isChecked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                            size={24} 
                            color={isChecked ? COLORS.success : COLORS.subtext} 
                        />
                        <MaterialCommunityIcons name={item.icon as any} size={30} color={COLORS.white} style={{marginVertical:10}} />
                        <Text style={styles.checkLabel}>{item.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>

        {/* COMENTARIOS */}
        <View style={styles.commentBox}>
            <Text style={styles.label}>Observaciones / Daños encontrados:</Text>
            <TextInput 
                style={styles.input} 
                multiline 
                placeholder="Ej: Golpe en defensa trasera, llanta baja..." 
                placeholderTextColor="#666"
                value={comentarios}
                onChangeText={setComentarios}
            />
        </View>

        {/* BOTÓN GUARDAR */}
        <TouchableOpacity style={styles.saveBtn} onPress={solicitarFirma}>
            <Text style={styles.saveBtnText}>FIRMAR Y GUARDAR</Text>
            <MaterialCommunityIcons name="draw" size={20} color="white" />
        </TouchableOpacity>

      </ScrollView>

      {/* MODAL DE FIRMA */}
      <Modal visible={modalFirma} animationType="slide">
          <View style={{flex:1, backgroundColor: COLORS.bg}}>
              <FirmaDigital onOK={finalizarGuardado} onCancel={() => setModalFirma(false)} />
          </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.card, borderBottomWidth:1, borderBottomColor: COLORS.border
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },

  selectorContainer: {
    flexDirection: 'row', backgroundColor: COLORS.card, margin: 20, borderRadius: 10, padding: 5,
    borderWidth: 1, borderColor: COLORS.border
  },
  selectorBtn: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 8 },
  selectorText: { color: COLORS.subtext },

  instruction: { color: COLORS.subtext, marginLeft: 20, marginBottom: 10, fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15 },
  checkItem: {
    width: '47%', aspectRatio: 1, backgroundColor: COLORS.card, margin: '1.5%', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent'
  },
  checkLabel: { color: COLORS.text, fontSize: 12, fontWeight: 'bold', marginTop: 5 },

  commentBox: { margin: 20 },
  label: { color: COLORS.text, marginBottom: 8, fontWeight:'bold' },
  input: { 
    backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 10, padding: 15, height: 100, 
    textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border 
  },

  saveBtn: {
    backgroundColor: COLORS.primary, margin: 20, padding: 18, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    elevation: 5
  },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});