# Map replacement preview

This is a localhost review of the private game page. It is not live and it is not on `main`.

Open http://127.0.0.1:8765/ or http://localhost:8765/ after:

```bash
MAPTILER_TEST_API_KEY=... GEOAPIFY_API_KEY=... python3 preview/localhost-server.py
```

The server binds `127.0.0.1:8765` only. Hosts and origins stay `localhost:8765` and `127.0.0.1:8765`. Environment names match the tested prototype: `MAPTILER_TEST_API_KEY` and `GEOAPIFY_API_KEY`. If those are unset, the server also reads `private/api-key.txt` and `private/geoapify-api-key.txt` next to the repo root. Do not commit that folder.

With no key, the page still reaches the map step and says the basemap was not loaded. It does not draw invented buildings.

The basemap is MapTiler. Search sends partial town, suburb, postcode and street text to Geoapify after a deliberate pause. A highlighted building is one polygon component plus a UUID and click coordinate in `yp.mapsel.v1`. It is not a Coralwood `c1:` lot, not an owner, and not a price. Listings still open the existing game records, and the camera is not moved onto those fictional lots.

```bash
node preview/map-preview-tests.cjs
```
