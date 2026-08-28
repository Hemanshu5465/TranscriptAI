# TranscriptAI — frontend

React 19 + TypeScript + Vite + Tailwind v4. See the [root README](../README.md)
for the full picture.

## Commands

```bash
npm run dev         # http://localhost:5173, proxies /api → http://localhost:8899
npm run build       # tsc -b + vite build → dist/
npm run preview     # serve the production build
npm test            # vitest run
npm run typecheck   # tsc -b --noEmit
```

Point the dev proxy at a non-default API:

```bash
VITE_API_PROXY=http://localhost:8123 npm run dev
```

## Layout

```
src/
├── lib/          api client, types, youtube-url parsing, formatting, transcript text builders
├── store/        auth (zustand), theme (light/dark/system, persisted)
├── hooks/        job polling, transcript search, undo/redo, debounce, YouTube IFrame player, toasts
├── components/   Button, Menu, UrlComposer, StageChecklist, VideoPanel, StatsPanel,
│                 TranscriptWorkspace / Toolbar / SegmentRow / SearchPanel, Toaster, States
├── pages/        Landing, Processing, Transcript, Dashboard, Login/Register, NotFound
└── layouts/      RootLayout (header + footer + auth state)
```

## Design system

Tokens live in `src/index.css` under `:root` / `.dark` and are exposed to Tailwind
via `@theme inline`. "Editorial precision" direction: warm paper light theme, deep
ink dark theme, one burnt-sienna accent, Fraunces (display) + Newsreader
(transcript reading) + Archivo (UI) + JetBrains Mono (timestamps). Respects
`prefers-reduced-motion`; focus rings are always visible.

## Notes

- URL validation in `lib/youtube.ts` mirrors `backend/app/utils/youtube_url.py` —
  change both together.
- The transcript list is virtualized (`@tanstack/react-virtual`) so multi-hour
  videos stay smooth.
- The YouTube IFrame API is loaded on demand for click-to-seek.
