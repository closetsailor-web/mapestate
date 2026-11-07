#!/usr/bin/env python3
"""Loopback preview for the private game page. Not a production server.

Serves only the map-preview entry and GET /runtime-config. Keys come from
MAPTILER_TEST_API_KEY and GEOAPIFY_API_KEY, with the same private-file
fallbacks as the tested prototype. Those files are never created here and
must not be committed. Allowed hosts stay localhost:8765 and 127.0.0.1:8765.
"""
import http.server
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / '3d-5d6ea64333a6' / 'index.html'
SCRIPT = ROOT / '3d-5d6ea64333a6' / 'map-preview.js'
PRIVATE = ROOT / 'private'
ALLOWED = {'localhost:8765', '127.0.0.1:8765'}
ORIGINS = {'http://localhost:8765', 'http://127.0.0.1:8765'}
ROUTES = {'/': GAME, '/index.html': GAME, '/map-preview.js': SCRIPT}
TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8'}


def read_secret(env_name, filename):
    value = os.environ.get(env_name, '').strip()
    if value:
        return value
    try:
        return (PRIVATE / filename).read_text().strip()
    except OSError:
        return ''


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def send_body(self, code, body, kind='text/plain; charset=utf-8'):
        self.send_response(code)
        for key, value in {
            'Content-Type': kind,
            'Content-Length': str(len(body)),
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Cross-Origin-Resource-Policy': 'same-origin',
        }.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get('Host') not in ALLOWED:
            return self.send_body(403, b'Forbidden')
        path = urlsplit(self.path).path
        if path == '/runtime-config':
            origin = self.headers.get('Origin')
            if origin and origin not in ORIGINS:
                return self.send_body(403, b'Forbidden')
            site = self.headers.get('Sec-Fetch-Site')
            if site and site not in {'same-origin', 'none'}:
                return self.send_body(403, b'Forbidden')
            body = json.dumps({
                'key': read_secret('MAPTILER_TEST_API_KEY', 'api-key.txt'),
                'geoapifyKey': read_secret('GEOAPIFY_API_KEY', 'geoapify-api-key.txt'),
            }).encode()
            return self.send_body(200, body, 'application/json')
        target = ROUTES.get(path)
        if not target:
            return self.send_body(404, b'Not found')
        try:
            body = target.read_bytes()
        except OSError:
            return self.send_body(500, b'Local file unavailable')
        self.send_body(200, body, TYPES[target.suffix])


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    print('Map preview at http://127.0.0.1:8765/', flush=True)
    server.serve_forever()
