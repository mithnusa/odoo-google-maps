# Change Log

## 19.0.1.0.4

- [Improved] **Google Maps Context Flag**: `record.update()` in `_handlePlaceSelect` is now wrapped with `record.context.is_from_google_maps = true` set before the call and cleaned up in a `finally` block after; downstream field handlers and computed triggers can use this flag to detect that the update originated from a Google Places selection
