# Google Places Address Mapping Types

This document explains the three mapping types available for address field mappings in the Google Places integration.

## Mapping Types

### 1. Direct Mapping (`direct`)
Uses only the first component from the list.

**Example Configuration:**
- Field: `city`
- Components: `['locality', 'administrative_area_level_2']`
- Handling Mode: `direct`

**Behavior:**
- Only uses `locality` component
- Ignores `administrative_area_level_2`
- Returns the value from `locality` if available, empty string otherwise

### 2. Fallback Mapping (`fallback`)
Uses the first available component from the list in priority order.

**Example Configuration:**
- Field: `street2`
- Components: `['sublocality_level_1', 'neighborhood', 'premise']`
- Handling Mode: `fallback`

**Behavior:**
- Tries `sublocality_level_1` first
- If not available, tries `neighborhood`
- If not available, tries `premise`
- Returns the first available value, empty string if none found

### 3. Concatenate Mapping (`concat`)
Joins all available components with a separator.

**Example Configuration:**
- Field: `street`
- Components: `['street_number', 'route']`
- Handling Mode: `concat`
- Separator: ` ` (space)

**Behavior:**
- Gets values from both `street_number` and `route`
- Joins them with the specified separator
- Example result: "123 Main Street"

## Configuration Examples

### Complete Address Mapping Configuration

```python
# Example address line configurations

# Street address (concatenate)
{
    'field_id': 'street',
    'gplace_component': "['street_number', 'route']",
    'handling_mode': 'concat',
    'separator': ' ',
    'text_option': 'shortText'
}

# Secondary address (fallback)  
{
    'field_id': 'street2',
    'gplace_component': "['sublocality_level_1', 'neighborhood', 'premise']",
    'handling_mode': 'fallback',
    'separator': ' ',  # Not used for fallback
    'text_option': 'shortText'
}

# City (direct)
{
    'field_id': 'city',
    'gplace_component': "['locality']",
    'handling_mode': 'direct',
    'separator': ' ',  # Not used for direct
    'text_option': 'longText'
}

# State (fallback for relational field)
{
    'field_id': 'state_id',
    'gplace_component': "['administrative_area_level_1', 'administrative_area_level_2']",
    'handling_mode': 'fallback',
    'separator': ' ',  # Not used for relational fields
    'text_option': 'shortText'
}
```

## Processing Logic

The mapping types are processed in the following methods:

1. **Text Fields** (`char`, `text`):
   - `_process_direct_mapping()` - Returns first component only
   - `_process_fallback_mapping()` - Returns first available component
   - `_process_concat_mapping()` - Returns all components for joining
   - `_format_text_field_value()` - Formats the final text value

2. **Relational Fields** (`many2one`, `many2many`):
   - Uses same component selection logic
   - Always acts as fallback (tries components in order until match found)
   - Returns Odoo record ID or list of IDs

## Special Cases

### Street Fields
Street fields that contain both `route` and `street_number` components get special country-specific formatting through `_format_street_address()` method.

### Relational Fields
For relational fields (country, state), the handling mode determines which components to try, but the behavior is essentially fallback - it stops at the first successful record match.

## Default Values

- **Default Handling Mode**: `direct`
- **Default Separator**: ` ` (space)
- **Default Text Option**: `shortText`