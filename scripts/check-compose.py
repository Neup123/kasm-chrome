#!/usr/bin/env python3
"""Check the deployment's named controls without printing resolved configuration.

Requires PyYAML. This checks the source Compose/policy/image contract, and can
check operator-supplied runtime parameter shapes. It cannot validate Docker's
implementation, live proxy state, actual volume identity, signing trust, Firefox
installation, or ChatGPT interaction. Those are separate acceptance gates.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys

import yaml


ROOT = Path(__file__).resolve().parents[1]
EXTENSION_ID = "kasm-agent@chabad.gr"
RUNTIME_NAMES = (
    "DRIVER_IMAGE_TAG", "KASM_PROFILE_VOLUME", "KASM_DOCKER_NETWORK",
    "DRIVER_PUBLIC_HOST", "TRAEFIK_HTTPS_ENTRYPOINT", "TRAEFIK_CERTRESOLVER",
    "BROWSER_AUTH_MIDDLEWARES", "BROWSER_SERVERSTRANSPORT",
)


class CheckError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise CheckError(message)


def labels(service: dict) -> dict[str, str]:
    entries = service.get("labels", {})
    if isinstance(entries, dict):
        return {str(k): str(v) for k, v in entries.items()}
    result = {}
    for item in entries:
        key, sep, value = item.partition("=")
        require(bool(sep), "Every label must have a key and value")
        require(key not in result, "Duplicate label key")
        result[key] = value
    return result


def validate(root: Path) -> None:
    compose = yaml.safe_load((root / "docker-compose.yml").read_text())
    require(set(compose["services"]) == {"firefox", "driver"}, "Expected exactly firefox and driver services")
    firefox = compose["services"]["firefox"]
    driver = compose["services"]["driver"]
    require(firefox.get("ports") == ["6901:6901"], "Firefox must preserve published port 6901 only")
    require(firefox.get("volumes") == ["kasm-profile:/home/kasm-user"], "Firefox must preserve the home volume mount")
    require(firefox.get("shm_size") == "512mb", "Firefox shared memory must stay 512mb")
    require(not driver.get("ports"), "Driver must not publish any port")
    require(driver.get("expose") == ["8080"], "Driver internal port must be 8080")
    require(not driver.get("read_only"), "Environment-backed Compose secrets require a writable container filesystem")
    require(driver.get("user") == "1000:1000", "Driver must run as the secret-file owner UID 1000")
    require(driver.get("cap_drop") == ["ALL"], "Driver must drop all Linux capabilities")
    require("no-new-privileges:true" in driver.get("security_opt", []), "Driver must prevent privilege escalation")
    for service in (firefox, driver):
        require("entrypoint" not in service and "command" not in service, "Do not replace image startup")
        require(service.get("restart") == "unless-stopped", "Both services must reconnect after app restart")
        require(not service.get("privileged"), "Privileged containers are forbidden")
        require("kasm-existing" in service.get("networks", {}), "Both services must share the existing network")

    volume = compose["volumes"]["kasm-profile"]
    require(volume.get("external") is True, "Existing profile volume must be external to prevent recreation/deletion")
    require(volume.get("name", "").startswith("${KASM_PROFILE_VOLUME:?"), "Exact existing profile volume is required")
    network = compose["networks"]["kasm-existing"]
    require(network.get("external") is True, "Existing Docker network must remain external")
    require(network.get("name", "").startswith("${KASM_DOCKER_NETWORK:?"), "Exact existing network is required")

    secrets = compose.get("secrets", {})
    require(secrets == {
        "driver_managed_storage": {"environment": "DRIVER_MANAGED_STORAGE"},
        "driver_api_key": {"environment": "DRIVER_API_KEY"},
    }, "Secrets must originate from the native environment-backed secret mechanism")
    require(len(firefox.get("secrets", [])) == 1, "Firefox must receive only the managed WS secret")
    managed = firefox["secrets"][0]
    require(managed.get("source") == "driver_managed_storage", "Wrong Firefox managed-storage source")
    require(managed.get("target") == f"/usr/lib/mozilla/managed-storage/{EXTENSION_ID}.json", "Wrong Firefox native managed-storage path")
    for service in (firefox, driver):
        for secret in service.get("secrets", []):
            require(secret.get("uid") == "1000" and secret.get("gid") == "1000" and secret.get("mode") == 0o400,
                    "Secret files must be readable only by UID 1000")
    require({entry["source"] for entry in driver.get("secrets", [])} == set(secrets), "Driver must receive both declared secrets")
    require(driver["environment"].get("DRIVER_MANAGED_STORAGE_FILE") == "/run/secrets/driver_managed_storage", "Driver managed-storage filename mismatch")
    require(driver["environment"].get("DRIVER_API_KEY_FILE") == "/run/secrets/driver_api_key", "Driver API key filename mismatch")

    flabels, dlabels = labels(firefox), labels(driver)
    for label in (*flabels.values(), *dlabels.values()):
        require("gzip" not in label.lower(), "Gzip middleware must remain disabled")
    require(flabels.get("traefik.http.routers.kasm-agent-browser.middlewares", "").startswith("${BROWSER_AUTH_MIDDLEWARES:?"), "Browser middleware chain must be supplied from live settings")
    require(flabels.get("traefik.http.services.kasm-agent-browser.loadbalancer.server.port") == "6901", "Browser proxy target changed")
    require(flabels.get("traefik.http.services.kasm-agent-browser.loadbalancer.server.scheme") == "https", "Kasm backend requires HTTPS")
    require(flabels.get("traefik.http.services.kasm-agent-browser.loadbalancer.serverstransport", "").startswith("${BROWSER_SERVERSTRANSPORT:?"), "Preserve the existing Kasm TLS transport")
    rule = dlabels.get("traefik.http.routers.kasm-agent-api.rule", "")
    require(rule == "Host(`${DRIVER_PUBLIC_HOST:?existing browser hostname required}`) && (Path(`/agent-driver/v1`) || PathPrefix(`/agent-driver/v1/`))", "Only the exact API prefix may be routed publicly")
    require(int(dlabels["traefik.http.routers.kasm-agent-api.priority"]) > int(flabels["traefik.http.routers.kasm-agent-browser.priority"]), "API route must be more specific than browser root")
    require(dlabels.get("traefik.http.routers.kasm-agent-api.tls") == "true", "API must use HTTPS")
    require(dlabels.get("traefik.http.services.kasm-agent-api.loadbalancer.server.port") == "8080", "Driver proxy target changed")
    require(not any("middlewares" in key for key in dlabels), "Do not inject browser login/header middleware into the API route")

    policy = json.loads((root / "firefox/policies.json").read_text())["policies"]
    extension = policy["ExtensionSettings"][EXTENSION_ID]
    require(extension == {"installation_mode": "force_installed", "install_url": "file:///opt/kasm-driver/companion.xpi"}, "Policy must force-install the local signed artifact")
    require("3rdparty" not in policy, "Do not bake runtime secrets into policies.json")
    dockerfile = (root / "firefox/Dockerfile").read_text()
    require("FROM kasmweb/firefox:1.18.0-rolling-weekly" in dockerfile, "Kasm base image version changed")
    directives = [line.split(None, 1)[0].upper() for line in dockerfile.splitlines() if line.strip() and not line.startswith("#")]
    require("ENTRYPOINT" not in directives and "CMD" not in directives, "Firefox image must inherit Kasm startup unchanged")
    require("--require-signature" in dockerfile, "Image build must check the signed artifact")
    require("/etc/firefox/policies/policies.json" in dockerfile, "Firefox policy install path missing")


def validate_runtime() -> None:
    for name in RUNTIME_NAMES:
        require(bool(os.environ.get(name)), f"Required nonsecret deployment parameter is unset: {name}")
    host = os.environ["DRIVER_PUBLIC_HOST"]
    require(bool(re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?", host)), "DRIVER_PUBLIC_HOST must contain only a hostname, not a URL, port, path or rule")
    require(bool(re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}", os.environ["DRIVER_IMAGE_TAG"])), "Invalid immutable image tag shape")
    for name in ("KASM_PROFILE_VOLUME", "KASM_DOCKER_NETWORK", "TRAEFIK_HTTPS_ENTRYPOINT", "TRAEFIK_CERTRESOLVER"):
        require(bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", os.environ[name])), f"Invalid parameter shape: {name}")
    for name in ("BROWSER_AUTH_MIDDLEWARES", "BROWSER_SERVERSTRANSPORT"):
        require(bool(re.fullmatch(r"[A-Za-z0-9_@.,-]+", os.environ[name])), f"Invalid parameter shape: {name}")
        require("gzip" not in os.environ[name].lower(), "Gzip middleware is forbidden")
    require(len(os.environ["BROWSER_AUTH_MIDDLEWARES"].split(",")) >= 2, "Preserve both the Authelia and Kasm header-injection middlewares")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--runtime", action="store_true", help="Check required nonsecret deployment environment parameters; never prints values")
    args = parser.parse_args()
    try:
        validate(args.root)
        if args.runtime:
            validate_runtime()
    except (CheckError, OSError, KeyError, ValueError, TypeError, yaml.YAMLError) as error:
        # All messages here describe structure or parameter names, never values.
        if isinstance(error, CheckError):
            print(f"FAIL: {error}", file=sys.stderr)
        else:
            print(f"FAIL: Could not validate deployment source ({type(error).__name__})", file=sys.stderr)
        return 1
    print("PASS: deployment source controls" + (" and runtime parameter shapes" if args.runtime else ""))
    print("NOT COVERED: Docker execution, live proxy/volume identity, signature trust, Firefox first boot, ChatGPT or rollback")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
