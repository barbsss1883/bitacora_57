import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView, Modal, TextInput, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker'; 

import { obtenerEstadisticasUsuario, guardarDocumento, obtenerDocumentosUsuario, eliminarDocumento } from '../db/database';

const COLORS = {
  bg: '#0f172a', card: '#1e293b', primary: '#f59e0b', text: '#f8fafc', subtext: '#94a3b8', danger: '#ef4444', border: '#334155'
};

export default function Perfil() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<any>(null);
  const [stats, setStats] = useState({ viajes: 0, km: 0 });
  const [documentos, setDocumentos] = useState<any[]>([]);
  
  // MODALES
  const [modalEdit, setModalEdit] = useState(false);
  const [modalDocs, setModalDocs] = useState(false);
  
  const [editData, setEditData] = useState({ nombre: '', licencia: '', unidad: '' });

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = async () => {
    try {
      const session = await AsyncStorage.getItem('USER_SESSION');
      const presets = await AsyncStorage.getItem('FORM_PRESETS');
      
      if (session) {
        const u = JSON.parse(session);
        setUsuario(u);
        cargarDocumentos(u.id); // Cargar docs de este usuario
        
        let p = presets ? JSON.parse(presets) : {};
        setEditData({ nombre: u.nombre || '', licencia: p.licencia || '', unidad: p.unidad || '' });
      }
      const estadisticas = await obtenerEstadisticasUsuario();
      // @ts-ignore
      setStats(estadisticas);
    } catch (e) {}
  };

  const cargarDocumentos = async (uid: number) => {
    const docs: any = await obtenerDocumentosUsuario(uid);
    setDocumentos(docs || []);
  };

  const subirDocumento = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // Guardar en BD
        await guardarDocumento(usuario.id, file.name, file.uri, file.mimeType || 'file');
        Alert.alert("✅ Subido", "Documento guardado correctamente.");
        cargarDocumentos(usuario.id); // Recargar lista
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar el archivo.");
    }
  };

  const borrarDoc = async (id: number) => {
    Alert.alert("Eliminar", "¿Borrar este documento?", [
      { text: "Cancelar" },
      { text: "Borrar", style: 'destructive', onPress: async () => {
        await eliminarDocumento(id);
        cargarDocumentos(usuario.id);
      }}
    ]);
  };

  const guardarCambios = async () => {
    const nuevoUsuario = { ...usuario, nombre: editData.nombre };
    await AsyncStorage.setItem('USER_SESSION', JSON.stringify(nuevoUsuario));
    setUsuario(nuevoUsuario);
    const prevPresets = await AsyncStorage.getItem('FORM_PRESETS');
    const nuevosPresets = prevPresets ? JSON.parse(prevPresets) : {};
    nuevosPresets.operador = editData.nombre;
    nuevosPresets.licencia = editData.licencia;
    nuevosPresets.unidad = editData.unidad;
    await AsyncStorage.setItem('FORM_PRESETS', JSON.stringify(nuevosPresets));
    setModalEdit(false);
    Alert.alert("Actualizado", "Datos guardados.");
  };

  const cerrarSesion = async () => {
    Alert.alert("Cerrar Sesión", "¿Seguro que quieres salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem('USER_SESSION');
          router.replace('/login');
      }}
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: usuario?.foto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.avatar} />
        </View>
        <Text style={styles.name}>{usuario?.nombre || "Operador"}</Text>
        <Text style={styles.email}>{usuario?.email || usuario?.usuario || "Sin correo"}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statNumber}>{stats.viajes}</Text><Text style={styles.statLabel}>VIAJES</Text></View>
        <View style={styles.statCard}><Text style={styles.statNumber}>{stats.km}</Text><Text style={styles.statLabel}>KM APROX</Text></View>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setModalEdit(true)}>
          <MaterialCommunityIcons name="account-edit" size={24} color={COLORS.primary} />
          <Text style={styles.menuText}>Editar Datos Personales</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.subtext} />
        </TouchableOpacity>
        
        {/* BOTÓN DOCUMENTOS */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setModalDocs(true)}>
          <MaterialCommunityIcons name="file-document" size={24} color={COLORS.primary} />
          <Text style={styles.menuText}>Mis Licencias y Documentos</Text>
          <View style={styles.badge}><Text style={{color:'white', fontSize:10}}>{documentos.length}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.subtext} />
        </TouchableOpacity>

        {/* --- NUEVO BOTÓN: CONFIGURACIÓN Y RESPALDO --- */}
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/configuracion')}>
          <MaterialCommunityIcons name="cog" size={24} color={COLORS.primary} />
          <Text style={styles.menuText}>Configuración y Respaldo</Text>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.subtext} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.btnLogout} onPress={cerrarSesion}>
        <Text style={styles.txtLogout}>CERRAR SESIÓN</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Bitácora57 v1.0.7</Text>

      {/* MODAL EDICIÓN PERFIL */}
      <Modal visible={modalEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Perfil</Text>
            <Text style={styles.label}>Nombre</Text><TextInput style={styles.input} value={editData.nombre} onChangeText={(t)=>setEditData({...editData, nombre:t})} />
            <Text style={styles.label}>Licencia (Default)</Text><TextInput style={styles.input} value={editData.licencia} onChangeText={(t)=>setEditData({...editData, licencia:t})} />
            <Text style={styles.label}>Unidad Favorita</Text><TextInput style={styles.input} value={editData.unidad} onChangeText={(t)=>setEditData({...editData, unidad:t})} />
            <TouchableOpacity style={styles.btnSave} onPress={guardarCambios}><Text style={styles.txtBtn}>GUARDAR</Text></TouchableOpacity>
            <TouchableOpacity style={{marginTop:15}} onPress={()=>setModalEdit(false)}><Text style={{color: COLORS.subtext, textAlign:'center'}}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DOCUMENTOS */}
      <Modal visible={modalDocs} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height:'80%'}]}>
            <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
              <Text style={styles.modalTitle}>Mis Documentos</Text>
              <TouchableOpacity onPress={subirDocumento} style={{backgroundColor: COLORS.primary, padding:5, borderRadius:5}}>
                <Text style={{color:'white', fontWeight:'bold'}}>+ SUBIR</Text>
              </TouchableOpacity>
            </View>
            
            {documentos.length === 0 ? (
              <Text style={{color: COLORS.subtext, textAlign:'center', marginTop:20}}>No has subido documentos aún.</Text>
            ) : (
              <FlatList
                data={documentos}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({item}) => (
                  <View style={styles.docItem}>
                    <MaterialCommunityIcons name={item.tipo.includes('pdf') ? 'file-pdf-box' : 'image'} size={30} color={COLORS.text} />
                    <View style={{flex:1, marginLeft:10}}>
                      <Text style={{color:'white', fontWeight:'bold'}}>{item.nombre}</Text>
                      <Text style={{color: COLORS.subtext, fontSize:10}}>{new Date(item.fecha).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => borrarDoc(item.id)}>
                      <MaterialCommunityIcons name="trash-can" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
            
            <TouchableOpacity style={{marginTop:15, alignSelf:'center'}} onPress={()=>setModalDocs(false)}>
              <Text style={{color: COLORS.subtext}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: 'center', padding: 30, backgroundColor: COLORS.card, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  avatarContainer: { marginBottom: 15 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  email: { fontSize: 14, color: COLORS.subtext },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  statCard: { alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 15, width: '30%', borderWidth: 1, borderColor: COLORS.border },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 10, color: COLORS.subtext, marginTop: 5 },
  menu: { padding: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
  menuText: { flex: 1, color: COLORS.text, marginLeft: 15, fontSize: 16 },
  badge: { backgroundColor: COLORS.danger, paddingHorizontal:8, borderRadius:10, marginRight:5 },
  btnLogout: { margin: 20, backgroundColor: COLORS.danger, padding: 15, borderRadius: 12, alignItems: 'center' },
  txtLogout: { color: 'white', fontWeight: 'bold' },
  version: { textAlign: 'center', color: COLORS.subtext, marginBottom: 30 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { color: COLORS.subtext, fontSize: 12, marginBottom: 5 },
  input: { backgroundColor: COLORS.bg, color: 'white', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border },
  btnSave: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  txtBtn: { color: 'white', fontWeight: 'bold' },
  docItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: COLORS.border, marginBottom: 5 }
});
