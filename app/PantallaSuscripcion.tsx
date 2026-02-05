import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Alert, ActivityIndicator, StatusBar 
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- COLORES DE TU MARCA (Bitacora57) ---
const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b', // Naranja Principal
  text: '#f8fafc',
  subtext: '#94a3b8',
  success: '#10b981',
  white: '#ffffff',
  border: '#334155',
  danger: '#ef4444'
};

// 🔥 TU LLAVE DE REVENUECAT LISTA
const API_KEY = 'test_kBGHpTgrAUXILeRLXCgzsKCtbmc'; 

export default function PantallaSuscripcion() {
  const router = useRouter();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoOfertas, setCargandoOfertas] = useState(true);

  useEffect(() => {
    const setup = async () => {
      try {
        // Inicializamos RevenueCat con tu llave de prueba
        await Purchases.configure({ apiKey: API_KEY });
        
        // Obtenemos las ofertas
        const offerings = await Purchases.getOfferings();
        
        if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
          setPackages(offerings.current.availablePackages);
          
          // Estrategia: Pre-seleccionar el ANUAL
          const anual = offerings.current.availablePackages.find(p => p.packageType === 'ANNUAL');
          if (anual) {
             setSelectedPkg(anual);
          } else {
             setSelectedPkg(offerings.current.availablePackages[0]);
          }
        }
      } catch (e) {
        console.log("Error conectando con RevenueCat", e);
      } finally {
        setCargandoOfertas(false);
      }
    };
    setup();
  }, []);

  const comprar = async () => {
    if (!selectedPkg) return;
    setCargando(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPkg);
      
      // Verificamos si se desbloqueó el nivel "pro"
      if (typeof customerInfo.entitlements.active['pro'] !== "undefined") {
        Alert.alert("¡Bienvenido a PRO!", "Tu suscripción está activa. Disfruta de Bitacora57 sin límites.");
        router.back(); 
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Error en la compra", e.message);
      }
    } finally {
      setCargando(false);
    }
  };

  const restaurarCompras = async () => {
    setCargando(true);
    try {
      const info = await Purchases.restorePurchases();
      if (info.entitlements.active['pro']) {
        Alert.alert("Éxito", "Tus compras anteriores han sido restauradas.");
        router.back();
      } else {
        Alert.alert("Aviso", "No se encontraron suscripciones activas.");
      }
    } catch (e) { 
        Alert.alert("Error", "No se pudo conectar con la tienda."); 
    } finally { 
        setCargando(false); 
    }
  };

  const cerrar = () => {
      router.back();
  };

  // Renderizado de tarjetas de precio
  const renderOption = (pkg: PurchasesPackage) => {
    const isSelected = selectedPkg?.identifier === pkg.identifier;
    const isAnnual = pkg.packageType === 'ANNUAL';
    const labelAhorro = isAnnual ? "AHORRA 27%" : null;

    return (
      <TouchableOpacity 
        key={pkg.identifier}
        onPress={() => setSelectedPkg(pkg)}
        activeOpacity={0.8}
        style={[
          styles.optionCard, 
          isSelected && styles.optionSelected
        ]}
      >
        <View style={styles.optionContent}>
           <View style={{flex: 1}}>
              {labelAhorro && (
                  <View style={styles.badge}>
                      <Text style={styles.badgeText}>{labelAhorro}</Text>
                  </View>
              )}
              <Text style={[styles.planTitle, isSelected && {color: COLORS.primary}]}>
                  {isAnnual ? "PLAN ANUAL" : "PLAN MENSUAL"}
              </Text>
              <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
              <Text style={styles.planSub}>
                  {isAnnual 
                    ? "Solo $49.90 al mes (facturado anualmente)" 
                    : "Cancela cuando quieras. Sin plazos forzosos."}
              </Text>
           </View>
           <View style={[styles.radio, isSelected && {borderColor: COLORS.primary}]}>
              {isSelected && <View style={styles.radioFill} />}
           </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <TouchableOpacity style={styles.closeBtn} onPress={cerrar}>
         <MaterialCommunityIcons name="close" size={26} color={COLORS.subtext} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{paddingBottom:40}} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="crown" size={50} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Bitácora57 <Text style={{color:COLORS.primary}}>PRO</Text></Text>
          <Text style={styles.subtitle}>
            Evita multas de la Guardia Nacional y profesionaliza tu trabajo hoy mismo.
          </Text>
        </View>

        <View style={styles.benefitsContainer}>
          <Beneficio icon="file-pdf-box" title="PDFs Profesionales" desc="Descargas ilimitadas sin marcas de agua." />
          <Beneficio icon="cloud-check" title="Respaldo en la Nube" desc="Tus viajes seguros aunque pierdas el celular." />
          <Beneficio icon="block-helper" title="Cero Publicidad" desc="Navegación limpia y sin interrupciones." />
          <Beneficio icon="shield-check" title="Soporte Prioritario" desc="Atención directa vía WhatsApp." />
        </View>

        {cargandoOfertas ? (
           <View style={{height: 150, justifyContent:'center'}}>
               <ActivityIndicator size="large" color={COLORS.primary} />
               <Text style={{textAlign:'center', color: COLORS.subtext, marginTop:10}}>Cargando precios...</Text>
           </View>
        ) : (
           <View style={styles.optionsContainer}>
             {packages.map(renderOption)}
             {packages.length === 0 && (
                 <Text style={{color:COLORS.danger, textAlign:'center'}}>
                     {/* Este mensaje saldrá si aún no se propagan los productos en Google Play */}
                     Configurando precios... Intenta más tarde.
                 </Text>
             )}
           </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.trialText}>
             {selectedPkg?.packageType === 'ANNUAL' 
               ? "Incluye 7 Días GRATIS, después se cobra anual." 
               : "Acceso inmediato. Cancela en Google Play cuando quieras."}
          </Text>
          
          <TouchableOpacity 
            style={[styles.btnSubscribe, (cargando || packages.length === 0) && {opacity: 0.7}]} 
            onPress={comprar} 
            disabled={cargando || packages.length === 0}
          >
            {cargando ? <ActivityIndicator color="#000"/> : (
               <Text style={styles.btnText}>
                  {selectedPkg?.packageType === 'ANNUAL' ? "INICIAR PRUEBA GRATIS" : "ACTIVAR AHORA"}
               </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={restaurarCompras} style={{marginTop:20, padding:10}}>
             <Text style={styles.restoreText}>Restaurar Compras</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const Beneficio = ({icon, title, desc}: any) => (
  <View style={styles.benefitRow}>
    <View style={styles.benefitIconBg}>
        <MaterialCommunityIcons name={icon} size={22} color={COLORS.primary} />
    </View>
    <View style={{flex:1}}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  closeBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  header: { alignItems: 'center', marginTop: 60, marginBottom: 30, paddingHorizontal: 20 },
  iconContainer: { marginBottom: 15, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: 15, borderRadius: 50 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.white },
  subtitle: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 10, lineHeight: 20, paddingHorizontal: 20 },
  benefitsContainer: { paddingHorizontal: 25, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  benefitIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth:1, borderColor: COLORS.border },
  benefitTitle: { color: COLORS.white, fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  benefitDesc: { color: COLORS.subtext, fontSize: 12 },
  optionsContainer: { paddingHorizontal: 20, marginBottom: 10 },
  optionCard: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border, overflow:'hidden' },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(245, 158, 11, 0.08)' },
  optionContent: { flexDirection:'row', padding: 20, alignItems:'center' },
  planTitle: { color: COLORS.subtext, fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  planPrice: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginVertical: 4 },
  planSub: { color: COLORS.success, fontSize: 12 },
  badge: { backgroundColor: COLORS.primary, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.subtext, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  radioFill: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary },
  footer: { padding: 20, alignItems: 'center' },
  trialText: { color: COLORS.white, fontSize: 13, marginBottom: 15, textAlign:'center', fontWeight:'500' },
  btnSubscribe: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 18, borderRadius: 14, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:5, elevation:5 },
  btnText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing:0.5 },
  restoreText: { color: COLORS.subtext, fontSize: 13, textDecorationLine: 'underline' }
});