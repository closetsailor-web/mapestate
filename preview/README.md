# Map replacement preview

This is a localhost review of the private game page. It is not live and it is not on `main`.

The standalone pilot already listens on port 8765. Leave that process running. This preview defaults to 8765 and will refuse to start if that port is taken; it does not stop the existing listener. Use this when 8765 is occupied:

```bash
python3 preview/localhost-server.py --port 8766
```

Then open http://127.0.0.1:8766/ or http://localhost:8766/. The server binds `127.0.0.1` only. Host and `Origin` for `/runtime-config` are accepted only for that chosen port (`localhost` and `127.0.0.1`). A foreign origin, `*`, or another port is rejected. Provider key restrictions are unchanged.

Environment names match the tested prototype: `MAPTILER_TEST_API_KEY` and `GEOAPIFY_API_KEY`. If those are unset, the server also reads `private/api-key.txt` and `private/geoapify-api-key.txt` next to the repo root. Do not commit that folder.

With no key, the page still reaches the map step and says the basemap was not loaded. It does not draw invented buildings.

After the existing rent, buy, or room-share setup, the new basemap opens and one location popup sits over it. The heading is `Choose location` and the field placeholder is `enter town or suburb`. Listings do not open by themselves. There is no My Location control. This preview does not call `getCurrentPosition`, `watchPosition`, or a location permission query, and it does not draw an accuracy circle. The old target button is hidden. Hiding street-name symbol layers is not anonymity: the map provider still sees the view it serves, and road and building shapes stay visible. House-number and business labels stay hidden. Attribution stays.

Show available rentals is a separate button after a place is chosen. It is not opened by setup. The list is the selected postcode, 20 rows a page. Moving the map does not change that filter and there is no Search this area control. Markers use the same detail popup as a list row. Each chosen suburb gets 10 shared preview starter homes in `yp.previewStock.v1` (not `fe.*`). Repeat selection does not add another 10. The points are a small scatter around the chosen locality, not vendor building footprints and not street addresses. Weekly rent and a four-week bond are labelled preview assumptions. Ongoing building costs are not calculated. Apply records a preview application only. It does not change the game balance and it does not start a tenancy. These homes are not real vacancies, occupants, or landlords. A future home listed by another player would wait for that player. For sale and Auctions stay empty. Coralwood `c1:` lots are not placed on the basemap.

Postcode limitation: no licensed exhaustive suburb-boundary file is bundled. The community file `australian_postcodes.json` (matthewproctor/australianpostcodes) answered HTTP 200, and its README says Australia Post no longer publishes a free raw full list. That repository has no LICENSE file (the license URLs returned 404), so the file was not copied into this preview. Geoapify postcode autocomplete is a partial search, not a boundary. The list uses only a 4-digit `postcode` on the locality result the player chose. If that result has several codes, the player picks among those codes only. If it has none, the list says the postcode is unavailable and invents no code and no radius substitute. The map can still be moved. A highlighted building remains one polygon component plus a UUID and click coordinate in `yp.mapsel.v1`. It is not a Coralwood lot, not an owner, and not a price.

The node check listens on 8766 only, so it does not bind or stop the pilot on 8765:

```bash
node preview/map-preview-tests.cjs
```
