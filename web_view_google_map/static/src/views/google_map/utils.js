
/**
 * Parse config markerColor given in google_map view
 * @param {string} colors
 */
export function parseMarkersColor(colors) {
    if (!colors) {
        return false;
    }
    let pair;
    let color;
    let expr;
    return _(colors.split(';'))
        .chain()
        .compact()
        .map(function (color_pair) {
            pair = color_pair.split(':');
            color = pair[0];
            expr = pair[1];
            return [color, py.parse(py.tokenize(expr)), expr];
        })
        .value();
}

function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
}


export function getCurrentActionId() {
    let url = new URL(window.location.href);
    let hashParams = new URLSearchParams(url.hash.slice(1));
    let actionId = parseInt(hashParams.get('action'));
    return isNaN(actionId) ? null : actionId;
}

export function parseRecord(record, viewConfig, isGrouped = false) {
    function getFieldValue(fieldName) {
        let value = '';
        if (!fieldName || !record.fields[fieldName]) {
            return value;
        }
        switch (record.fields[fieldName].type) {
            case 'many2one':
                value = record.data[fieldName] ? record.data[fieldName][1] : '';
                break;
            case 'selection':
                let selection = record.fields[fieldName].selection.find(
                    (s) => s[0] === record.data[fieldName]
                );
                value = selection ? selection[1] : '';
                break;
            case 'char':
            case 'text':
            case 'datetime':
            case 'date':
                value = record.data[fieldName] || '';
                break;
            case 'float':
            case 'integer':
            case 'monetary':
                value = record.data[fieldName] || 0;
                break;
            case 'binary': // expected binary of an image
                value = `/web/image/${record.resModel}/${record.resId}/${fieldName}`;
                break;
            default:
                value = '';
        }
        return value;
    }

    const other = {};
    let geolocation = false;

    const { lat, lng, ...otherFields } = viewConfig;

    if (!otherFields.title) {
        otherFields.title = 'display_name';
    }

    if (isGrouped) {
        other['markerColor'] = '#' + Math.floor(Math.random() * 16777215).toString(16);
    }

    if (record.data) {
        if (lat && lng) {
            const latitude = getFieldValue(lat);
            const longitude = getFieldValue(lng);
            if (latitude !== 0.0 && longitude !== 0.0) {
                geolocation = { lat: latitude, lng: longitude };
            }
        }

        Array.from(Object.keys(otherFields)).forEach((config) => {
            const fieldName = otherFields[config];
            other[config] = getFieldValue(fieldName);
        });

        if (otherFields.markerColor) {
            let marker_color = null;
            const color = record.data[otherFields.markerColor] || otherFields.markerColor;
            if (typeof color === 'number') {
                const ColorList = [
                    null,
                    '#F06050', // Red
                    '#F4A460', // Orange
                    '#F7CD1F', // Yellow
                    '#6CC1ED', // Light blue
                    '#814968', // Dark purple
                    '#EB7E7F', // Salmon pink
                    '#2C8397', // Medium blue
                    '#475577', // Dark blue
                    '#D6145F', // Fuchsia
                    '#30C381', // Green
                    '#9365B8', // Purple
                ];
                marker_color = ColorList[color] || marker_color;
            } else if (/(?:#|0x)(?:[a-f0-9]{3}|[a-f0-9]{6})\b|(?:rgb|hsl)a?\([^\)]*\)/gi.test(color)) {
                marker_color = color;
            } else if (color) {
                // check color is a valid color name
                const colorName = color.toLowerCase();
                const colorList = [
                    'red',
                    'orange',
                    'yellow',
                    'green',
                    'blue',
                    'purple',
                    'pink',
                    'brown',
                    'black',
                    'white',
                ];
                if (colorList.includes(colorName)) {
                    marker_color = colorName;
                } else {
                    marker_color = normalizeColor(color);
                }
            }
            other['markerColor'] = marker_color;
        }
    }
    return { geolocation, other };
}

export function normalizeColor(color) {
    // Create a temporary element to leverage the browser's color parsing
    let tempElement = document.createElement('div');
    tempElement.style.color = color;
    document.body.appendChild(tempElement);

    // Get the computed color in RGB format
    let computedColor = window.getComputedStyle(tempElement).color;
    document.body.removeChild(tempElement);

    // Extract the RGB components
    let rgbMatch = computedColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgbMatch) {
        let r = parseInt(rgbMatch[1]);
        let g = parseInt(rgbMatch[2]);
        let b = parseInt(rgbMatch[3]);

        // Convert RGB to hex
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    // If the input is already in hex format, return it as is
    return color;
}

export function invertColorDarken(color) {
    // Normalize the color to hex format
    let hexColor = normalizeColor(color);

    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse the r, g, b values
    let r = parseInt(hexColor.substring(0, 2), 16);
    let g = parseInt(hexColor.substring(2, 4), 16);
    let b = parseInt(hexColor.substring(4, 6), 16);

    // Darken the r, g, b values
    r = Math.max(0, r - 50);
    g = Math.max(0, g - 50);
    b = Math.max(0, b - 50);

    // Convert the darkened r, g, b values back to a hex string
    let darkHexColor =
        '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

    return darkHexColor;
}

export function invertColorLighten(color) {
    // Normalize the color to hex format
    let hexColor = normalizeColor(color);

    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse the r, g, b values
    let r = parseInt(hexColor.substring(0, 2), 16);
    let g = parseInt(hexColor.substring(2, 4), 16);
    let b = parseInt(hexColor.substring(4, 6), 16);

    // Lighten the r, g, b values
    r = Math.min(255, r + 50);
    g = Math.min(255, g + 50);
    b = Math.min(255, b + 50);

    // Convert the lightened r, g, b values back to a hex string
    let lightHexColor =
        '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();

    return lightHexColor;
}
