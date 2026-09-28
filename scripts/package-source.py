#!/usr/bin/env python3
"""Archive only tracked project files; refuse local research and build outputs."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import zipfile
from native_config import ROOT, VERSION

ALLOWED_DIRS = {'.github', 'docs', 'native', 'public', 'scripts', 'src', 'tests'}
ALLOWED_FILES = {'README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md',
                 'package.json', '.gitignore', '.gitattributes', '.editorconfig'}


def tracked_files():
    manifest = ROOT/'scripts/public-files.json'
    if not manifest.is_file(): raise ValueError('Missing reviewed public-file manifest.')
    approved = json.loads(manifest.read_text())
    if not isinstance(approved, list) or not all(isinstance(name, str) for name in approved):
        raise ValueError('Public-file manifest must be a list of paths.')
    if len(approved) != len(set(approved)):
        raise ValueError('Duplicate path in public-file manifest.')
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    paths = [pathlib.PurePosixPath(name) for name in names if name]
    if not paths: raise ValueError('Stage the reviewed public source files in Git first.')
    indexed = {str(path) for path in paths}
    if indexed != set(approved):
        unexpected = sorted(indexed - set(approved))
        missing = sorted(set(approved) - indexed)
        raise ValueError(f'Public file list differs from the reviewed manifest. '
                         f'Unapproved: {unexpected}; missing: {missing}. '
                         'Package only from the reviewed public checkout.')
    for path in paths:
        if (path.parts[0] not in ALLOWED_DIRS and str(path) not in ALLOWED_FILES
                or '__pycache__' in path.parts or path.suffix in {'.pyc', '.pkg', '.ppam', '.pptm', '.key', '.pem', '.p12', '.pfx'}
                or path.is_absolute() or '..' in path.parts or (ROOT/path).is_symlink()):
            raise ValueError(f'Non-public file in Git index: {path}')
        if not (ROOT/path).is_file(): raise ValueError(f'Missing tracked file: {path}')
    return sorted(paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Only audit the Git file list')
    parser.add_argument('--output-dir', type=pathlib.Path, default=ROOT/'dist/github')
    args = parser.parse_args()
    try: files = tracked_files()
    except (ValueError, OSError, subprocess.CalledProcessError) as error: parser.error(str(error))
    if args.check:
        print(f'Public source audit passed: {len(files)} files.')
        return
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir/f'FreeElements-{VERSION}-source.zip'
    if output.exists(): parser.error(f'Refusing to replace {output}; move it aside first.')
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(ROOT/path, f'free-elements-{VERSION}/{path}')
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'Source archive: {output}\nSHA-256: {digest}')


if __name__ == '__main__': main()
