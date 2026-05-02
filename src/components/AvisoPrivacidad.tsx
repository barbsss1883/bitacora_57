import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Modal } from 'react-native';

const COLORS = {
  bg: '#010a14', // Tu azul noche
  text: '#f8fafc',
  subtext: '#94a3b8',
  primary: '#f59e0b', // Tu dorado
  danger: '#ef4444'
};

export const ProminentDisclosure = ({ isVisible, onAccept, onDecline }: { isVisible: boolean; onAccept: () => void; onDecline: () => void }) => (
  <Modal visible={isVisible} animationType="slide" transparent={false}>
    <View style={styles.mainContainer}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>PERMISO DE UBICACIÓN Y PRIVACIDAD</Text>
        
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>
            IMPORTANTE: Bitácora 57 requiere acceso a su ubicación en todo momento.
          </Text>
        </View>

        <Text style={styles.parrafo}>
          Para cumplir con la <Text style={{fontWeight: 'bold'}}>NOM-087-SCT-2-2017</Text>, esta aplicación recopila datos de ubicación para permitir el **rastreo de sus rutas, cálculo de jornadas y pausas de descanso**.
        </Text>

        <Text style={styles.highlight}>
          Estos datos se recopilan incluso cuando la aplicación está cerrada o no se está utilizando (ubicación en segundo plano).
        </Text>

        <Text style={styles.subtitle}>¿Por qué es necesario?</Text>
        <Text style={styles.parrafo}>
          • Garantizar que sus registros de manejo sean precisos para auditorías de la SCT.{"\n"}
          • Generar reportes PDF con códigos QR verificables.{"\n"}
          • Monitoreo de seguridad y logística de la flota.
        </Text>

        <Text style={styles.subtitle}>Uso de Datos Personales</Text>
        <Text style={styles.parrafo}>
          Además de la ubicación, recolectamos su nombre y número de licencia para personalizar sus reportes oficiales. Sus datos están protegidos y solo se comparten con su centro de monitoreo autorizado.
        </Text>
      </ScrollView>

      {/* BOTONES DE ACCIÓN - Obligatorios para Google */}
      <View style={styles.buttonArea}>
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.buttonText}>ACEPTAR Y CONTINUAR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
          <Text style={[styles.buttonText, {color: COLORS.subtext}]}>AHORA NO</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const AvisoTexto = () => (
  <ScrollView style={{ padding: 10 }}>
    <Text style={styles.title}>AVISO DE PRIVACIDAD</Text>
    <View style={styles.alertBox}>
      <Text style={styles.alertText}>
        IMPORTANTE: Bitácora 57 requiere acceso a su ubicación en todo momento.
      </Text>
    </View>
    <Text style={styles.parrafo}>
      Para cumplir con la NOM-087-SCT-2-2017, esta aplicación recopila datos de ubicación para permitir el rastreo de sus rutas, cálculo de jornadas y pausas de descanso.
    </Text>
    <Text style={styles.highlight}>
      Estos datos se recopilan incluso cuando la aplicación está cerrada o no se está utilizando (ubicación en segundo plano).
    </Text>
    <Text style={styles.subtitle}>¿Por qué es necesario?</Text>
    <Text style={styles.parrafo}>
      • Garantizar que sus registros de manejo sean precisos para auditorías de la SCT.{"\n"}
      • Generar reportes PDF con códigos QR verificables.{"\n"}
      • Monitoreo de seguridad y logística de la flota.
    </Text>
    <Text style={styles.subtitle}>Uso de Datos Personales</Text>
    <Text style={styles.parrafo}>
      Además de la ubicación, recolectamos su nombre y número de licencia para personalizar sus reportes oficiales. Sus datos están protegidos y solo se comparten con su centro de monitoreo autorizado.
    </Text>
  </ScrollView>
);

export default AvisoTexto;

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 20, marginTop: 40 },
  alertBox: { backgroundColor: '#1e293b', padding: 15, borderRadius: 8, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  alertText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },
  title: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: 'center' },
  subtitle: { color: COLORS.primary, fontWeight: 'bold', fontSize: 15, marginTop: 15, marginBottom: 5 },
  parrafo: { color: COLORS.subtext, fontSize: 13, lineHeight: 20, textAlign: 'justify' },
  highlight: { color: COLORS.text, fontSize: 13, fontWeight: 'bold', marginTop: 15, fontStyle: 'italic', textAlign: 'center' },
  buttonArea: { padding: 20, borderTopWidth: 1, borderTopColor: '#1e293b' },
  acceptButton: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  declineButton: { padding: 10, alignItems: 'center' },
  buttonText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 15 }
});
