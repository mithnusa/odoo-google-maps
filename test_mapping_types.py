#!/usr/bin/env python3
"""
Simple test to validate the three mapping types functionality.
This script demonstrates how the mapping types work with sample data.
"""

# Sample Google Places address components data
sample_address_components = [
    {
        "types": ["street_number"],
        "longText": "123",
        "shortText": "123"
    },
    {
        "types": ["route"], 
        "longText": "Main Street",
        "shortText": "Main St"
    },
    {
        "types": ["sublocality_level_1"],
        "longText": "Downtown District",
        "shortText": "Downtown"
    },
    {
        "types": ["neighborhood"],
        "longText": "Historic Neighborhood", 
        "shortText": "Historic"
    },
    {
        "types": ["locality"],
        "longText": "San Francisco",
        "shortText": "San Francisco"
    },
    {
        "types": ["administrative_area_level_1"],
        "longText": "California",
        "shortText": "CA"
    },
    {
        "types": ["postal_code"],
        "longText": "94102",
        "shortText": "94102"
    },
    {
        "types": ["country"],
        "longText": "United States",
        "shortText": "US"
    }
]

# Sample field configurations
field_configs = {
    # Direct mapping - uses only first component
    "city_direct": {
        "handling_mode": "direct",
        "component": ["locality", "administrative_area_level_2"],
        "text_option": "shortText"
    },
    
    # Fallback mapping - uses first available
    "street2_fallback": {
        "handling_mode": "fallback", 
        "component": ["sublocality_level_1", "neighborhood", "premise"],
        "text_option": "shortText"
    },
    
    # Concatenate mapping - joins all available
    "street_concat": {
        "handling_mode": "concat",
        "component": ["street_number", "route"],
        "separator": " ",
        "text_option": "shortText"
    }
}

def build_component_lookup(address_components):
    """Build component lookup table (simulates the actual method)."""
    lookup = {}
    for component in address_components:
        for component_type in component["types"]:
            lookup[component_type] = {
                "longText": component["longText"],
                "shortText": component["shortText"]
            }
    return lookup

def simulate_mapping_processing():
    """Simulate the mapping processing logic."""
    component_lookup = build_component_lookup(sample_address_components)
    
    print("=== Google Places Address Component Mapping Test ===\n")
    print("Available components:")
    for comp_type, comp_data in component_lookup.items():
        print(f"  {comp_type}: {comp_data['shortText']} / {comp_data['longText']}")
    
    print("\n=== Mapping Results ===")
    
    for field_name, field_config in field_configs.items():
        print(f"\n{field_name.upper()}:")
        print(f"  Mode: {field_config['handling_mode']}")
        print(f"  Components: {field_config['component']}")
        
        if field_config['handling_mode'] == 'direct':
            result = process_direct(field_config, component_lookup)
        elif field_config['handling_mode'] == 'fallback':
            result = process_fallback(field_config, component_lookup)
        elif field_config['handling_mode'] == 'concat':
            result = process_concat(field_config, component_lookup)
        
        print(f"  Result: '{result}'")

def process_direct(field_config, component_lookup):
    """Simulate direct mapping processing."""
    components = field_config['component']
    text_option = field_config['text_option']
    
    if not components:
        return ""
    
    # Direct mode - only use first component
    component_type = components[0]
    component = component_lookup.get(component_type)
    
    if component:
        return component.get(text_option, '')
    return ""

def process_fallback(field_config, component_lookup):
    """Simulate fallback mapping processing."""
    components = field_config['component']
    text_option = field_config['text_option']
    
    # Fallback mode - use first available
    for component_type in components:
        component = component_lookup.get(component_type)
        if component:
            text_value = component.get(text_option, '')
            if text_value:
                return text_value
    return ""

def process_concat(field_config, component_lookup):
    """Simulate concatenate mapping processing."""
    components = field_config['component']
    text_option = field_config['text_option']
    separator = field_config.get('separator', ' ')
    
    # Concat mode - join all available
    values = []
    for component_type in components:
        component = component_lookup.get(component_type)
        if component:
            text_value = component.get(text_option, '')
            if text_value:
                values.append(text_value)
    
    return separator.join(values)

if __name__ == "__main__":
    simulate_mapping_processing()