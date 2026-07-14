// Central place that reads Expo's inlined EXPO_PUBLIC_* env. Shared packages
// never read env directly — the app injects config into them.
export const ENV = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8005/api/",
  wsBaseUrl: process.env.EXPO_PUBLIC_WS_BASE_URL ?? "ws://127.0.0.1:8005/ws",
  aiRequestTimeout: Number(process.env.EXPO_PUBLIC_AI_REQUEST_TIMEOUT ?? 240000),
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  },
};
