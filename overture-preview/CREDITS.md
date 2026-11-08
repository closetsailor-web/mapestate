# Building overlay credits

This preview draws one frozen extract of building footprints. It is not legal advice, and shipping this file does not settle how the game records and the open geodata must stay separate in a later product.

The map now uses Overture buildings release 2026-10-21.0 inside the Bundaberg Regional Council boundary published on data.gov.au. That boundary excludes the Coral Sea portion the council omitted. The measured area of the reprojected polygon is 6,438.456 km². It is not a promise that every structure in the region is present. The original 1,093-feature central sample remains in `source/bundaberg-buildings.geojson`. Its measured extent is about 152.3421, -24.8732 to 152.3535, -24.8623.

The council boundary is Creative Commons Attribution 4.0. Dataset `e32f307d-f866-46cf-a9bf-def12ae2be21`, Bundaberg Regional Council. The file used was the GeoJSON Web Feature Service response, reprojected from EPSG:28356 to EPSG:4326. https://data.gov.au/data/dataset/bundaberg-regional-council-area

Every parsed source row in that extract names license `ODbL-1.0`. The datasets named in those rows are:

- OpenStreetMap, provider `osm`. Copyright OpenStreetMap contributors. License: Open Database License 1.0. https://www.openstreetmap.org/copyright and https://opendatacommons.org/licenses/odbl/1-0/
- Microsoft ML Buildings, provider `microsoft`, resource `ml_buildings`. The extract records the same ODbL-1.0 license string. https://github.com/microsoft/GlobalMLBuildingFootprints

Overture Maps publishes the buildings theme that carried these footprints. https://docs.overturemaps.org/ and https://overturemaps.org/

The game id on an adopted building is assigned by this package from the frozen geometry. It is not an Overture GERS id, not an OpenStreetMap way id, and not a Microsoft record id. Those vendor ids are kept only as a secondary reference. Names in the source file are not shown on the map.

Map tiles, when a local key is present, come from MapTiler and stay under MapTiler's own terms. The page hides MapTiler building polygons so the click target is this overlay. MapTiler attribution stays on the map control.

Game saves, rental applications, and valuations are separate records. This preview does not read or rewrite them.
