# Contacts Google Maps - Features

## Google Map View for Contacts

**What it does**: Adds a Map view to the Contacts application, displayed alongside the standard list, kanban, and form views in the view switcher.

**Why it matters**: Lets you see the geographic distribution of your contacts at a glance and interact with them spatially rather than scrolling through a list.

**How it works**: Once installed, a Map button appears in the Contacts view switcher. Contacts with valid latitude and longitude coordinates appear as colored pin markers. Records without coordinates are automatically excluded.

---

## Contact Avatars

**What it does**: Displays each contact's profile photo in the map sidebar and in the info window that appears when clicking a marker.

**Why it matters**: Makes it much faster to identify contacts on the map without having to open each record individually.

**How it works**: The sidebar shows a small thumbnail (24×24px) beside each contact's name. The info window shows a larger version of the avatar. Both use Odoo's standard `avatar_128` image field with lazy loading for performance.

---

## Marker Color Customization

**What it does**: Allows each contact to have a custom marker color on the map, set via a color picker on the contact form.

**Why it matters**: Makes it easy to visually distinguish contacts by category, priority, or any custom classification you assign through the color field.

**How it works**: A `Marker Color` field (Integer) is added to each contact. On the contact form's Geolocation page, a color picker widget lets you choose a color. That color is used for the contact's map marker.

---

## Nearby Contacts Search

**What it does**: A "Nearby Contacts" button on the contact form opens the map view filtered to contacts within a configurable radius of that contact's location.

**Why it matters**: Enables proximity-based workflows — for example, finding all contacts near a customer's office, or identifying leads in the same area as a planned visit.

**How it works**: Clicking the button computes a bounding box around the contact's coordinates using a configurable radius (default: 1000 meters). The map opens showing only contacts within that area, with a rectangle overlay indicating the search boundary and a title such as "Nearby Contacts (within 1.0 km)". The button is only visible on contacts that have geolocation coordinates. Antimeridian wraparound is handled correctly for locations near the international date line.

---

## Embedded Map in Contact Form

**What it does**: Shows an embedded Google Map directly on the contact form's Geolocation page, displaying the contact's saved coordinates.

**Why it matters**: Lets you verify or review a contact's map location without leaving the form view or switching to the full map view.

**How it works**: The map widget is added to the Geolocation page via a form view inheritance. It renders the contact's latitude and longitude as a single marker on a compact map (400px tall, full width of the page).

---

## Automatic Geocoding Cron

**What it does**: A scheduled job that automatically geocodes contacts that have a country and at least one address field (city, zip, street, or street 2) but no latitude/longitude coordinates.

**Why it matters**: Keeps your contacts' geolocation data up to date without manual effort, especially useful after bulk imports or when contacts are created without coordinates.

**How it works**: The cron job runs every 12 hours and is **enabled by default** after installation. Each run processes up to 80 contacts. Only contacts that have a country set and at least one of city, zip, street, or street 2 populated are queued — contacts with only a country are skipped to avoid wasted API calls. When OpenStreetMap is the active geocoding provider, each contact is processed individually with a 1-second pause between calls to respect Nominatim's rate limits. For all other providers, the batch is processed in a single call. The schedule and batch size can be adjusted in **Settings → Technical → Scheduled Actions → Contact: geolocate**.
