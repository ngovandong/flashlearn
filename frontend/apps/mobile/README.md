# FlashLearn Mobile

FlashLearn Mobile is the Expo/React Native client for FlashLearn. It lives in
the frontend npm workspace and reuses the same API, authentication, learning
rules, reminder metadata, and theme definitions as the web app.

## Features

- **Auth** — email/password and native Google sign-in, SecureStore refresh, session bootstrap
- **Home** — learning streak, actionable reminders (deep-link into study screens), Dragon chat stub
- **Library** — deck list (mine / shared / public), create deck, deck detail, edit terms, image search & translation, deck sharing (roles)
- **Study** — learn mode, deck revise (quiz + fill), mixed revise session, realtime quick-revise WebSocket game
- **Practice hub** — entry points for courses, listening, grammar, speaking, and writing
- **Courses** — catalog, course detail, lesson audio playback, and Live Role-play scoring
- **Listening** — dictation exercises and number-listening drill
- **Grammar** — unit catalog and auto-graded exercises
- **Speaking coach** — generate conversations, line-by-line TTS, microphone capture & pronunciation analysis
- **Writing coach** — chat mode, free-form drafts with AI feedback
- **Settings** — theme mode/palette, daily reminder, logout

Web-only concepts (Dragon onboarding tours, drag-to-position) are intentionally excluded.

## Tech stack

- Expo SDK 57 and React Native 0.86
- React 19 and TypeScript (strict mode)
- Expo Router 57 for file-based routes and tabs
- React Native Paper 5 for Material Design components and theming
- React Native Reanimated 4 + Gesture Handler for animations and gestures
- Redux Toolkit for authentication/client state
- TanStack Query for server state
- Axios through the shared `@flashlearn/api` client
- Expo SecureStore for the long-lived refresh token
- expo-audio / expo-speech for audio playback, recording, and TTS
- Jest with the `jest-expo` preset

Shared workspace packages:

- `@flashlearn/core` — types, theme data, reminders, study/scoring logic
- `@flashlearn/api` — HTTP client and API service factories
- `@flashlearn/auth` — reusable Redux authentication slice

## Navigation

Authenticated app uses four tabs:

| Tab | Routes |
|-----|--------|
| **Home** | Dashboard, reminders, Dragon chat |
| **Library** | Deck list → deck detail → learn / revise / quick-revise / edit / share |
| **Practice** | Hub → courses, listening, grammar, speaking, writing, mixed revise |
| **Settings** | Theme, reminders, logout |

Hidden stack routes (opened from Practice or reminders): `/courses`, `/listening`, `/grammar`, `/speaking`, `/writing`, `/revise`, `/invite`.

## Project structure

```text
apps/mobile/
├── app/                    Expo Router routes and layouts
│   ├── (auth)/             Public authentication routes
│   └── (app)/              Authenticated tabs + feature stacks
│       ├── library/        Deck management & study flows
│       ├── practice/       Practice hub
│       ├── courses/        Speaking course lessons
│       ├── listening/      Dictation & number listening
│       ├── grammar/        Grammar units & exercises
│       ├── speaking/       AI conversation coach
│       ├── writing/        AI writing coach
│       └── revise/         Mixed revise session
├── src/
│   ├── api/                Configured native HTTP client and services
│   ├── auth/               Google OAuth, token refresh, SecureStore adapter
│   ├── components/         Shared native UI
│   ├── config/             Expo environment configuration
│   ├── features/           Feature-specific UI, hooks, and tests
│   ├── query/              TanStack Query client and keys
│   ├── store/              Redux store and authentication slice
│   ├── theme/              Shared-theme to React Native Paper mapping
│   └── utils/              Audio helpers, API error parsing
├── app.json                Expo application metadata
├── metro.config.js         npm-workspace/Metro resolution
└── .env.sample             Mobile environment template
```

## Prerequisites

- Node.js 20.19+ (22+ recommended, matching the Vite 8 monorepo)
- npm
- a running FlashLearn Django API
- Xcode with an iOS Simulator, Android Studio with an emulator, or a compatible
  Expo client on a physical device

For Google sign-in, create OAuth clients in Google Cloud for the web, iOS, and
Android application identifiers used by this app.

## Development setup

Run npm commands from the `frontend/` workspace root:

```bash
cd frontend
npm install
cp apps/mobile/.env.sample apps/mobile/.env.local
```

Edit `apps/mobile/.env.local` and set the API URL:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8005/api/
EXPO_PUBLIC_WS_BASE_URL=ws://127.0.0.1:8005/ws
```

Start the Django API from the repository root:

```bash
uv sync --frozen --no-cache
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:8005
```

Then start Expo from `frontend/`:

```bash
npm run dev:mobile
```

From the Expo terminal, open the iOS simulator, Android emulator, or scan the QR
code for a physical device. You can also run a target directly:

```bash
npm run ios -w @flashlearn/mobile
npm run android -w @flashlearn/mobile
npm run web -w @flashlearn/mobile
```

### API URL by target

- iOS Simulator: `http://127.0.0.1:8005/api/` and `ws://127.0.0.1:8005/ws`
- Android Emulator: `http://10.0.2.2:8005/api/` and `ws://10.0.2.2:8005/ws`
- Physical device: `http://<your-computer-LAN-IP>:8005/api/` and `ws://<LAN-IP>:8005/ws`

The phone and development machine must be on the same network when using a LAN
address. Keep the trailing `/api/` in the URL.

## Environment variables

Expo inlines variables prefixed with `EXPO_PUBLIC_` into the client bundle.
These values are public configuration and must never contain secrets.

| Variable | Required | Purpose |
|---|---:|---|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | FlashLearn API base URL, including `/api/` |
| `EXPO_PUBLIC_WS_BASE_URL` | Yes | WebSocket base for quick-revise game (e.g. `ws://127.0.0.1:8005/ws`) |
| `EXPO_PUBLIC_AI_REQUEST_TIMEOUT` | No | AI request timeout in milliseconds; defaults to `240000` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | For Google login | Web OAuth client used to request an ID token |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | On iOS | Native iOS OAuth client |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | On Android | Native Android OAuth client |

The native app uses the scheme `flashlearn` and the iOS/Android identifier
`site.ngovandong.flashlearn`; keep the Google OAuth clients aligned with
`app.json`.

## Authentication model

The access token stays in Redux memory. The rotating refresh token is stored in
the operating system keychain/keystore through Expo SecureStore. On startup,
`AuthGate` restores the session, obtains a fresh access token, loads the user,
and redirects to the authenticated or login route group.

Unlike the browser app, native refresh and logout requests send the refresh
token in the request body because the app does not use an HttpOnly browser
cookie. Google authentication runs in the system browser and sends the returned
ID token to the same backend account-initialization endpoint used by the web
client.

## Quality checks

From `frontend/`:

```bash
npm run typecheck -w @flashlearn/mobile
npm run test -w @flashlearn/mobile
npm run doctor -w @flashlearn/mobile
```

Run all workspace checks with:

```bash
npm run typecheck
npm test
```

## Building a release APK locally

`android/` and `ios/` are git-ignored (see `frontend/.gitignore`) — they are
regenerated from `app.json` by `expo prebuild` and should never be hand-edited.
The app icon and Android adaptive icon are defined by
`assets/images/icon.png`, `assets/images/adaptive-icon.png`, and
`assets/images/adaptive-icon-background.png` (kept in sync with the web app's
`apps/web/public/logo512.png` / `apps/web/public/icons/*.svg`), referenced from
`app.json`'s `icon` / `android.adaptiveIcon` keys.

### One-time machine setup (macOS, Homebrew)

```bash
brew install openjdk@17 android-commandlinetools
yes | "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager" --licenses
```

`android-commandlinetools` installs to `/opt/homebrew/share/android-commandlinetools`
and does not put `sdkmanager`/`adb` on `PATH` by default beyond the symlinked
binaries; Gradle only needs `ANDROID_HOME` set correctly (see below). The Gradle
build reports the exact `compileSdk` / `buildToolsVersion` / NDK version it
needs (currently 36 / 36.0.0 / 27.1.12297006 for Expo SDK 57 + RN 0.86) — if a
package is missing or a partial download left a broken NDK directory (missing
`source.properties`), reinstall it explicitly, e.g.:

```bash
"/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager" \
  "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
```

### Build

From `frontend/apps/mobile/`:

```bash
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export SENTRY_DISABLE_AUTO_UPLOAD=true   # see "Sentry" below — omit once org/project/auth token are configured

npx expo prebuild --clean --platform android   # regenerate android/ from app.json
cd android
./gradlew assembleRelease
```

Behind a TLS-inspecting VPN (Zscaler), Gradle may fail to download Maven/JitPack
artifacts until the Zscaler root CA is in the JDK truststore — see
**Common issues** below.

The APK lands at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
Without a configured release keystore, Gradle signs it with the default Expo
debug keystore — fine for sideloading/internal testing, not for the Play Store.
For a Play Store build, use `eas build -p android --profile production`
instead (see `eas.json`), which manages release signing in the cloud.

## Sentry

Crash/error reporting via `@sentry/react-native`, initialized in
`src/config/sentry.ts` and wired up in `app/_layout.tsx` (root error boundary)
and `src/query/queryClient.ts` (every failed query/mutation is reported
automatically). It's a no-op until `EXPO_PUBLIC_SENTRY_DSN` is set (see
`.env.sample`), matching the backend's `SENTRY_DSN` on/off convention.

The `@sentry/react-native` Expo plugin also hooks into release Gradle/Xcode
builds to upload source maps for de-obfuscated stack traces. That upload needs
`SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` env vars (or an
`android/sentry.properties` — regenerated by prebuild, so set these as real env
vars, not by hand-editing that file). Until those are configured, exporting
`SENTRY_DISABLE_AUTO_UPLOAD=true` before running Gradle skips the upload step
so the build doesn't fail; crash reporting itself still works without it.

## Known limitations

- **Dragon assistant (Home)** — remains a UI stub. There is no dedicated backend AI chat endpoint for the home Dragon widget (writing/grammar coaches have their own scoped endpoints).
- **Real-device audio** — PCM→WAV wrapping and TTS playback logic are unit-tested; verify legacy Gemini PCM clips and course role-play mic scoring on physical iOS/Android devices.
- **Course role-play recordings** — native sends `audio/m4a` (same as Speaking Coach). Web resamples to 16 kHz WAV via the Web Audio API; native resampling is not implemented.
- **Web-only polish** — confetti, study sound effects, swipe gestures, and onboarding tours from the web app are not ported.

## Common issues

- **The device cannot reach the API:** do not use `127.0.0.1` on Android or a
  physical phone; use the target-specific address above and verify port 8005 is
  reachable through the host firewall.
- **WebSocket game fails:** ensure `EXPO_PUBLIC_WS_BASE_URL` points to the same
  host as the API and that Django Channels is running (default `runserver` with Daphne).
- **Environment changes are ignored:** stop Expo and restart it with its cache
  cleared: `npm run start -w @flashlearn/mobile -- --clear`.
- **Google sign-in is disabled or rejected:** verify all required client IDs,
  package/bundle identifiers, and OAuth consent-screen settings.
- **Workspace packages do not resolve:** install from `frontend/`, not from
  `apps/mobile/`; Metro is configured to resolve the hoisted workspace modules.
- **Gradle fails with `PKIX path building failed` / SSL handshake (Zscaler VPN):**
  Homebrew OpenJDK 17 does not trust the Zscaler root CA, so Maven downloads
  fail (often first seen on `:10play_tentap-editor`). Import the PEM into the
  JDK truststore (repeat after `brew upgrade openjdk@17`), stop the Gradle
  daemon so it reloads the store, then rebuild. If the next error is
  `No route to host` talking to JitPack, prefer IPv4:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
keytool -importcert -noprompt \
  -alias zscaler-root-ca \
  -file /path/to/Zscaler-root-ca.pem \
  -keystore "$JAVA_HOME/libexec/openjdk.jdk/Contents/Home/lib/security/cacerts" \
  -storepass changeit
cd android
./gradlew --stop
export GRADLE_OPTS="-Djava.net.preferIPv4Stack=true"
./gradlew assembleRelease
```
