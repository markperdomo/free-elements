#!/usr/bin/env python3
"""Stage/install only Free Elements files. Add-in registration uses PowerPoint's UI."""
import argparse, pathlib, shutil, hashlib, sys, json
from native_config import ROOT, BUNDLE
p=argparse.ArgumentParser()
p.add_argument('--install',action='store_true',help='Copy to the current user Office group container')
a=p.parse_args()
source=ROOT/'dist/native/release/Free Elements'
target=pathlib.Path.home()/'Library/Group Containers/UBF8T346G9.Office/Free Elements/Program'
required=['FreeElements.ppam',BUNDLE,'build.json']
for name in required:
    if not (source/name).exists(): p.error('Run the native build, export the PPAM in PowerPoint, then package-native.py first.')
metadata=json.loads((source/'build.json').read_text())
if metadata.get('distribution'): p.error('Use the distribution .pkg installer for this shared-location build.')
if hashlib.sha256((source/'FreeElements.ppam').read_bytes()).hexdigest()!=metadata['ppamSHA256']:
    p.error('The staged PPAM does not match its build manifest.')
print(f'Source: {source}\nDestination: {target}')
print('In PowerPoint: Tools > PowerPoint Add-ins > + > FreeElements.ppam. Check its Loaded box.')
if not a.install:
    print('Preview only. Use --install, or copy the staged files with Finder.')
    sys.exit(0)
try:
    target.mkdir(parents=True,exist_ok=True)
    for name in required:
        origin=source/name
        dest=target/name
        if dest.exists():
            if origin.is_file() and origin.read_bytes()==dest.read_bytes(): continue
            if origin.is_dir():
                old={str(f.relative_to(dest)):hashlib.sha256(f.read_bytes()).hexdigest() for f in dest.rglob('*') if f.is_file()}
                new={str(f.relative_to(origin)):hashlib.sha256(f.read_bytes()).hexdigest() for f in origin.rglob('*') if f.is_file()}
                if old==new: continue
            p.error(f'{dest} differs. Unload Free Elements, quit PowerPoint, and move the old version aside before updating.')
        if origin.is_dir(): shutil.copytree(origin,dest)
        else: shutil.copy2(origin,dest)
except PermissionError:
    print('macOS denied terminal access to the Office container. Use Finder to copy only the listed Free Elements files; no security-setting changes are needed.',file=sys.stderr)
    sys.exit(2)
print('Files installed. Load the PPAM through PowerPoint Add-ins to finish.')
