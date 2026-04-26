import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  StatusBar
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';

const COLORS = {
  bg: '#0f172a',
  card: '#1e293b',
  primary: '#f59e0b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  success: '#10b981',
  white: '#ffffff',
  border: '#334155',
  danger: '#ef4444'
};

const API_KEY = 'goog_DzTkRNvkOzigskDvblAaBCgMPQl';

const SCREEN_STATE = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
  PURCHASING: 'purchasing',
};

export default function PantallaSuscripcion() {
  const router = useRouter();
  const [screenState, setScreenState] = useState(SCREEN_STATE.LOADING);
  const [products, setProducts] = useState<{ annual: any; monthly: any }>({ annual: null, monthly: null });
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [errorMessage, setErrorMessage] = useState('');
  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    loadBillingProducts();
  }, []);

  const loadBillingProducts = useCallback(async () => {
    setScreenState(SCREEN_STATE.LOADING);
    setErrorMessage('');
    setSinConexion(false);

    // ── Verificar conectividad antes de llamar a Google Play ─────────────
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setSinConexion(true);
      setErrorMessage('Sin conexión a internet.\n\nConéctate a una red para ver los planes y completar tu suscripción.');
      setScreenState(SCREEN_STATE.ERROR);
      return;
    }

    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        throw new Error('No hay ofertas disponibles en este momento.');
      }

      // Buscamos dinámicamente por tipo para mayor seguridad
      const annualPackage = offerings.current.availablePackages.find(p => p.packageType === 'ANNUAL');
      const monthlyPackage = offerings.current.availablePackages.find(p => p.packageType === 'MONTHLY');

      if (!annualPackage && !monthlyPackage) {
        throw new Error('No se encontraron paquetes de suscripción.');
      }

      setProducts({
        annual: annualPackage
          ? {
              package: annualPackage,
              priceString: annualPackage.product.priceString,
              monthlyPriceString: calculateMonthlyFromAnnual(annualPackage.product.price, annualPackage.product.currencyCode),
            }
          : null,
        monthly: monthlyPackage
          ? {
              package: monthlyPackage,
              priceString: monthlyPackage.product.priceString,
            }
          : null,
      });

      setScreenState(SCREEN_STATE.READY);
    } catch (error: any) {
      console.error('[PaywallScreen] Error cargando productos:', error);

      // Distinguir error de conectividad vs error de Play Store
      const esErrorRed =
        error?.message?.toLowerCase().includes('network') ||
        error?.message?.toLowerCase().includes('connection') ||
        error?.code === 'NETWORK_ERROR';

      if (esErrorRed) {
        setSinConexion(true);
        setErrorMessage('Sin conexión a internet.\n\nConéctate a una red para ver los planes y completar tu suscripción.');
      } else {
        setErrorMessage('No se pudo conectar con Google Play.\n\nVerifica que Google Play Services esté actualizado e intenta de nuevo.');
      }
      setScreenState(SCREEN_STATE.ERROR);
    }
  }, []);

  const handlePurchase = useCallback(async () => {
    const selectedProduct = products[selectedPlan];
    if (!selectedProduct) return;

    setScreenState(SCREEN_STATE.PURCHASING);

    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedProduct.package);

      if (typeof customerInfo.entitlements.active['pro'] !== "undefined") {
        Alert.alert("¡Bienvenido a PRO!", "Tu suscripción está activa. Disfruta de Bitácora57 sin límites.");
        router.back();
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Error en la compra', error.message || 'No se pudo completar la compra.');
      }
    } finally {
      setScreenState(SCREEN_STATE.READY);
    }
  }, [selectedPlan, products, router]);

  const handleRestore = useCallback(async () => {
    setScreenState(SCREEN_STATE.PURCHASING);
    try {
      const info = await Purchases.restorePurchases();
      if (info.entitlements.active['pro']) {
        Alert.alert('Éxito', 'Tus compras han sido restauradas.');
        router.back();
      } else {
        Alert.alert("Aviso", "No se encontraron suscripciones activas.");
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron restaurar las compras.');
    } finally {
      setScreenState(SCREEN_STATE.READY);
    }
  }, [router]);

  const calculateMonthlyFromAnnual = (annualPrice: number, currency: string) => {
    if (!annualPrice) return null;
    const monthly = annualPrice / 12;
    return `${monthly.toFixed(2)} ${currency}`;
  };

  const cerrar = () => router.back();

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

        {screenState === SCREEN_STATE.LOADING && <PricesSkeleton />}

        {screenState === SCREEN_STATE.ERROR && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name={sinConexion ? 'wifi-off' : 'alert-circle-outline'}
              size={48}
              color={sinConexion ? COLORS.subtext : COLORS.danger}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.errorText}>{errorMessage}</Text>
            {sinConexion ? (
              <Text style={styles.errorSubtext}>
                Tu suscripción activa seguirá funcionando sin conexión. Solo necesitas internet para contratar un plan nuevo.
              </Text>
            ) : null}
            <TouchableOpacity style={styles.retryButton} onPress={loadBillingProducts}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {(screenState === SCREEN_STATE.READY || screenState === SCREEN_STATE.PURCHASING) && (
          <View style={styles.optionsContainer}>
            {products.annual && (
              <TouchableOpacity
                style={[styles.optionCard, selectedPlan === 'annual' && styles.optionSelected]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.8}
              >
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>AHORRA 27%</Text>
                </View>
                <View style={styles.optionContent}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.planTitle, selectedPlan === 'annual' && {color: COLORS.primary}]}>
                      PLAN ANUAL
                    </Text>
                    <Text style={styles.planPrice}>{products.annual.priceString}</Text>
                    <Text style={styles.planSub}>
                      Solo {products.annual.monthlyPriceString} al mes (facturado anualmente)
                    </Text>
                  </View>
                  <View style={[styles.radio, selectedPlan === 'annual' && {borderColor: COLORS.primary}]}>
                    {selectedPlan === 'annual' && <View style={styles.radioFill} />}
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {products.monthly && (
              <TouchableOpacity
                style={[styles.optionCard, selectedPlan === 'monthly' && styles.optionSelected]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <View style={styles.optionContent}>
                  <View style={{flex: 1}}>
                    <Text style={[styles.planTitle, selectedPlan === 'monthly' && {color: COLORS.primary}]}>
                      PLAN MENSUAL
                    </Text>
                    <Text style={styles.planPrice}>{products.monthly.priceString}</Text>
                    <Text style={styles.planSub}>Cancela cuando quieras. Sin plazos forzosos.</Text>
                  </View>
                  <View style={[styles.radio, selectedPlan === 'monthly' && {borderColor: COLORS.primary}]}>
                    {selectedPlan === 'monthly' && <View style={styles.radioFill} />}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.trialText}>
             {selectedPlan === 'annual' 
               ? "Incluye 7 Días GRATIS, después se cobra anual." 
               : "Acceso inmediato. Cancela en Google Play cuando quieras."}
          </Text>
          
          <TouchableOpacity 
            style={[styles.btnSubscribe, screenState !== SCREEN_STATE.READY && {opacity: 0.7}]} 
            onPress={handlePurchase} 
            disabled={screenState !== SCREEN_STATE.READY}
          >
            {screenState === SCREEN_STATE.PURCHASING ? <ActivityIndicator color="#000"/> : (
               <Text style={styles.btnText}>
                  {selectedPlan === 'annual' ? "INICIAR PRUEBA GRATIS" : "ACTIVAR AHORA"}
               </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} style={{marginTop:20, padding:10}}>
             <Text style={styles.restoreText}>Restaurar Compras</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const PricesSkeleton = () => (
  <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
    <View style={[styles.optionCard, { height: 100, opacity: 0.5, justifyContent: 'center', alignItems: 'center' }]}>
       <ActivityIndicator size="small" color={COLORS.primary} />
    </View>
    <View style={[styles.optionCard, { height: 90, opacity: 0.5 }]} />
    <Text style={{ textAlign: 'center', color: COLORS.subtext, marginTop: 10 }}>Conectando con Google Play...</Text>
  </View>
);

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
  optionCard: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: COLORS.border, overflow:'hidden', position: 'relative' },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(245, 158, 11, 0.08)' },
  optionContent: { flexDirection:'row', padding: 20, alignItems:'center', paddingTop: 25 },
  planTitle: { color: COLORS.subtext, fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  planPrice: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginVertical: 4 },
  planSub: { color: COLORS.success, fontSize: 12 },
  badge: { position: 'absolute', top: 0, left: 0, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderBottomRightRadius: 10, zIndex: 1 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.subtext, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  radioFill: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary },
  footer: { padding: 20, alignItems: 'center' },
  trialText: { color: COLORS.white, fontSize: 13, marginBottom: 15, textAlign:'center', fontWeight:'500' },
  btnSubscribe: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 18, borderRadius: 14, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, shadowRadius:5, elevation:5 },
  btnText: { color: '#000', fontSize: 16, fontWeight: 'bold', letterSpacing:0.5 },
  restoreText: { color: COLORS.subtext, fontSize: 13, textDecorationLine: 'underline' },
  errorContainer: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 24 },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 14, marginBottom: 10, lineHeight: 20 },
  errorSubtext: { color: COLORS.subtext, textAlign: 'center', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  retryButton: { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border },
  retryButtonText: { color: COLORS.primary, fontWeight: 'bold' }
});
