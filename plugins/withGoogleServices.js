const { withAppBuildGradle, withMainActivity } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGoogleServices(config) {
  return config;
};

// Hook que se ejecuta ANTES de prebuild
const prePluginHook = () => {
  console.log('[google-services-plugin] Verificando google-services.json...');
  
  const googleServicesB64 = process.env.GOOGLE_SERVICES_JSON_B64;
  const googleServicesPath = path.join(process.cwd(), 'google-services.json');

  if (fs.existsSync(googleServicesPath)) {
    console.log('[google-services-plugin] ✅ google-services.json existe');
    return;
  }

  if (!googleServicesB64) {
    console.warn(
      '\n[google-services-plugin] ⚠️  GOOGLE_SERVICES_JSON_B64 no encontrado.\n' +
      '  Creando archivo vacío de prueba (esto fallará en build real)...\n'
    );
    fs.writeFileSync(googleServicesPath, '{}');
    return;
  }

  try {
    const jsonContent = Buffer.from(googleServicesB64, 'base64').toString('utf8');
    fs.writeFileSync(googleServicesPath, jsonContent);
    console.log('[google-services-plugin] ✅ google-services.json creado desde GOOGLE_SERVICES_JSON_B64');
    
    // Verificar JSON válido
    JSON.parse(jsonContent);
    console.log('[google-services-plugin] ✅ JSON válido');
  } catch (err) {
    console.error(`[google-services-plugin] ❌ Error: ${err.message}`);
    throw err;
  }
};

// Exportar el hook para que se ejecute
if (require.main === module) {
  prePluginHook();
}

module.exports.prePluginHook = prePluginHook;
