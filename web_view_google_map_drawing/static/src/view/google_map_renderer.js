/** @odoo-module **/

import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

export class GoogleMapDrawingRenderer extends GoogleMapRenderer {
    setup() {
        super.setup();
        this.editColor = '#ffa187';
        this.drawingManager = null;
    }

    renderMap() {
        this.initialize();
        this.initializeDrawing();
        this.centerMap();
    }

    _getGeneralOptions() {
        return {
            fillColor: this.editColor,
            strokeColor: '#fc6c44',
            strokeOpacity: 0.85,
            strokeWeight: 2.0,
            fillOpacity: 0.45,
            editable: true,
        };
    }

    _getCircleOptions() {
        return {
            fillColor: this.editColor,
            fillOpacity: 0.45,
            strokeWeight: 0,
            editable: true,
            zIndex: 1,
        };
    }

    initializeDrawing() {
        console.log(' <-{initializeDrawing}-> ');
        console.log(this);
        if (!this.drawingManager) {
            const shapeOption = this._getGeneralOptions();
            const circleOption = this._getCircleOptions();
            this.drawingManager = new google.maps.drawing.DrawingManager({
                // drawingControl: true,
                drawingControlOptions: {
                    position: google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: [
                        google.maps.drawing.OverlayType.CIRCLE,
                        google.maps.drawing.OverlayType.POLYGON,
                        google.maps.drawing.OverlayType.RECTANGLE,
                    ],
                },
                map: this.googleMap,
                polygonOptions: shapeOption,
                circleOptions: circleOption,
                rectangleOptions: shapeOption,
            });
        }
    }
}
