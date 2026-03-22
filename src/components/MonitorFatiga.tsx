import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';

interface MonitorFatigaProps {
  jornadaActiva: boolean;
  fechaInicio: string | null; 
}

const LIMITE_HORAS = 5;
const SEGUNDOS_LIMITE = LIMITE_HORAS * 3600;

export default function MonitorFatiga({ jornadaActiva, fechaInicio }: MonitorFatigaProps) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    let intervalo: NodeJS.Timeout;

    if (jornadaActiva && fechaInicio) {
      intervalo = setInterval(() => {
        const ahora = new Date();
        const inicio = new Date(fechaInicio);
        const diff = Math.floor((ahora.getTime() - inicio.getTime()) / 1000);
        setSegundos(diff);
        if (diff === SEGUNDOS_LIMITE - 900) {
           Alert.alert("⚠️ Aviso de NOM-087", "Te quedan 15 minutos para tu descanso obligatorio.");
        }
      }, 1000);
    }
    return () => clearInterval(intervalo);
  }, [jornadaActiva, fechaInicio]);

  const formato = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  };

  const esCritico = segundos > SEGUNDOS_LIMITE;

  return (
    <View style={[styles.container, esCritico && styles.containerCritico]}>
      <Text style={styles.label}>Tiempo Conduciendo</Text>
      <Text style={styles.timer}>{formato(segundos)}</Text>
      {esCritico && <Text style={styles.alerta}>¡DETENTE A DESCANSAR!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: '#2C3E50', borderRadius: 8, alignItems: 'center', marginVertical: 10 },
  containerCritico: { backgroundColor: '#C0392B' },
  label: { color: '#BDC3C7', fontSize: 14, textTransform: 'uppercase' },
  timer: { color: '#ECF0F1', fontSize: 42, fontWeight: 'bold', fontFamily: 'monospace' },
  alerta: { color: '#FFF', fontWeight: 'bold', marginTop: 5 }
});
