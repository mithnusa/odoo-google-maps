# Base Google Map - Features

## Settings Configuration

### API Key
**What it does**: Stores your Google Maps API key in Odoo's system settings.

**Why it matters**: All Google Maps features across the suite depend on a valid API key. Centralizing it here means you configure it once and every dependent module uses it automatically.

**How it works**: Enter your key in Settings → General Settings → Google Maps. The key is securely stored in Odoo's system parameters and sent to the browser only when loading the Maps API.

---

### Map ID
**What it does**: Stores a Google Cloud Map ID alongside the API key.

**Why it matters**: A Map ID is required to use advanced map features such as custom cloud-based map styles and 3D map rendering.

**How it works**: Enter a Map ID obtained from the Google Cloud Console. It is applied automatically to all map views that support it.

---

### Language
**What it does**: Sets the display language for map labels, controls, and UI elements.

**Why it matters**: Ensures the map UI matches the language your users expect, including region-specific language variants.

**How it works**: Choose from 86 supported languages including regional variants (e.g., Chinese Simplified, Chinese Traditional, English AU, Portuguese BR). The selected language is passed to the Google Maps API on load.

---

### Region Localization
**What it does**: Sets a region code that influences how Google Maps renders geographic data.

**Why it matters**: Some countries require maps to display borders and place names according to local regulations. Setting the correct region ensures compliance.

**How it works**: Available regions are derived from the selected language. The region code is passed to the Google Maps API on load.

---

### Color Scheme
**What it does**: Controls whether maps display in Light, Dark, or System (auto-detect) mode.

**Why it matters**: Allows maps to match your Odoo interface theme, improving readability especially in dark mode environments.

**How it works**: Select Light, Dark, or System in the settings. "System" automatically applies dark map styling when the user's OS is set to dark mode.

---

## Autocomplete Restrictions

### Language Restriction
**What it does**: Limits place autocomplete suggestions to results that match the configured map language.

**Why it matters**: Prevents autocomplete from returning results in unexpected languages when users type addresses.

**How it works**: Toggle "Restrict autocomplete by language" in settings. When enabled, the map language setting is applied as a language bias in autocomplete requests.

---

### Country Restriction
**What it does**: Limits place autocomplete suggestions to results within specific countries.

**Why it matters**: Helps users find addresses faster by narrowing results to relevant countries, and prevents accidental selection of locations in the wrong region.

**How it works**: Toggle "Restrict autocomplete by country" and select up to 5 countries from a dropdown. Selected countries are passed as filters to the Google Places API. The limit of 5 countries is set by Google's API.

---

## In-Map Place Search

**What it does**: Enables a place search input directly within Google Map views.

**Why it matters**: Allows users to search for locations on the map without leaving the map view, improving navigation efficiency.

**How it works**: Toggle "Enable in-map place search" in settings. When enabled, map views that support this feature display a search box powered by the Google Places API (New). Requires the Places API (New) to be enabled in your Google Cloud Console.

---

## API Loader

**What it does**: Handles loading the Google Maps JavaScript API reliably across all modules.

**Why it matters**: Without a consistent loader, multiple modules could conflict when each tries to load the API independently. The shared loader prevents duplicate loading and handles errors gracefully.

**How it works**: The loader fetches configuration from the server, builds the API URL, and injects the script once. Concurrent requests share a single loading promise. Failed requests are retried automatically before showing an error to the user.

**Key behaviors**:
- Retries failed loads up to 3 times before giving up
- Detects authentication errors (invalid API key) and network errors separately
- Prevents the API script from loading more than once per page
- Caches imported map libraries (maps, places, marker, geometry, etc.) to avoid redundant imports

---

## Base Map Component

**What it does**: Provides a reusable OWL component that all map views extend, with consistent behavior for error handling, loading states, offline detection, and accessibility.

**Why it matters**: Without a shared base, each map view would need to independently implement error handling, resize detection, and accessibility — leading to inconsistencies and duplicated code.

**How it works**: Map view components inherit from the base component and gain its capabilities automatically. The base component manages the full map lifecycle from initialization to cleanup.

**Key behaviors**:
- Shows clear error messages when the API key is missing, invalid, or when network issues occur
- Detects when the user goes offline and retries loading automatically when connectivity is restored
- Resizes the map automatically when its container changes size
- Sets appropriate ARIA labels and roles for screen reader compatibility
- Tracks and cleans up all map event listeners on component teardown to prevent memory leaks
