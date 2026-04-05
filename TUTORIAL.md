# GTA 5 Interactive Map – Tutorial

Step-by-step guide for **adding**, **changing**, and **removing** map details (territories and POIs), plus **importing** and **exporting** data so you can share and keep the latest version in sync.

---

## 1. Adding detail

### Add a point of interest (POI)

1. Click **Add POI** in the header (the button becomes active).
2. Click on the map where you want the marker. A **modal** opens for the POI form.
3. Fill in:
   - **Name** – e.g. "Ammu-Nation", "Hidden package"
   - **Category** – pick from the dropdown (existing categories) or type a new one in "Or type category name" (that overrides the dropdown).
   - **Notes** – optional. Good for extra detail (e.g. what a shop sells or buys). **Notes are included in the header search** (see [Search](#search) below).
4. Click **Save**. The POI appears on the map and in the "Points of interest" list. Data is saved to your browser (localStorage) for the **active profile**.

### Add a territory (polygon)

1. Click **Draw territory** in the header (the button becomes active).
2. On the map, **click** to place each corner of the polygon. You’ll see a dashed line between points.
3. **Double-click** when you’re done (you need at least 3 points). The territory form opens in a **modal**.
4. Fill in:
   - **Name** – e.g. "Ballas turf", "Downtown"
   - **Gang / Type** – e.g. "Ballas", "Neutral"
   - **Color** – use the color picker for the polygon fill and border.
5. Click **Save**. The territory appears on the map and in the "Territories" list. Data is saved to localStorage.

**Tip:** Open **Map options** in the header to show/hide **Territories** and **Points of interest**, turn on the **POI heatmap** or **marker clustering**, and other layer options—without deleting anything.

---

## Search

The **search box** in the header filters the **Territories** and **Points of interest** lists in the sidebar.

| What you type | What it matches |
|----------------|-----------------|
| Territories | Name, **Category / Group**, **Gang / Type** |
| POIs | Name, category, **Notes**, image URL text |

- Search is **case-insensitive** and looks for your text as one **continuous substring** in those fields (for POIs, name, category, notes, and URL are combined for matching).
- **Comma-separated notes** (e.g. `car parts, blow torch, rubber, scrap`) work well: search for **`rubber`**, **`car parts`**, or **`torch`** as separate searches. Searching two words that don’t appear next to each other in the text (e.g. `car rubber`) may not match unless that exact phrase exists.
- Press **Enter** to move the map to the **first** matching territory (zoom to its bounds) or POI (pan to the pin).

---

## Profiles and Map options

- **Map options** (header) opens a slide-in panel: **profile** picker, **new profile**, **copy from another profile** (merge or replace), **layer** toggles, and **save snapshot**.
- **Main map (default)** is the normal profile; others are optional **personal** sandboxes. The header badge shows **Main view** or **Personal view · …**.
- **Export data** / **Import data** / server sync apply to the **active profile** only. Use **Copy from another profile** if you want the same data in more than one profile.

---

## 2. Changing detail

### Edit a POI

- **From the list:** In the sidebar under "Points of interest", click the POI name. The edit form opens; change Name, Category, or Notes, then **Save**.
- **From the map:** Click the POI marker to open its popup, then click **Edit**. Same form; edit and **Save**.

Changes are saved to localStorage immediately. If you use server sync, use **Save to server** to push your edits (see below).

### Edit a territory

- **From the list:** Under "Territories", click the territory name. The edit form opens; change Name, Gang/Type, or Color, then **Save**.
- **From the map:** Click the territory polygon to open its popup, then click **Edit**. Same form; edit and **Save**.

**Note:** The app does not support changing the polygon shape after creation. To “move” a territory, delete it and draw a new one (you can copy name/gang/color from the old one before deleting).

---

## 3. Removing detail

### Delete a POI

- **From the map:** Click the POI marker → in the popup click **Delete** → confirm.
- **From the form:** Click the POI in the list to open the edit form → click **Delete** → confirm.

The POI is removed from the map and from storage. If you use server sync, use **Save to server** after deleting so the server has the latest state.

### Delete a territory

- **From the map:** Click the territory polygon → in the popup click **Delete** → confirm.
- **From the form:** Click the territory in the list → click **Delete** → confirm.

Same as POIs: removal is local until you **Save to server** (if you use server sync).

---

## 4. Import new changes (getting others’ updates)

Import is used when someone sends you a **JSON export** of the map (or when you want to load from a server). Import **merges** with your current data; it does not replace everything.

### How merge works

- **Same ID** → the **incoming** item overwrites yours (name, position, category, etc.). No duplicate.
- **New ID** → the item is **added** to your map.
- **Your items that are not in the file** → they **stay**. Only items present in the import file are updated or added.

So: if you have 20 POIs and import a file that has 2 new POIs and 1 updated POI (same id), you end up with 21 POIs and the updated one is replaced.

### Import from a JSON file

1. Get the JSON file (e.g. `gta5-map-data.json`) from whoever has the latest version.
2. In the app, click **Import data (merge)**.
3. Choose the JSON file when prompted.
4. You’ll see an alert like: *"Merged: X territories, Y POIs. Same IDs = updated; new IDs = added."*
5. The page **reloads** so the map and lists show the merged data.

**When to use:** When a teammate or another device has added/edited/removed details and sent you their export. You merge their changes into your current map.

### Load from server (merge)

If Firebase or a REST server is set up (`js/config.js`):

1. Click **Load from server**.
2. Data is fetched and **merged** with your current data (same merge-by-id rules as file import).
3. An alert confirms load; the page **reloads**.

**When to use:** To pull the latest shared version from the server into your browser. Use this when you start a session or when someone else may have saved changes.

---

## 5. Export changes for the latest version (sharing your work)

Export creates a single JSON file with **all** current data for the **active profile**. That file is the “latest version” snapshot you can send to others or back up.

### Export to a file

1. Add/edit/remove details as needed (they’re already in localStorage).
2. Click **Export data** in the header.
3. A file downloads (e.g. `gta5-map-data.json`) with:
   - `version: 2`
   - `profileId` – which profile was active when you exported
   - `territories` – array of territory GeoJSON-style features (each has `properties.id`, `properties.name`, etc.)
   - `poi` – array of POI objects (each has `id`, `name`, `category`, `notes`, `position`)
   - `categories` and `categoryColors` – for POI categories and their colors
   - `hiddenTerritoryIds` / `hiddenPoiIds` – visibility state
   - `settings` – territory and POI category **color palette** rules from **Settings**

**When to use:** After you’ve made changes and want to send “the latest version” to someone else. They use **Import data (merge)** with this file.

**Undo import:** If a merge import went wrong, **Undo import** in the header restores the snapshot saved **just before** that import (then reloads).

### Save to server (push your version)

If Firebase or a REST server is set up:

1. Make your edits locally (add/change/remove POIs and territories).
2. Click **Save to server**.
3. Your current localStorage data (territories, POIs, category colors) is sent to the server and overwrites the stored document for the configured map ID.

**When to use:** When you’re done with a batch of edits and want the shared map (e.g. for your team or other devices) to reflect your version. Others get your changes by clicking **Load from server**.

---

## Quick reference

| Goal | Action |
|------|--------|
| Add a marker | **Add POI** → click map → fill form → **Save** |
| Add a zone | **Draw territory** → click corners → double-click to finish → fill form → **Save** |
| Change a POI or territory | Click it (list or map) → **Edit** → change fields → **Save** |
| Remove a POI or territory | Click it → **Delete** (or Edit form → **Delete**) → confirm |
| Filter lists / find on map | Type in header **search**; **Enter** = go to first match |
| Profiles / layers / snapshots | **Map options** |
| Category color palettes | **Settings** |
| Get others’ updates from a file | **Import data (merge)** → select JSON file |
| Undo a bad import | **Undo import** |
| Get latest from server | **Load from server** (merge with current) |
| Send your version to others (file) | **Export data** → send the downloaded JSON |
| Push your version to server | **Save to server** |

---

## Important details about the data

- **IDs:** Every territory has `properties.id`, every POI has `id`. These are generated when you create the item and are used for merge (same id = update, new id = add). Don’t remove or change IDs if you want merge to work correctly.
- **Export format:** The export is valid JSON. You can open it in a text editor. It includes `profileId`, `settings` (palette rules), visibility arrays, and the fields above.
- **Import format:** The file you import should have the same shape (at least `territories` and `poi` as arrays). Missing `categoryColors` or `settings` is fine; present fields are merged where applicable.
- **Reload after import:** The app reloads the page after a successful file import so the map and lists reflect the merged data. After **Load from server** it also reloads.

If you use **only** localStorage (no server): share updates by **Export data** → send file → others **Import data (merge)**. If you use **Firebase or REST**: use **Load from server** to pull latest and **Save to server** when you’re done with your changes.
