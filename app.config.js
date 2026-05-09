// Inyecta variables de entorno sensibles que no deben estar en app.json
module.exports = ({ config }) => ({
  ...config,
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
