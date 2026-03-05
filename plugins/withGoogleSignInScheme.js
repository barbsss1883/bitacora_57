const { createRunOncePlugin, withInfoPlist } = require('expo/config-plugins');

const PLUGIN_NAME = 'with-google-signin-scheme';
const PLUGIN_VERSION = '1.0.0';

const withGoogleSignInScheme = (config, props = {}) => {
  const iosUrlScheme = props.iosUrlScheme;

  if (!iosUrlScheme) {
    throw new Error(`${PLUGIN_NAME}: missing "iosUrlScheme" option`);
  }

  if (!iosUrlScheme.startsWith('com.googleusercontent.apps.')) {
    throw new Error(
      `${PLUGIN_NAME}: "iosUrlScheme" must start with "com.googleusercontent.apps."`
    );
  }

  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const urlTypes = Array.isArray(plist.CFBundleURLTypes) ? plist.CFBundleURLTypes : [];

    const hasScheme = urlTypes.some((entry) =>
      Array.isArray(entry.CFBundleURLSchemes) &&
      entry.CFBundleURLSchemes.includes(iosUrlScheme)
    );

    if (!hasScheme) {
      if (urlTypes.length > 0 && Array.isArray(urlTypes[0].CFBundleURLSchemes)) {
        urlTypes[0].CFBundleURLSchemes.push(iosUrlScheme);
      } else {
        urlTypes.push({ CFBundleURLSchemes: [iosUrlScheme] });
      }
      plist.CFBundleURLTypes = urlTypes;
    }

    return cfg;
  });
};

module.exports = createRunOncePlugin(withGoogleSignInScheme, PLUGIN_NAME, PLUGIN_VERSION);
