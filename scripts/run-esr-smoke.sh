#!/usr/bin/env bash
set -euo pipefail
# Only run on a disposable CI Docker host, never the production host.
: "${CI:?This smoke test is for disposable CI runners only}"
prefix="kasm-esr-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"
network="$prefix-net"
driver="$prefix-driver"
browser="$prefix-firefox"
volume="$prefix-profile"
tmp=$(mktemp -d)
cleanup() {
  docker rm -f "$browser" "$driver" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  sudo rm -rf "$tmp"
}
trap cleanup EXIT
docker build -f firefox/Dockerfile.esr -t "$prefix-firefox" .
docker build -f driver/Dockerfile -t "$prefix-driver" .
# Synthetic credentials are generated on the runner; never print or upload them.
python3 - "$tmp" <<'PY'
import json, pathlib, secrets, sys
p=pathlib.Path(sys.argv[1])
(p/'key').write_text(secrets.token_urlsafe(32))
(p/'managed').write_text(json.dumps({'name':'kasm-agent@chabad.gr','description':'Isolated CI fixture','type':'storage','data':{'wsUrl':'ws://driver:8080/ws','wsToken':secrets.token_urlsafe(32)}}))
(p/'browser.env').write_text('VNC_PW='+secrets.token_hex(12)+'\n')
PY
sudo chown 1000:1000 "$tmp/key" "$tmp/managed"
sudo chmod 0400 "$tmp/key" "$tmp/managed"
chmod 0600 "$tmp/browser.env"
docker network create --internal "$network"
docker volume create "$volume"
docker run -d --name "$driver" --network "$network" --network-alias driver \
  --mount "type=bind,src=$tmp/key,dst=/run/secrets/driver_api_key,readonly" \
  --mount "type=bind,src=$tmp/managed,dst=/run/secrets/driver_managed_storage,readonly" \
  "$prefix-driver"
docker run -d --name "$browser" --network "$network" --shm-size=512m \
  --env-file "$tmp/browser.env" --env "APP_ARGS=-profile /esr-profile" --mount "type=volume,src=$volume,dst=/esr-profile" \
  --mount "type=bind,src=$tmp/managed,dst=/usr/lib/mozilla/managed-storage/kasm-agent@chabad.gr.json,readonly" \
  "$prefix-firefox"
docker exec "$browser" firefox-esr --version
docker exec -i "$driver" node - < scripts/esr-smoke.js
docker restart "$driver"
docker exec -i "$driver" node - --after-restart < scripts/esr-smoke.js
# Wait for the real profile DBs to persist the synthetic markers before
# interrupting Firefox; DOM readback alone is not evidence of durable writes.
docker exec -i "$browser" python3 - <<'PY'
import pathlib, sqlite3, time
root=pathlib.Path('/esr-profile')
deadline=time.monotonic()+60
while time.monotonic()<deadline:
    try:
        with sqlite3.connect(f'file:{root}/cookies.sqlite?mode=ro',uri=True) as db:
            cookies={row[0] for row in db.execute("SELECT value FROM moz_cookies WHERE name='kasm_probe'")}
        storage=set()
        for p in root.glob('storage/default/*/ls/data.sqlite'):
            with sqlite3.connect(f'file:{p}?mode=ro',uri=True) as db:
                # LSNG values can be compressed; existence of a committed key
                # in each isolated DB is sufficient here. Readback checks values.
                if db.execute("SELECT 1 FROM data WHERE key='kasm_probe'").fetchone():
                    storage.add(p.parent.parent.name)
        if (root/'containers.json').is_file() and cookies=={'A','B'} and len(storage)>=2:
            print('PASS: profile volume contains both durable cookie and storage records')
            break
    except (OSError,sqlite3.Error):
        pass
    time.sleep(1)
else:
    raise SystemExit('Profile durability preflight failed: containers/cookies/storage not committed to /esr-profile')
PY
docker restart --time 30 "$browser"
docker exec -i "$driver" node - --after-restart < scripts/esr-smoke.js
echo 'PASS: Kasm ESR restart, bridge reconnect and isolated fixture persistence'
