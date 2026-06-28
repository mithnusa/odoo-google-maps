# -*- coding: utf-8 -*-
from odoo import fields, models
from .fields import SearchableJson


class GoogleDrawingShape(models.AbstractModel):
    _name = "google.drawing.shape"
    _description = "Google Maps Shape Mixin"
    _rec_name = "gshape_name"

    gshape_name = fields.Char(
        string="Name", default=lambda self: self.env._("New Shape")
    )
    gshape_area = fields.Float(
        string="Area",
        digits=(16, 2),
    )
    gshape_description = fields.Text(string="Description")
    # NOTE: Concrete models inheriting this mixin should add a GIN index on this column
    # for performant json_contains / json_not_contains searches at scale:
    #   CREATE INDEX CONCURRENTLY ON <table> USING gin (gshape_geojson jsonb_path_ops);
    gshape_geojson = SearchableJson(string="Shape GeoJSON")
    gshape_color = fields.Integer(
        default=1, string="Color"
    )  # Paired with widget color picker
