# Change Log

## 19.0.1.0.3

### Fixed
- **Notification Service Calls**: Replaced incorrect `notificationService(...)` direct calls with `notificationService.add(...)` across all notification usages in `use_google_place_autocomplete_mapping.js`
- **Widget ID Generation**: `getUniqueWidgetId()` now uses `record.resId` / `record.virtualId` instead of `record.id` to correctly handle unsaved (new) records without errors
- **Error Return Value**: `fetchMappingConfig()` now returns `null` on failure instead of `{}` for clearer error distinction from empty results

### Improved
- **Concurrent Fetch Deduplication**: Added `_pendingFetch` promise guard in `getMappingConfig()` to prevent duplicate simultaneous RPC calls when the mapping config is not yet cached
- **Mapping Cache Clarity**: Renamed internal `localState` object to `mappingCache` to better reflect its purpose

### Code Quality
- Renamed `is_test` parameter to `isTest` to follow JavaScript camelCase conventions

## 19.0.1.0.2

### Fixed

- **Code Quality**: Added missing semicolon in return statement for consistent code formatting
- **Code Cleanup**: Removed unused NOTIFICATION_CONFIG constant

## 19.0.1.0.1
Initial release for Odoo 19.0

## 19.0.1.0.0
Migration to version 19.0
