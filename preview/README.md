# Map replacement preview

This is a localhost review of the private game page. It is not live and it is not on `main`.

The standalone pilot already listens on port 8765. Leave that process running. This preview defaults to 8765 and will refuse to start if that port is taken; it does not stop the existing listener. Use this when 8765 is occupied:

```bash
python3 preview/localhost-server.py --port 8766
```

Then open http://127.0.0.1:8766/ or http://localhost:8766/. The server binds `127.0.0.1` only. Host and `Origin` for `/runtime-config` are accepted only for that chosen port (`localhost` and `127.0.0.1`). A foreign origin, `*`, or another port is rejected. Provider key restrictions are unchanged.

Environment names match the tested prototype: `MAPTILER_TEST_API_KEY` and `GEOAPIFY_API_KEY`. If those are unset, the server also reads `private/api-key.txt` and `private/geoapify-api-key.txt` next to the repo root. Do not commit that folder.

With no key, the page still reaches the map step and says the basemap was not loaded. It does not draw invented buildings.

After the existing rent, buy, or room-share setup, the new basemap opens and a town or suburb popup sits over it. Listings do not open by themselves. Properties, on the map, asks for For rent, For sale, or Auctions and does not present fictional Coralwood lots as local stock. The basemap is MapTiler. Search sends partial town, suburb, postcode and street text to Geoapify after a deliberate pause. My Location asks the browser for this device only after that button is tapped. A chosen search result cancels a location request that has not finished, so the late result does not move the map. The reading is not saved, and it is not an address or a game property. A highlighted building is one polygon component plus a UUID and click coordinate in `yp.mapsel.v1`. It is not a Coralwood `c1:` lot, not an owner, and not a price. Listings still open the existing game records, and the camera is not moved onto those fictional lots. A phone needs HTTPS later; this server stays on localhost and is not opened to the LAN.

The node check listens on 8766 only, so it does not bind or stop the pilot on 8765:

```bash
node preview/map-preview-tests.cjs
```
