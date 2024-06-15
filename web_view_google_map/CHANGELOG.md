# Change Log

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
