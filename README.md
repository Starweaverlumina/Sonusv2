# SoundDeck (Kimi Agent build)

A production-oriented **soundboard / sampler web app** built with **React 19 + TypeScript + Vite**, styled with **Tailwind + shadcn/ui**.

## Features
- **Pads + banks**: organize sounds into banks and categories.
- **Upload & processing**: optional trim, normalize, and fade-in/out on import.
- **Chopper**: slice a longer clip into multiple regions and save slices as pads.
- **Playback controls**: per-pad volume, optional looping, stop/stop-all.
- **Export / import**: move your banks between devices.
- **Voice controls (browser dependent)**: basic voice-triggered actions.

## Tech
- Storage via IndexedDB (idb) for metadata + audio blobs.
- Audio via Web Audio API (single shared AudioContext).

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

## Notes
- Some capabilities (e.g., microphone/voice) depend on browser permissions and support.
