# Google Maps Area Selector

Allow you to select multiple markers by draw a shape (polygon, rectangle, cirle) on the maps.    
This feature is enable by default except for google_map drawing view and google_map view inside form view.    
To disabled this feature, add this attribute `disable_area_selector` to the view.    

Example:
```xml
    <record id=".." model="..">
        ...
        <field name="arch" type="xml">
            <google_map ... disable_area_selector="1">
                ...
            </google_map>
        </field>
    </record>
```