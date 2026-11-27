#!/usr/bin/env bash
set -euo pipefail
# Only run on a disposable CI Docker host, never the production host.
: "${CI:?This smoke test is for disposable CI runners only}"
version=$(python3 -c 'import json; print(json.load(open("extension/manifest.json"))["version"])')
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
if [ "${SIGNED_RELEASE_SMOKE:-0}" = 1 ]; then
  # The actual production image recipe, built only on this disposable CI runner.
  # No deployment, registry push, shared host or existing profile.
  docker build -f firefox/Dockerfile -t "$prefix-firefox" .
else
  docker build -f firefox/Dockerfile.esr -t "$prefix-firefox" .
fi
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
if [ "${SIGNED_RELEASE_SMOKE:-0}" = 1 ]; then
  docker run --rm --network none --user root --entrypoint /bin/sh \
    --mount "type=volume,src=$volume,dst=/esr-profile" "$prefix-firefox" \
    -c 'chown 1000:1000 /esr-profile && chmod 0700 /esr-profile'
fi
docker run -d --name "$driver" --network "$network" --network-alias driver \
  --mount "type=bind,src=$tmp/key,dst=/run/secrets/driver_api_key,readonly" \
  --mount "type=bind,src=$tmp/managed,dst=/run/secrets/driver_managed_storage,readonly" \
  "$prefix-driver"
docker run -d --name "$browser" --network "$network" --shm-size=512m \
  --env-file "$tmp/browser.env" --env "APP_ARGS=-profile /esr-profile" --mount "type=volume,src=$volume,dst=/esr-profile" \
  --mount "type=bind,src=$tmp/managed,dst=/usr/lib/mozilla/managed-storage/kasm-agent@chabad.gr.json,readonly" \
  "$prefix-firefox"
if [ "${SIGNED_RELEASE_SMOKE:-0}" = 1 ]; then
  browser_version=$(docker exec "$browser" firefox --version)
  printf '%s\n' "$browser_version"
  if printf '%s\n' "$browser_version" | grep -qi esr; then echo 'Expected Firefox Release, not ESR'; exit 1; fi
  docker exec "$browser" python3 -c 'import json; p=json.load(open("/etc/firefox/policies/policies.json"))["policies"]; assert "xpinstall.signatures.required" not in p.get("Preferences",{}); assert p["ExtensionSettings"]["kasm-agent@chabad.gr"]["installation_mode"]=="force_installed"'
  docker exec -i "$driver" node - "$version" --signed-release < scripts/esr-smoke.js
  docker exec -i "$browser" python3 - "$version" <<'PY'
import json, pathlib, sys, time
path = pathlib.Path('/esr-profile/extensions.json')
for _ in range(45):
    try:
        items=json.loads(path.read_text())['addons']
        addon=next(a for a in items if a['id']=='kasm-agent@chabad.gr')
        if addon.get('version') == sys.argv[1] and addon.get('active') is True and addon.get('signedState',-999) >= 2 and not addon.get('appDisabled') and not addon.get('userDisabled'):
            print('PASS: Firefox Release reports active signed extension',json.dumps({k:addon.get(k) for k in ('id','version','active','signedState','appDisabled','userDisabled')}))
            break
    except (OSError,ValueError,KeyError,StopIteration):
        pass
    time.sleep(1)
else:
    raise SystemExit('Firefox Release did not report active trusted signed extension')
PY
  echo 'PASS: stock Firefox Release signed policy installation and live bridge'
  # Keep the existing signature smoke bounded unless the CI-only restart job opts in.
  if [ "${SIGNED_RELEASE_RESTART_SMOKE:-0}" != 1 ]; then exit 0; fi
  mode=(--signed-release)
else
  docker exec "$browser" firefox-esr --version
  docker exec -i "$driver" node - "$version" < scripts/esr-smoke.js
  mode=()
fi
# Check the fresh CI volume identity, not any existing profile or mount.
profile_mount() {
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/esr-profile"}}{{.Name}}{{end}}{{end}}' "$browser"
}
test "$(profile_mount)" = "$volume"
driver_started=$(docker inspect --format '{{.State.StartedAt}}' "$driver")
docker restart "$driver"
test "$(docker inspect --format '{{.State.StartedAt}}' "$driver")" != "$driver_started"
docker exec -i "$driver" node - "$version" "${mode[@]}" --after-restart < scripts/esr-smoke.js
echo 'PASS: disposable driver restart, reconnection and fixture readback'
# Profile layout differs across Firefox versions. Verify the actual running
# process uses the intended mounted path, and print only synthetic-test
# diagnostics. The independent API readback after container restart remains
# the durability gate, not private SQLite schema/layout assumptions.
docker exec -i "$browser" python3 - <<'PY'
import pathlib, os, time
root=pathlib.Path('/esr-profile')
assert os.path.ismount(root), 'CI profile is not a mount'
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
browser_started=$(docker inspect --format '{{.State.StartedAt}}' "$browser")
docker restart --time 30 "$browser"
test "$(docker inspect --format '{{.State.StartedAt}}' "$browser")" != "$browser_started"
test "$(profile_mount)" = "$volume"
docker exec -i "$driver" node - "$version" "${mode[@]}" --after-restart < scripts/esr-smoke.js
if [ "${SIGNED_RELEASE_SMOKE:-0}" = 1 ]; then
  docker exec -i "$browser" python3 - "$version" <<'PY'
import json, pathlib, sys, time
path = pathlib.Path('/esr-profile/extensions.json')
for _ in range(45):
    try:
        addon=next(a for a in json.loads(path.read_text())['addons'] if a['id']=='kasm-agent@chabad.gr')
        if addon.get('version') == sys.argv[1] and addon.get('active') is True and addon.get('signedState',-999) >= 2 and not addon.get('appDisabled') and not addon.get('userDisabled'):
            print('PASS: same active signed version after Firefox restart',json.dumps({k:addon.get(k) for k in ('id','version','active','signedState','appDisabled','userDisabled')}))
            break
    except (OSError,ValueError,KeyError,StopIteration):
        pass
    time.sleep(1)
else:
    raise SystemExit('Firefox Release did not report active trusted signed extension after restart')
PY
  echo 'PASS: signed Firefox Release restart, same isolated CI profile and fixture persistence'
else
  echo 'PASS: Kasm ESR restart, bridge reconnect and isolated fixture persistence'
fi
