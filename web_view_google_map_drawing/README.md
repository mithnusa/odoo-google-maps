# Web View Google Maps Drawing


### 1. Sub-view of `google_map` view
A new view to display geolocation data using Google Maps Drawing

In order to use this view, the model needs to inherit from an `AbstractModel` model `google.drawing.shape`

How to create the view?

```xml
<!-- View -->
<record id="view_res_partner_area_map" model="ir.ui.view">
    <field name="name">view.res.partner.area.map</field>
    <field name="model">res.partner.area</field>
    <field name="arch" type="xml">
        <google_map js_class="google_map_drawing" string="Areas" sidebar_title="gshape_name" sidebar_subtitle="partner_id">
            <field name="partner_id"/>
            <field name="gshape_name"/>
            <field name="gshape_description"/>
            <field name="gshape_type"/>
            <field name="gshape_radius"/>
            <field name="gshape_area"/>
            <field name="gshape_paths"/>
        </google_map>
    </field>
</record>


<!-- Action -->
<record id="action_partner_area_map" model="ir.actions.act_window">
    ...
    <field name="view_mode">kanban,tree,form,google_map</field>
    ...
</record>
```

Mandatory attributes:
- `js_class`: attribute to load Google Maps Drawing, must be set with `google_map_drawing`
- `sidebar_title`: attribute to be used on a sidebar of map, to display name of record (only support field `Char` and field `Many2one` )

Optional attributes:
- `sidebar_subtitle`: attribute to be used on a sidebar of map, to display secondary info that you would like to display (only support field `Char` and field `Many2one`)


### Use `google_map` view inside `form` view

For field `One2many` it is a must to use widget `google_map_drawing_one2many`
and for field `Many2many` uses widget `google_map_drawing_many2many`

Example:
```xml
<field name="shape_line_ids" widget="google_map_drawing_one2many" mode="google_map">
    <google_map js_class="google_map_drawing" string="Areas" sidebar_title="gshape_name" sidebar_subtitle="partner_id">
        <field name="partner_id" invisible="1"/>
        <field name="gshape_name"/>
        <field name="gshape_description"/>
        <field name="gshape_type"/>
        <field name="gshape_radius"/>
        <field name="gshape_area"/>
        <field name="gshape_paths"/>
    </google_map>
</field>
```

### 2. New widget `google_map_drawing`
In order to activate the drawing mode, it's a must to apply widget `google_map_drawing` to field `gshape_paths` in view `form`

Example:
```xml
<record id="view_res_partner_area_form" model="ir.ui.view">
    <field name="name">view.res.partner.area.form</field>
    <field name="model">res.partner.area</field>
    <field name="arch" type="xml">
        <form string="Area">
            <sheet>
                ...
                <field name="gshape_paths" widget="google_map_drawing"/>
            </sheet>
        </form>
    </field>
</record>
```

If you have difficulties implement or use the view and the widget on your custom module, please do not hesitate to open an issue.