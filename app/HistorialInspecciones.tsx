import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDB } from '../db/database';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function HistorialInspecciones() {
  const router = useRouter();
  const [inspecciones, setInspecciones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [inspeccionSeleccionada, setInspeccionSeleccionada] = useState<any>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const cargarHistorial = async () => {
    try {
      const db = await getDB();
      const registros = await db.getAllAsync(`
        SELECT i.id, i.tipo, i.comentarios, i.fecha, i.detalles_json,
               j.unidad, j.operador, j.placas
        FROM inspecciones i
        LEFT JOIN jornadas j ON i.jornada_id = j.id
        ORDER BY i.id DESC LIMIT 50
      `);
      setInspecciones(registros || []);
    } catch (error) {
      console.log('Error al cargar historial:', error);
    } finally {
      setCargando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarHistorial();
    }, [])
  );

  const generarPDF = async (item: any) => {
    setGenerandoPDF(true);
    let detalles: Record<string, boolean> = {};
    try {
      detalles = JSON.parse(item.detalles_json || '{}');
    } catch (e) { console.log(e); }

    const filasDetalles = Object.entries(detalles).map(([pieza, estado]) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">${pieza}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; font-size: 14px; color: ${estado ? '#059669' : '#dc2626'};">
          ${estado ? 'PASÓ (✓)' : 'FALLA (X)'}
        </td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        </head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #010A14;">
          <div style="border-bottom: 3px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
              <h1 style="color: #051C33; margin: 0; font-size: 28px;">BITÁCORA <span style="color: #D4AF37;">57</span></h1>
              <p style="margin: 0; font-weight: bold; color: #64748b; font-size: 12px; letter-spacing: 1px;">REPORTE OFICIAL DE INSPECCIÓN VISUAL</p>
          </div>
          
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
              <p style="margin: 5px 0;"><strong>Operador:</strong> ${item.operador || 'No registrado'}</p>
              <p style="margin: 5px 0;"><strong>Unidad/Eco:</strong> ${item.unidad || 'N/A'} <span style="color:#64748b;">(Placas: ${item.placas || '--'})</span></p>
              <p style="margin: 5px 0;"><strong>Fecha y Hora:</strong> ${new Date(item.fecha).toLocaleString('es-MX')}</p>
              <p style="margin: 5px 0;"><strong>Tipo de Revisión:</strong> ${item.tipo || 'Inspección General'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #051C33; color: #ffffff;">
                <th style="padding: 12px; text-align: left; border-top-left-radius: 6px;">Elemento Revisado</th>
                <th style="padding: 12px; text-align: right; border-top-right-radius: 6px;">Estado Físico</th>
              </tr>
            </thead>
            <tbody>
              ${filasDetalles || '<tr><td colspan="2" style="text-align:center; padding: 20px; color: #94a3b8;">Sin detalles registrados</td></tr>'}
            </tbody>
          </table>

          ${item.comentarios ? `
            <div style="padding: 15px; border-left: 4px solid #D4AF37; background-color: #fffbeb; border-radius: 4px;">
              <p style="margin: 0; color: #b45309; font-weight: bold; font-size: 14px;">Observaciones del Operador:</p>
              <p style="margin-top: 8px; margin-bottom: 0; font-style: italic; color: #334155;">"${item.comentarios}"</p>
            </div>
          ` : ''}

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center; color: #94a3b8; font-size: 11px;">
            <p style="margin: 2px;">Este documento es un registro digital generado automáticamente por la aplicación Bitácora 57.</p>
            <p style="margin: 2px;">Válido para controles internos de flota y evidencia de mantenimiento preventivo.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Compartir Reporte de Inspección' });
    } catch (error) {
      console.error("Error PDF:", error);
      Alert.alert("Error", "No se pudo generar el documento PDF.");
    } finally {
      setGenerandoPDF(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    let tieneFallas = false;
    try {
      const detalles = JSON.parse(item.detalles_json || '{}');
      tieneFallas = Object.values(detalles).includes(false);
    } catch (e) { console.log(e); }

    const fechaFormateada = item.fecha ? new Date(item.fecha).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).toUpperCase() : '---';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setInspeccionSeleccionada(item)}>
        <View style={styles.cardHeader}>
          <View style={styles.fechaContainer}>
            <MaterialCommunityIcons name="calendar-clock" size={18} color="#C5A059" />
            <Text style={styles.fechaTexto}>{fechaFormateada}</Text>
          </View>
          
          <View style={styles.headerRight}>
            <View style={[styles.badge, { backgroundColor: tieneFallas ? '#450A0A' : '#065F46' }]}>
              <Text style={[styles.badgeText, { color: tieneFallas ? '#ef4444' : '#10b981' }]}>
                {item.tipo || 'INSPECCIÓN'}
              </Text>
            </View>
            
            {/* Botón rápido para generar PDF desde la lista */}
            <TouchableOpacity 
              style={styles.pdfButton} 
              onPress={(e) => {
                e.stopPropagation(); // Evita que se abra el modal al picar el botón de PDF
                generarPDF(item);
              }}
              disabled={generandoPDF}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.unidadTexto}>Unidad: <Text style={styles.bold}>{item.unidad || 'N/A'}</Text> ({item.placas || '--'})</Text>
          <Text style={styles.operadorTexto}>Operador: {item.operador || 'DESCONOCIDO'}</Text>
          {item.comentarios ? (
            <Text style={styles.comentarios} numberOfLines={1}>Nota: {item.comentarios}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetallesModal = () => {
    if (!inspeccionSeleccionada) return null;
    let detalles: Record<string, boolean> = {};
    try {
      detalles = JSON.parse(inspeccionSeleccionada.detalles_json || '{}');
    } catch (e) { console.log(e); }

    const items = Object.entries(detalles);

    if (items.length === 0) {
      return <Text style={{color: '#9DA8B5', textAlign: 'center'}}>No hay detalles registrados.</Text>;
    }

    return items.map(([key, valorStatus], index) => (
      <View key={index} style={styles.detalleRow}>
        <Text style={styles.detalleKey}>{key}</Text>
        <MaterialCommunityIcons 
          name={valorStatus ? "check-circle" : "close-circle"} 
          size={24} 
          color={valorStatus ? "#10b981" : "#ef4444"} 
        />
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#051C33" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#C5A059" />
        </TouchableOpacity>
        <Text style={styles.title}>HISTORIAL DE INSPECCIONES</Text>
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color="#D4AF37" style={{flex:1}} />
      ) : inspecciones.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="clipboard-text-off-outline" size={80} color="#2A4A69" />
          <Text style={styles.emptyText}>No hay registros para mostrar</Text>
        </View>
      ) : (
        <FlatList
          data={inspecciones}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* MODAL DE DETALLES */}
      <Modal
        visible={!!inspeccionSeleccionada}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setInspeccionSeleccionada(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reporte de Inspección</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
                <TouchableOpacity onPress={() => generarPDF(inspeccionSeleccionada)} disabled={generandoPDF}>
                  <MaterialCommunityIcons name="export-variant" size={24} color="#D4AF37" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setInspeccionSeleccionada(null)}>
                  <MaterialCommunityIcons name="close" size={28} color="#9DA8B5" />
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={{maxHeight: 400}}>
              {renderDetallesModal()}
              
              {inspeccionSeleccionada?.comentarios ? (
                <View style={styles.comentariosBox}>
                  <Text style={styles.comentariosBoxTitle}>Observaciones:</Text>
                  <Text style={styles.comentariosBoxText}>{inspeccionSeleccionada.comentarios}</Text>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity style={styles.btnCerrarModal} onPress={() => setInspeccionSeleccionada(null)}>
              <Text style={styles.btnCerrarTexto}>CERRAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/inspeccionVisual')}>
        <MaterialCommunityIcons name="plus" size={32} color="#010A14" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#010A14' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50, backgroundColor: '#051C33', borderBottomWidth: 1, borderColor: '#2A4A69' },
  backButton: { marginRight: 15 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#C5A059', letterSpacing: 1 },
  listContainer: { padding: 15, paddingBottom: 100 },
  card: { backgroundColor: '#051C33', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#2A4A69' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderColor: '#12365A', paddingBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fechaContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fechaTexto: { fontSize: 12, color: '#9DA8B5', fontWeight: 'bold' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  pdfButton: { padding: 2 },
  cardBody: { gap: 5 },
  unidadTexto: { fontSize: 14, color: '#FFFFFF' },
  operadorTexto: { fontSize: 13, color: '#9DA8B5' },
  comentarios: { fontSize: 12, color: '#C5A059', fontStyle: 'italic', marginTop: 5 },
  bold: { fontWeight: 'bold', color: '#D4AF37' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 15, fontSize: 14, color: '#2A4A69', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 30, backgroundColor: '#D4AF37', width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#051C33', borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#2A4A69' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#12365A', paddingBottom: 10 },
  modalTitle: { color: '#D4AF37', fontSize: 18, fontWeight: 'bold' },
  detalleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#12365A' },
  detalleKey: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  comentariosBox: { marginTop: 20, backgroundColor: '#010A14', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#2A4A69' },
  comentariosBoxTitle: { color: '#C5A059', fontWeight: 'bold', fontSize: 13, marginBottom: 5 },
  comentariosBoxText: { color: '#9DA8B5', fontSize: 14, fontStyle: 'italic' },
  btnCerrarModal: { backgroundColor: '#D4AF37', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  btnCerrarTexto: { color: '#010A14', fontWeight: 'bold', fontSize: 16 }
});
