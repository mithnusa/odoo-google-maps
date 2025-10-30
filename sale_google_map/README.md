# Sales Google Maps

The `sale_google_map` module adds Google Maps view to the Sales application. It allows you to visualize sales orders on an interactive Google Map based on customer locations, helping sales teams analyze geographical sales patterns.
Quotations and orders will be grouped by customer (partner) on the map, with markers representing each customer's location. So won't see every single sales order or quotations as a separate marker, but rather grouped under their respective customers. This provides a clearer overview of where your sales are concentrated geographically.

<div style="display: flex; gap: 4px; justify-content: center;">
  <img src="static/img/google_maps_preview.png" alt="Previews" style="width: 100%; max-width: 600px; height: auto;">
</div>

## Features
- Interactive Google Map view for Sales Orders with clustering and sidebar
- Quick actions from the map sidebar to open sales order records
- View sales orders plotted on the map based on customer addresses
- Records displayed on the map are grouped by customer (partner)


## Installation & Configuration
1. Configure your Google Maps API key & Map ID in `Settings > General Settings > Google Maps`
2. Navigate to `Sales > Quotations` or `Sales > Orders` and switch to the Google Maps view
3. View your sales orders plotted on the map based on customer addresses
4. Maps JavaScript API must be enabled in your Google Cloud Console.

## Authors
- [Yopi Angi](https://www.github.com/gityopie)
