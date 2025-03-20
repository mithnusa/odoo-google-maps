export function calculatePolygonCenter(vertices) {
    let area = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < vertices.length; i++) {
        const j = (i + 1) % vertices.length;
        const factor = vertices[i].lat * vertices[j].lng - vertices[j].lat * vertices[i].lng;

        area += factor;
        cx += (vertices[i].lat + vertices[j].lat) * factor;
        cy += (vertices[i].lng + vertices[j].lng) * factor;
    }

    area = Math.abs(area / 2);

    // If area is too small, use arithmetic mean instead
    if (area < 1e-10) {
        let sumLat = 0,
            sumLng = 0;
        vertices.forEach((v) => {
            sumLat += v.lat;
            sumLng += v.lng;
        });
        return {
            lat: sumLat / vertices.length,
            lng: sumLng / vertices.length,
        };
    }

    cx = Math.abs(cx / (6 * area));
    cy = Math.abs(cy / (6 * area));

    return {
        lat: cx,
        lng: cy,
    };
}
