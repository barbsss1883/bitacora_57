import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';

const COLORS = {
  text: '#f8fafc',
  subtext: '#94a3b8',
  primary: '#f59e0b',
};

export const AvisoTexto = () => (
  <ScrollView style={styles.container}>
    <Text style={styles.title}>AVISO DE PRIVACIDAD SIMPLIFICADO</Text>
    <Text style={styles.parrafo}>
      La aplicación **Bitácora 57** recolecta datos de ubicación en segundo plano, 
      nombres, números de licencia e imágenes de documentos oficiales con la 
      finalidad exclusiva de cumplir con la NOM-087-SCT-2-2017 y facilitar el 
      monitoreo logístico de la flota.
    </Text>
    <Text style={styles.subtitle}>¿Qué datos recabamos?</Text>
    <Text style={styles.parrafo}>
      • Ubicación GPS en tiempo real (incluso con la app cerrada o en uso).{"\n"}
      • Datos de identidad (Nombre, Licencia, INE).{"\n"}
      • Registros de conducción y pausas.
    </Text>
    <Text style={styles.subtitle}>Finalidad</Text>
    <Text style={styles.parrafo}>
      Los datos serán compartidos únicamente con el centro de monitoreo de su 
      empresa transportista y autoridades competentes en caso de inspección oficial.
    </Text>
    <View style={{height: 20}} />
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { padding: 10 },
  title: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16, marginBottom: 10, textAlign: 'center' },
  subtitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14, marginTop: 10 },
  parrafo: { color: COLORS.subtext, fontSize: 12, lineHeight: 18, textAlign: 'justify' }
});