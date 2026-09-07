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


| Tab          | Routes                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| **Home**     | Dashboard, reminders, Dragon chat                                      |
| **Library**  | Deck list → deck detail → learn / revise / quick-revise / edit / share |
| **Practice** | Hub → courses, listening, grammar, speaking, writing, mixed revise     |
| **Settings** | Theme, reminders, logout                                               |


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


| Variable                               | Required         | Purpose                                                              |
| -------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`             | Yes              | FlashLearn API base URL, including `/api/`                           |
| `EXPO_PUBLIC_WS_BASE_URL`              | Yes              | WebSocket base for quick-revise game (e.g. `ws://127.0.0.1:8005/ws`) |
| `EXPO_PUBLIC_AI_REQUEST_TIMEOUT`       | No               | AI request timeout in milliseconds; defaults to `240000`             |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`     | For Google login | Web OAuth client used to request an ID token                         |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`     | On iOS           | Native iOS OAuth client                                              |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | On Android       | Native Android OAuth client                                          |


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



## Building & running iOS (Simulator and Physical iPhone)

Because FlashLearn uses custom native modules (`@10play/tentap-editor`, `expo-audio`,
`@react-native-google-signin/google-signin`, `expo-gl`), standard Expo Go cannot
run the full app. You must build a **development client** or compile the native
project with Xcode.

### 1. One-time macOS setup

1. **Install full Xcode:**
   - From the Mac App Store, or download the `.xip` directly from
     [developer.apple.com/download/all/](https://developer.apple.com/download/all/)
     (useful on MDM-managed Macs where App Store is blocked).
   - If using the CLI, `xcodes` (`brew install --cask xcodes-app` or the standalone
     binary) can download and extract Xcode without the App Store:
     ```bash
     xcodes install 16.2
     ```
2. **Configure Command Line Tools & accept license:**
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   sudo xcodebuild -runFirstLaunch
   ```
3. **Install CocoaPods:**
   ```bash
   brew install cocoapods
   ```
4. **Install an iOS Simulator Runtime:**
   Xcode does not bundle an iOS runtime by default. If `xcrun simctl list devices available`
   shows no devices (or `CommandError: No iOS devices available in Simulator.app`),
   download the iOS platform runtime:
   ```bash
   xcodebuild -downloadPlatform iOS
   ```
   *(Alternatively: open Xcode > **Settings** > **Platforms** / **Components** and click **Get** next to the latest iOS Simulator).*

---

### 2. Environment configuration (`.env.local`)

In `frontend/apps/mobile/`:
```bash
cp .env.sample .env.local
```

Configure `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_WS_BASE_URL` depending on your target:

| Target | `EXPO_PUBLIC_API_BASE_URL` | `EXPO_PUBLIC_WS_BASE_URL` |
|---|---|---|
| **iOS Simulator** | `http://127.0.0.1:8005/api/` | `ws://127.0.0.1:8005/ws` |
| **Physical iPhone** | `http://<YOUR-MAC-LAN-IP>:8005/api/` | `ws://<YOUR-MAC-LAN-IP>:8005/ws` |

> **Note for Physical Devices:** Find your Mac's LAN IP via `ipconfig getifaddr en0`. Both your Mac and iPhone must be on the same Wi-Fi network and port 8005 must be open through the firewall.

---

### 3. Running on the iOS Simulator (macOS)

From `frontend/apps/mobile/`:
```bash
npx expo run:ios
```
Or from the `frontend/` monorepo root:
```bash
npm run ios -w @flashlearn/mobile
```

**What this does:**
1. Launches Simulator.app (defaulting to the latest iPhone runtime).
2. Compiles native pods and Swift/Objective-C code via `xcodebuild`.
3. Installs the development app on the simulator.
4. Starts the Metro bundler with fast refresh and hot-reloading.

**Targeting a specific simulator model:**
```bash
# List available simulators
xcrun simctl list devices available

# Boot and run on a specific model
npx expo run:ios --simulator="iPhone 16 Pro"
```

---

### 4. Running on a Physical iPhone

Testing on a real iPhone requires enabling Developer Mode, setting up free code signing in Xcode, and installing the app over USB or Wi-Fi.

#### Step 1: Enable Developer Mode on iPhone
1. On your iPhone running iOS 16+, open **Settings** > **Privacy & Security**.
2. Scroll to the bottom and tap **Developer Mode**.
3. Toggle it **ON** and reboot your device when prompted.
4. After restarting, unlock your device and tap **Turn On** to confirm.

#### Step 2: Configure Code Signing in Xcode
1. Connect your iPhone to your Mac via USB cable (tap **Trust This Computer** on your iPhone).
2. Open the Xcode workspace:
   ```bash
   open ios/FlashLearn.xcworkspace
   ```
3. In Xcode's left sidebar, click the top-level **FlashLearn** project.
4. Select the **FlashLearn** target under "Targets", then open the **Signing & Capabilities** tab.
5. Check **Automatically manage signing**.
6. Under **Team**, select your Apple Account (Personal Team). Any free personal Apple ID works.
7. *If Xcode reports a Bundle Identifier conflict:* adjust the **Bundle Identifier** temporarily (e.g. `site.ngovandong.flashlearn.dev`) in the Signing tab.

#### Step 3: Build and install

**Option A — Via Expo CLI:**
```bash
cd frontend/apps/mobile

# Debug build (streams JS dynamically from Mac Metro bundler):
npx expo run:ios --device

# Standalone Release build (embeds JS bundle directly on device):
npx expo run:ios --configuration Release --device "Hachanndayy" --no-bundler
```
Select your connected iPhone from the interactive prompt (or pass the exact device name with `--device "<Device Name>"`).

**Option B — Directly in Xcode:**
1. In Xcode's top toolbar, click the device selector next to the **FlashLearn** scheme.
2. Select your connected physical iPhone (instead of a simulator).
3. Press **Run (⌘R)** or click the **Play** button. Xcode builds and installs the app onto your phone.

#### Step 4: Trust the Developer Certificate on iPhone
The first time you install an app signed with a free personal Apple ID, iOS blocks launch:
1. On your iPhone, open **Settings** > **General** > **VPN & Device Management**.
2. Under **Developer App**, tap your Apple ID.
3. Tap **Trust "[Your Apple ID]"** and confirm.
4. Open the **FlashLearn** app from your home screen.

---

### 5. Running Standalone on iPhone (Cable Unplugged & MacBook Turned Off)

By default, `npx expo run:ios --device` builds in **Debug** mode, which loads the JavaScript bundle live from the Metro bundler on your Mac and launches into the Expo Dev Launcher. If you close your laptop or unplug, the app will fail with "No dev server found".

To install FlashLearn as a fully standalone, offline app that boots directly to the Login screen:

1. **Point `.env.local` to a live/staging backend:**
   ```dotenv
   EXPO_PUBLIC_API_BASE_URL=https://flashlearnapi.dongkiemem.site/api/
   EXPO_PUBLIC_WS_BASE_URL=wss://flashlearnapi.dongkiemem.site/ws
   ```

2. **Build and install via CLI (fastest, no Xcode UI required):**
   ```bash
   cd frontend/apps/mobile

   # On physical iPhone:
   npx expo run:ios --configuration Release --device --no-bundler

   # Or specify the exact device name:
   npx expo run:ios --configuration Release --device "Hachanndayy" --no-bundler

   # On iOS Simulator:
   npx expo run:ios --configuration Release --simulator "iPhone 17" --no-bundler
   ```
   **What each flag does:**
   - `--configuration Release`: Bundles and embeds all JavaScript code + assets directly into the binary, removing the Expo Dev Launcher and Metro dependency.
   - `--device [name]`: Targets your connected physical iPhone.
   - `--no-bundler`: Skips starting the local Metro server because the app has everything embedded.

3. **Alternative: Build via Xcode UI:**
   - Open `ios/FlashLearn.xcworkspace` in Xcode.
   - Go to menu **Product** > **Scheme** > **Edit Scheme...** (or press `⌘<`).
   - Select **Run** in the left column.
   - Under the **Info** tab, change **Build Configuration** from `Debug` to **`Release`**.
   - Uncheck **Debug executable** and click **Close**.
   - Select your physical iPhone in the top toolbar and press **Run (`⌘R`)**.

4. **Unplug & Go:**
   - You can stop Xcode / CLI, unplug the USB cable, and turn off your MacBook. FlashLearn will run like any standard App Store application.

> **Note on Free Apple ID Certificate Expiration:**
> Apple allows free Personal Team certificates to run on physical devices for **7 days**. After 7 days, iOS will display *"FlashLearn is no longer available"*. Simply plug your phone back in and re-run the build command or hit **`⌘R`** in Xcode to refresh the signature for another 7 days (all user data and logins are preserved). Paid Apple Developer accounts ($99/yr) stay valid for 1 year or 90 days via TestFlight.

---

### 6. Alternative: Cloud Builds via EAS (No local Xcode required)

If you cannot install Xcode locally or need to share test builds:
1. **Simulator Build (free, no Apple Developer Account needed):**
   ```bash
   cd frontend/apps/mobile
   npx eas-cli build -p ios --profile preview
   ```
   Download the resulting `.tar.gz`, extract the `FlashLearn.app` bundle, and drag it onto the iOS Simulator window.
2. **Internal Distribution for Real Device:**
   Requires a paid Apple Developer account ($99/year) to register device UDIDs and manage ad-hoc provisioning:
   ```bash
   npx eas-cli device:create
   npx eas-cli build -p ios --profile preview
   ```

---

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

Size-optimization flags are already enabled in `app.json`, which brings this
APK from 123 MB down to ~30 MB. Note that R8 needs a larger Gradle heap than
Expo's default, so pass `-Dorg.gradle.jvmargs="-Xmx8g -XX:MaxMetaspaceSize=2g"`
to `assembleRelease`. See **Reducing the release build size** below.

## Reducing the release build size

With Expo's stock prebuild settings, `./gradlew assembleRelease` produced a
**123 MB** `app-release.apk`: a universal build containing every ABI, storing
native libraries and the JS bundle uncompressed, with R8 disabled. Nearly all
of that weight turned out to be recoverable without touching a single feature —
it now builds at **30.5 MB**.

The sections below explain each lever, because the flags are only correct for
this app's dependency set and you will need to revisit them when adding native
modules. Everything except the icon-font exclusion (§5) is already applied in
`app.json`.

### Where the size goes

Measured on the original 123 MB APK (compressed, i.e. actual contribution to
the file):


| Part                          | Size    | Notes                                                                               |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `lib/` × 4 ABIs               | 84.1 MB | `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`, all stored uncompressed                |
| `classes*.dex` (5 files)      | 18.2 MB | 49.9 MB uncompressed — R8 is off, so nothing is shrunk                              |
| `assets/index.android.bundle` | 8.7 MB  | Hermes bytecode, stored uncompressed                                                |
| `res/*.ttf` (21 families)     | 2.4 MB  | every `@expo/vector-icons` font, though only two are used                           |
| everything else               | ~10 MB  | `resources.arsc`, drawables, manifests, baseline profile, plus zip/signing overhead |


The single largest native libraries, summed across all four ABIs:
`libreactnative.so` 25.1 MB, `libhermesvm.so` 9.3 MB, `libappmodules.so`
7.2 MB, `libreanimated.so` 5.2 MB, `libexpo-modules-core.so` 5.1 MB,
`libc++_shared.so` 4.5 MB, then `librnscreens`/`libworklets`/`librnsvg`
codegen at 3–4 MB each, `libexpo-gl.so` 2.9 MB (three.js competition games),
`libzstd-kmp.so` 2.8 MB (Expo network inspector) and `libsentry.so` 2.5 MB.

### 1. Stop shipping four ABIs (−46.3 MB measured)

No physical Android phone needs `x86`/`x86_64` — those exist only for
emulators, and they cost **46.3 MB**. `arm64-v8a` alone covers every 64-bit
device (all Play Store submissions since Aug 2019).

For the Play Store, build an **AAB** and let Google split delivery per device;
this is the correct answer and needs no ABI trimming at all:

```bash
cd android && ./gradlew bundleRelease   # app/build/outputs/bundle/release/app-release.aab
# or, with cloud-managed release signing:
eas build -p android --profile production
```

For a sideloadable APK, restrict the ABI list. Because `android/` is
regenerated by `expo prebuild`, set it in `app.json` under
`expo-build-properties` (never by editing `android/gradle.properties`):

```json
["expo-build-properties", {
  "android": { "buildArchs": ["arm64-v8a", "armeabi-v7a"] }
}]
```

Or, for a one-off build without changing config:

```bash
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```



### 2. Compress native libraries and the JS bundle (−29 MB measured)

`expo.useLegacyPackaging=false` is the prebuild default, so the `.so` files are
*stored*, not deflated. They compress extremely well — 84.1 MB → 28.7 MB
(arm64-only: 22.4 MB → 7.2 MB). The Hermes bundle likewise compresses
8.7 MB → 3.8 MB.

Both are pure APK-file-size wins with a runtime tradeoff: compressed libraries
are extracted at install time (larger on-disk footprint) and a compressed
bundle slightly slows cold start. Use them for internal/sideloaded APKs; for
Play Store AABs leave them off, since Play already compresses on the wire.

```json
["expo-build-properties", {
  "android": { "useLegacyPackaging": true, "enableBundleCompression": true }
}]
```



### 3. Turn on R8 and resource shrinking (−10.6 MB measured)

`android.enableMinifyInReleaseBuilds` defaults to `false` in Expo prebuild, so
the release APK ships 49.9 MB of unminified dex across five dex files.

```json
["expo-build-properties", {
  "android": {
    "enableMinifyInReleaseBuilds": true,
    "enableShrinkResourcesInReleaseBuilds": true,
    "extraProguardRules": "-keep class com.facebook.hermes.unicode.** { *; }\n-keep class com.facebook.jni.** { *; }"
  }
}]
```

This is the one change that can break the app at runtime rather than at build
time: R8 strips classes reached only through reflection or JNI. After enabling
it, smoke-test the reflection-heavy paths — Google sign-in, Sentry, the
quick-revise WebSocket, `@10play/tentap-editor`, and the three.js games — and
add `-keep` rules to `extraProguardRules` for anything that misbehaves.

**R8 needs more heap than Expo's default.** Prebuild writes
`org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m`, and
`:app:minifyReleaseWithR8` dies against that limit with *"Gradle build daemon
has been stopped: since the JVM garbage collector is thrashing and after
running out of JVM Metaspace"*. `expo-build-properties` has no option for JVM
args, and `android/gradle.properties` is regenerated by prebuild, so either
pass it per build:

```bash
./gradlew assembleRelease -Dorg.gradle.jvmargs="-Xmx8g -XX:MaxMetaspaceSize=2g"
```

or set it once in `~/.gradle/gradle.properties`, which prebuild cannot clobber:

```properties
org.gradle.jvmargs=-Xmx8g -XX:MaxMetaspaceSize=2g
```



### 4. Drop dev-only weight from release builds

Two dev-oriented dependencies leak into the release APK on Android:

- **Expo network inspector** — `libzstd-kmp.so` (2.8 MB over four ABIs) comes
from an unconditional `implementation 'com.squareup.zstd:zstd-kmp-okio'` in
`expo/android/build.gradle`. `"networkInspector": false` in
`expo-build-properties` turns the inspector off, but because that Gradle
dependency is not variant-gated the library may still be packaged; pair it
with `packagingOptions.exclude: ["**/libzstd-kmp.so"]` to actually drop it,
and confirm release networking still works.
- `expo-dev-client` — `expo-dev-launcher`/`expo-dev-menu` are marked
`debugOnly` for Apple only, so their Kotlin classes land in the release dex
(`classes4.dex`). Harmless but dead; R8 removes most of it. If you want it
gone entirely, move `expo-dev-client` out of `dependencies` and install it
only when building a development client.

`react-native-web` and `react-dom` are also runtime `dependencies` but are only
needed for `expo start --web`; Metro leaves them out of the native bundle, so
they cost nothing in the APK.

### 5. Optional: trim unused icon fonts (~2 MB)

`@expo/vector-icons` embeds all 21 font families as Android resources, but the
app only imports `MaterialIcons` and `MaterialCommunityIcons` (plus whatever
React Native Paper resolves). This is the one item below not enabled in
`app.json` — measurements confirm `enableShrinkResourcesInReleaseBuilds` does
*not* strip these fonts (they stayed at exactly 2.4 MB), so excluding them has
to be explicit:

```json
["expo-build-properties", {
  "android": { "packagingOptions": { "exclude": ["**/FontAwesome6*.ttf", "**/Zocial.ttf", "**/Fontisto.ttf"] } }
}]
```

Verify icons still render afterwards — Paper falls back to
`MaterialCommunityIcons`, but a missing font fails silently as blank glyphs.

### Measured results

All of the above except the icon-font exclusion is now enabled in `app.json`,
which takes `app-release.apk` from **123.4 MB to 30.5 MB — a 75% reduction**.
Per-part contribution to the APK, before and after:


| Part                     | Before       | After       | Delta        |
| ------------------------ | ------------ | ----------- | ------------ |
| `lib/x86` + `lib/x86_64` | 46.3 MB      | —           | −46.3 MB     |
| `lib/arm64-v8a`          | 22.4 MB      | 7.2 MB      | −15.2 MB     |
| `lib/armeabi-v7a`        | 15.4 MB      | 6.3 MB      | −9.1 MB      |
| `classes*.dex`           | 18.2 MB      | 7.6 MB      | −10.6 MB     |
| JS bundle                | 8.7 MB       | 3.8 MB      | −5.0 MB      |
| icon fonts               | 2.4 MB       | 2.4 MB      | unchanged    |
| other                    | 3.3 MB       | 3.2 MB      | −0.1 MB      |
| **Total APK**            | **123.4 MB** | **30.5 MB** | **−92.9 MB** |


Dropping `armeabi-v7a` too would save a further ~6 MB, at the cost of 32-bit
device support. A Play Store AAB should land near the same figure per device
without any ABI trimming, since Play splits delivery itself.

> **Not yet verified on a device.** The build succeeds and the APK is
> well-formed, but R8 failures surface at runtime. Install this APK and smoke-test
> Google sign-in, Sentry reporting, the quick-revise WebSocket, the note editor,
> and the three.js games before shipping it.



### Measuring an APK

Re-run this after any change to see the real breakdown instead of guessing:

```bash
cd android/app/build/outputs/apk/release
unzip -v app-release.apk | awk 'NF>=8 && $1 ~ /^[0-9]+$/ {
  c=$3; n=$8; if (n ~ /^lib\//) {split(n,a,"/"); abi[a[2]]+=c}
  else if (n ~ /\.dex$/) d+=c; else if (n ~ /\.ttf$/) f+=c; else o+=c; t+=c
} END {
  for (k in abi) printf "lib/%-12s %8.1f MB\n", k, abi[k]/1048576
  printf "dex %18.1f MB\nfonts %16.1f MB\nother %16.1f MB\nTOTAL %16.1f MB\n",
    d/1048576, f/1048576, o/1048576, t/1048576
}'
```

For a per-class/per-library view, open the APK in Android Studio's
**Build → Analyze APK**, which also diffs two APKs.

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
- **Gradle fails with** `PKIX path building failed` **/ SSL handshake (Zscaler VPN):**
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

