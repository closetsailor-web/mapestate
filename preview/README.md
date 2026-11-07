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

The bottom bar keeps five tabs. The former For sale slot is labelled Listings. It opens a category choice: For Sale, For Rent, Room Share, and Auctions. It does not open a list by itself. For Rent then opens the selected-postcode sample list. For Sale, Room Share, and Auctions say that category has no stock in this preview and do not add prices or flows. Map, My properties, Shop, and Profile stay. Show available rentals remains a separate button after a place is chosen. Neither opens by itself after setup. The list is grouped by the postcode on the place result you chose, 20 rows a page. Sample pins are circle icons on the map. This preview does not add buildings for them. Moving the map does not change that filter and there is no Search this area control. A sample pin and a list row open the same detail. Each chosen place keeps 10 starter records in `yp.previewStock.v1` (not `fe.*`). Repeat selection and reload return the same ids and the same positions. The pins are a fixed pattern inside a 2 km test radius of that place’s geocoded centre. That is a nearby area, not a suburb boundary. The weekly rent and bond are test amounts. Ongoing building costs are not calculated. Apply records a preview application only. It does not change the game balance and it does not start a tenancy. These pins are not real buildings, addresses, occupants, or vacancies. A future home listed by another player would wait for that player. For sale and Auctions stay empty. Coralwood `c1:` lots are not placed on the basemap.

The postcode on the list is the code from the chosen place result, copied onto each sample as a list tag (`postcodeSource` `chosen-place-result`). A pin inside the 2 km radius is not a check that the pin itself lies in that postcode, and no postcode is invented when the place result has none. Several codes on that one result ask the player to pick among those codes only. Zoomed out, the sample pins draw as one cluster. Zoomed in, each pin is separate. With no map key the imagery stays empty and the sample pins still draw on a blank map. A highlighted building remains one polygon component plus a UUID and click coordinate in `yp.mapsel.v1`. It is not a Coralwood lot, not an owner, and not a price.

The node check listens on 8766 only, so it does not bind or stop the pilot on 8765:

```bash
node preview/map-preview-tests.cjs
```
