# Google Places Address Mapping - Separator Field

## Updated Separator Field Design

The separator field has been changed from a free-text Char field to a Selection field with predefined options for better user experience and consistency.

### Available Separator Options:

| Value | Label | Symbol | Example Result |
|-------|-------|--------|----------------|
| `'space'` | Space | `' '` | "123 Main St" |
| `'comma_space'` | Comma + Space | `', '` | "123, Main St" |
| `'comma'` | Comma | `','` | "123,Main St" |
| `'hyphen'` | Hyphen | `'-'` | "123-Main St" |
| `'underscore'` | Underscore | `'_'` | "123_Main St" |
| `'forward_slash'` | Forward Slash | `'/'` | "123/Main St" |
| `'new_line'` | New Line | `'\n'` | "123<br>Main St" |
| `'none'` | None (no separator) | `''` | "123Main St" |

### Usage Examples:

#### Example 1: Standard Address (Space separator)
```python
{
    'field_id': street_field,
    'gplace_component': ['street_number', 'route'],
    'handling_mode': 'concat',
    'separator': 'space',  # Maps to ' '
}
# Result: "123 Main Street"
```

#### Example 2: Comma-separated Address
```python
{
    'field_id': street_field,
    'gplace_component': ['street_number', 'route'],
    'handling_mode': 'concat',
    'separator': 'comma_space',  # Maps to ', '
}
# Result: "123, Main Street"
```

#### Example 3: Multi-line Address
```python
{
    'field_id': address_field,
    'gplace_component': ['street_number', 'route', 'subpremise'],
    'handling_mode': 'concat',
    'separator': 'new_line',  # Maps to '\n'
}
# Result: "123\nMain Street\nApt 4B"
```

### Benefits:

1. **User-friendly**: Dropdown selection instead of free text
2. **Consistent**: Standardized separators across all mappings
3. **Error-proof**: No invalid separator characters
4. **Clear options**: Descriptive labels for each separator type
5. **Covers common cases**: Most frequently used separators included

### Field Behavior:

- **Editable only when**: `handling_mode == 'concat'`
- **Read-only when**: `handling_mode` is 'direct' or 'fallback'
- **Default value**: 'space' (maps to space character `' '`)
- **Required**: No (uses default if not specified)