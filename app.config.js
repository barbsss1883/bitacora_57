const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('@expo/config-plugins');

const gsPath = path.resolve(__dirname, 'google-services.json');
const MLKIT_BARCODE_ACTIVITY = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

// Safety net: decode from env var if the pre-install hook hasn't run yet
if (!fs.existsSync(gsPath) && process.env.GOOGLE_SERVICES_JSON_B64) {
  try {
    const content = Buffer.from(process.env.GOOGLE_SERVICES_JSON_B64, 'base64').toString('utf8');
    fs.writeFileSync(gsPath, content);
  } catch (_) {}
}

const withLargeScreenAndroidCompatibility = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.$ = {
      ...manifest.$,
      'xmlns:tools': manifest.$?.['xmlns:tools'] || 'http://schemas.android.com/tools',
    };

    const application = manifest.application?.[0];
    if (!application) return config;

    application.activity = application.activity || [];

    application.activity.forEach((activity) => {
      const name = activity.$?.['android:name'];
      if (name === '.MainActivity' || name === 'com.luisg0418.bitacora57.MainActivity') {
        delete activity.$['android:screenOrientation'];
      }
    });

    const mlkitActivity = application.activity.find(
      (activity) => activity.$?.['android:name'] === MLKIT_BARCODE_ACTIVITY
    );

    if (mlkitActivity) {
      delete mlkitActivity.$['android:screenOrientation'];
      mlkitActivity.$['tools:node'] = 'merge';
      mlkitActivity.$['tools:remove'] = 'android:screenOrientation';
    } else {
      application.activity.push({
        $: {
          'android:name': MLKIT_BARCODE_ACTIVITY,
          'tools:node': 'merge',
          'tools:remove': 'android:screenOrientation',
        },
      });
    }

    return config;
  });

module.exports = ({ config }) => {
  const nextConfig = {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: fs.existsSync(gsPath) ? './google-services.json' : undefined,
    },
    plugins: (config.plugins || []).map((plugin) => {
      if (Array.isArray(plugin) && plugin[0] === '@rnmapbox/maps') {
        return [
          plugin[0],
          {
            ...plugin[1],
            RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
          },
        ];
      }
      return plugin;
    }),
  };

  return withLargeScreenAndroidCompatibility(nextConfig);
};
