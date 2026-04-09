# Change Log

## 17.0.1.0.1

* Improvement:
  * Sales map views (Quotations, Orders, Orders to Invoice, Orders to Upsell) now group
    records by `partner_id` by default using the new `default_group_by` arch attribute,
    so each customer appears as a single marker on the map.
  * Added `groups_limit="100"` and `limit="1"` to all sales map views to cap the number
    of groups fetched and limit records per group to one (used for marker placement).
  * `isGrouped` prop added to `GoogleMapSidebarSales` so the sidebar is aware of the
    current grouping state.
  * Sidebar now automatically unfolds all folded groups on mount and when records change,
    using a debounced loader with UI blocking to prevent partial rendering.
  * `maxGroupByDepth` is now only enforced when a `defaultGroupBy` is active, making
    the controller more flexible when grouping is not configured.
  * Removed hardcoded `defaultGroupBy: 'partner_id'` from the controller; grouping is
    now driven by the arch definition.

## 17.0.1.0.0

* Added Google Maps view to Sales
