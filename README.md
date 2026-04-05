# GTA 5 Interactive Map

A custom interactive map for GTA 5 that supports:

- **Territories** – Mark gang zones, districts, or any region with colored polygons and labels
- **Points of interest (POI)** – Pin locations (stores, missions, collectibles, spawns, etc.) with categories and notes

## Quick start

1. **Add your map image**  
   Place a top-down GTA 5 map image in `assets/` and set its path in the app (e.g. `assets/gta5-map.png`).  
   Common sizes: 8192×8192 or 5000×5000 px. The app works with any image size.

2. **Run locally**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000

3. **Use the map**
   - Open **Map options** in the header for **profiles**, **layer toggles** (territories, POIs, heatmap, clustering, territory fade), and **snapshots**.
   - Use **Draw territory** to add gang/region polygons; **Add POI** to place markers (click the map first, then fill the form in the modal).
   - Data is saved in your browser (**localStorage**) for the **active profile** (see below).

## Profiles

- **Main map (default)** is the usual place for your data. You can add **extra profiles** (sandboxes or alternate maps) under **Map options** → **New profile**.
- **Export / Import** and **Save to server** / **Load from server** always apply to **whichever profile is active**. The export JSON includes a `profileId` field for reference.
- **Copy from another profile** (in Map options) can **merge** (same rules as file import) or **replace** the current profile with a copy of another.
- The header shows a small badge (**Main view** vs **Personal view · …**) so you know which profile is loaded.

## Search

- Use the **search box** in the header to filter the **Territories** and **Points of interest** lists.
- **Territories** match on name, category/group, and gang/type.
- **POIs** match on name, category, **notes**, and image URL text.
- Matching is **case-insensitive substring**: your search text must appear **in order** as one contiguous piece of that combined text.  
  - Good for comma-separated notes like `car parts, blow torch, rubber` — search **`rubber`**, **`car parts`**, or **`blow torch`** separately.  
  - A single search like `car rubber` will **not** match unless that exact phrase appears in the notes.
- Press **Enter** to pan/zoom the map to the **first** matching territory or POI.

## Settings (category colors)

- **Settings** in the header opens the **workbench** where you set **territory** and **POI** category color palettes (multiple shades per category). These are saved locally and included in **export/import** and server sync.

## Sharing and merging data

- **Export data** – Downloads a JSON file with all territories and POIs (each item has a unique `id`).
- **Import data (merge)** – Load a JSON file and *merge* with your current data:
  - **Same id** → incoming version overwrites yours (no duplicate).
  - **New id** → item is added.
  - Example: you have 20 items, someone sends you their export with 2 new items and 1 updated; after import you have 21 items and the updated one is replaced.
- **Server sync (optional)** – Use **Load from server** and **Save to server** to share one map across people. Two options:
  - **Firebase (recommended)** – Free, no backend to run. See [Firebase setup](#firebase-setup) below.
  - **REST API** – Set `DATA_CONFIG.serverUrl` in `js/config.js`. Your server: GET returns `{ version, territories, poi }`; POST/PUT accepts and stores that JSON.

**Local-only, manual sync:** Keep `DATA_CONFIG.firebase` and `serverUrl` as `null`. Each person has their own copy in the browser. To share updates: one person **Export data**, sends the JSON file (e.g. in chat or repo); others **Import data (merge)** every few days. Same IDs merge (no duplicates), new IDs are added.

### Firebase setup

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Firestore Database** (Create database → start in test mode, or use the rules below).
3. Go to **Project settings** (gear) → **Your apps** → **Add app** → Web (</>). Copy the `firebaseConfig` object.
4. In `js/config.js`, set `DATA_CONFIG.firebase` to that object, e.g.:
   ```js
   firebase: {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...',
   },
   ```
5. In Firestore, go to **Rules** and paste the contents of `firestore.rules` (or use test mode for quick testing). The rules allow read/write to `mapData/{mapId}`; tighten them (e.g. `request.auth != null`) if you want auth later.
6. Reload the app – **Load from server** and **Save to server** will sync with Firestore. Everyone using the same `firebaseMapId` (default: `'default'`) shares one map.

### Secure login for live use

To require sign-in before anyone can use the map:

1. **Enable Firebase Authentication** in your Firebase project: Console → Build → Authentication → Get started. Enable **Email/Password** (and optionally **Google**).
2. In `js/config.js`, set:
   ```js
   AUTH_CONFIG: {
     requireAuth: true,
     signInMethods: ['email'],   // or ['email', 'google']
   },
   ```
3. **Firestore rules**: In Firebase Console → Firestore → Rules, require auth so only signed-in users can read/write:
   ```text
   match /mapData/{mapId} {
     allow read, write: if request.auth != null;
   }
   ```
4. Reload the app. Users see a sign-in screen; they can **Sign in** (existing) or **Create account** (new). After sign-in they use the map; **Sign out** appears in the header.

If you add `'google'` to `signInMethods`, enable Google in Authentication → Sign-in method and the “Sign in with Google” button will appear.

## Deploy to GitHub Pages (with shared data)

GitHub Pages serves **static files only** – it cannot run a backend or store data. You can still have **server-side saving and a shared collaborative map** by hosting the app on Pages and using **Firebase** for the data:

1. **Set up Firebase** (see [Firebase setup](#firebase-setup)) and put your `firebaseConfig` in `js/config.js`. Everyone who opens the map will use the same Firestore data when they use **Load from server** / **Save to server**.

2. **Push the repo to GitHub** and turn on Pages:
   - Repo → **Settings** → **Pages** → Source: **Deploy from a branch**
   - Branch: `main` (or `master`), folder: **/ (root)** → Save
   - The site will be at `https://<username>.github.io/<repo-name>/`

3. **If you use Firebase Auth** (sign-in): In Firebase Console → **Authentication** → **Settings** → **Authorized domains**, add `github.io` and your full Pages domain (e.g. `yourname.github.io`).

The app uses relative paths, so it works when served from a subpath like `.../gta5-interactive-map/`. No build step is required – just push and the published site will use Firebase for shared data.

## Map image

Use any full-map image (PNG/JPG). If you don’t have one, search for “GTA 5 full map high resolution” and see `assets/gta5-map.jpg` (included). To use another image, set `MAP_CONFIG.imageUrl` and `MAP_CONFIG.imageSize` in `js/config.js`.

## Tech

- Leaflet for the map and drawing
- Vanilla JS, no build step
- Data: localStorage (per profile); export/import with merge-by-ID; optional Firebase/REST for sync
- **Undo import** (header): restores the snapshot taken just before your last **Import data (merge)**. Rolling autosave runs about every five minutes (per profile).

See **TUTORIAL.md** for a step-by-step guide (adding POIs/territories, import/export, search, and profiles).
