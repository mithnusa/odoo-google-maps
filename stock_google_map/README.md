# Delivery Google Maps

## Overview

This module adds a Google Maps view to the Inventory application, allowing you to visualize delivery orders and other stock pickings on an interactive map based on delivery addresses.

## What It Does

Adds a Map view to Delivery Orders and other stock picking lists in Inventory. Each picking appears as a teal marker at the destination partner's address. A sidebar lists all visible pickings with their reference number and delivery address.

## Key Features

- **Map View on Picking Lists**: The Map view is available on Deliveries, Ready to Transfer, Waiting Transfer, Late Transfers, Backorders, and All Operations
- **Address-Based Plotting**: Each picking is plotted using the coordinates of its linked delivery partner
- **Sidebar Navigation**: A left-hand panel lists all pickings with their reference and delivery address; clicking an entry pans the map to that marker
- **Teal Markers**: Picking markers use a teal color to distinguish deliveries from other record types on shared maps

## Dependencies

- `sale_stock`
- `stock_delivery`
- `web_view_google_map`

## Installation

1. Install the module through Odoo Apps
2. Configure your Google API Key in Settings → General Settings → Google Maps
3. Ensure partners have coordinates set (via geolocation tools in Contacts)

## Basic Usage

1. Open **Inventory → Delivery Orders** (or any other picking list)
2. Click the **Map** view icon
3. Deliveries with geolocated partners appear as teal markers
4. Click a marker or sidebar entry to view the delivery reference and address

## Related Modules

- `web_view_google_map`: Provides the core Google Map view type
- `contacts_google_map`: Adds geolocation tools to partner records so coordinates are available for plotting
