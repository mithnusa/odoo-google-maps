/** @odoo-module **/
import fontAwesomeSVG from './fontawesome';

export const MARKER_ICON_SVG_PATH =
    'M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z';
export const MARKER_ICON_WIDTH = 384;
export const MARKER_ICON_HEIGHT = 512;

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

export function getFontAwesomeIcon(iconName) {
    iconName = iconName || '';
    let defaultIconStr = 'location-dot';
    let iconStr;
    if (iconName) {
        iconStr =
            'fa' +
            iconName
                .split('-')
                .map((s) => capitalizeFirstLetter(s))
                .join('');
    } else {
        iconStr =
            'fa' +
            defaultIconStr
                .split('-')
                .map((s) => capitalizeFirstLetter(s))
                .join('');
    }
    let iconFa;
    try {
        iconFa = fontAwesomeSVG[iconStr].icon;
    } catch (error) {
        iconFa = fontAwesomeSVG['faLocationDot'].icon;
    }
    return iconFa;
}
return { getFontAwesomeIcon: getFontAwesomeIcon };
