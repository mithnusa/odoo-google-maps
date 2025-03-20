import { _t } from '@web/core/l10n/translation';
import { Dialog } from '@web/core/dialog/dialog';

import { Component } from '@odoo/owl';

export class WarningMissingGoogleMapFormViewDialog extends Component {
    static template = 'web_view_google_map.WarningMissingGoogleMapFormViewDialog';
    static components = { Dialog };

    setup() {
        this.title = _t('Configuration: Missing Required Google Map Form View');
    }

    get googleMapFormSample() {
        return `
<!-- New form view -->
<record id="view_res_partner_google_map_form" model="ir.ui.view">
    <field name="name">view.res.partner.google_map_form</field>
    <field name="model">res.partner</field>
    <!-- define 'priority' if you have multiple form view and would like to avoid this form view overlapped the other form view -->
    <field name="priority">1000</field>
    <field name="arch" type="xml">
        <!-- please make sure you are not missing the following form attribute -->
        <!-- js_class="google_map_form" -->
        <!-- lat="field_latitude" -->
        <!-- lng="field_longitude" -->
        <form js_class="google_map_form" string="Contact" lat="partner_latitude" lng="partner_longitude">
            <field name="partner_latitude"/>
            <field name="partner_longitude"/>
        </form>
    </field>
</record>
        `;
    }
}
