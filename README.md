# 🚛 Bitácora 57

> **Plataforma integral de navegación, seguridad y cumplimiento normativo para transporte de carga pesada e hidrocarburos en México.**

[![Version](https://img.shields.io/badge/version-3.0.3-gold)](https://github.com/barbsss1883/bitacora_57)
[![Platform](https://img.shields.io/badge/platform-Android-green)](https://play.google.com/store)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2054-blue)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-blue)](https://reactnative.dev)
[![License](https://img.shields.io/badge/license-Privado-red)](LICENSE)

---

## 📖 ¿Qué es Bitácora 57?

Bitácora 57 soluciona la desconexión entre la navegación por GPS y las restricciones físicas y legales de las carreteras mexicanas. A diferencia de los navegadores convencionales, está diseñada exclusivamente para operadores de carga pesada, ofreciendo un ecosistema completo de:

- ✅ Navegación específica para camiones (Truck-Specific)
- ✅ Cumplimiento normativo ante SICT y Guardia Nacional
- ✅ Seguridad y rastreo en tiempo real
- ✅ Blindaje jurídico con sellos digitales SHA-256

---

## 🏗️ Pilares Fundamentales

### 1. 🗺️ Inteligencia Colectiva y Navegación Truck-Specific

La app funciona como una red de sabiduría vial:

| Característica | Descripción |
|---|---|
| **Zonas Prohibidas** | Áreas con restricción de paso o peligrosas para transporte pesado |
| **Alertas de Infraestructura** | Puentes bajos, calles angostas, zonas de riesgo |
| **Rutas Seguras** | Basadas en viajes exitosos previos filtrados por tipo de unidad |
| **Tipos de Unidad** | Sencillo, Full, Torton |

**Tecnología:** GeoJSON + Turf.js + Mapbox/MapLibre

---

### 2. ⚖️ Ecosistema de Cumplimiento Normativo (ELD Mexicano)

Bitácora 57 digitaliza las obligaciones legales, eliminando la bitácora de papel:

#### NOM-087-SCT-2-2017 — Horas de Servicio
- Cronómetros automáticos de manejo, pausa y descanso
- Alertas preventivas antes de exceder límites legales
- Registro de jornada con GPS en segundo plano
- Firma digital del operador al cierre de jornada

#### NOM-068-SCT-2-2014 — Inspección Físico-Mecánica
- Checklist digital de frenos, llantas, luces y sistema de escape
- Registro fotográfico de condiciones
- Vinculación automática de inspección al viaje del día

#### Blindaje Jurídico
- Reportes PDF oficiales generados automáticamente
- **Sello Digital Criptográfico SHA-256** por cada jornada
- **Códigos QR** de validación para inspecciones en carretera
- Modo Inspección para mostrar a la Guardia Nacional

---

### 3. 🔒 Seguridad y Operación en Tiempo Real

| Función | Detalle |
|---|---|
| **Rastreo Avanzado** | Geolocalización en segundo plano con detección de movimiento |
| **Pausas Automáticas** | Se detienen si se detecta velocidad de conducción |
| **Botón de Pánico** | Envía ubicación exacta como alerta de emergencia |
| **Reporte de Incidencias** | Retenes, accidentes y zonas inseguras con coordenadas |
| **Monitor de Fatiga** | Alertas al detectar síntomas de cansancio |

---

## 📱 Pantallas de la Aplicación

```
splash         → Animación de inicio
login          → Autenticación con Google Sign-In
home           → Panel principal con accesos rápidos + botón S.O.S
jornadaEnCurso → ELD en tiempo real (manejo/pausa/descanso)
mapaRuta       → Mapa con ruta activa y puntos GPS
inspeccionVisual → Inspección NOM-068 pre-viaje
inspecciones   → Historial de inspecciones
historial      → Lista de jornadas anteriores
detalleViaje   → Detalle completo + mapa de ruta recorrida
perfil         → Datos del operador y documentos
calculadora    → Calculadora de rendimiento de diesel
configuracion  → Ajustes de la aplicación
HistorialInspecciones → Registro histórico de inspecciones
PantallaSuscripcion   → Planes Pro vs Gratuito
```

---

## 🗄️ Esquema de Base de Datos Local (SQLite)

```sql
usuarios       → Perfil del operador
jornadas       → Registro de viajes (NOM-087)
inspecciones   → Inspecciones físico-mecánicas (NOM-068)
puntos_gps     → Trazado de ruta (lat, lng, velocidad, timestamp)
pausas         → Registro de descansos y motivos
incidencias    → Eventos en ruta con foto y ubicación
documentos     → Archivos adjuntos del operador
```

**Sincronización:** SQLite (offline-first) → Supabase (nube)

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | React Native 0.81 + Expo SDK 54 |
| **Navegación** | Expo Router 6 |
| **Lenguaje** | TypeScript |
| **Mapas** | Mapbox / MapLibre + Turf.js |
| **Base de datos local** | expo-sqlite (WAL mode) |
| **Backend / Nube** | Supabase (PostgreSQL + Auth + Storage) |
| **Serverless** | Firebase Functions |
| **Autenticación** | Google Sign-In + Supabase Auth |
| **Suscripciones** | RevenueCat (react-native-purchases) |
| **Notificaciones** | expo-notifications |
| **PDF** | expo-print + expo-sharing |
| **Criptografía** | expo-crypto (SHA-256) |
| **Anuncios** | Google Mobile Ads (solo en plan gratuito) |
| **Animaciones** | Lottie + React Native Reanimated |

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- Expo CLI
- Android Studio (para Android)
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Mapbox](https://mapbox.com)

### 1. Clonar el repositorio

```bash
git clone https://github.com/barbsss1883/bitacora_57.git
cd bitacora_57
npm install
```

### 2. Variables de entorno

Crear archivo `.env` en la raíz:

```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key
MAPBOX_TOKEN=tu_token_de_mapbox
```

### 3. Configurar servicios

- Agregar `google-services.json` (Firebase/Google Sign-In)
- Configurar `src/services/firebaseConfig.ts`
- Configurar `src/services/supabaseClient.js`

### 4. Iniciar en desarrollo

```bash
npx expo start
```

### 5. Build para producción (Android)

```bash
eas build -p android --profile production
```

---

## 📦 Estructura del Proyecto

```
bitacora_57/
├── app/                    # Pantallas (Expo Router)
│   ├── _layout.tsx
│   ├── home.tsx
│   ├── jornadaEnCurso.tsx
│   ├── mapaRuta.tsx
│   ├── inspecciones.tsx
│   └── ...
├── src/
│   ├── components/         # Componentes reutilizables
│   │   ├── MonitorFatiga.tsx
│   │   ├── FirmaDigital.tsx
│   │   └── AvisoPrivacidad.tsx
│   └── services/           # Servicios y clientes
│       ├── LocationService.ts
│       ├── SyncService.ts
│       ├── PdfGenerator.ts
│       └── supabaseClient.js
├── db/
│   └── database.ts         # SQLite: esquema y operaciones
├── utils/
│   ├── exportPDF.ts
│   └── routeUtils.ts
├── public/                 # Web (panel admin + validación QR)
├── functions/              # Firebase Cloud Functions
├── assets/
│   ├── images/
│   └── animations/
├── app.json                # Configuración Expo (v3.0.3, build 76)
├── eas.json                # Perfiles de build EAS
└── package.json
```

---

## 🔐 Seguridad y Privacidad

- Los datos de ubicación se recopilan en segundo plano exclusivamente para cumplimiento de **NOM-087-SCT-2-2017**
- La información es compartida únicamente con autoridades competentes o centros de monitoreo autorizados
- Sello digital **SHA-256** garantiza la integridad de cada jornada
- Autenticación segura mediante Google Sign-In + Supabase RLS
- Base de datos local cifrada con WAL mode

---

## 📋 Cumplimiento Normativo

| Norma | Descripción | Estado |
|---|---|---|
| NOM-087-SCT-2-2017 | Horas de Servicio del Operador (ELD) | ✅ Implementado |
| NOM-068-SCT-2-2014 | Inspección Físico-Mecánica | ✅ Implementado |
| Google Play Policy | Aviso destacado de ubicación en segundo plano | ✅ Implementado |
| LFPDPPP | Aviso de Privacidad integrado | ✅ Implementado |

---

## 🤝 Contribuir

Este es un proyecto privado. Para reporte de bugs o sugerencias, contactar al equipo de desarrollo.

---

## 👨‍💻 Autor

**Luis G.** — [@barbsss1883](https://github.com/barbsss1883)

---

## 📄 Licencia

Proyecto privado — Todos los derechos reservados © 2025 Bitácora 57
