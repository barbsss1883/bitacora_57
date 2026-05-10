const fs = require('fs');
const path = require('path');

const gsPath = path.resolve(__dirname, 'google-services.json');

// Safety net: decode from env var if the pre-install hook hasn't run yet
if (!fs.existsSync(gsPath) && process.env.GOOGLE_SERVICES_JSON_B64) {
  try {
    const content = Buffer.from(process.env.GOOGLE_SERVICES_JSON_B64, 'base64').toString('utf8');
    fs.writeFileSync(gsPath, content);
  } catch (_) {}
}

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: fs.existsSync(gsPath) ? './google-services.json' : undefined,
  },
  plugins: config.plugins.map((plugin) => {
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
});
