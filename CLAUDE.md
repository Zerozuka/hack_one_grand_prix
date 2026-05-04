# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Knowledge Mesh** — a single-page application for academic knowledge networking, built for Keio University. It visualizes student knowledge graphs, recommends connections, and supports faculty oversight. No build step, no npm — pure vanilla JavaScript served via Nginx in Docker.

## Running the App

```bash
# Start with Docker (recommended)
docker compose up --build

# Access at http://localhost:8080
```

Demo login credentials (from `data/demo-data.json`):
- Manager (faculty): `tanaka_prof` / `pass`
- Member (student): `alice` / `pass`

There are no linting, testing, or build commands — this is a prototype with no toolchain.

## Architecture

The entire application is three files:

- **`index.html`** — HTML shell with two top-level sections: `#authScreen` and `#appShell`
- **`app.js`** — ~1923-line monolithic vanilla JS file; all logic lives here
- **`styles.css`** — All styling

Data is loaded at startup via `fetch()` from `data/demo-data.json` (users, accounts, communities, relationships, events) and `data/courses.json` (Keio course catalog parsed from PDF).

### State Model

A single `uiState` object holds all application state. Changes to state call `renderApp()`, which re-renders the relevant panel. State is persisted to `localStorage` (keyed by version string).

### Key Subsystems in `app.js`

| Subsystem | Description |
|---|---|
| Auth | Client-side credential check against `accounts` in demo-data; sets `uiState.currentUser` |
| Role system | `isManager()` / `isMember()` gate UI features; managers see all communities and analytics |
| Graph | D3.js force-directed graph (`_graphSim` persists across renders); nodes = users, edges = knowledge relationships |
| Recommendations | Three modes: `bridge` (cross-domain connectors), `complementary` (skill pairing), `similar` (shared interests); uses weighted scoring |
| Course matching | `SYNONYM_MAP` expands Japanese academic keywords semantically before matching users to courses |
| SOS panel | BroadcastChannel API for real-time cross-tab broadcast within the same origin |
| Gamification | Scoring computed from relationship count, diversity, and activity |

### Data Shape

`demo-data.json` top-level keys: `communities`, `accounts`, `users`, `relationships`, `events`

`courses.json`: array of ~1808 course objects with `title`, `instructor`, `schedule`, `lectureContents`, `departments`, etc.

## Deployment

Single Nginx container (Alpine). `nginx.conf` routes all paths to `index.html` (SPA fallback) and exposes `/health`. Docker image copies only `index.html`, `app.js`, `styles.css`, and `data/`.
