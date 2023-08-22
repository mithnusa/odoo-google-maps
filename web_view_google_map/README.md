# Web View Google Maps

#### A new `google_map` view to display geolocation data using Google Maps

How to create the view?

```xml
<!-- View -->
<record id="view_res_partner_google_map" model="ir.ui.view">
    <field name="name">view.res.partner.google_map</field>
    <field name="model">res.partner</field>
    <field name="arch" type="xml">
        <google_map string="Contacts" lat="partner_latitude" color="marker_color" lng="partner_longitude" sidebar_title="display_name" sidebar_subtitle="contact_address">
            <field name="partner_latitude"/>
            <field name="partner_longitude"/>
            <field name="color"/>
            <field name="display_name"/>
            <field name="contact_address"/>
            <field name="marker_color"/>
        </google_map>
    </field>
</record>


<!-- Action -->
<record id="action_partner_map" model="ir.actions.act_window">
    ...
    <field name="view_mode">kanban,tree,form,google_map</field>
    ...
</record>
```

Mandatory attributes:
- `lat`: attribute for latitude field
- `lng`: attribute for longitude field
- `sidebar_title`: attribute to be used on a sidebar of map, to display name of record (only support field `Char` and field `Many2one` )

Optional attributes:
- `string`: attribute to be used on a sidebar of map, as a head title
- `sidebar_subtitle`: attribute to be used on a sidebar of map, to display secondary info that you would like to display (only support field `Char` and field `Many2one`)
- `color`: attribute to define color of marker. You can assign color hex code or a field `Integer` in your model. _When you assign a field to set marker color, be sure to paired it with widget `color_picker` in `form` view_.    
    Example: 
    1. Using color hex code
    ```xml
    <google_map color="#FF0000">
    ...
    </google_map>
    ```
    2. Using field
    ```xml
    <!-- google_map view -->
    
    <google_map color="marker_color">
    ...
    </google_map>

    <!-- on the form view -->
    <form>
        <field name="marker_color" widget="color_picker">
    </form>
    ```
- `marker_icon`: attribute to assign FontAwesome icon as marker.    
Check this url https://fontawesome.com/v6/search?o=r&m=free&s=solid for list available icon that can be used.    
Use the FontAwesome icon name without prefix `"fa"` for example, icon `"fa-flag"` (https://fontawesome.com/icons/flag?f=classic&s=solid) then in the `"marker_icon"` attribute just use `"flag"`.    
Example:    
    ```xml
    <google_map marker_icon="flag">
        ...
    </google_map>
    ```
- `icon_scale`: attribute to set the scale of FontAwesome icon.    
Example:    
    ```xml
    <google_map icon_scale="0.8">
        ...
    </google_map>
    ```

#### Using `google_map` view inside `form` view
You can use the view inside `form` view

Example:
```xml
<field name="partner_ids" mode="google_map">
    <google_map string="Contacts" lat="partner_latitude" color="marker_color" lng="partner_longitude" sidebar_title="display_name" sidebar_subtitle="contact_address">
        <field name="partner_latitude"/>
        <field name="partner_longitude"/>
        <field name="color"/>
        <field name="display_name"/>
        <field name="contact_address"/>
        <field name="marker_color"/>
    </google_map>
</field>
```
