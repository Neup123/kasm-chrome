#!/usr/bin/env python3
"""Server-side API client. Reads a key file; never accepts keys in CLI arguments."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the API key to a redirect target.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['status', 'command', 'spec'])
    args = parser.parse_args()
    try:
        base = os.environ['DRIVER_API_URL'].rstrip('/')
        url = urlsplit(base)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ValueError('DRIVER_API_URL must be an HTTPS API base URL.')
        if url.path != '/agent-driver/v1':
            raise ValueError('DRIVER_API_URL must end with /agent-driver/v1.')
        key = Path(os.environ['DRIVER_API_KEY_FILE']).read_text().strip()
        if not key:
            raise ValueError('API key file is empty.')
        if args.operation == 'command':
            body = json.load(sys.stdin)
            if not isinstance(body, dict):
                raise ValueError('Command JSON must be an object.')
            data = json.dumps(body).encode()
            endpoint = '/commands'
        else:
            data = None
            endpoint = '/status' if args.operation == 'status' else '/openapi.json'
        request = urllib.request.Request(base + endpoint, data=data,
            headers={'X-API-Key': key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        opener = urllib.request.build_opener(NoRedirect)
        try:
            response = opener.open(request, timeout=70)
        except urllib.error.HTTPError as error:
            if error.code in (301,302,303,307,308):
                print('API request refused: unexpected redirect; key was not forwarded.', file=sys.stderr)
                return 1
            response = error
        result = json.load(response)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if response.status == 200 and result.get('ok', True) else 1
    except (KeyError, OSError, ValueError, urllib.error.URLError):
        print('API request failed. Check the configured HTTPS URL, mounted key file, request JSON and connection. No secret or raw network error was printed.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
