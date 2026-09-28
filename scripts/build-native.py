#!/usr/bin/env python3
"""Compile our universal AppKit library and generate path-specific VBA import sources."""
import argparse, pathlib, plistlib, subprocess, json, hashlib
from native_config import ROOT, VERSION, BUNDLE, USER_ROOT, SHARED_ROOT, library_path
p = argparse.ArgumentParser()
p.add_argument('--arch', choices=['universal','arm64','x86_64'], default='universal')
p.add_argument('--install-root', type=pathlib.Path, default=USER_ROOT)
p.add_argument('--distribution', action='store_true', help='Generate VBA for the shared, machine-independent installer location')
p.add_argument('--output-dir', type=pathlib.Path, default=ROOT/'dist/native')
p.add_argument('--sign-identity', default='-', help='Developer ID Application identity, or - for local ad-hoc signing')
a = p.parse_args()
if a.distribution: a.install_root = SHARED_ROOT
out = a.output_dir.resolve()
bundle = out/BUNDLE
exe = bundle/'Contents/MacOS/FreeElements'
exe.parent.mkdir(parents=True, exist_ok=True)
(out/'vba').mkdir(exist_ok=True)
# Old builds generated an export macro unsupported by Mac PowerPoint's VBA enum.
# Export PPAM using File > Export; keep development helpers out of the add-in.
(out/'vba/FEBuilder.bas').unlink(missing_ok=True)
archs = ['arm64','x86_64'] if a.arch == 'universal' else [a.arch]
for arch in archs:
    subprocess.run(['xcrun','swiftc','-emit-library','-O','-target',f'{arch}-apple-macos12.0','-module-name','FreeElementsNative','-module-cache-path',str(out/'module-cache'),'-Xlinker','-install_name','-Xlinker',f'@rpath/{BUNDLE}/Contents/MacOS/FreeElements',str(ROOT/'native/macos/FreeElements.swift'),'-o',str(out/f'FreeElements-{arch}')],check=True)
subprocess.run(['lipo','-create',*[str(out/f'FreeElements-{arch}') for arch in archs],'-output',str(exe)],check=True)
(bundle/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':'org.freeelements.native','CFBundleName':'Free Elements','CFBundleExecutable':'FreeElements','CFBundlePackageType':'BNDL','CFBundleVersion':VERSION,'CFBundleShortVersionString':VERSION,'LSMinimumSystemVersion':'12.0'}))
sign = ['codesign','--force','--sign',a.sign_identity]
if a.sign_identity != '-': sign += ['--timestamp', '--options', 'runtime']
subprocess.run([*sign,str(bundle)],check=True)
subprocess.run(['codesign','--verify','--strict',str(bundle)],check=True)
for source in [*(ROOT/'native/vba').glob('*'), *(ROOT/'native/tests').glob('*.bas')]:
    if source.name.startswith('FEProbe'): continue
    text = source.read_text().replace('__NATIVE_LIBRARY__', library_path(a.install_root)).replace('__BUILD_DIR__',str(out))
    (out/'vba'/source.name).write_bytes(text.replace('\n','\r\n').encode('utf-8'))
    if source.name == 'FENativeTests.bas':
        installed = text.replace('FENativeTests', 'FEInstalledTests').replace('FERunNativeTests', 'FERunInstalledTests')
        installed = installed.replace('    FreeElementsShow\n', '    Application.Run "FreeElements.ppam!FreeElements.FreeElementsShow"\n')
        installed = installed.replace('FECommand(', 'Application.Run("FreeElements.ppam!FreeElements.FECommand", ')
        (out/'vba/FEInstalledTests.bas').write_bytes(installed.replace('\n','\r\n').encode('utf-8'))
metadata = {'version': VERSION, 'bundle': BUNDLE, 'installRoot': str(a.install_root), 'libraryPath': library_path(a.install_root), 'architectures': archs, 'distribution': a.distribution, 'developmentSignature': a.sign_identity == '-', 'sourceSHA256': {str(f.relative_to(ROOT)): hashlib.sha256(f.read_bytes()).hexdigest() for f in [ROOT/'native/macos/FreeElements.swift', *sorted((ROOT/'native/vba').glob('*'))]}}
(out/'native-build.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(f'Native component: {bundle}\nImport sources: {out / "vba"}\nInstall location: {a.install_root}')
