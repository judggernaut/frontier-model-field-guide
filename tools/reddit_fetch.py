#!/usr/bin/env python3
"""Reddit fetcher through a rotating residential proxy, using the mobile app's anonymous OAuth flow.

Why: anonymous www/old.reddit.com *.json is walled (403 "blocked by network security") for every
client and exit in 2026, so rotating IPs alone never helps. oauth.reddit.com with an
installed_client bearer still serves listings and /search (pattern from omkarcloud/reddit-scraper).

  REDDIT_PROXY=http://user:pass@geo.iproyal.com:12321 python3 reddit_fetch.py search OfferEngineering "research scientist"
  python3 reddit_fetch.py post 1wequa3
"""
import base64, json, os, sys, time, uuid
from curl_cffi import requests

PROXY = os.environ.get('REDDIT_PROXY')
CLIENT_ID = 'ohXpoqrZYub1kg'                       # Reddit Android app (public)
APP_UA = 'Reddit/Version 2025.20.0/Build 2352930/Android 14'
_tok = None

_sid = None
def session(new_exit=False):
    """IPRoyal: per-request rotation fails CONNECT about half the time (HTTP 504 from the gateway),
    so pin a sticky session (_session-<id>_lifetime-10m) and only change it after a block."""
    global _sid
    if new_exit or _sid is None: _sid = uuid.uuid4().hex[:8]
    s = requests.Session(impersonate="chrome")
    if PROXY:
        user, rest = PROXY.split('://', 1)[1].split('@', 1)
        u, pw = user.split(':', 1)
        pw = pw.split('_session-')[0] + f'_session-{_sid}_lifetime-10m'
        px = f'http://{u}:{pw}@{rest}'
        s.proxies = {'http': px, 'https': px}
    s.headers['User-Agent'] = APP_UA
    return s

def token(s):
    global _tok
    if _tok: return _tok
    basic = base64.b64encode(f'{CLIENT_ID}:'.encode()).decode()
    r = s.post('https://www.reddit.com/api/v1/access_token', timeout=30,
               headers={'Authorization': f'Basic {basic}'},
               data={'grant_type': 'https://oauth.reddit.com/grants/installed_client', 'device_id': str(uuid.uuid4())})
    r.raise_for_status(); _tok = r.json()['access_token']; return _tok

def get(path, params=None, tries=20):
    global _tok
    blocked = False
    for i in range(tries):
        s = session(new_exit=blocked); blocked = False
        try:
            r = s.get('https://oauth.reddit.com' + path, timeout=40,
                      headers={'Authorization': f'Bearer {token(s)}'}, params={**(params or {}), 'raw_json': 1})
            if r.status_code == 200 and r.headers.get('content-type', '').startswith('application/json'):
                return r.json()
            print(f'  try {i+1}: {r.status_code} {r.headers.get("content-type")}', file=sys.stderr)
            if r.status_code in (401, 403, 429): _tok = None; blocked = True   # wall or rate limit: new token on a new exit
        except Exception as e:
            print(f'  try {i+1}: {e.__class__.__name__} {str(e)[:80]}', file=sys.stderr); _tok = None; blocked = True
        time.sleep(0.5)
    raise SystemExit(f'failed: {path}')

def search(sub, q, limit=100):
    d = get(f'/r/{sub}/search', {'q': q, 'restrict_sr': 1, 'limit': limit, 'sort': 'new'})
    return [(c['data']['id'], c['data']['title']) for c in d['data']['children']]

def post(pid):
    d = get('/by_id/t3_' + pid)                     # /comments/<id> is walled for this bearer since Oct 2026
    p = d['data']['children'][0]['data']
    return {'id': pid, 'title': p['title'], 'body': p.get('selftext', ''), 'url': 'https://www.reddit.com' + p['permalink']}

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        for pid, t in search(sys.argv[2], sys.argv[3]): print(pid, '|', t)
    elif cmd == 'post':
        print(json.dumps(post(sys.argv[2]), indent=1))
