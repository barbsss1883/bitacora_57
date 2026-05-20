const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Fuerza supabase al build CJS en lugar del UMD que usa dynamic import() incompatible con Hermes
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return {
      filePath: require.resolve('@supabase/supabase-js/dist/index.cjs'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
