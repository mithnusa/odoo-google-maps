# Change Log

## 18.0.1.0.3

- Fixed `ir.ui.view` field-tag overrides (`_postprocess_tag_field`,
  `_validate_tag_field`) to call `super()` instead of duplicating core's
  logic, so core behavior and other modules extending the same methods
  are no longer bypassed.
- Added `_get_additional_nestable_view_tags()` hook so other modules can
  register their own nestable view tags (e.g. `google_map`) via `super()`
  instead of re-overriding the field-tag methods.
- Added test suite (`tests/test_ir_ui_view.py`) covering core x2many
  auto-embedding, field validation, and `google_map` arch embedding.

## 18.0.1.0.0
Migration to version 18.0
