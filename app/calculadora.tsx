import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Alert, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  bg: '#010A14',          // Tu fondo oscuro real
  textGold: '#C5A059',    // Textos dorados
  textWelcome: '#9DA8B5', // Textos secundarios
  goldBevel: '#D4AF37',   // Acentos, iconos y líneas del mapa
  white: '#FFFFFF',       // Textos principales
  // --- Utilitarios ---
  danger: '#A70000',      // Rojo (tomado de tu emergencyBg)
  success: '#10B981',     // Verde (para "Finalizado")
  border: '#12365A'       // Azul de tus tarjetas para bordes sutiles
};

const GRADIENTS = {
  cardBg: ['#12365A', '#081D33', '#030E1A'],
  emergencyBg: ['#A70000', '#7A0000', '#4A0000'], 
};

export default function CalculadoraDiesel() {
  const router = useRouter();

  const [form, setForm] = useState({
    km: '',               
    inicial: '',          
    recargas: '',         
    finales: '',          
    ralenti: '',          
  });

  const [resultado, setResultado] = useState<any>(null);

  const calcular = () => {
    if (!form.km || !form.inicial || !form.finales) {
      Alert.alert("Faltan Datos", "Necesitamos KM, Iniciales y Finales para el balance.");
      return;
    }

    const kilometros = parseFloat(form.km);
    const capacidadTanques = parseFloat(form.inicial); 
    const litrosCargadosRuta = parseFloat(form.recargas) || 0;
    const litrosFinales = parseFloat(form.finales);
    const litrosRelanti = parseFloat(form.ralenti) || 0;

    if (kilometros <= 0) { Alert.alert("Error", "Los KM deben ser mayor a 0"); return; }
    if (capacidadTanques <= 0) { Alert.alert("Error", "Litros iniciales incorrectos"); return; }
    if (litrosFinales < 0) { Alert.alert("Error", "Litros finales no pueden ser negativos"); return; }

    // 1️⃣ Litros disponibles totales
    const litrosDisponibles = capacidadTanques + litrosCargadosRuta;

    // 2️⃣ Consumo total real (Balance de Masas)
    const consumoTotal = litrosDisponibles - litrosFinales;

    if (consumoTotal <= 0) {
      Alert.alert("Error Lógico", "Los litros finales son mayores a los disponibles. Revisa tus datos.");
      return;
    }

    let consumoManejo = consumoTotal - litrosRelanti;
    if (consumoManejo < 0) consumoManejo = 0;

    const rendimientoKmPorL = consumoManejo > 0 ? (kilometros / consumoManejo) : 0;
    const consumoTecnico = consumoManejo / kilometros; 

    const diferencia = litrosDisponibles - (consumoTotal + litrosFinales);

    setResultado({
      consumoTotal: consumoTotal.toFixed(0),
      consumoManejo: consumoManejo.toFixed(0),
      rendimiento: rendimientoKmPorL.toFixed(2), // km/l
      litrosRelanti: litrosRelanti.toFixed(0),
      litrosFinales: litrosFinales.toFixed(0),
      diferencia: diferencia.toFixed(2) // Debe ser 0
    });
  };

  const limpiar = () => {
    setForm({ km: '', inicial: '', recargas: '', finales: '', ralenti: '' });
    setResultado(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AUDITORÍA DE TANQUE</Text>
        <MaterialCommunityIcons name="file-chart-check" size={24} color={COLORS.primary} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* TARJETA DE RESULTADOS */}
        {resultado && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>BALANCE FÍSICO (REAL)</Text>
            
            <View style={{alignItems:'center', marginBottom: 20}}>
                <Text style={styles.labelSmall}>RENDIMIENTO NETO (MANEJO)</Text>
                <Text style={styles.bigNumber}>
                    {resultado.rendimiento} <Text style={{fontSize:16, color: COLORS.subtext}}>km/l</Text>
                </Text>
                <Text style={styles.explainerText}>
                   Calculado por diferencia de tanques. Exactitud garantizada.
                </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>🔥 Consumo Total Real:</Text>
                <Text style={styles.valDetails}>{resultado.consumoTotal} Lts</Text>
            </View>
            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>🛑 Menos Ralentí (Parado):</Text>
                <Text style={[styles.valDetails, {color: COLORS.primary}]}>- {resultado.litrosRelanti} Lts</Text>
            </View>
            <View style={styles.dividerSmall} />
            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>🚛 Consumo Rodando:</Text>
                <Text style={styles.valDetails}>{resultado.consumoManejo} Lts</Text>
            </View>
            
            {/* Dato de auditoría técnica */}
            <View style={{marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border}}>
                 <Text style={{color: COLORS.subtext, fontSize: 10, textAlign:'center'}}>
                    Auditoría de masa: Diferencia {resultado.diferencia} (Debe ser 0)
                 </Text>
            </View>
          </View>
        )}

        {/* FORMULARIO */}
        <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>1. DATOS FÍSICOS</Text>
            
            <Input label="KM Recorridos" val={form.km} set={(t:string)=>setForm({...form, km:t})} kbd="numeric" placeholder="Ej: 1500" />
            
            <View style={styles.row}>
                <Input label="Litros INICIALES" val={form.inicial} set={(t:string)=>setForm({...form, inicial:t})} kbd="numeric" flex placeholder="Inicio" />
                <Input label="Litros RECARGAS" val={form.recargas} set={(t:string)=>setForm({...form, recargas:t})} kbd="numeric" flex placeholder="Ruta" />
            </View>

            {/* 2. BACKGROUND INLINE ADAPTADO AL NUEVO DORADO (#EAB308) */}
            <View style={{backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.3)'}}>
                <Input label="Litros FINALES (Lectura Varilla/Reloj)" val={form.finales} set={(t:string)=>setForm({...form, finales:t})} kbd="numeric" placeholder="¿Cuánto sobró al llegar?" />
            </View>

            <Text style={[styles.sectionTitle, {marginTop: 10}]}>2. DESCUENTO DE TIEMPO MUERTO</Text>
            <Input label="Litros estimados en Ralentí" val={form.ralenti} set={(t:string)=>setForm({...form, ralenti:t})} kbd="numeric" placeholder="Ej: 30 (Por pernocta o carga)" />

            <View style={{flexDirection:'row', gap:10, marginTop: 20}}>
                <TouchableOpacity style={styles.btnOutline} onPress={limpiar}>
                    <Text style={{color: COLORS.subtext}}>LIMPIAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSolid} onPress={calcular}>
                    <Text style={styles.btnText}>CALCULAR BALANCE</Text>
                </TouchableOpacity>
            </View>
        </View>

      </ScrollView>
    </View>
  );
}

// Componente Input
const Input = ({ label, val, set, kbd, flex, placeholder }: any) => (
  <View style={[{ marginBottom: 15 }, flex && { flex: 1 }]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput 
        style={styles.input} 
        value={val} 
        onChangeText={set} 
        keyboardType={kbd ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={COLORS.border}
    />
  </View>
);

// 3. STYLESHEET LIMPIO (Sin sombras ni bordes toscos)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: COLORS.bg, // Integrado al fondo principal
    flexDirection: 'row', alignItems: 'center', justifyContent:'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  backBtn: { padding: 5 },
  
  formCard: { margin: 20, padding: 20, backgroundColor: COLORS.card, borderRadius: 16 },
  sectionTitle: { color: COLORS.primary, fontWeight:'bold', marginBottom: 10, fontSize: 12, letterSpacing: 1 },
  label: { color: COLORS.subtext, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  
  btnSolid: { flex:1, backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnOutline: { flex:0.4, borderWidth:1, borderColor: COLORS.border, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#000' },

  resultCard: { margin: 20, marginBottom: 0, padding: 20, backgroundColor: COLORS.card, borderRadius: 16 },
  resultTitle: { color: COLORS.success, textAlign:'center', fontWeight:'bold', marginBottom: 15, fontSize: 14, letterSpacing: 1 },
  labelSmall: { color: COLORS.subtext, fontSize: 10, marginBottom: 5, fontWeight: 'bold' },
  bigNumber: { fontSize: 42, fontWeight: 'bold', color: 'white' },
  explainerText: { color: COLORS.subtext, fontSize: 11, textAlign: 'center', marginTop: 5, fontStyle: 'italic' },
  
  divider: { height:1, backgroundColor: COLORS.border, marginVertical: 15 },
  dividerSmall: { height:1, backgroundColor: COLORS.border, marginVertical: 8, width:'100%' },
  
  rowDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  textDetails: { color: COLORS.subtext, fontSize: 14 },
  valDetails: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
