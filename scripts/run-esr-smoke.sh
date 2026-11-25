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
# Profile layout differs across Firefox versions. Verify the actual running
# process uses the intended mounted path, and print only synthetic-test
# diagnostics. The independent API readback after container restart remains
# the durability gate, not private SQLite schema/layout assumptions.
docker exec -i "$browser" python3 - <<'PY'
import pathlib, os, time
root=pathlib.Path('/esr-profile')
assert os.path.ismount(root), 'ESR profile is not a mount'
# Wait for Firefox background writes; no production data in this profile.
deadline=time.monotonic()+45
while time.monotonic()<deadline:
    if (root/'containers.json').is_file() and (root/'cookies.sqlite').is_file():
        break
    time.sleep(1)
else:
    print('Profile diagnostic: expected files missing from mounted path')
    for base in [root, pathlib.Path('/home/kasm-user/.mozilla/firefox'), pathlib.Path('/home/kasm-user/.config/mozilla/firefox')]:
        if base.exists():
            print(str(base), sorted(str(p.relative_to(base)) for p in base.rglob('containers.json')))
    raise SystemExit('Firefox did not write its profile into the intended volume')
print('PASS: actual Firefox profile files exist in the isolated mounted volume')
print('Profile diagnostic: local storage DB paths:', sorted(str(p.relative_to(root)) for p in root.rglob('data.sqlite')))
time.sleep(15)
PY
docker restart --time 30 "$browser"
docker exec -i "$driver" node - --after-restart < scripts/esr-smoke.js
echo 'PASS: Kasm ESR restart, bridge reconnect and isolated fixture persistence'
