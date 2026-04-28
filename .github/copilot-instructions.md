# Bitácora 57 - AI Coding Agent Instructions

This document provides guidance for AI coding agents to effectively contribute to the Bitacora 57 codebase.

## 1. Project Overview & Architecture

Bitácora 57 is a comprehensive fleet management system for the Mexican trucking industry, ensuring compliance with federal regulations (NOM-087 & NOM-006).

The architecture is composed of two main parts:
1.  **Mobile Application:** A React Native (with Expo) application for truck drivers. It features offline-first capabilities, background GPS tracking, and on-device document certification.
2.  **Web Monitoring Center:** A web dashboard (`public/monitor.html`) for fleet managers to track vehicles in real-time.

The backend is powered by **Supabase** (PostgreSQL + S3-like storage). Credentials are in `src/services/supabaseClient.js` (public key hardcoded is safe for client).

## 2. Core Concepts & Technologies

- **Offline-First (Mobile):** The mobile app is designed to work without a constant internet connection. All trip data is stored locally in an **SQLite database (WAL mode)** defined in `db/database.ts`. Data is synchronized to Supabase asynchronously via `SyncService.ts` when a connection is available.
- **Data Synchronization:** Use `encolarSync()` — this is the **ONLY path** to backend operations. The sync queue persists in AsyncStorage if offline. Max 5 retries. Never make direct API calls.
- **Background GPS Tracking:** The Expo TaskManager background task writes to SQLite only (~80m interval, ~450 points per 36km trip). No backend calls during TaskManager execution.
- **Digital Certification:** On-device PDF generation with:
    - HTML to PDF conversion using `Expo Print`.
    - Capturing a digital signature (`src/components/FirmaDigital.tsx`).
    - **SHA256 seal** computed from `[jornada_id, operador, fecha_fin, km_totales]`.
    - QR code linking to `public/validar.html` for authority validation.
    - **RevenueCat subscription check** required before PDF generation.
- **Navigation:** Expo Router with screens in `app/` directory.
- **NOM-087 Compliance:** `validarTiemposSCT()` enforces federal driving time limits (built into core logic).

## 3. Key Files & Directories

Critical files for understanding the system:

-   **`db/database.ts`**: Defines SQLite schema, all domain types (`DatosJornada`, `RowPuntoGPS`, `Inspeccion`, etc.), and all CRUD operations. **Start here for data model changes.**
-   **`app/jornadaEnCurso.tsx`**: Active trip screen with core business logic: trip state management, pause/resume, incident tracking, timer accuracy (uses refs to avoid stale state). **This is the most complex screen.**
-   **`src/services/LocationService.ts`**: Background GPS TaskManager task (`LOCATION_TASK_NAME`). Writes directly to SQLite. Requires `ACCESS_FINE_LOCATION` + `ACCESS_BACKGROUND_LOCATION` permissions.
-   **`src/services/SyncService.ts`**: Queue-based sync engine. Use `encolarSync(table, operation, data)` for ANY backend write.  Max 5 retries. Persists in AsyncStorage. **No direct Supabase calls.**
-   **`src/services/PdfGenerator.ts`**: Generates certified PDFs with SHA256 seal + QR. Validates RevenueCat subscription before generation.
-   **`src/services/supabaseClient.js`**: Supabase client configuration (public key safe for client).
-   **`public/validar.html`**: Authority validation page for QR codes.
-   **`public/monitor.html`**: Real-time fleet dashboard (reads `jornadas` collection).

## 4. Critical Architectural Patterns

**⚡ The Offline-First Pipeline**
1. Write to local SQLite first
2. Queue sync operation via `encolarSync()` 
3. SyncService handles retry logic asynchronously
4. On reconnect, queued operations are processed (max 5 retries)

**🚫 No Direct API Calls**
- Never call Supabase directly from screens
- Always use `encolarSync(table, operation, data)` for any backend write
- Background GPS task writes to SQLite only (no network calls)

**📱 Timer State Management**
- Use refs synced via `useEffect` to avoid stale closure state
- Example in `jornadaEnCurso.tsx`: elapsed time calculations must reference current state
- `setInterval` callbacks capture stale state—use refs as the source of truth

**🗺️ GPS Precision** 
- 80m interval captures curve details (~450 points per 36km trip)
- Previous 500m interval caused straight-line routes
- Don't change without testing on actual device

**🔐 Digital Certification Flow**
1. Check RevenueCat subscription (user must be PRO)
2. Compute SHA256 seal from `[jornada_id, operador, fecha_fin, km_totales]`
3. Generate PDF with embedded QR linking to `validar.html`
4. Upload to Supabase Storage via `encolarSync()`

**⚖️ NOM-087 Compliance**
- `validarTiemposSCT()` enforces federal driving time limits
- Built into trip validation logic
- Violations block trip completion

## 5. Common Pitfalls

| Issue | Root Cause | Fix |
|-------|---|---|
| **Timer runs too fast/slow** | `setInterval` captures stale React state | Use refs synced via `useEffect` (see `jornadaEnCurso.tsx`) |
| **GPS route is straight line** | 500m interval was too large | Confirmed working at 80m interval |
| **Background sync fails** | LocationService task doesn't have Supabase initialized | Task writes SQLite only; foreground handles sync |
| **PDF generation errors** | Non-PRO users not blocked | RevenueCat subscription must be validated before PDF creation |
| **Inspection data access fails** | `.sort()` returns array, not object | Use `ultimaInspeccion[0].detalles_json` pattern |
| **Dual location permission missing** | App requested only one permission | Request both `ACCESS_FINE_LOCATION` + `ACCESS_BACKGROUND_LOCATION` |

## 6. Developer Workflows

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

## 7. Project-Specific Conventions

- **Local-First Always:** Start all changes in `db/database.ts` for data model; implement business logic offline-capable first
- **No Direct Supabase:** Use `encolarSync()` exclusively—never call Supabase client directly from screens
- **GPS = SQLite During Background:** Background tasks write only to SQLite; sync happens in foreground via SyncService
- **Every Trip Must Be Certified:** Digital signature + SHA256 seal are mandatory—validate before PDF upload
- **Component Reusability:** Check `src/components/` before creating new ones (e.g., `FirmaDigital.tsx`, `MonitorFatiga.tsx`)
- **NOM-087 Built-In:** Regulatory time limits are enforced automatically—don't bypass `validarTiemposSCT()`
- **Testing:** No automated test suite—changes require manual device validation with live Supabase credentials
