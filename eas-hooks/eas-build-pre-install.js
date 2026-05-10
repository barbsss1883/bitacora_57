// eas-hooks/eas-build-pre-install.js
//
// EAS corre este script automáticamente ANTES de instalar dependencias npm
// y ANTES de que Gradle corra.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

// ===== MAPBOX TOKEN =====
function setupMapbox() {
  const token = process.env.MAPBOX_DOWNLOADS_TOKEN;

  if (!token) {
    console.error(
      '\n[mapbox-hook] ❌ MAPBOX_DOWNLOADS_TOKEN no encontrado en variables de entorno.\n' +
      '  Verifica que el secret existe en EAS: eas env:list\n'
    );
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

  const verify = fs.readFileSync(gradlePath, 'utf8');
  if (verify.includes('MAPBOX_DOWNLOADS_TOKEN')) {
    console.log(`[mapbox-hook] ✅ Verificado: ${gradlePath}`);
  } else {
    console.error('[mapbox-hook] ❌ No se pudo verificar la escritura');
  }
}

// ===== GOOGLE SERVICES =====
function setupGoogleServices() {
  const googleServicesB64 = process.env.GOOGLE_SERVICES_JSON_B64;
  const googleServicesPath = path.join(process.cwd(), 'google-services.json');

  console.log('[google-services-hook] Verificando GOOGLE_SERVICES_JSON_B64...');

  // Si el archivo ya existe, no hacer nada
  if (fs.existsSync(googleServicesPath)) {
    console.log('[google-services-hook] ✅ google-services.json ya existe, saltando');
    return;
  }

  if (!googleServicesB64) {
    console.error(
      '\n[google-services-hook] ❌ GOOGLE_SERVICES_JSON_B64 no encontrado en variables de entorno.\n' +
      '  Asegúrate de que el secret se creó: eas env:list\n' +
      '  Si necesitas actualizarlo: eas env:create --name GOOGLE_SERVICES_JSON_B64\n'
    );
    return;
  }

  try {
    console.log('[google-services-hook] Decodificando base64...');
    const jsonContent = Buffer.from(googleServicesB64, 'base64').toString('utf8');
    
    console.log('[google-services-hook] Validando JSON...');
    JSON.parse(jsonContent);
    
    console.log('[google-services-hook] Escribiendo archivo...');
    fs.writeFileSync(googleServicesPath, jsonContent);
    
    console.log(`[google-services-hook] ✅ google-services.json creado en: ${googleServicesPath}`);
    console.log('[google-services-hook] ✅ JSON válido');
  } catch (err) {
    console.error(`[google-services-hook] ❌ Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('[EAS Build Hook] Iniciando setup...\n');
  try {
    setupMapbox();
    setupGoogleServices();
    console.log('\n[EAS Build Hook] ✅ Setup completado exitosamente');
  } catch (err) {
    console.error('\n[EAS Build Hook] ❌ Error durante setup:', err.message);
    process.exit(1);
  }
}

// Si se ejecuta directamente, ejecutar main
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

// Exportar funciones para uso en otros scripts
module.exports = { setupMapbox, setupGoogleServices, main };

