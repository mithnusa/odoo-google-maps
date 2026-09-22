# -*- coding: utf-8 -*-
from unittest.mock import patch

from lxml import etree

from odoo.exceptions import ValidationError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestIrUiViewFieldOverrides(TransactionCase):
    """Regression tests for web_view_google_map's `_postprocess_tag_field`
    and `_validate_tag_field` overrides on `ir.ui.view`.

    Both methods must keep calling `super()` so that core's own behavior
    (and any other module extending the same methods) is preserved, while
    still supporting embedding a <google_map> arch inside an x2many
    <field> node."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.View = cls.env["ir.ui.view"]

    def _create_partner_form_view(self, field_arch):
        return self.View.create(
            {
                "name": "test_google_map_field_postprocess",
                "model": "res.partner",
                "arch": f"""
                <form>
                    <field name="name"/>
                    {field_arch}
                </form>
            """,
            }
        )

    # -- core behavior must still run through super() --------------------

    def test_core_x2many_auto_embed_still_works(self):
        """A plain one2many field with no widget/child arch must still get
        an automatically embedded list view from core's own logic."""
        view = self._create_partner_form_view('<field name="bank_ids"/>')
        arch = self.env["res.partner"].get_view(view_id=view.id)["arch"]
        arch_node = etree.fromstring(arch)
        bank_field = arch_node.find('.//field[@name="bank_ids"]')
        self.assertIsNotNone(bank_field)
        self.assertTrue(
            bank_field.findall("list") or bank_field.findall("tree"),
            "core's automatic x2many view embedding did not run; "
            "super() call may be missing from _postprocess_tag_field",
        )

    def test_core_missing_field_name_still_raises(self):
        with self.assertRaises(ValidationError):
            self._create_partner_form_view("<field/>")

    def test_core_unknown_field_still_raises(self):
        with self.assertRaises(ValidationError):
            self._create_partner_form_view(
                '<field name="not_a_real_field_xyz"/>'
            )

    # -- google_map embedding added by this module ------------------------

    def test_google_map_child_is_postprocessed(self):
        """The embedded google_map arch must be recursively postprocessed
        (proves node_info['children'] handling doesn't drop it)."""
        view = self._create_partner_form_view(
            """
            <field name="bank_ids">
                <google_map js_class="google_map_drawing" sidebar_title="acc_number">
                    <field name="acc_number"/>
                </google_map>
            </field>
        """
        )
        arch = self.env["res.partner"].get_view(view_id=view.id)["arch"]
        arch_node = etree.fromstring(arch)
        bank_field = arch_node.find('.//field[@name="bank_ids"]')
        google_map_node = bank_field.find("google_map")
        self.assertIsNotNone(google_map_node)
        self.assertIsNotNone(
            google_map_node.find('field[@name="acc_number"]')
        )

    def test_google_map_child_fields_are_validated(self):
        """A bad field reference inside the embedded google_map arch must
        still raise, proving _validate_tag_field recurses into it."""
        with self.assertRaises(ValidationError):
            self._create_partner_form_view(
                """
                <field name="bank_ids">
                    <google_map js_class="google_map_drawing" sidebar_title="acc_number">
                        <field name="not_a_real_field_xyz"/>
                    </google_map>
                </field>
            """
            )

    def test_google_map_child_survives_view_inheritance(self):
        """Mirrors web_view_google_map_drawing's real-world pattern: a base
        view is extended by an inheriting view that injects an x2many
        <field> with a nested <google_map> arch via xpath. The combined,
        postprocessed arch (resolved from the base view id) must still
        contain the google_map child and its nested fields."""
        base_view = self.View.create(
            {
                "name": "test_google_map_inherit_base",
                "model": "res.partner",
                "arch": """
                <form>
                    <field name="name"/>
                </form>
            """,
            }
        )
        self.View.create(
            {
                "name": "test_google_map_inherit_extension",
                "model": "res.partner",
                "inherit_id": base_view.id,
                "arch": """
                <xpath expr="//field[@name='name']" position="after">
                    <field name="bank_ids">
                        <google_map js_class="google_map_drawing" sidebar_title="acc_number">
                            <field name="partner_id"/>
                            <field name="acc_number"/>
                        </google_map>
                    </field>
                </xpath>
            """,
            }
        )
        arch = self.env["res.partner"].get_view(view_id=base_view.id)[
            "arch"
        ]
        arch_node = etree.fromstring(arch)
        bank_field = arch_node.find('.//field[@name="bank_ids"]')
        self.assertIsNotNone(
            bank_field, "xpath-injected x2many field did not survive"
        )
        google_map_node = bank_field.find("google_map")
        self.assertIsNotNone(
            google_map_node,
            "google_map child did not survive view inheritance resolution",
        )
        self.assertEqual(
            {f.get("name") for f in google_map_node.findall("field")},
            {"partner_id", "acc_number"},
        )

    # -- extension hook composability --------------------------------------

    def test_extension_hook_is_composable(self):
        """Future modules should extend _get_additional_nestable_view_tags
        via super() instead of re-overriding _postprocess_tag_field /
        _validate_tag_field. Simulate such an extension and verify the
        original 'google_map' tag and the new tag both keep working when
        combined."""
        IrUiView = type(self.env["ir.ui.view"])
        original = IrUiView._get_additional_nestable_view_tags

        def extended(self):
            return original(self) + ("my_custom_map",)

        with patch.object(
            IrUiView, "_get_additional_nestable_view_tags", extended
        ):
            view = self._create_partner_form_view(
                """
                <field name="bank_ids">
                    <google_map js_class="google_map_drawing" sidebar_title="acc_number">
                        <field name="acc_number"/>
                    </google_map>
                </field>
                <field name="child_ids">
                    <my_custom_map>
                        <field name="name"/>
                    </my_custom_map>
                </field>
            """
            )
            arch = self.env["res.partner"].get_view(view_id=view.id)["arch"]
            arch_node = etree.fromstring(arch)

            bank_field = arch_node.find('.//field[@name="bank_ids"]')
            self.assertIsNotNone(bank_field.find("google_map"))

            child_field = arch_node.find('.//field[@name="child_ids"]')
            self.assertIsNotNone(child_field.find("my_custom_map"))

            with self.assertRaises(ValidationError):
                self._create_partner_form_view(
                    """
                    <field name="child_ids">
                        <my_custom_map>
                            <field name="not_a_real_field_xyz"/>
                        </my_custom_map>
                    </field>
                """
                )
