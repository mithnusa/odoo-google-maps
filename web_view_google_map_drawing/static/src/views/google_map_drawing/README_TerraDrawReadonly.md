# Terra Draw Readonly Renderer

This module provides a readonly display component for Google Maps using the Terra Draw library. It's designed to display GeoJSON features with measurement capabilities but without editing functionality.

## Features

### 🔍 **Readonly Display**
- Display GeoJSON features on Google Maps
- Support for all geometry types (Point, LineString, Polygon, Rectangle, Circle)
- Feature selection with visual feedback
- Non-editable features (no dragging, rotation, or modification)

### 📏 **Measurement Capabilities**
- **Points**: Coordinates with directional indicators (N/S, E/W)
- **Lines**: Length calculation with point count
- **Polygons**: Area and perimeter calculations
- **Rectangles**: Area and perimeter calculations
- **Circles**: Area, radius, and circumference calculations

### 🎛️ **Professional Features**
- Professional number formatting with locale support
- Measurement unit toggling (metric/imperial)
- Click-to-view measurements on features
- Automatic map fitting to show all features
- Error handling and user feedback

## Usage

### Basic Implementation

```javascript
import { GoogleMapTerraDrawRenderer } from './google_map_terra_draw_renderer';

// In your component
static components = {
    TerraDrawRenderer: GoogleMapTerraDrawRenderer,
};

// In your template
<TerraDrawRenderer 
    googleMap="googleMapInstance"
    dataGeoJson="geoJsonData"
    showMeasurements="true"
    measurementUnit="'metric'"
    onFeatureClick="onFeatureClick" />
```

### Integration with Existing GoogleMapDrawingRenderer

```javascript
// Add to your existing GoogleMapDrawingRenderer
import { GoogleMapTerraDrawRenderer } from './google_map_terra_draw_renderer';

export class GoogleMapDrawingRenderer extends BaseGoogleMapComponent {
    static components = {
        // ... existing components
        TerraDrawReadonly: GoogleMapTerraDrawRenderer,
    };

    // Use in readonly mode
    renderTerraDrawFeatures() {
        if (this.props.readonly && this.hasGeoJsonData()) {
            return true; // Show Terra Draw readonly renderer
        }
        return false; // Use regular drawing interface
    }
}
```

### Template Integration

```xml
<!-- In your Google Map Drawing template -->
<div class="o_google_map_container">
    <!-- Regular Google Map -->
    <div t-ref="map" class="o_google_map"></div>
    
    <!-- Terra Draw Readonly Overlay (when in readonly mode) -->
    <TerraDrawReadonly 
        t-if="renderTerraDrawFeatures()"
        googleMap="googleMap"
        dataGeoJson="geoJsonData"
        showMeasurements="true"
        measurementUnit="'metric'" />
</div>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `googleMap` | Object | Yes | null | Google Maps instance |
| `dataGeoJson` | Object | No | null | GeoJSON data to display |
| `showMeasurements` | Boolean | No | true | Whether to display measurements |
| `measurementUnit` | String | No | 'metric' | Unit system ('metric' or 'imperial') |
| `onFeatureClick` | Function | No | null | Callback when feature is clicked |

## API Methods

### Public Methods

```javascript
// Toggle measurement unit
renderer.toggleMeasurementUnit();

// Toggle measurement display
renderer.toggleMeasurementDisplay();

// Get all loaded features
const features = renderer.getAllFeatures();

// Get measurements for all features
const measurements = renderer.getAllFeatureMeasurements();

// Get measurement for selected feature
const measurement = renderer.getSelectedFeatureMeasurement();
```

## Data Format

### Input GeoJSON Format

```javascript
// FeatureCollection
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[lat, lng], [lat, lng], ...]]
            },
            "properties": {
                "name": "Feature Name",
                "description": "Feature Description"
            }
        }
    ]
}

// Single Feature
{
    "type": "Feature",
    "geometry": {
        "type": "Point",
        "coordinates": [lng, lat]
    },
    "properties": {
        "name": "Point Name"
    }
}
```

### Measurement Output Format

```javascript
{
    type: 'Polygon',
    area: '15.67 ha',
    perimeter: '2.34 km',
    points: '12 points'
}
```

## Styling

The component includes minimal CSS for clean display:

```scss
.o_terra_draw_readonly {
    .o_terra_readonly_controls {
        // Positioned controls for unit toggle
    }
    
    .o_terra_readonly_status {
        // Loading status indicator
    }
}
```

## Event Handling

### Feature Selection

```javascript
onFeatureClick(feature) {
    console.log('Feature selected:', feature);
    console.log('Feature ID:', feature.id);
    console.log('Geometry type:', feature.geometry.type);
}
```

### Measurement Events

Measurements are automatically calculated and displayed when:
- A feature is selected
- Measurement unit is toggled
- Measurement display is enabled

## Error Handling

The component includes comprehensive error handling:

- Library loading failures
- Invalid GeoJSON data
- Measurement calculation errors
- Map initialization issues

## Performance Considerations

- **Lazy Loading**: Terra Draw libraries are loaded on demand
- **Batch Processing**: Large GeoJSON datasets are processed efficiently
- **Memory Management**: Proper cleanup of event listeners and instances
- **Debounced Operations**: Measurement calculations are optimized

## Differences from Editable Terra Draw

| Feature | Editable Mode | Readonly Mode |
|---------|---------------|---------------|
| Drawing Tools | ✅ Full toolbar | ❌ Not available |
| Feature Editing | ✅ Drag, rotate, scale | ❌ View only |
| Feature Creation | ✅ All geometry types | ❌ Display only |
| Measurements | ✅ During/after drawing | ✅ On selection |
| Undo/Redo | ✅ Full history | ❌ Not applicable |
| Export | ✅ Save changes | ✅ View measurements |

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Dependencies

- Google Maps JavaScript API
- Terra Draw Library
- Terra Draw Google Maps Adapter
- Odoo OWL Framework

## Contributing

When contributing to this readonly renderer:

1. Maintain readonly-only functionality
2. Ensure measurement accuracy
3. Add comprehensive error handling
4. Include proper documentation
5. Test with various GeoJSON formats

## Examples

### Display Complex Polygon

```javascript
const geoJsonData = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-74.0059, 40.7128],
                    [-74.0059, 40.7614],
                    [-73.9352, 40.7614],
                    [-73.9352, 40.7128],
                    [-74.0059, 40.7128]
                ]]
            },
            "properties": {
                "name": "Manhattan Area"
            }
        }
    ]
};

// Measurement output:
// Type: Polygon
// Area: 28.45 sq km
// Perimeter: 23.12 km
// Points: 4 points
```

### Handle Feature Selection

```javascript
onFeatureClick(feature) {
    if (feature.geometry.type === 'Polygon') {
        this.showAreaDetails(feature);
    } else if (feature.geometry.type === 'Point') {
        this.showLocationInfo(feature);
    }
}
```

This readonly renderer provides a complete solution for displaying GeoJSON data with Terra Draw while maintaining the professional measurement capabilities of the full editing interface.
