#!/usr/bin/env python3
"""Write the in-page build id from version.json, the single source of truth.

Usage (from this folder):
    python3 sync-version.py

Reads version.json {"v":"datesXX"} and updates index.html:
  - window.YP_BUILD
  - map-preview.js and overture-layer.js ?v= queries

When pushing live, copy version.json into the live folder as well, then
run this script there (or copy the already-synced index.html and
version.json together) so live has its own version.json.
"""
from pathlib import Path
import json, re, sys

here = Path(__file__).resolve().parent
data = json.loads((here / "version.json").read_text())
v = str(data.get("v") or "").strip()
if not re.fullmatch(r"[A-Za-z0-9._-]+", v):
    sys.exit("version.json is missing a simple v value")

html_path = here / "index.html"
html = html_path.read_text()
html2, n1 = re.subn(
    r"window\.YP_BUILD\s*=\s*['\"][^'\"]+['\"]",
    "window.YP_BUILD=" + json.dumps(v),
    html,
    count=1,
)
html2, n2 = re.subn(
    r"(map-preview\.js\?v=)[A-Za-z0-9._-]+",
    r"\1" + v,
    html2,
)
html2, n3 = re.subn(
    r"(overture-layer\.js\?v=)[A-Za-z0-9._-]+",
    r"\1" + v,
    html2,
)
if n1 != 1 or n2 < 1 or n3 < 1:
    sys.exit(f"could not update index.html (YP_BUILD={n1}, map={n2}, overture={n3})")
if html2 != html:
    html_path.write_text(html2)
print(f"synced {v} into index.html")
