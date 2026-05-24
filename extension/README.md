# Flashlearn Chrome Extension

Chrome extension for Flashlearn — select text on any page to translate and save terms to your default deck.

## Setup

```bash
cd extension
cp .env.sample .env   # edit URLs for your environment
npm install
npm run build
```

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/build` folder

## Environment variables

| Variable | Description |
|----------|-------------|
| `REACT_APP_BASE_URL` | Flashlearn API base URL (with trailing slash) |
| `REACT_APP_CRAWLER_URL` | Crawler/images API base URL |
| `REACT_APP_BASE_FRONTEND_URL` | Flashlearn web app URL (used for login) |

The frontend URL must also appear in `public/manifest.json` under `content_scripts` → `loginScript` matches so auth can sync after login.

## Development

```bash
npm start    # popup UI only (CRA dev server)
npm run build
npm test
```

After code changes, rebuild and click **Reload** on the extension in `chrome://extensions`.

## Usage

1. Click the extension icon → **Connect Account** (opens Flashlearn web app)
2. Log in on the website — the token syncs automatically
3. Open the popup and set a **Default Deck** and **Translation Language**
4. Select text on any webpage — click the Flashlearn icon to translate and save
5. Optional: enable **Open on browser start** in the popup to open Flashlearn when you launch the browser
