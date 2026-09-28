#!/usr/bin/env python3
"""Build a macOS installer from a validated, portable PowerPoint export."""
import argparse
import hashlib
import json
import pathlib
import plistlib
import shutil
import subprocess
import tempfile
from native_config import ROOT, VERSION, BUNDLE, SHARED_ROOT, library_path


def validate_payload(source):
    metadata = json.loads((source/'build.json').read_text())
    if metadata.get('version') != VERSION or not metadata.get('distribution'):
        raise ValueError('A matching distribution build is required; do not publish a per-user PPAM.')
    if metadata.get('libraryPath') != library_path(SHARED_ROOT):
        raise ValueError('VBA must use the portable shared installation path.')
    if set(metadata.get('architectures', [])) != {'arm64', 'x86_64'}:
        raise ValueError('Public installers must include Apple Silicon and Intel.')
    expected = metadata.get('files', {})
    actual = {str(f.relative_to(source)) for f in source.rglob('*') if f.is_file() and f.name != 'build.json'}
    if not expected or actual != set(expected):
        raise ValueError('Payload files differ from the build manifest; package again.')
    for name, digest in expected.items():
        path = pathlib.PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or (source/name).is_symlink():
            raise ValueError('Unsafe payload path.')
        if hashlib.sha256((source/name).read_bytes()).hexdigest() != digest:
            raise ValueError(f'Payload checksum mismatch: {name}')
    if any(f.is_symlink() for f in source.rglob('*')):
        raise ValueError('Payload must not contain symlinks.')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload', type=pathlib.Path, default=ROOT/'dist/distribution/release/Free Elements')
    parser.add_argument('--output-dir', type=pathlib.Path, default=ROOT/'dist/github')
    parser.add_argument('--sign-identity', help='Optional Developer ID Installer identity')
    args = parser.parse_args()
    source = args.payload.resolve()
    try:
        validate_payload(source)
    except (ValueError, OSError, KeyError) as error:
        parser.error(str(error))
    binary = source/BUNDLE/'Contents/MacOS/FreeElements'
    architectures = subprocess.check_output(['lipo', '-archs', str(binary)], text=True).split()
    if set(architectures) != {'arm64', 'x86_64'}:
        parser.error('Native binary must contain exactly arm64 and x86_64 slices.')
    subprocess.run(['codesign', '--verify', '--strict', str(source/BUNDLE)], check=True)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir.resolve()/f'FreeElements-{VERSION}-macOS.pkg'
    if output.exists(): parser.error(f'Refusing to replace {output}; move it aside first.')
    with tempfile.TemporaryDirectory(prefix='free-elements-installer-') as folder:
        stage = pathlib.Path(folder)
        payload = stage/'payload'
        payload.mkdir()
        for name in ['FreeElements.ppam', BUNDLE, 'build.json']:
            item = source/name
            if item.is_dir(): shutil.copytree(item, payload/name)
            else: shutil.copy2(item, payload/name)
        shutil.copy2(ROOT/'LICENSE', payload/'LICENSE.txt')
        shutil.copy2(ROOT/'docs/MAC_INSTALL.md', payload/'INSTALL.md')
        scripts = stage/'scripts'
        scripts.mkdir()
        shutil.copy2(ROOT/'native/installer/preinstall', scripts/'preinstall')
        (scripts/'preinstall').chmod(0o755)
        components = stage/'components.plist'
        subprocess.run(['pkgbuild', '--analyze', '--root', str(payload), str(components)], check=True)
        entries = plistlib.loads(components.read_bytes())
        for entry in entries:
            # VBA resolves one fixed path. Installer must not relocate the bundle
            # to an earlier developer build with the same bundle identifier.
            entry['BundleIsRelocatable'] = False
            entry['BundleIsVersionChecked'] = True
        components.write_bytes(plistlib.dumps(entries))
        command = ['pkgbuild', '--root', str(payload), '--identifier', 'org.freeelements.native',
                   '--version', VERSION, '--install-location', str(SHARED_ROOT),
                   '--ownership', 'recommended', '--scripts', str(scripts),
                   '--component-plist', str(components)]
        if args.sign_identity: command += ['--sign', args.sign_identity, '--timestamp']
        subprocess.run([*command, str(output)], check=True)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (output.with_suffix('.pkg.sha256')).write_text(f'{digest}  {output.name}\n')
    print(f'Installer: {output}\nSHA-256: {digest}')
    if not args.sign_identity:
        print('Unsigned prerelease. Do not describe this installer as Developer ID signed or notarized.')


if __name__ == '__main__':
    main()
