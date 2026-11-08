# Bundaberg regional coverage

This is a wider local preview of one frozen building extract. It is not a claim that every building in the region is included, and it is not multiplayer or a production property register.

## Boundary

The extent is the Bundaberg Regional Council local government boundary published by the council on data.gov.au, not a hand-drawn square around the CBD.

- Dataset: Bundaberg Regional Council Area, id `e32f307d-f866-46cf-a9bf-def12ae2be21`
- Page: https://data.gov.au/data/dataset/bundaberg-regional-council-area
- File: GeoJSON Web Feature Service, https://data.gov.au/geoserver/bundaberg-regional-council-area/wfs?request=GetFeature&typeName=ckan_e32f307d_f866_46cf_a9bf_def12ae2be21&outputFormat=json
- Licence: Creative Commons Attribution 4.0 International
- Council note: the boundary excludes parcels whose locality is Coral Sea
- Source coordinate reference system: EPSG:28356 (GDA94 / MGA zone 56)
- Used on the map as: EPSG:4326, transformed with the EPSG definition, without clipping building footprints
- Measured geodesic area of that polygon: 6,438.456 km²
- Bounds: 151.341793, -25.4313055 to 152.6330215, -24.5137614

The outline is `data/boundary.geojson`.

## Buildings

- Source: Overture Maps buildings, release `2026-10-21.0`
- Path: `s3://overturemaps-us-west-2/release/2026-10-21.0/theme=buildings/type=building/*`
- Access: public Amazon S3, no paid query and no account
- A bbox count inside the council bounds, before the polygon test, was 89,502
- Features whose geometry intersects the council polygon, kept whole: 79,879
- Downloaded slim file size, without names: 28,361,766 bytes
- Adopted game ids: 79,046, including the original 1,058
- Quarantined, not saleable, drawn grey where a geometry exists: 833, including the original 35
- New overlaps or ambiguous matches: 798, failed closed, no new saleable id
- The original 1,093 sample features were all found again. 1,058 kept the same game id. 35 matched an existing quarantined geometry and were not added a second time

Buildings outside the polygon are not included. A building that crosses the boundary is kept whole, so the drawing can extend slightly past the line. Names and addresses are not stored in the served chunks. Overture's own release notes list several global source datasets; each kept record stores only the dataset name and licence string that came with it. Those strings in this extract are ODbL-1.0 for OpenStreetMap and Microsoft ML Buildings. See `CREDITS.md`.

## Prices

The original 1,058 price rows are unchanged. These three stay:

- `ypb-3be0a2ac226ef07bee0a8a8115b3cf2d` $1,152,835
- `ypb-962c403a94919046f4fa6e7347665435` $630,000
- `ypb-e55369618f2c13e5c92bdaf3dda1ee58` $438,000

New buildings use the same residential formula, the same stored 30–40% commercial uplift, and a 0 adjustment for other classified buildings. That 0 is pending review. Unknown buildings, roofs, sheds, garages, and outbuildings have no estimate. No listing, purchase, or owner is created.

## Map

The page loads only the chunks that intersect the current view, with a small margin. The whole council view does not load every footprint. That is a display limit of this preview, not a statement that those buildings are absent from the file.
