// web_view_google_map_drawing/static/tests/google_map_drawing_view.test.js
import { beforeEach, describe, expect, test } from '@odoo/hoot';
import {
    defineModels,
    fields,
    findComponent,
    models,
    mountView,
    patchWithCleanup,
    serverState,
} from '@web/../tests/web_test_helpers';

import { mockGoogleMapsApi } from '@web_view_google_map/../tests/helpers/google_maps_test_helpers';
import { GoogleMapDrawingArchParser } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_drawing_arch_parser';
import { GoogleMapDrawingController } from '@web_view_google_map_drawing/views/google_map_drawing/google_map_drawing_controller';

class Partner extends models.Model {
    _name = 'res.partner';

    name = fields.Char();
    contact_address = fields.Char();
    // The mock server's field DSL has no dedicated Json type; a Char field
    // is a fine stand-in here since these tests only check field-metadata
    // shape (searchable) and arch/domain *structure* — no test actually
    // round-trips a search through the mock server using this field (see
    // the "map domain" describe block for why that specifically can't work).
    gshape_geojson = fields.Char();

    _records = [{ id: 1, name: 'Shape A', contact_address: 'Street A', gshape_geojson: false }];
}

// The mock server resolves the current user (env["res.users"].browse(uid))
// on every RPC, not just when a field references res.users — it must
// always be registered, even though nothing in this view touches it.
class Users extends models.Model {
    _name = 'res.users';

    name = fields.Char();
    _records = [{ id: serverState.userId, name: 'Mitchell Admin' }];

    has_group() {
        return true;
    }
}

defineModels([Partner, Users]);

function getMapController(view) {
    return findComponent(view, (c) => c instanceof GoogleMapDrawingController);
}

// Minimal, non-rendering stand-ins for the second third-party global this
// renderer needs (on top of google.maps): Deck.gl and Turf.js. onWillStart
// checks `window.deck && window.turf` and skips loading the real bundled
// assets if both are already present — same "already loaded" fast path as
// GoogleMapsAPILoader. These exist purely so mounting doesn't crash; no
// test in this file asserts anything about actual shape/layer rendering.
const FAKE_DECK = {
    GoogleMapsOverlay: class {
        setMap() {}
        setProps() {}
    },
    GeoJsonLayer: class {},
    ScatterplotLayer: class {},
};
const FAKE_TURF = {
    area: () => 0,
};

beforeEach(() => {
    mockGoogleMapsApi();
    patchWithCleanup(window, { deck: FAKE_DECK, turf: FAKE_TURF });
});

describe('arch parser', () => {
    // Pure parsing logic — no mountView, no google.maps/deck.gl, no OWL.
    function parseArch(archXml) {
        const xmlDoc = new DOMParser().parseFromString(archXml, 'text/xml').documentElement;
        return new GoogleMapDrawingArchParser().parse(xmlDoc, { 'res.partner': { fields: {} } }, 'res.partner');
    }

    test('geojson is required instead of lat/lng', () => {
        expect(() =>
            parseArch(`<google_map js_class="google_map_drawing" sidebar_title="name" sidebar_subtitle="contact_address"/>`)
        ).toThrow('Missing required attribute(s): geojson');
    });

    test('sidebar_title/sidebar_subtitle are still required', () => {
        expect(() => parseArch(`<google_map js_class="google_map_drawing" geojson="gshape_geojson"/>`)).toThrow(
            'Missing required attribute(s): sidebar_title, sidebar_subtitle'
        );
    });

    test('a valid arch parses geoJsonField from the geojson attribute', () => {
        const archInfo = parseArch(
            `<google_map js_class="google_map_drawing" geojson="gshape_geojson" sidebar_title="name" sidebar_subtitle="contact_address"/>`
        );
        expect(archInfo.geoJsonField).toBe('gshape_geojson');
    });
});

describe('map domain', () => {
    test('mapDomain and notGeolocatedDomain are empty when the geojson field is not searchable', async () => {
        // A non-searchable field is the only way to mount this view without
        // hitting the blocker below — GoogleMapDrawingModel.load() would
        // otherwise merge a domain using the custom json_ne/json_eq
        // operators into a real search, and neither the client Domain
        // evaluator nor the mock server's own record filtering (both go
        // through the same matchCondition() in core/domain.js) implement
        // those operators — real Odoo only supports them server-side, in
        // Python. With the field not searchable, _hasSearchableGeoFields()
        // is false and both getters short-circuit to [] before ever
        // building a domain, so no search using json_ne/json_eq happens.
        Partner._fields.gshape_geojson.searchable = false;

        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map js_class="google_map_drawing" geojson="gshape_geojson" sidebar_title="name" sidebar_subtitle="contact_address">
                <field name="gshape_geojson"/>
                <field name="name"/>
                <field name="contact_address"/>
            </google_map>`,
        });

        const { model } = getMapController(view);
        expect(model.mapDomain).toEqual([]);
        expect(model.notGeolocatedDomain).toEqual([]);

        Partner._fields.gshape_geojson.searchable = true;
    });

    test('mapDomain and notGeolocatedDomain reference the geojson field and the empty/null FeatureCollection check', async () => {
        // Same blocker as above. Mount with the field non-searchable so
        // load() completes normally (a real search, but with an empty
        // mapDomain — model.root gets built correctly, unlike stubbing
        // load() entirely, which left it undefined and crashed usePager).
        Partner._fields.gshape_geojson.searchable = false;

        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map js_class="google_map_drawing" geojson="gshape_geojson" sidebar_title="name" sidebar_subtitle="contact_address">
                <field name="gshape_geojson"/>
                <field name="name"/>
                <field name="contact_address"/>
            </google_map>`,
        });

        const { model } = getMapController(view);

        // Flip searchable directly on the model's own field-metadata (not
        // Partner._fields, which may not be the same object load() already
        // read) and clear mapDomain/notGeolocatedDomain's memoization
        // caches so re-reading them recomputes with _hasSearchableGeoFields()
        // now true. This never triggers another search — those getters are
        // pure; only load() performs RPCs, and it isn't called again here.
        model.config.fields[model.viewConfig.geoJsonField].searchable = true;
        model._mapDomainCache = undefined;
        model._unlocatedDomainCache = undefined;

        // Structural assertions, not behavioral ones: Domain.contains()
        // can't evaluate json_ne/json_eq (see above), so this checks the
        // right field and operators are present rather than filtering an
        // actual record through the domain.
        const mapDomainJson = JSON.stringify(model.mapDomain);
        expect(mapDomainJson).toInclude('gshape_geojson');
        expect(mapDomainJson).toInclude('json_ne');
        expect(mapDomainJson).toInclude('FeatureCollection');

        const notGeolocatedJson = JSON.stringify(model.notGeolocatedDomain);
        expect(notGeolocatedJson).toInclude('gshape_geojson');
        expect(notGeolocatedJson).toInclude('json_eq');
        expect(notGeolocatedJson).toInclude('FeatureCollection');
    });
});
