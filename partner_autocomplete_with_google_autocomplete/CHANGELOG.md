# Change Log

## 19.0.1.0.6

### Improved

- **Python — Black format** (`models/res_partner.py`): Reformatted `node.set(...)` call to multi-line style.
- **JS code style** (`partner_autocomplete_with_google_place.js`): Reformatted multi-line imports, `notificationService.add(...)`, and `registry.add(...)` calls; added missing semicolon on `return {}`.
- **XML format** (`partner_autocomplete_with_google_place.xml`): Self-closing tags (`<div />`, `<i />`), multi-line attribute layout for `<t t-name=...>` and `<a>` elements, trailing newline added.
- **SCSS** (`partner_autocomplete_with_google_place.scss`): Added missing newline at end of file.
- **Manifest**: Version normalized to `19.0.1.0.6`; removed `installable`, `application`, `auto_install` keys.

## 19.0.1.0.5

### Improved

- **Manifest**: Rewrote summary and description; replaced wildcard asset glob with explicit ordered file entries; removed empty `data` and `demo` keys
- **i18n**: Regenerated POT — updated dates; removed stale `"Create a Customer"` website form label entry

## 19.0.1.0.4

- [Improved] **Google Maps Context Flag**: `record.update()` in `_handlePlaceSelect` is now wrapped with `record.context.is_from_google_maps = true` set before the call and cleaned up in a `finally` block after; downstream field handlers and computed triggers can use this flag to detect that the update originated from a Google Places selection
