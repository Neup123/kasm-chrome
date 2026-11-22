#!/usr/bin/env python3
"""Check archive/source identity and signature structure, not Mozilla trust.

Firefox Release policy installation is the final cryptographic acceptance gate.
No secrets or runtime configuration belong in either source or XPI.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile


def verify(path, source, require_signature=False, metadata=None):
    expected = {
        p.relative_to(source).as_posix(): p.read_bytes()
        for p in source.rglob('*') if p.is_file()
        and not any(part.startswith('.') for part in p.relative_to(source).parts)
    }
    if 'manifest.json' not in expected:
        raise ValueError('Extension source manifest is missing.')
    if path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError('XPI exceeds the package size limit.')
    with zipfile.ZipFile(path) as archive:
        names = [i.filename for i in archive.infolist() if not i.is_dir()]
        if len(set(names)) != len(names):
            raise ValueError('Duplicate ZIP entries are forbidden.')
        if any(PurePosixPath(n).is_absolute() or '..' in PurePosixPath(n).parts or '\\' in n for n in names):
            raise ValueError('Unsafe ZIP entry path.')
        if sum(i.file_size for i in archive.infolist()) > 10 * 1024 * 1024:
            raise ValueError('Expanded XPI exceeds the package size limit.')
        signature_names = {n for n in names if n.startswith('META-INF/')}
        payload_names = set(names) - signature_names
        if payload_names != set(expected):
            raise ValueError('XPI files differ from the source file set.')
        for name, content in expected.items():
            # AMO normalizes manifest JSON whitespace while signing.
            # Every executable asset remains byte-for-byte source-identical.
            if name == 'manifest.json':
                if json.loads(archive.read(name)) != json.loads(content):
                    raise ValueError('Signed manifest semantics differ from the reviewed source.')
            elif archive.read(name) != content:
                raise ValueError('XPI payload differs from the reviewed source.')
        manifest = json.loads(archive.read('manifest.json'))
        settings = manifest.get('browser_specific_settings', {}).get('gecko', {})
        if manifest.get('manifest_version') != 2 or settings.get('id') != 'kasm-agent@chabad.gr':
            raise ValueError('Incorrect extension identity or manifest version.')
        if manifest.get('background', {}).get('persistent') is not True:
            raise ValueError('A persistent background page is required.')
        hosts = {p for p in manifest.get('permissions', []) if '://' in p or p == '<all_urls>'}
        if hosts != {'https://chatgpt.com/*', 'http://driver/*'}:
            raise ValueError('Host permissions exceed or differ from the required origins.')
        classic = {'META-INF/manifest.mf', 'META-INF/mozilla.sf', 'META-INF/mozilla.rsa'}
        cose = {'META-INF/cose.manifest', 'META-INF/cose.sig'}
        signature_present = classic <= signature_names or cose <= signature_names
        if require_signature and not signature_present:
            raise ValueError('AMO signature entries are missing; unsigned image builds are blocked.')
        if any(archive.getinfo(n).file_size == 0 for n in signature_names):
            raise ValueError('Empty signature metadata is invalid.')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    result = {'extension_id': settings['id'], 'version': manifest['version'],
              'sha256': digest, 'signature_entries_present': signature_present,
              'source_files_match': True,
              'cryptographic_trust_verified': False}
    if metadata:
        recorded = json.loads(metadata.read_text())
        for field in ['extension_id', 'version', 'sha256']:
            if recorded.get(field) != result[field]:
                raise ValueError('Signed artifact metadata does not match the XPI.')
        if recorded.get('channel') != 'unlisted':
            raise ValueError('Signed artifact must record the unlisted channel.')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xpi', type=Path)
    parser.add_argument('--source', type=Path, default=Path('extension'))
    parser.add_argument('--require-signature', action='store_true')
    parser.add_argument('--metadata', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.xpi, args.source, args.require_signature, args.metadata), indent=2))
    except (OSError, ValueError, zipfile.BadZipFile, KeyError) as exc:
        print('Artifact verification failed: ' + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
