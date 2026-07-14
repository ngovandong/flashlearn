# FlashLearn Web

React web application built with Vite.

Run commands from the `frontend` workspace root:

```bash
npm install
npm run dev:web
npm run build:web
npm test -w @flashlearn/web
npm run lint -w @flashlearn/web
```

The development server runs at <http://localhost:3000>. Production assets are
written to `dist/`.

Copy `.env.sample` to `.env` for local configuration. Client-visible
environment variables use the `VITE_` prefix.
