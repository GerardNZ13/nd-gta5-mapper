/**
 * Firebase Firestore sync. Load/save map data when DATA_CONFIG.firebase is set.
 */
(function () {
  const config = typeof DATA_CONFIG !== 'undefined' && DATA_CONFIG ? DATA_CONFIG : {};
  const firebaseConfig = config.firebase;
  const mapId = config.firebaseMapId || 'default';
  const COLLECTION = 'mapData';

  if (!firebaseConfig || !firebaseConfig.apiKey) {
    window.loadFromFirebase = async function () {
      throw new Error('Firebase not configured. Set DATA_CONFIG.firebase in js/config.js');
    };
    window.saveToFirebase = async function () {
      throw new Error('Firebase not configured. Set DATA_CONFIG.firebase in js/config.js');
    };
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.warn('Firebase init failed', e);
    window.loadFromFirebase = async () => { throw e; };
    window.saveToFirebase = async () => { throw e; };
    return;
  }

  const db = firebase.firestore();

  window.loadFromFirebase = async function (mergeWithCurrent) {
    const docRef = db.collection(COLLECTION).doc(mapId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { version: 2, territories: [], poi: [] };
    }
    const data = snap.data();
    const payload = {
      version: data.version || 2,
      territories: data.territories || [],
      poi: data.poi || [],
      categoryColors: data.categoryColors || {},
      hiddenTerritoryIds: data.hiddenTerritoryIds || [],
      hiddenPoiIds: data.hiddenPoiIds || [],
      settings: data.settings || {},
    };
    if (mergeWithCurrent && typeof mergeImportData === 'function') {
      mergeImportData(payload);
    }
    return payload;
  };

  window.saveToFirebase = async function () {
    const data = {
      version: 2,
      territories: getTerritoriesFromStorage(),
      poi: getPoiFromStorage(),
      categories: typeof getAllCategoriesFromPois === 'function' ? getAllCategoriesFromPois() : [],
      categoryColors: typeof getCategoryColorsFromStorage === 'function' ? getCategoryColorsFromStorage() : {},
      hiddenTerritoryIds: typeof getHiddenTerritoryIds === 'function' ? getHiddenTerritoryIds() : [],
      hiddenPoiIds: typeof getHiddenPoiIds === 'function' ? getHiddenPoiIds() : [],
      settings: typeof getMapSettings === 'function' ? getMapSettings() : {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = db.collection(COLLECTION).doc(mapId);
    await docRef.set(data);
    return data;
  };
})();
