import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, StatusBar, Alert, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0f172a', 
  card: '#1e293b', 
  primary: '#f59e0b', 
  text: '#f8fafc', 
  subtext: '#94a3b8', 
  success: '#22c55e', 
  danger: '#ef4444', 
  border: '#334155'
};

export default function CalculadoraDiesel() {
  const router = useRouter();

  // Estados del Formulario
  const [form, setForm] = useState({
    empresa: '',
    operador: '',
    unidad: '',
    origen: '',
    destino: '',
    km: '',          // Kilómetros recorridos
    promedio: '',    // Tu factor meta (ej: 1.75 km/l)
    ralenti: '',     // LITROS consumidos en ralentí (parado)
    inicial: '',     // Litros Salida
    recargas: '',    // Litros Ruta
  });

  const [resultado, setResultado] = useState<any>(null);

  const calcular = () => {
    // 1. Validaciones
    if (!form.km || !form.promedio || !form.inicial) {
      Alert.alert("Faltan Datos", "Ingresa KM, Rendimiento Meta y Litros Iniciales.");
      return;
    }

    // 2. Convertir a números
    const km = parseFloat(form.km);
    const meta = parseFloat(form.promedio); // Ej: 1.75
    const ltsRalenti = parseFloat(form.ralenti) || 0; // Litros quemados parado
    
    const ltsInicial = parseFloat(form.inicial);
    const ltsRecarga = parseFloat(form.recargas) || 0;

    // ---------------------------------------------------------
    // TU LÓGICA EXACTA
    // ---------------------------------------------------------

    // A. ¿Cuánto DIESEL REAL se "comió" el camión? (Lo que le echaron)
    const litrosRealesTotales = ltsInicial + ltsRecarga;

    // B. ¿Cuánto DIESEL debió gastar MANEJANDO? (Según la meta de 1.75)
    // Usamos división porque 2485 / 1.75 = 1420 (Tu ejemplo)
    const litrosTeoricosManejo = km / meta; 

    // C. ¿Cuánto DIESEL debió gastar EN TOTAL (Manejo + Ralentí)?
    const litrosTeoricosTotales = litrosTeoricosManejo + ltsRalenti;

    // D. DIFERENCIA (Balance)
    // Si Litros Reales (lo que echaron) es MENOR a lo Teórico = AHORRO
    // Si Litros Reales es MAYOR a lo Teórico = FALTANTE
    const diferenciaLitros = litrosRealesTotales - litrosTeoricosTotales;
    
    // E. Rendimiento REAL Global (incluyendo ralentí)
    const rendimientoRealGlobal = km / litrosRealesTotales;

    // Dinero (Estimado a $24.50 MXN)
    const costoExtra = diferenciaLitros * 24.50; 

    setResultado({
      real: rendimientoRealGlobal.toFixed(2),
      meta: meta.toFixed(2),
      
      // Desglose de Litros
      litrosReales: litrosRealesTotales.toFixed(0),
      litrosManejo: litrosTeoricosManejo.toFixed(0),
      litrosRalenti: ltsRalenti.toFixed(0),
      litrosPermitidos: litrosTeoricosTotales.toFixed(0), // Manejo + Ralentí
      
      diferencia: diferenciaLitros.toFixed(1),
      esBueno: diferenciaLitros <= 0, // Si es negativo o 0, sobró diesel (Bueno)
      costo: Math.abs(costoExtra).toFixed(2)
    });
  };

  const limpiar = () => {
    setForm({ ...form, km: '', inicial: '', recargas: '', ralenti: '' });
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
        <Text style={styles.headerTitle}>BALANCE DE COMBUSTIBLE</Text>
        <MaterialCommunityIcons name="fuel" size={24} color={COLORS.primary} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* TARJETA DE RESULTADOS */}
        {resultado && (
          <View style={[styles.resultCard, { borderColor: resultado.esBueno ? COLORS.success : COLORS.danger }]}>
            <Text style={styles.resultTitle}>BALANCE FINAL</Text>
            
            <View style={styles.rowBetween}>
                <View style={{alignItems:'center'}}>
                    <Text style={styles.labelSmall}>RENDIMIENTO REAL</Text>
                    <Text style={[styles.bigNumber, {color: resultado.esBueno ? COLORS.success : COLORS.danger}]}>
                        {resultado.real} <Text style={{fontSize:14}}>km/l</Text>
                    </Text>
                </View>
                <View style={{width:1, backgroundColor:'#555', height:40}} />
                <View style={{alignItems:'center'}}>
                    <Text style={styles.labelSmall}>META (MANEJO)</Text>
                    <Text style={[styles.bigNumber, {color: COLORS.subtext}]}>
                        {resultado.meta} <Text style={{fontSize:14}}>km/l</Text>
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            {/* DESGLOSE LÓGICO */}
            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>⛽ Litros Cargados (Real):</Text>
                <Text style={styles.valDetails}>{resultado.litrosReales}</Text>
            </View>
            
            <View style={styles.dividerSmall} />
            
            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>🚛 Litros p/Manejo ({resultado.meta}):</Text>
                <Text style={styles.valDetails}>{resultado.litrosManejo}</Text>
            </View>
            <View style={styles.rowDetails}>
                <Text style={styles.textDetails}>🛑 Litros p/Ralentí (Motor):</Text>
                <Text style={styles.valDetails}>+ {resultado.litrosRalenti}</Text>
            </View>
            <View style={styles.rowDetails}>
                <Text style={[styles.textDetails, {color: COLORS.primary}]}>✅ Total Permitido:</Text>
                <Text style={[styles.valDetails, {color: COLORS.primary}]}>{resultado.litrosPermitidos}</Text>
            </View>

            {/* ALERTA FINAL */}
            <View style={[styles.alertBox, {backgroundColor: resultado.esBueno ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}]}>
                <MaterialCommunityIcons name={resultado.esBueno ? "check-circle" : "alert-circle"} size={30} color={resultado.esBueno ? COLORS.success : COLORS.danger} />
                <View style={{marginLeft:10, flex:1}}>
                    <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>
                        {resultado.esBueno ? "¡A FAVOR! (SOBRANTE)" : "¡EN CONTRA! (FALTANTE)"}
                    </Text>
                    <Text style={{color:'white', fontSize:12, marginTop:2}}>
                        {resultado.esBueno 
                            ? `Eficiencia: Ahorraste ${Math.abs(resultado.diferencia)} litros.` 
                            : `Faltan ${resultado.diferencia} litros (aprox $${resultado.costo} MXN)`}
                    </Text>
                </View>
            </View>
          </View>
        )}

        {/* FORMULARIO */}
        <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>1. DATOS DE OPERACIÓN</Text>
            <View style={styles.row}>
                <Input label="KM Recorridos" val={form.km} set={(t:string)=>setForm({...form, km:t})} kbd="numeric" flex placeholder="Ej: 2485" />
                <Input label="Meta (km/l)" val={form.promedio} set={(t:string)=>setForm({...form, promedio:t})} kbd="numeric" flex placeholder="Ej: 1.75" />
            </View>
            
            {/* AQUÍ ESTÁ EL CAMPO NUEVO DE RALENTÍ */}
            <Input label="Litros en Ralentí (Tiempo muerto)" val={form.ralenti} set={(t:string)=>setForm({...form, ralenti:t})} kbd="numeric" placeholder="Ej: 50 (Litros quemados parado)" />

            <Text style={styles.sectionTitle}>2. CARGAS DE COMBUSTIBLE</Text>
            <View style={styles.row}>
                <Input label="Inicial (Salida)" val={form.inicial} set={(t:string)=>setForm({...form, inicial:t})} kbd="numeric" flex placeholder="Litros" />
                <Input label="Recargas (Ruta)" val={form.recargas} set={(t:string)=>setForm({...form, recargas:t})} kbd="numeric" flex placeholder="Litros" />
            </View>

            <View style={{flexDirection:'row', gap:10, marginTop:20}}>
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

// Componente Input Reutilizable
const Input = ({ label, val, set, kbd, flex, placeholder }: any) => (
  <View style={[{ marginBottom: 12 }, flex && { flex: 1 }]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput 
        style={styles.input} 
        value={val} 
        onChangeText={set} 
        keyboardType={kbd ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor="#555"
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: COLORS.card,
    flexDirection: 'row', alignItems: 'center', justifyContent:'space-between',
    elevation: 5
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  backBtn: { padding: 5 },
  
  formCard: { margin: 20, padding: 20, backgroundColor: COLORS.card, borderRadius: 16 },
  sectionTitle: { color: COLORS.primary, fontWeight:'bold', marginTop: 10, marginBottom: 10, fontSize: 12, letterSpacing: 1 },
  label: { color: COLORS.subtext, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  
  btnSolid: { flex:1, backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnOutline: { flex:0.4, borderWidth:1, borderColor: COLORS.border, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#000' },

  // RESULTADOS
  resultCard: { margin: 20, marginBottom: 0, padding: 20, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 2 },
  resultTitle: { color: 'white', textAlign:'center', fontWeight:'bold', marginBottom: 15, fontSize: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelSmall: { color: COLORS.subtext, fontSize: 10, marginBottom: 5 },
  bigNumber: { fontSize: 32, fontWeight: 'bold' },
  divider: { height:1, backgroundColor: COLORS.border, marginVertical: 15 },
  dividerSmall: { height:1, backgroundColor: '#334155', marginVertical: 8, width:'50%', alignSelf:'flex-end' },
  
  rowDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  textDetails: { color: COLORS.subtext, fontSize: 14 },
  valDetails: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  alertBox: { flexDirection:'row', alignItems:'center', padding: 15, borderRadius: 10, marginTop: 15 }
});