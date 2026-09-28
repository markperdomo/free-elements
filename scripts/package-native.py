#!/usr/bin/env python3
"""Add our ribbon to a PPAM compiled by PowerPoint; never fabricate vbaProject.bin."""
import argparse, pathlib, zipfile, xml.etree.ElementTree as ET, shutil, json, hashlib
from native_config import ROOT, VERSION, BUNDLE
p=argparse.ArgumentParser()
p.add_argument('--input',type=pathlib.Path,default=ROOT/'dist/native/FreeElements-base.ppam')
p.add_argument('--output',type=pathlib.Path,default=ROOT/'dist/native/FreeElements.ppam')
p.add_argument('--build-dir',type=pathlib.Path,help='Directory containing the matching native bundle and native-build.json')
a=p.parse_args()
if not a.input.exists(): p.error('Compile the VBA in PowerPoint and export FreeElements-base.ppam first.')
R='http://schemas.openxmlformats.org/package/2006/relationships'
C='http://schemas.openxmlformats.org/package/2006/content-types'
with zipfile.ZipFile(a.input) as z:
    files={n:z.read(n) for n in z.namelist()}
if 'ppt/vbaProject.bin' not in files: p.error('Input has no compiled VBA project; refusing to create a hollow add-in.')
build_dir=a.build_dir or a.output.parent
build_info=build_dir/'native-build.json'
metadata=json.loads(build_info.read_text()) if build_info.exists() else {}
if metadata:
    if metadata.get('version') != VERSION: p.error('Native build version differs from package.json; rebuild first.')
    if metadata['libraryPath'].encode() not in files['ppt/vbaProject.bin']:
        p.error('Compiled VBA library path does not match this native build. Import the generated VBA and export a new PPAM in PowerPoint.')
    for name,digest in metadata['sourceSHA256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=digest:
            p.error('Native sources changed after building; rebuild and export the PPAM again.')
if not (build_dir/BUNDLE).is_dir(): p.error('Matching native bundle is missing; build-native.py first.')
ct=ET.fromstring(files['[Content_Types].xml'])
main=next((n for n in ct if n.get('PartName')=='/ppt/presentation.xml'),None)
if main is None or main.get('ContentType')!='application/vnd.ms-powerpoint.addin.macroEnabled.main+xml':
    p.error('Input must be a real PowerPoint Open XML Add-in, saved by PowerPoint.')
rels=ET.fromstring(files['_rels/.rels'])
for n in list(rels):
    if n.get('Type','').endswith('/ui/extensibility'): rels.remove(n)
ET.SubElement(rels,f'{{{R}}}Relationship',{'Id':'rIdFreeElementsRibbon','Type':'http://schemas.microsoft.com/office/2007/relationships/ui/extensibility','Target':'customUI/customUI14.xml'})
if not any(n.get('PartName')=='/customUI/customUI14.xml' for n in ct):
    ET.SubElement(ct,f'{{{C}}}Override',{'PartName':'/customUI/customUI14.xml','ContentType':'application/xml'})
# Embed our own image: the Mac ribbon does not render every Windows imageMso ID.
icon_part='/customUI/images/free-elements.png'
if not any(n.get('PartName')==icon_part for n in ct):
    ET.SubElement(ct,f'{{{C}}}Override',{'PartName':icon_part,'ContentType':'image/png'})
image_rels=ET.Element(f'{{{R}}}Relationships')
ET.SubElement(image_rels,f'{{{R}}}Relationship',{'Id':'rIdFreeElementsIcon','Type':'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image','Target':'images/free-elements.png'})
files['_rels/.rels']=ET.tostring(rels,encoding='utf-8',xml_declaration=True)
files['[Content_Types].xml']=ET.tostring(ct,encoding='utf-8',xml_declaration=True)
files['customUI/customUI14.xml']=(ROOT/'native/ribbon.xml').read_bytes()
files['customUI/_rels/customUI14.xml.rels']=ET.tostring(image_rels,encoding='utf-8',xml_declaration=True)
files[icon_part.lstrip('/')]=(ROOT/'public/assets/icon-80.png').read_bytes()
a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'w',zipfile.ZIP_DEFLATED) as z:
    for n,data in files.items(): z.writestr(n,data)
with zipfile.ZipFile(a.output) as z:
    assert z.testzip() is None
    assert z.read('ppt/vbaProject.bin')==files['ppt/vbaProject.bin']
payload=a.output.parent/'release'/'Free Elements'
payload.mkdir(parents=True,exist_ok=True)
shutil.copy2(a.output,payload/'FreeElements.ppam')
if (payload/BUNDLE).exists(): shutil.rmtree(payload/BUNDLE)
shutil.copytree(build_dir/BUNDLE,payload/BUNDLE)
metadata.update({'version':VERSION,'platform':'macOS','developmentSignature':metadata.get('developmentSignature',True),'ppamSHA256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'vbaSHA256':hashlib.sha256(files['ppt/vbaProject.bin']).hexdigest()})
metadata['files']={str(f.relative_to(payload)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(payload.rglob('*')) if f.is_file() and f.name!='build.json'}
(payload/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(f'Packaged {a.output}\nInstall payload: {payload}')
