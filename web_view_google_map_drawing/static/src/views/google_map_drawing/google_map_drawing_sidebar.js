import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

const googleMapSidebarProps = { ...GoogleMapSidebar.props };
// remove unnecessary properties
delete googleMapSidebarProps.showNearbyRecords;

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    static recordItemTemplate = 'web_view_google_map_drawing.RecordItem';
    static groupItemTemplate = 'web_view_google_map_drawing.GroupItem';
    static props = { ...googleMapSidebarProps };
}
