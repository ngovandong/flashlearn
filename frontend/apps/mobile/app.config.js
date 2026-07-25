// Dynamic Expo config layered on top of app.json. Its only job is to feed the
// Google Sign-In plugin the iOS URL scheme (the reversed iOS OAuth client ID),
// which lives in EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and therefore can't be
// hard-coded in the static app.json.
const GOOGLE_PLUGIN = "@react-native-google-signin/google-signin";

/** Build the reversed-client-id URL scheme Google requires on iOS, or return
 * undefined when no real iOS client id is configured (e.g. the placeholder). */
function iosUrlSchemeFromClientId(iosClientId) {
  if (!iosClientId) return undefined;
  const suffix = ".apps.googleusercontent.com";
  const id = iosClientId.endsWith(suffix)
    ? iosClientId.slice(0, -suffix.length)
    : iosClientId;
  if (!id || id === "xxxxxxxx") return undefined;
  return `com.googleusercontent.apps.${id}`;
}

module.exports = ({ config }) => {
  const iosUrlScheme = iosUrlSchemeFromClientId(
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  );

  const plugins = (config.plugins || []).flatMap((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== GOOGLE_PLUGIN) return [plugin];
    // The google-signin config plugin only wires up the iOS URL scheme and
    // *requires* a valid `iosUrlScheme`. Include it only when we have one;
    // otherwise drop it — Android autolinks the native module regardless, and
    // EAS evaluates the config without loading .env (EXPO_NO_DOTENV).
    return iosUrlScheme ? [[GOOGLE_PLUGIN, { iosUrlScheme }]] : [];
  });

  return { ...config, plugins };
};
