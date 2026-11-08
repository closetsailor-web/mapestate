#!/usr/bin/env python3
"""Loopback page for one frozen Overture building snapshot.

Binds 127.0.0.1 only. Serves an allowlist of preview files plus
GET /runtime-config, which returns the MapTiler browser key and nothing else.
Ownership claims are not served. This is not production authentication and
not a multiplayer lock.
"""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
PRIVATE = REPO / 'private'
FILES = {
    '/': ROOT / 'index.html',
    '/index.html': ROOT / 'index.html',
    '/app.js': ROOT / 'app.js',
    '/data/overlay-v1.geojson': ROOT / 'data' / 'overlay-v1.geojson',
    '/data/registry-v1.json': ROOT / 'data' / 'registry-v1.json',
    '/CREDITS.md': ROOT / 'CREDITS.md',
}
TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
}


def map_key():
    value = os.environ.get('MAPTILER_TEST_API_KEY', '').strip()
    if value:
        return value
    try:
        return (PRIVATE / 'api-key.txt').read_text(encoding='utf-8').strip()
    except OSError:
        return ''


def allowed_hosts(port):
    return {f'localhost:{port}', f'127.0.0.1:{port}'}


def allowed_origins(port):
    return {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}


def make_handler(port):
    hosts = allowed_hosts(port)
    origins = allowed_origins(port)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            return

        def send_body(self, code, body, kind='text/plain; charset=utf-8'):
            self.send_response(code)
            for key, value in {
                'Content-Type': kind,
                'Content-Length': str(len(body)),
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'Referrer-Policy': 'same-origin',
                'Cross-Origin-Resource-Policy': 'same-origin',
                'Content-Security-Policy': "frame-ancestors 'none'",
            }.items():
                self.send_header(key, value)
            self.end_headers()
            if body:
                self.wfile.write(body)

        def host_ok(self):
            return self.headers.get('Host') in hosts

        def origin_ok(self, required):
            origin = self.headers.get('Origin')
            referer = self.headers.get('Referer') or ''
            site = self.headers.get('Sec-Fetch-Site')
            if origin == 'null' or (origin and origin not in origins):
                return False
            if referer and not any(referer.startswith(item + '/') or referer == item for item in origins):
                return False
            if site and site not in {'same-origin', 'none'}:
                return False
            if required and origin not in origins:
                return False
            return True

        def do_GET(self):
            if not self.host_ok():
                return self.send_body(403, b'Forbidden')
            path = urlsplit(self.path).path
            if path != urlsplit(self.path).path or '\\' in path or '\x00' in path:
                return self.send_body(404, b'Not found')
            if path == '/runtime-config':
                if not self.origin_ok(False):
                    return self.send_body(403, b'Forbidden')
                body = json.dumps({'key': map_key()}).encode('utf-8')
                return self.send_body(200, body, 'application/json')
            target = FILES.get(path)
            if target is None or not target.is_file():
                return self.send_body(404, b'Not found')
            if not self.origin_ok(False):
                return self.send_body(403, b'Forbidden')
            self.send_body(200, target.read_bytes(), TYPES.get(target.suffix, 'application/octet-stream'))

        def do_POST(self):
            if not self.host_ok() or not self.origin_ok(True):
                return self.send_body(403, b'Forbidden')
            return self.send_body(404, b'Not found')

        def do_PUT(self):
            self.do_POST()

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    if args.port < 1 or args.port > 65535:
        raise SystemExit('Port must be 1 to 65535.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(args.port))
    print(f'http://127.0.0.1:{args.port}/', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
