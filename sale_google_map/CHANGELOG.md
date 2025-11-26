# Change Log

## 19.0.1.0.5
### Performance Improvements
- Added marker caching to prevent duplicate marker creation for existing groups
- Optimized loadGroupRecord method to skip groups that already have loaded records
- Reduced unnecessary group toggle operations for better performance

### UI/UX Enhancements
- Enabled marker clustering for better map organization (removed disable_cluster_marker attribute)
- Standardized marker width to fixed 250px for consistent display
- Removed collision behavior setting for cleaner marker management

### Code Quality
- Improved group filtering logic in sidebar to avoid redundant processing
- Enhanced cache utilization in marker creation workflow

## 19.0.1.0.4
- Removed unused action button reference storage
- Added data-id attribute to action buttons for better traceability
- Improved code quality with consistent variable naming (datas → data)
- Simplified parameter destructuring in getAvatarUrl method

## 19.0.1.0.3
- Enhanced marker visual design with color-coded left borders matching group colors
- Improved marker container sizing with flexible min/max width (250px-400px) for better responsiveness
- Added responsive design support for screens 1600px and below
- Fixed partner avatar field reference (changed from `image_128` to `avatar_128`)


## 19.0.1.0.2
Small UI improvements on the map sidebar.

## 19.0.1.0.1
- Clean up code, no functional changes.
- Visual improvements when showing individual marker in the map.

## 19.0.1.0.0
Migration to version 19.0
