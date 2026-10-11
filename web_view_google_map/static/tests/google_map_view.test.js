// web_view_google_map/static/tests/google_map_view.test.js
import { beforeEach, describe, expect, test } from '@odoo/hoot';
import { click, queryAllTexts, queryAll, waitFor } from '@odoo/hoot-dom';
import { Domain } from '@web/core/domain';
import {
    contains,
    defineModels,
    fields,
    findComponent,
    mockService,
    models,
    mountView,
    serverState,
} from '@web/../tests/web_test_helpers';

import { GoogleMapController } from '@web_view_google_map/views/google_map/google_map_controller';
import { GoogleMapRenderer } from '@web_view_google_map/views/google_map/google_map_renderer';
import { GoogleMapArchParser } from '@web_view_google_map/views/google_map/google_map_arch_parser';
import { generateColor } from '@web_view_google_map/views/google_map/utils';
import { mockGoogleMapsApi, waitUntil } from '@web_view_google_map/../tests/helpers/google_maps_test_helpers';

class Country extends models.Model {
    _name = 'res.country';

    name = fields.Char();
    _records = [
        { id: 1, name: 'North' },
        { id: 2, name: 'South' },
        { id: 3, name: 'None' },
    ];
}

class Partner extends models.Model {
    _name = 'res.partner';

    name = fields.Char();
    contact_address = fields.Char();
    country_id = fields.Many2one({ string: 'Country', relation: 'res.country' });
    partner_latitude = fields.Float();
    partner_longitude = fields.Float();

    _records = [
        {
            id: 1,
            name: 'Located A',
            contact_address: 'Street A',
            partner_latitude: 10.0,
            partner_longitude: 10.5,
            country_id: 1,
        },
        {
            id: 2,
            name: 'Located B',
            contact_address: 'Street B',
            partner_latitude: 11.0,
            partner_longitude: 11.5,
            country_id: 2,
        },
        {
            id: 3,
            name: 'No coords',
            contact_address: 'None',
            partner_latitude: false,
            partner_longitude: false,
            country_id: 3,
        },
    ];
}

// The mock server resolves the current user (env["res.users"].browse(uid))
// on every RPC, not just when a field references res.users — it must
// always be registered, even though nothing in this view touches it.
class Users extends models.Model {
    _name = 'res.users';

    name = fields.Char();
    _records = [{ id: serverState.userId, name: 'Mitchell Admin' }];

    // Matches core's ResUsers mock model — some access-rights check in the
    // view stack (e.g. group-gated buttons/menus) calls this on every mount.
    has_group() {
        return true;
    }
}

defineModels([Partner, Users, Country]);

function getMapController(view) {
    return findComponent(view, (c) => c instanceof GoogleMapController);
}

function getMapRenderer(view) {
    return findComponent(view, (c) => c instanceof GoogleMapRenderer);
}

beforeEach(() => {
    mockGoogleMapsApi();
});


describe('unlocated records', () => {
    test('unlocated records are counted and excluded from the map domain', async () => {
        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        const { model } = getMapController(view);
        expect(model.unLocatedCount).toBe(1);

        // Assert on what the domain *selects*, not on Domain.toList()'s internal
        // array shape — the serialized form (flat implicit-AND vs "&"-prefixed)
        // is an implementation detail of the Domain class, not our contract.
        const domain = new Domain(model.unlocatedRecordsDomain);
        expect(domain.contains({ partner_latitude: 10.0, partner_longitude: 10.5 })).toBe(false);
        expect(domain.contains({ partner_latitude: 11.0, partner_longitude: 11.5 })).toBe(false);
        expect(domain.contains({ partner_latitude: false, partner_longitude: false })).toBe(true);
    });

    test('clicking the Unlocated row opens a list scoped to the unlocated domain', async () => {
        let calledWith;
        mockService('action', {
            doAction(action) {
                calledWith = action;
            },
        });

        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        await waitFor('.o_map_sidebar .border-top.border-bottom');
        expect(queryAllTexts('.o_map_sidebar .border-top.border-bottom span')).toInclude('Unlocated');

        await contains("button[data-tooltip='Show Unlocated']").click();
        expect(calledWith.domain).toEqual(getMapController(view).model.unlocatedRecordsDomain);
    });
});

describe('map domain', () => {
    test('mapDomain includes the 0.0 equator/prime-meridian coordinates but excludes null/false', async () => {
        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        const { model } = getMapController(view);
        const domain = new Domain(model.mapDomain);

        // Regression test: 0.0 is a valid coordinate (equator / prime
        // meridian), not an absence of one. A prior version of mapDomain
        // treated it as equivalent to null/false and excluded it.
        expect(domain.contains({ partner_latitude: 0.0, partner_longitude: 0.0 })).toBe(true);
        expect(domain.contains({ partner_latitude: false, partner_longitude: false })).toBe(false);
        expect(domain.contains({ partner_latitude: 10.0, partner_longitude: false })).toBe(false);
    });
});

describe('arch parser', () => {
    // Pure parsing logic — no mountView, no google.maps, no OWL involved.
    function parseArch(archXml) {
        const xmlDoc = new DOMParser().parseFromString(archXml, 'text/xml').documentElement;
        return new GoogleMapArchParser().parse(xmlDoc, { 'res.partner': { fields: {} } }, 'res.partner');
    }

    test('groupsLimit defaults to 80 when default_group_by is set without an explicit groups_limit', () => {
        const archInfo = parseArch(
            `<google_map lat="partner_latitude" lng="partner_longitude" default_group_by="contact_address" sidebar_title="name" sidebar_subtitle="contact_address"/>`
        );
        expect(archInfo.groupsLimit).toBe(80);
    });

    test('groupsLimit stays unset without default_group_by', () => {
        const archInfo = parseArch(
            `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address"/>`
        );
        expect(archInfo.groupsLimit).toBe(null);
    });

    test('an explicit groups_limit is respected even with default_group_by', () => {
        const archInfo = parseArch(
            `<google_map lat="partner_latitude" lng="partner_longitude" default_group_by="country_id" groups_limit="25" sidebar_title="name" sidebar_subtitle="contact_address"/>`
        );
        expect(archInfo.groupsLimit).toBe(25);
    });

    // Asserted directly against the parser (synchronous throw), not through
    // mountView(): the error is thrown inside View's onWillStart, which OWL's
    // error-boundary machinery intercepts during component mounting — Hoot
    // flags that as a global "unverified error" regardless of whether the
    // outer mountView() promise also rejects, so rejects.toThrow() here
    // would report noise even when the assertion itself is correct.
    test('undefined lat/lng attributes throw an error', () => {
        expect(() =>
            parseArch(`<google_map sidebar_title="name" sidebar_subtitle="contact_address"/>`)
        ).toThrow('Missing required attribute(s): lat, lng');
    });

    test('undefined sidebar_title/sidebar_subtitle attributes throw an error', () => {
        expect(() =>
            parseArch(`<google_map lat="partner_latitude" lng="partner_longitude"/>`)
        ).toThrow('Missing required attribute(s): sidebar_title, sidebar_subtitle');
    });
});

describe('markers', () => {
    test('one marker is created per located record', async () => {
        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `
            <google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        const renderer = getMapRenderer(view);
        await waitUntil(() => renderer.cache.size > 0);

        // Only the 2 located records get markers — the unlocated one never
        // reaches the map at all (it's excluded by mapDomain upstream).
        expect(renderer.cache.size).toBe(2);
    });

    test('clicking a marker opens the info window for that record', async () => {
        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        const renderer = getMapRenderer(view);
        await waitUntil(() => renderer.cache.size > 0);

        const marker = renderer.cache.get(1);
        marker.fireClick();

        expect(renderer.markerInfoWindow.openCallCount).toBe(1);
    });
});

describe('grouping', () => {
    test('generateColor is deterministic for a given seed', () => {
        // GoogleMapGroup derives its color from the group value via this
        // function specifically so the same group gets the same color
        // across reloads — assert that contract directly, no map needed.
        expect(generateColor('Street A')).toBe(generateColor('Street A'));
        expect(generateColor(42)).toBe(generateColor(42));
    });

    test('grouping by a field renders one sidebar group per distinct value', async () => {
        Partner._records = [
            {
                id: 1,
                name: 'Located A',
                contact_address: 'Street A',
                country_id: 1,
                partner_latitude: 10.0,
                partner_longitude: 10.5,
            },
            {
                id: 2,
                name: 'Located B',
                contact_address: 'Street B',
                country_id: 2,
                partner_latitude: 11.0,
                partner_longitude: 11.5,
            },
        ];

        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="country_id"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>`,
            groupBy: ['country_id'],
        });

        await waitFor('.o_map_sidebar_group');
        const groupLabels = queryAllTexts('.o_map_sidebar_group span.ps-1');
        expect(groupLabels).toEqual(['North (1)', 'South (1)']);

        getMapController(view); // sanity: controller resolves under grouping too
    });
});

describe('record actions', () => {
    test('an always-displayed header button calls doActionButton with its arch-declared name', async () => {
        let calledWith;
        mockService('action', {
            doActionButton(params) {
                calledWith = params;
            },
        });

        await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <header>
                    <button name="do_something" type="object" string="Do Something" display="always"/>
                </header>
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        await contains("button[name='do_something']").click();
        expect(calledWith.name).toBe('do_something');
        expect(calledWith.type).toBe('object');
        expect(calledWith.resModel).toBe('res.partner');
    });

    test('deleting a selected record removes it from the view via the standard confirmation flow', async () => {
        let confirmedProps;
        mockService('dialog', {
            add(component, props) {
                confirmedProps = props;
                return () => {};
            },
        });

        const view = await mountView({
            type: 'google_map',
            resModel: 'res.partner',
            arch: `<google_map lat="partner_latitude" lng="partner_longitude" sidebar_title="name" sidebar_subtitle="contact_address" disable_cluster_marker="1">
                <field name="name"/>
                <field name="contact_address"/>
                <field name="partner_latitude"/>
                <field name="partner_longitude"/>
            </google_map>
            `,
        });

        // Select the first record's row in the sidebar (index 0 is the
        // sidebar's own "select all" checkbox).
        await waitFor('.o_map_sidebar input.form-check-input');
        const checkboxes = queryAll('.o_map_sidebar input.form-check-input');
        await click(checkboxes[1]);

        const controller = getMapController(view);
        controller.onDeleteSelectedRecords();

        expect(confirmedProps).not.toBe(undefined);
        await confirmedProps.confirm();

        expect(controller.model.root.records.map((r) => r.resId)).toEqual([2]);
    });
});
