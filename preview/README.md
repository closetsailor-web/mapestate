# Map replacement preview

This is a localhost review of the private game page. It is not live and it is not on `main`.

The standalone pilot already listens on port 8765. Leave that process running. This preview defaults to 8765 and will refuse to start if that port is taken; it does not stop the existing listener. Use this when 8765 is occupied:

```bash
python3 preview/localhost-server.py --port 8766
```

Then open http://127.0.0.1:8766/ or http://localhost:8766/. The server binds `127.0.0.1` only. Host and `Origin` for `/runtime-config` are accepted only for that chosen port (`localhost` and `127.0.0.1`). A foreign origin, `*`, or another port is rejected. Provider key restrictions are unchanged.

Environment names match the tested prototype: `MAPTILER_TEST_API_KEY` and `GEOAPIFY_API_KEY`. If those are unset, the server also reads `private/api-key.txt` and `private/geoapify-api-key.txt` next to the repo root. Do not commit that folder.

With no key, the page still reaches the map step and says the basemap was not loaded. It does not draw invented buildings.

After the existing rent, buy, or room-share setup, the new basemap opens and one location popup sits over it. The heading is `Choose location`, the field placeholder is `enter town or suburb`, and the line under the field is `You can also search on the map` Listings do not open by themselves. There is no My Location control. This preview does not call `getCurrentPosition`, `watchPosition`, or a location permission query, and it does not draw an accuracy circle. The old target button is hidden. Hiding street-name symbol layers is not anonymity: the map provider still sees the view it serves, and road and building shapes stay visible. House-number and business labels stay hidden. Attribution stays.

The bottom bar keeps five tabs. The former For sale slot is labelled Listings. It opens a category choice: For Sale, For Rent, Room Share, and Auctions. It does not open a list by itself. For Rent lists sample pins inside 2 km of the town or suburb centre you chose. A place only needs that centre. For Sale, Room Share, and Auctions say that category has no stock in this preview and do not add prices or flows. Map, My properties, Shop, and Profile stay. Show available rentals remains a separate button after a place is chosen. Neither opens by itself after setup. The list is every stored sample pin within 2 km of that fixed centre, 20 rows a page. Pins from another chosen place are included only when they actually fall inside the circle. Moving the map does not move the centre. A light dashed circle marks the 2 km search area. It is the place you chose, not this device. Sample pins are circle icons on the map. This preview does not add buildings for them. A sample pin and a list row open the same detail. Each chosen place keeps 10 starter records in `yp.previewStock.v1` (not `fe.*`). Repeat selection and reload return the same ids, positions, and application state. The weekly rent and bond are test amounts. Ongoing building costs are not calculated. Apply records a preview application only. It does not change the game balance and it does not start a tenancy. These pins are not real buildings, addresses, occupants, or vacancies. A future home listed by another player would wait for that player. Coralwood `c1:` lots are not placed on the basemap.

Zoomed out, the sample pins draw as one cluster. Zoomed in, each pin is separate. With no map key the imagery stays empty and the sample pins and search circle still draw on a blank map. A highlighted building remains one polygon component plus a UUID and click coordinate in `yp.mapsel.v1`. It is not a Coralwood lot, not an owner, and not a price.

The node check listens on 8766 only, so it does not bind or stop the pilot on 8765:

```bash
node preview/map-preview-tests.cjs
```
