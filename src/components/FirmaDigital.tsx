import React, { useRef } from 'react';
import { View, StyleSheet, Button, Text, TouchableOpacity } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';

interface FirmaProps {
  onOK: (signature: string) => void;
  onCancel: () => void;
}

export default function FirmaDigital({ onOK, onCancel }: FirmaProps) {
  const ref = useRef<any>(null);

  const handleOK = (signature: string) => {
    onOK(signature); 
  };

  const handleClear = () => {
    ref.current.clearSignature();
  };

  const handleConfirm = () => {
    ref.current.readSignature();
  };

  const style = `.m-signature-pad--footer {display: none; margin: 0px;}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firma del Conductor</Text>
      <View style={styles.pad}>
        <SignatureScreen
          ref={ref}
          onOK={handleOK}
          webStyle={style}
          backgroundColor="white"
          penColor="black"
        />
      </View>
      
      <View style={styles.btnRow}>
        <TouchableOpacity onPress={handleClear} style={[styles.btn, styles.btnClear]}>
          <Text style={styles.txtBtn}>Borrar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnCancel]}>
          <Text style={styles.txtBtn}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleConfirm} style={[styles.btn, styles.btnSave]}>
          <Text style={styles.txtBtn}>GUARDAR FIRMA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 10, justifyContent: 'center' },
  title: { color: 'white', textAlign: 'center', fontSize: 18, marginBottom: 10, fontWeight: 'bold' },
  pad: { height: 300, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#fff' },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btn: { padding: 12, borderRadius: 8, width: '30%', alignItems: 'center' },
  btnClear: { backgroundColor: '#e67e22' },
  btnCancel: { backgroundColor: '#c0392b' },
  btnSave: { backgroundColor: '#27ae60' },
  txtBtn: { color: 'white', fontWeight: 'bold' }
});
