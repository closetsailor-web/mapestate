#!/usr/bin/env python3
"""Loopback preview for the private game page. Not a production server.

Serves only the map-preview entry and GET /runtime-config. Keys come from
MAPTILER_TEST_API_KEY and GEOAPIFY_API_KEY, with the same private-file
fallbacks as the tested prototype. Those files are never created here and
must not be committed. The process binds 127.0.0.1 only. The default port is
8765. Pass --port to choose another localhost port without stopping whatever
is already listening. Host and Origin checks accept only that chosen port.
"""
import argparse
import errno
import http.server
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
GAME = ROOT / '3d-5d6ea64333a6' / 'index.html'
SCRIPT = ROOT / '3d-5d6ea64333a6' / 'map-preview.js'
PRIVATE = ROOT / 'private'
DEFAULT_PORT = 8765
ROUTES = {'/': GAME, '/index.html': GAME, '/map-preview.js': SCRIPT}
TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8'}


def preview_port(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument('--port', default=str(DEFAULT_PORT))
    args = parser.parse_args(argv)
    try:
        port = int(args.port)
    except (TypeError, ValueError):
        port = 0
    if port < 1 or port > 65535:
        raise SystemExit('Port must be an integer from 1 to 65535. The bind address stays 127.0.0.1.')
    return port


def loopback_rules(port):
    hosts = {f'localhost:{port}', f'127.0.0.1:{port}'}
    origins = {f'http://localhost:{port}', f'http://127.0.0.1:{port}'}
    return hosts, origins


def read_secret(env_name, filename):
    value = os.environ.get(env_name, '').strip()
    if value:
        return value
    try:
        return (PRIVATE / filename).read_text().strip()
    except OSError:
        return ''


def make_handler(port):
    hosts, origins = loopback_rules(port)

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
            if self.headers.get('Host') not in hosts:
                return self.send_body(403, b'Forbidden')
            path = urlsplit(self.path).path
            if path == '/runtime-config':
                origin = self.headers.get('Origin')
                if origin and origin not in origins:
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

    return Handler


if __name__ == '__main__':
    port = preview_port()
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', port), make_handler(port))
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            sys.exit(
                f'127.0.0.1:{port} is already in use. That process was left running.\n'
                'Start this preview on a free localhost port instead:\n'
                '  python3 preview/localhost-server.py --port 8766'
            )
        raise
    print(f'Map preview at http://127.0.0.1:{port}/ and http://localhost:{port}/', flush=True)
    print('Listening on 127.0.0.1 only. An existing listener is not stopped.', flush=True)
    server.serve_forever()
