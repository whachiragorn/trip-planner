#!/usr/bin/env python3
"""เซิร์ฟเวอร์เล็ก ๆ สำหรับแชร์แผนเที่ยวให้เพื่อนแก้ไขร่วมกัน (ใช้ Python มาตรฐาน ไม่ต้องติดตั้งอะไรเพิ่ม)

วิธีใช้:  python3 server.py            → เปิด http://localhost:8000
          python3 server.py 8080       → เปลี่ยนพอร์ต
การแก้ไขทั้งหมดจะถูกบันทึกลงไฟล์ trip.json ในโฟลเดอร์นี้
"""
import json, os, sys, shutil, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'trip.json')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, code, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/trip':
            if os.path.exists(DATA):
                with open(DATA, encoding='utf-8') as f:
                    return self._json(200, json.load(f))
            return self._json(200, {})
        return super().do_GET()

    def do_PUT(self):
        if self.path.split('?')[0] != '/api/trip':
            return self._json(404, {'error': 'not found'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n > 5_000_000:
                return self._json(413, {'error': 'too large'})
            data = json.loads(self.rfile.read(n))
            if not isinstance(data, dict) or 'days' not in data:
                raise ValueError('invalid')
        except Exception:
            return self._json(400, {'error': 'invalid json'})
        if os.path.exists(DATA):
            shutil.copy(DATA, DATA + '.bak')
        tmp = DATA + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, DATA)
        return self._json(200, {'ok': True, 'saved': time.time()})


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8000))
    print(f'🌏 Shanghai Trip → http://localhost:{port}  (Ctrl+C เพื่อหยุด)')
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
