# 🚛 Bitácora 57 - Sistema Inteligente de Gestión de Flota

> **Plataforma integral para el cumplimiento de la NOM-087-SCT y el monitoreo satelital en tiempo real.**

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-lightgrey.svg)
![Compliance](https://img.shields.io/badge/SCT-NOM--087%20%26%20NOM--006-green.svg)

## 📖 Descripción

**Bitácora 57** es una solución tecnológica diseñada para el autotransporte federal en México. Combina una aplicación móvil (React Native) para el operador y un centro de monitoreo web para la administración de la flota.

El sistema permite el registro de tiempos de conducción, pausas y descansos, funcionando incluso sin conexión a internet (Offline-First) y sincronizando datos automáticamente con la nube cuando se recupera la señal.

## 🚀 Características Principales

### 📱 Aplicación Móvil (Operador)
* **Rastreo GPS en Segundo Plano:** Registro continuo de ubicación y velocidad sin afectar la batería.
* **Modo Offline Robusto:** Base de datos local (SQLite) que almacena viajes completos y sincroniza con Firebase al detectar red.
* **Certificación Digital:**
    * Generación de PDFs certificados en el dispositivo.
    * Firma autógrafa digital.
    * Sello Digital **SHA1** para integridad del documento.
    * Código QR para validación instantánea por autoridades (SCT/Guardia Nacional).
* **Inspección 360°:** Checklist digital cumpliendo con la **NOM-006-SCT-2-2023** (Físico-Mecánica).

### 💻 Centro de Monitoreo (Web)
* **Dashboard en Tiempo Real:** Visualización de unidades activas en mapa interactivo (Leaflet).
* **Sincronización Dual:** Lectura inteligente de colecciones (`jornadas` y `rutas_maestras`) para evitar pérdida de datos.
* **Auditoría:** Acceso directo a las bitácoras certificadas (PDF) desde el mapa.

## ⚖️ Cumplimiento Normativo

Este proyecto fue desarrollado siguiendo estrictamente las regulaciones de la Secretaría de Infraestructura, Comunicaciones y Transportes (SICT):

1.  **NOM-087-SCT-2-2017:** Tiempos de conducción y pausas para conductores del servicio de autotransporte federal.
2.  **NOM-006-SCT-2-2023:** Aspectos básicos para la revisión ocular diaria de la unidad (Inspección Físico-Mecánica).

## 🛠️ Stack Tecnológico

* **Core:** React Native + Expo Router.
* **Base de Datos Local:** Expo SQLite (Modo WAL).
* **Nube & Backend:** Firebase Firestore, Firebase Storage.
* **Mapas & GPS:** Expo Location (Móvil) / Leaflet.js (Web).
* **Generación de Documentos:** Expo Print (HTML to PDF).
* **Seguridad:** Crypto-JS (Hashing SHA1).

## 📂 Estructura del Proyecto

```text
Bitacora57/
├── app/                  # Pantallas (Expo Router)
│   ├── jornadaEnCurso.tsx  # Lógica principal del viaje
│   ├── inspeccionVisual.tsx# Checklist NOM-006
│   └── ...
├── db/                   # Lógica SQLite (Offline)
├── public/               # Monitor Web y Validador QR
│   ├── monitor.html
│   └── validar.html
└── src/
    ├── services/         # GPS, PDF, Firebase Config
    └── components/       # Firma Digital, UI# bitacora_57
🔧 Instalación y Despliegue
Requisitos Previos

    Node.js & npm/yarn

    Cuenta de Firebase activa

Configuración Local

    Clonar el repositorio:
    Bash

    git clone [https://github.com/barbsss1883/bitacora_57.git](https://github.com/barbsss1883/bitacora_57.git)

    Instalar dependencias:
    Bash

    cd bitacora_57
    npm install

    Configurar Firebase:

        Crear src/services/firebaseConfig.ts con tus credenciales.

    Ejecutar en desarrollo:
    Bash

    npx expo start

Generación de APK (Android)
Bash

eas build -p android --profile preview
# O localmente:
cd android && ./gradlew assembleRelease

📄 Licencia

Este proyecto es propiedad privada. Prohibida su distribución sin autorización.
