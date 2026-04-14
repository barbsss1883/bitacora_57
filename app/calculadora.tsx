import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, StatusBar, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ─── Paleta unificada ─────────────────────────────────────────────────────────
const C = {
  bg:       '#010A14',
  card:     '#051C33',
  cardAlt:  '#081D33',
  border:   '#12365A',
  gold:     '#D4AF37',
  goldDim:  '#C5A059',
  text:     '#FFFFFF',
  subtext:  '#9DA8B5',
  success:  '#10B981',
  danger:   '#EF4444',
  yellow:   '#EAB308',
};

export default function CalculadoraDiesel() {
  const router = useRouter();

  const [form, setForm] = useState({
    km: '', inicial: '', recargas: '', finales: '', ralenti: '',
  });
  const [resultado, setResultado] = useState<any>(null);

  const calcular = () => {
    if (!form.km || !form.inicial || !form.finales) {
      Alert.alert('Faltan Datos', 'Necesitamos KM, Litros Iniciales y Litros Finales.');
      return;
    }
    const km        = parseFloat(form.km);
    const inicial   = parseFloat(form.inicial);
    const recargas  = parseFloat(form.recargas) || 0;
    const finales   = parseFloat(form.finales);
    const ralenti   = parseFloat(form.ralenti) || 0;

    if (km <= 0)      { Alert.alert('Error', 'Los KM deben ser mayor a 0'); return; }
    if (inicial <= 0) { Alert.alert('Error', 'Litros iniciales incorrectos'); return; }
    if (finales < 0)  { Alert.alert('Error', 'Litros finales no pueden ser negativos'); return; }

    const disponibles    = inicial + recargas;
    const consumoTotal   = disponibles - finales;

    if (consumoTotal <= 0) {
      Alert.alert('Error Lógico', 'Los litros finales superan los disponibles. Revisa tus datos.');
      return;
    }

    const consumoManejo      = Math.max(consumoTotal - ralenti, 0);
    const rendimiento        = consumoManejo > 0 ? km / consumoManejo : 0;
    const consumoPorKm       = consumoManejo > 0 ? consumoManejo / km : 0;
    const eficiencia         = rendimiento >= 2.5 ? 'ÓPTIMO' : rendimiento >= 2.0 ? 'NORMAL' : 'BAJO';
    const eficienciaColor    = rendimiento >= 2.5 ? C.success : rendimiento >= 2.0 ? C.gold : C.danger;

    setResultado({
      disponibles:   disponibles.toFixed(0),
      consumoTotal:  consumoTotal.toFixed(1),
      consumoManejo: consumoManejo.toFixed(1),
      ralenti:       ralenti.toFixed(1),
      finales:       finales.toFixed(1),
      rendimiento:   rendimiento.toFixed(2),
      consumoPorKm:  (consumoPorKm * 100).toFixed(2), // L/100km
      eficiencia,
      eficienciaColor,
    });
  };

  const limpiar = () => {
    setForm({ km: '', inicial: '', recargas: '', finales: '', ralenti: '' });
    setResultado(null);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>AUDITORÍA DE TANQUE</Text>
        <MaterialCommunityIcons name="file-chart-check" size={24} color={C.gold} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Resultado ──────────────────────────────────────────────────────── */}
        {resultado && (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <MaterialCommunityIcons name="check-circle" size={16} color={C.success} />
              <Text style={s.resultTitle}> BALANCE FÍSICO COMPLETADO</Text>
            </View>

            {/* Rendimiento grande */}
            <View style={s.bigBlock}>
              <Text style={s.bigLabel}>RENDIMIENTO NETO (MANEJO)</Text>
              <View style={s.bigRow}>
                <Text style={s.bigNumber}>{resultado.rendimiento}</Text>
                <Text style={s.bigUnit}>km/l</Text>
              </View>
              <View style={[s.eficienciaBadge, { backgroundColor: resultado.eficienciaColor + '22', borderColor: resultado.eficienciaColor }]}>
                <Text style={[s.eficienciaT, { color: resultado.eficienciaColor }]}>
                  {resultado.eficiencia}
                </Text>
              </View>
              <Text style={s.bigSub}>{resultado.consumoPorKm} L/100km · Exactitud por balance de masas</Text>
            </View>

            <View style={s.divider} />

            {/* Desglose */}
            <Row icon="gas-station"     label="Disponibles totales"    val={`${resultado.disponibles} L`}  />
            <Row icon="fire"            label="Consumo total real"      val={`${resultado.consumoTotal} L`} />
            <Row icon="engine-off"      label="Ralentí descontado"      val={`− ${resultado.ralenti} L`}    valColor={C.goldDim} />
            <View style={s.dividerSmall} />
            <Row icon="truck-fast"      label="Consumo rodando"         val={`${resultado.consumoManejo} L`} highlight />
            <Row icon="fuel"            label="Sobrante en tanque"      val={`${resultado.finales} L`}      />
          </View>
        )}

        {/* ── Formulario ─────────────────────────────────────────────────────── */}
        <View style={s.formCard}>
          <SectionTitle num="1" label="DATOS FÍSICOS" />

          <Field
            label="KM Recorridos"
            value={form.km}
            onChangeText={(t: string) => setForm({ ...form, km: t })}
            placeholder="Ej: 1500"
            icon="map-marker-distance"
          />

          <View style={s.row}>
            <Field
              label="Litros INICIALES"
              value={form.inicial}
              onChangeText={(t: string) => setForm({ ...form, inicial: t })}
              placeholder="Inicio"
              icon="fuel"
              flex
            />
            <Field
              label="Litros RECARGAS"
              value={form.recargas}
              onChangeText={(t: string) => setForm({ ...form, recargas: t })}
              placeholder="En ruta (0 si no)"
              icon="plus-circle-outline"
              flex
            />
          </View>

          {/* Litros finales — resaltado */}
          <View style={s.finalBox}>
            <View style={s.finalBoxHeader}>
              <MaterialCommunityIcons name="gauge" size={14} color={C.yellow} />
              <Text style={s.finalBoxLabel}>  Litros FINALES  (Varilla / Reloj)</Text>
            </View>
            <TextInput
              style={s.finalInput}
              value={form.finales}
              onChangeText={(t) => setForm({ ...form, finales: t })}
              keyboardType="numeric"
              placeholder="¿Cuánto sobró al llegar?"
              placeholderTextColor={C.subtext}
            />
          </View>

          <SectionTitle num="2" label="DESCUENTO TIEMPO MUERTO" />

          <Field
            label="Litros estimados en Ralentí"
            value={form.ralenti}
            onChangeText={(t: string) => setForm({ ...form, ralenti: t })}
            placeholder="Ej: 30  (pernocta / espera en carga)"
            icon="clock-time-four-outline"
          />

          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnOutline} onPress={limpiar}>
              <MaterialCommunityIcons name="refresh" size={16} color={C.subtext} />
              <Text style={s.btnOutlineT}> LIMPIAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSolid} onPress={calcular}>
              <MaterialCommunityIcons name="calculator" size={16} color="#000" />
              <Text style={s.btnSolidT}> CALCULAR BALANCE</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
const SectionTitle = ({ num, label }: { num: string; label: string }) => (
  <View style={s.sectionRow}>
    <View style={s.sectionBadge}><Text style={s.sectionBadgeT}>{num}</Text></View>
    <Text style={s.sectionLabel}>{label}</Text>
  </View>
);

const Field = ({ label, value, onChangeText, placeholder, icon, flex }: any) => (
  <View style={[s.fieldWrap, flex && { flex: 1 }]}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={s.inputWrap}>
      {icon && <MaterialCommunityIcons name={icon} size={16} color={C.subtext} style={{ marginRight: 8 }} />}
      <TextInput
        style={s.inputText}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor={C.border}
      />
    </View>
  </View>
);

const Row = ({ icon, label, val, valColor, highlight }: any) => (
  <View style={[s.detailRow, highlight && s.detailRowHL]}>
    <View style={s.detailLeft}>
      <MaterialCommunityIcons name={icon} size={15} color={highlight ? C.gold : C.subtext} />
      <Text style={[s.detailLabel, highlight && { color: C.text, fontWeight: 'bold' }]}> {label}</Text>
    </View>
    <Text style={[s.detailVal, valColor && { color: valColor }, highlight && { color: C.gold }]}>{val}</Text>
  </View>
);

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingHorizontal: 20, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: C.text, letterSpacing: 1 },
  backBtn: { padding: 4 },

  // Result card
  resultCard: {
    margin: 16, marginBottom: 0, padding: 20,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  resultTitle: { color: C.success, fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  bigBlock: { alignItems: 'center', marginBottom: 16 },
  bigLabel: { color: C.subtext, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bigNumber: { fontSize: 52, fontWeight: 'bold', color: C.text, lineHeight: 58 },
  bigUnit: { fontSize: 18, color: C.subtext, marginBottom: 10 },
  bigSub: { color: C.subtext, fontSize: 11, marginTop: 6, textAlign: 'center', fontStyle: 'italic' },
  eficienciaBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 3, marginTop: 6 },
  eficienciaT: { fontSize: 11, fontWeight: 'bold', letterSpacing: 2 },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  detailRowHL: { backgroundColor: C.cardAlt, marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 6 },
  detailLeft: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { color: C.subtext, fontSize: 13 },
  detailVal: { color: C.text, fontWeight: 'bold', fontSize: 13 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  dividerSmall: { height: 1, backgroundColor: C.border, marginVertical: 6 },

  // Form card
  formCard: {
    margin: 16, marginTop: 12, padding: 20,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, marginTop: 4 },
  sectionBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  sectionBadgeT: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  sectionLabel: { color: C.gold, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: C.subtext, fontSize: 11, marginBottom: 6, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  inputText: { flex: 1, color: C.text, fontSize: 16 },

  row: { flexDirection: 'row', gap: 10 },

  // Litros finales especial
  finalBox: {
    backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(234,179,8,0.35)', marginBottom: 20,
  },
  finalBoxHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  finalBoxLabel: { color: C.yellow, fontSize: 11, fontWeight: 'bold' },
  finalInput: {
    backgroundColor: C.bg, color: C.text, borderRadius: 8,
    padding: 12, borderWidth: 1, borderColor: 'rgba(234,179,8,0.4)', fontSize: 16,
  },

  // Botones
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btnOutline: {
    flex: 0.45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, padding: 14, borderRadius: 10,
  },
  btnOutlineT: { color: C.subtext, fontWeight: 'bold', fontSize: 12 },
  btnSolid: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold, padding: 14, borderRadius: 10,
  },
  btnSolidT: { color: '#000', fontWeight: 'bold', fontSize: 12 },
});
