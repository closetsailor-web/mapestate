# Overture building overlay preview

This is a separate page from the game map preview. It does not change rental applications, the bottom navigation, or saved games.

```bash
python3 overture-preview/server.py --port 8767
```

Open http://127.0.0.1:8767/ . The process binds `127.0.0.1` only. Do not use port 8765.

The coloured shapes are the frozen registry. A tap shows that shape's game id. Grey shapes overlapped another footprint and were not given a saleable id. A tap does not charge money.

The same `data/registry-v1.json` file is what every browser loads, so the game ids are the ones stored in that file. They are not new UUIDs minted in the page. The claim buttons write `data/ownership-v1.json` on this machine. A second owner or tenant for the same game id is refused. That file is not a public lock and it is not connected to the game's `fe.*` or `yp.*` saves.

Credits are in `CREDITS.md`. The license notice is in `LICENSES/NOTICE.md`.
