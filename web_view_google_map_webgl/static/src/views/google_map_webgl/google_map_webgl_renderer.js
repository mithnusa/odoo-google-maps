/** @odoo-module **/

// import * as THRE from 'three';
// import { AnimationClip } from 'THREE';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';

export class GoogleMapWebGLRenderer extends GoogleMapRenderer {
    setup() {
        super.setup(...arguments);
        this.webglOverlayView = null;
    }

    // renderMap(isCentered) {
    //     isCentered = isCentered || false;
    //     console.log(this);
    // }

    getMapOptions() {
        const options = super.getMapOptions();
        options.tilt = 0;
        options.heading = 0;
        options.zoom = 18;
        options.center = { lat: 35.6594945, lng: 139.6999859 };
        options.mapId = 'bbca1a6f796902cf';
        return options;
    }

    _initializeGoogleMap() {
        console.log(THREE);
        super._initializeGoogleMap();
        this.dummyThreejs();
        // this._initializeWebGLOverlay();
    }

    dummyThreejs() {
        const overlay = new google.maps.plugins.three.ThreeJSOverlayView({
            map: this.googleMap,
            upAxis: 'Y',
            anchor: { lat: 35.6594945, lng: 139.6999859 },
        });

        // create a box mesh
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(10, 50, 10),
            new THREE.MeshMatcapMaterial()
        );

        // set position at center of map
        const pos = overlay.latLngAltitudeToVector3({
            lat: 35.6594945,
            lng: 139.6999859,
        });
        box.position.copy(pos);

        // set position vertically
        box.position.z = 25;

        // add box mesh to the scene
        overlay.scene.add(box);

        // rotate the box using requestAnimationFrame
        const animate = () => {
            box.rotateZ(THREE.MathUtils.degToRad(0.1));

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    centerMap() {
        this.googleMap.setOptions({
            zoom: 18,
            center: {
                lat: 35.6594945,
                lng: 139.6999859,
            },
        });
    }

    // _initializeWebGLOverlay() {
    //     if (!this.webglOverlayView && this.googleMap) {
    //         let scene, renderer, camera, loader;

    //         this.webglOverlayView = new google.maps.WebGLOverlayView();

    //         this.webGLOverlayView.onAdd = () => {
    //             scene = new THREE.Scene();
    //             camera = new THREE.PerspectiveCamera();
    //             const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    //             scene.add(ambientLight);
    //             const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    //             directionalLight.position.set(0.5, -1, 0.5);
    //             scene.add(directionalLight);

    //             loader = new GLTFLoader();
    //             const source = './pin.gltf';
    //             loader.load(source, (gltf) => {
    //                 gltf.scene.scale.set(25, 25, 25);
    //                 gltf.scene.rotation.x = (180 * Math.PI) / 180;
    //                 scene.add(gltf.scene);
    //             });
    //         };

    //         this.webGLOverlayView.onContextRestored = ({ gl }) => {
    //             renderer = new THREE.WebGLRenderer({
    //                 canvas: gl.canvas,
    //                 context: gl,
    //                 ...gl.getContextAttributes(),
    //             });

    //             renderer.autoClear = false;

    //             loader.manager.onLoad = () => {
    //                 renderer.setAnimationLoop(() => {
    //                     map.moveCamera({
    //                         tilt: mapOptions.tilt,
    //                         heading: mapOptions.heading,
    //                         zoom: mapOptions.zoom,
    //                     });

    //                     if (mapOptions.tilt < 67.5) {
    //                         mapOptions.tilt += 0.5;
    //                     } else if (mapOptions.heading <= 360) {
    //                         mapOptions.heading += 0.2;
    //                     } else {
    //                         renderer.setAnimationLoop(null);
    //                     }
    //                 });
    //             };
    //         };

    //         this.webGLOverlayView.onDraw = ({ gl, coordinateTransformer }) => {
    //             const latLngAltitudeLiteral = {
    //                 lat: mapOptions.center.lat,
    //                 lng: mapOptions.center.lng,
    //                 altitude: 100,
    //             };

    //             const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
    //             camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    //             webGLOverlayView.requestRedraw();
    //             renderer.render(scene, camera);
    //             renderer.resetState();
    //         };

    //         this.webglOverlayView.setMap(this.googleMap);
    //     }
    // }
}
