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
- **Courses** — catalog, course detail, lesson audio playback
- **Listening** — dictation exercises and number-listening drill
- **Grammar** — unit catalog and auto-graded exercises
- **Speaking coach** — generate conversations, line-by-line TTS, microphone capture & pronunciation analysis
- **Writing coach** — chat mode, free-form drafts with AI feedback
- **Settings** — theme mode/palette, daily reminder, logout

Web-only concepts (Dragon onboarding tours, drag-to-position) are intentionally excluded.

## Tech stack

- Expo SDK 51 and React Native 0.74
- React 18 and TypeScript (strict mode)
- Expo Router for file-based routes and tabs
- React Native Paper for Material Design components and theming
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

- Node.js 18 or newer
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
