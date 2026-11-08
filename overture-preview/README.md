# Overture building overlay preview

This is a separate page from the game map preview. It does not change rental applications, the bottom navigation, or saved games.

```bash
python3 overture-preview/server.py --port 8767
```

Open http://127.0.0.1:8767/ . The process binds `127.0.0.1` only. Do not use port 8765.

The coloured shapes are the frozen registry. A tap shows that shape's game id. Grey shapes overlapped another footprint and were not given a saleable id. A tap does not charge money.

The same `data/registry-v1.json` file is what every browser loads, so the game ids are the ones stored in that file. They are not new UUIDs minted in the page. This server does not accept owner or tenant claims. It does not write an ownership file, and it does not read the game's `fe.*` or `yp.*` saves.

The basemap uses the same MapTiler browser key as the game preview, when that key is already available to the process. Set `MAPTILER_TEST_API_KEY` in the environment, or leave the existing `private/api-key.txt` file in place. Do not copy the key into this folder, the zip, or the registry. The page asks the server for it at `GET /runtime-config`. The answer is JSON with one field, `key`. If neither the environment nor that file has a key, the field is empty and the buildings still draw on a plain background. When a key is present, the page loads the MapTiler base map and puts the same building shapes back on top of it. The view starts on this sample. If that basemap does not finish, the shapes stay on the plain background and the page says so. The key is added only to requests whose host is `api.maptiler.com`. This is the browser map key, not a search key and not any other credential.

Credits are in `CREDITS.md`. The license notice is in `LICENSES/NOTICE.md`.
