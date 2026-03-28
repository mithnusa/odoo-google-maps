import { GoogleMapSidebar } from '@web_view_google_map/views/google_map/google_map_sidebar';

const { showNearbyRecords, ...googleMapSidebarProps } = GoogleMapSidebar.props;
// remove unnecessary properties (showNearbyRecords is excluded via destructuring)

export class GoogleMapsDrawingSidebar extends GoogleMapSidebar {
    static recordItemTemplate = 'web_view_google_map_drawing.RecordItem';
    static groupItemTemplate = 'web_view_google_map_drawing.GroupItem';
    static props = { ...googleMapSidebarProps };
}
