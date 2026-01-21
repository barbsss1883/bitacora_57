module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Solo dejamos Reanimated. El de router ya viene incluido en el preset.
      'react-native-reanimated/plugin',
    ],
  };
};
