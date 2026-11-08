#!/usr/bin/env python3
"""Loopback proof for one frozen Overture building snapshot.

This is not production hosting and not a multiplayer lock. It serves the
overlay page and one local ownership file. Bind address is 127.0.0.1.
"""
import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
REGISTRY = DATA / 'registry-v1.json'
OVERLAY = DATA / 'overlay-v1.geojson'
OWNERSHIP = Path(os.environ.get('OVERTURE_OWNERSHIP_FILE') or (DATA / 'ownership-v1.json'))
LOCK = threading.Lock()
TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.geojson': 'application/geo+json; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
}


def read_ownership():
    if not OWNERSHIP.exists():
        return {'version': 1, 'claims': {}}
    return json.loads(OWNERSHIP.read_text(encoding='utf-8'))


def write_ownership(body):
    OWNERSHIP.parent.mkdir(parents=True, exist_ok=True)
    tmp = OWNERSHIP.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(body), encoding='utf-8')
    tmp.replace(OWNERSHIP)


def claim(payload):
    game_id = str(payload.get('gameId') or '')
    player_id = str(payload.get('playerId') or '')
    role = payload.get('role')
    if role not in ('owner', 'tenant') or not game_id or not player_id:
        return 400, {'ok': False, 'reason': 'missing', 'shared': False}
    registry = json.loads(REGISTRY.read_text(encoding='utf-8'))
    known = {row['gameId'] for row in registry.get('records') or []}
    if game_id not in known:
        return 404, {'ok': False, 'reason': 'not-adopted', 'shared': False}
    with LOCK:
        state = read_ownership()
        claims = dict(state.get('claims') or {})
        current = dict(claims.get(game_id) or {'owner': '', 'tenant': ''})
        if current.get(role) and current.get(role) != player_id:
            return 409, {'ok': False, 'reason': 'taken', 'claim': current, 'shared': 'local-file-only'}
        current[role] = player_id
        claims[game_id] = current
        write_ownership({'version': 1, 'claims': claims})
        return 200, {'ok': True, 'reason': 'claimed', 'claim': current, 'shared': 'local-file-only'}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/claims':
            return self.send_json(200, read_ownership())
        file_path = {
            '/': ROOT / 'index.html',
            '/index.html': ROOT / 'index.html',
            '/app.js': ROOT / 'app.js',
            '/data/overlay-v1.geojson': OVERLAY,
            '/data/registry-v1.json': REGISTRY,
            '/CREDITS.md': ROOT / 'CREDITS.md'
        }.get(path)
        if not file_path or not file_path.exists():
            self.send_error(404)
            return
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', TYPES.get(file_path.suffix, 'application/octet-stream'))
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlsplit(self.path).path != '/api/claim':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length') or 0)
        try:
            payload = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
        except json.JSONDecodeError:
            return self.send_json(400, {'ok': False, 'reason': 'bad-json'})
        status, body = claim(payload)
        self.send_json(status, body)

    def send_json(self, status, body):
        raw = json.dumps(body).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        return


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8767)
    args = parser.parse_args()
    if args.port < 1 or args.port > 65535:
        raise SystemExit('Port must be 1 to 65535.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'http://127.0.0.1:{args.port}/', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
