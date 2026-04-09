# Change Log

## 17.0.1.1.3

* Improvement:
    - Added support for `default_group_by` and `groups_limit` attributes in the `google_map` view arch.
      Views can now define a default grouping field directly in the XML definition.
    - `defaultGroupBy` is now configurable from the arch parser instead of being hardcoded to `false`.
    - `groupsLimit` falls back to `Number.MAX_SAFE_INTEGER` when not specified, effectively removing the group limit by default.
    - Exposed `googleMap` instance through the component environment (`this.env.googleMap()`), allowing child components to access the map instance directly.
    - Added `isMapReady` state to the renderer. The sidebar is now deferred until the Google Map has fully loaded its tiles (`tilesloaded` event), preventing premature rendering of sidebar content before the map is ready.

## 17.0.1.1.2
* Bug fixes:    
    - Fix the bug related to marker info window and marker cluster.
    When marker info window is open and then moved to another cluster but keep the marker info window open, the map will bring you back to the previous marker instead of showing markers inside the cluster you just clicked.
* Improvement:    
    - If there are multiple records with the same coordinates, the marker info window shown is now limit to 3 records. The user can click the `See more` button to see the rest of the records.

## 17.0.1.0.2
* Improvement:    
    An improvement to address the previous case when opening a form view triggered from marker info window. Now we will check if the active action has window view (`ir.actions.act_window.view`) linked.

## 17.0.1.0.1
* Bug fixes:    
    Fix the error thrown when save a form view opened from the marker info window.
* Improvement:    
    The form view triggered from the marker info window now will try to find the form view defined for the current action, otherwise it will launch default form view.



## 17.0.1.0.0
- Migration to version 17.0
