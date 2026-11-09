#!/usr/bin/env python3
"""Integrated game preview. Binds 127.0.0.1 only.

This is a candidate beside the installed game on port 8766 and the separate
building overlay on port 8767. It does not serve claims, and it does not log keys.
"""
import argparse
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
PRIVATE = REPO / 'private'
CHUNK_PATH = re.compile(r'^/data/chunks/-?\d+_-?\d+\.json$')
FILES = {
    '/': ROOT / 'index.html',
    '/index.html': ROOT / 'index.html',
    '/map-preview.js': ROOT / 'map-preview.js',
    '/overture-layer.js': ROOT / 'overture-layer.js',
}
TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
}


def read_secret(env_name, filename):
    value = os.environ.get(env_name, '').strip()
    if value:
        return value
    try:
        return (PRIVATE / filename).read_text(encoding='utf-8').strip()
    except OSError:
        return ''


def packaged_file(*parts):
    local = (ROOT.joinpath(*parts)).resolve()
    if local.is_file() and ROOT.resolve() in local.parents:
        return local
    sibling = (REPO.joinpath('overture-preview', *parts)).resolve()
    if sibling.is_file() and (REPO / 'overture-preview').resolve() in sibling.parents:
        return sibling
    return None


def chunk_file(path):
    return packaged_file('data', 'chunks', Path(path).name)


def make_handler(port):
    hosts = {f'localhost:{port}', f'127.0.0.1:{port}'}
    origins = {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}

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

        def allowed(self, require_origin):
            if self.headers.get('Host') not in hosts:
                return False
            origin = self.headers.get('Origin')
            referer = self.headers.get('Referer') or ''
            site = self.headers.get('Sec-Fetch-Site')
            if origin == 'null' or (origin and origin not in origins):
                return False
            if referer and not any(referer == item or referer.startswith(item + '/') for item in origins):
                return False
            if site and site not in {'same-origin', 'none'}:
                return False
            if require_origin and origin not in origins:
                return False
            return True

        def do_GET(self):
            if not self.allowed(False):
                return self.send_body(403, b'Forbidden')
            path = urlsplit(self.path).path
            if path == '/runtime-config':
                body = json.dumps({
                    'key': read_secret('MAPTILER_TEST_API_KEY', 'api-key.txt'),
                    'geoapifyKey': read_secret('GEOAPIFY_API_KEY', 'geoapify-api-key.txt'),
                }).encode()
                return self.send_body(200, body, 'application/json')
            target = FILES.get(path)
            if path in {'/data/chunk-manifest.json', '/data/boundary.geojson'}:
                target = packaged_file('data', Path(path).name)
            elif target is None and CHUNK_PATH.match(path):
                target = chunk_file(path)
            if target is None or not target.is_file():
                return self.send_body(404, b'Not found')
            self.send_body(200, target.read_bytes(), TYPES.get(target.suffix, 'application/octet-stream'))

        def do_POST(self):
            if not self.allowed(True):
                return self.send_body(403, b'Forbidden')
            return self.send_body(404, b'Not found')

        def do_PUT(self):
            self.do_POST()

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8774)
    args = parser.parse_args()
    if args.port < 1 or args.port > 65535:
        raise SystemExit('Port must be 1 to 65535.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(args.port))
    print(f'http://127.0.0.1:{args.port}/', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
