/**
 * Map configuration – adjust for your GTA 5 map image
 * Map image: top-down view, any resolution (e.g. 8192×8192 or 5000×5000)
 */
const MAP_CONFIG = {
  // Path to your map image (relative to index.html)
  imageUrl: 'assets/gta5-map.jpg',
  // Pixel dimensions of the image (width, height)
  imageSize: [8192, 8192],
  // Optional: game coordinate bounds [minX, minY, maxX, maxY] if you want to match in-game coords
  // For a simple image overlay we use [0, 0] to [width, height]
  get bounds() {
    return [[0, 0], [this.imageSize[1], this.imageSize[0]]];
  },
};

/**
 * Shared data: choose one of these (or leave both null for export/import only).
 *
 * Option A – Firebase Firestore (recommended: free tier, no backend to run)
 *   - Create a project at https://console.firebase.google.com
 *   - Enable Firestore Database
 *   - Project settings → Your apps → Add web app → copy the firebaseConfig object
 *   - Paste it below as firebase: { apiKey, authDomain, projectId, ... }
 *
 * Option B – REST API
 *   - Set serverUrl to your endpoint. GET returns { territories, poi }; POST/PUT saves it.
 */
const DATA_CONFIG = {
  // Firebase: set this to your firebaseConfig from Firebase Console → Project settings
  firebase: null,
  // Document id for the shared map (e.g. 'default' or a custom map id)
  firebaseMapId: 'default',

  // REST fallback (used only if firebase is null)
  serverUrl: null,
  saveMethod: 'POST',
};

/**
 * Secure login for live use. Requires Firebase (DATA_CONFIG.firebase).
 * When true: users must sign in before using the map; Firestore rules should require request.auth.
 */
const AUTH_CONFIG = {
  requireAuth: false,
  // Sign-in methods to show: 'email' (email+password), 'google'
  signInMethods: ['email'],
};
