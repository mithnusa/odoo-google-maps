import { GoogleMapSidebar, googleMapSidebarProps } from '@web_view_google_map/views/google_map/google_map_sidebar';

// The drawing sidebar has no "Nearby" action — exclude showNearbyRecords
// from the schema. The base class binds props via `this.constructor.props`,
// so overriding the static is enough; an instance-level `props = props(...)`
// here would run too late (the base initializer validates first).
const { showNearbyRecords, ...sidebarProps } = googleMapSidebarProps;

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    static recordItemTemplate = 'web_view_google_map_drawing.RecordItem';
    static groupItemTemplate = 'web_view_google_map_drawing.GroupItem';
    static props = sidebarProps;
}
