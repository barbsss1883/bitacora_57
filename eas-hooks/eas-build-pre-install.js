// eas-hooks/eas-build-pre-install.js
//
// EAS corre este script con: "npx node eas-hooks/eas-build-pre-install.js"
// ANTES de instalar dependencias npm y ANTES de que Gradle corra.
// Escribe el MAPBOX_DOWNLOADS_TOKEN en ~/.gradle/gradle.properties
// para que @rnmapbox/maps pueda descargar sus dependencias de Maven.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

async function main() {
  const token = process.env.MAPBOX_DOWNLOADS_TOKEN;

  if (!token) {
    console.error(
      '\n[mapbox-hook] ❌ MAPBOX_DOWNLOADS_TOKEN no encontrado en variables de entorno.\n' +
      '  Verifica que el secret MAPBOX_DOWNLOAD_TOKEN existe en EAS:\n' +
      '  $ eas secret:list\n'
    );
    // No lanzamos error para no bloquear el build — Gradle fallará con 401
    // y el mensaje será más claro
    return;
  }

  const gradleDir   = path.join(os.homedir(), '.gradle');
  const gradlePath  = path.join(gradleDir, 'gradle.properties');

  if (!fs.existsSync(gradleDir)) {
    fs.mkdirSync(gradleDir, { recursive: true });
    console.log(`[mapbox-hook] 📁 Creado directorio: ${gradleDir}`);
  }

  let current = '';
  if (fs.existsSync(gradlePath)) {
    current = fs.readFileSync(gradlePath, 'utf8');
  }

  if (current.includes('MAPBOX_DOWNLOADS_TOKEN')) {
    // Reemplazar el valor existente por si cambió
    const updated = current.replace(
      /MAPBOX_DOWNLOADS_TOKEN=.*/,
      `MAPBOX_DOWNLOADS_TOKEN=${token}`
    );
    fs.writeFileSync(gradlePath, updated);
    console.log('[mapbox-hook] ✅ MAPBOX_DOWNLOADS_TOKEN actualizado en gradle.properties');
  } else {
    fs.appendFileSync(gradlePath, `\nMAPBOX_DOWNLOADS_TOKEN=${token}\n`);
    console.log('[mapbox-hook] ✅ MAPBOX_DOWNLOADS_TOKEN escrito en gradle.properties');
  }

  // Verificar que quedó
  const verify = fs.readFileSync(gradlePath, 'utf8');
  if (verify.includes('MAPBOX_DOWNLOADS_TOKEN')) {
    console.log(`[mapbox-hook] ✅ Verificado: ${gradlePath}`);
  } else {
    console.error('[mapbox-hook] ❌ No se pudo verificar la escritura');
  }

  // ===== google-services.json =====
  const googleServicesB64 = process.env.GOOGLE_SERVICES_JSON_B64;
  if (!googleServicesB64) {
    console.warn(
      '\n[google-services-hook] ⚠️  GOOGLE_SERVICES_JSON_B64 no encontrado en variables de entorno.\n' +
      '  Si necesitas Firebase/Google Play Services, asegúrate de agregar:\n' +
      '  $ eas secret:create --name GOOGLE_SERVICES_JSON_B64 --value <base64-encoded-json>\n'
    );
  } else {
    try {
      const jsonContent = Buffer.from(googleServicesB64, 'base64').toString('utf8');
      const googleServicesPath = path.join(process.cwd(), 'google-services.json');
      fs.writeFileSync(googleServicesPath, jsonContent);
      console.log(`[google-services-hook] ✅ google-services.json creado en: ${googleServicesPath}`);
      
      // Verificar que es JSON válido
      JSON.parse(jsonContent);
      console.log('[google-services-hook] ✅ JSON válido');
    } catch (err) {
      console.error(`[google-services-hook] ❌ Error al procesar GOOGLE_SERVICES_JSON_B64: ${err.message}`);
      throw err;
    }
  }
}

main().catch(console.error);
