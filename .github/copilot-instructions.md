# Bitácora 57 - AI Coding Agent Instructions

This document provides guidance for AI coding agents to effectively contribute to the Bitacora 57 codebase.

## 1. Project Overview & Architecture

Bitácora 57 is a comprehensive fleet management system for the Mexican trucking industry, ensuring compliance with federal regulations (NOM-087 & NOM-006).

The architecture is composed of two main parts:
1.  **Mobile Application:** A React Native (with Expo) application for truck drivers. It features offline-first capabilities, background GPS tracking, and on-device document certification.
2.  **Web Monitoring Center:** A web dashboard (`public/monitor.html`) for fleet managers to track vehicles in real-time.

The backend is powered by **Firebase** (Firestore and Storage).

## 2. Core Concepts & Technologies

- **Offline-First (Mobile):** The mobile app is designed to work without a constant internet connection. All trip data is stored locally in an SQLite database. The logic for this is primarily in `db/database.ts`. Data is synchronized with Firebase when a connection is available.
- **Data Synchronization:** The web dashboard reads from `jornadas` and `rutas_maestras` collections in Firestore. Be mindful of this dual-sync logic when working with data models.
- **Digital Certification:** A key feature is the on-device generation of certified PDF documents. This involves:
    - HTML to PDF conversion using `Expo Print`.
    - Capturing a digital signature (`src/components/FirmaDigital.tsx`).
    - Generating a SHA1 hash of the document for integrity.
    - A QR code for authorities to validate the document.
- **Navigation:** The mobile app uses Expo Router for navigation. Screen files are located in the `app/` directory.

## 3. Key Files & Directories

-   `app/`: Contains the screens for the mobile application.
    -   `jornadaEnCurso.tsx`: This is the core screen for an active trip, containing most of the business logic for tracking.
    -   `inspeccionVisual.tsx`: The vehicle inspection checklist screen.
-   `db/database.ts`: Handles all SQLite database operations for the mobile app's offline functionality.
-   `src/services/`: Houses the main services for the application.
    -   `LocationService.ts`: Manages background GPS tracking.
    -   `PdfGenerator.ts`: Logic for creating the PDF documents.
    -   `firebaseConfig.ts`: Firebase configuration (this file is gitignored and must be created locally).
-   `public/`: Contains the web-based components.
    -   `monitor.html`: The real-time fleet monitoring dashboard.
    -   `validar.html`: The page used by authorities to validate QR codes.

## 4. Developer Workflows

### Running the project in development mode

To start the Expo development server, run:
```bash
npx expo start
```

### Building the Android application

For a preview build on EAS:
```bash
eas build -p android --profile preview
```

For a local release build:
```bash
cd android && ./gradlew assembleRelease
```

## 5. Project-Specific Conventions

- When working on features related to trip tracking, always consider the offline scenario first. Changes should be implemented in `db/database.ts` before being synchronized to Firebase.
- For UI components, check `src/components/` for reusable elements before creating new ones.
- Ensure any changes to document generation or certification (`PdfGenerator.ts`) are compliant with the specified regulations. The SHA1 hash is critical for document integrity.
