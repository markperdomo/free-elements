"""Make a disposable smoke-test deck that opens the installed development add-in.

Uses the Registry/developer reference and package relationship pattern from
Microsoft's Office-Addin-Scripts PowerPointPresentationWithTaskPane.pptx template.
Only the bundled fixture is read; no user presentation is modified.
"""
from pathlib import Path
import zipfile
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
OFFICE = "http://schemas.microsoft.com/office/appforoffice/1.1"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CONTENT = "http://schemas.openxmlformats.org/package/2006/content-types"
manifest = ET.parse(ROOT / "public/manifest.xml").getroot()
identifier = manifest.find(f"{{{OFFICE}}}Id").text
version = manifest.find(f"{{{OFFICE}}}Version").text
target = ROOT / "dist/powerpoint-smoke-with-addin.pptx"
if target.exists() and "--force" not in sys.argv[1:]:
    raise SystemExit(f"Test deck already exists: {target}\nOpen that file, or pass --force to regenerate it and discard its test edits.")
target.parent.mkdir(exist_ok=True)

with zipfile.ZipFile(ROOT / "tests/fixtures/powerpoint-smoke.pptx") as source:
    parts = {name: source.read(name) for name in source.namelist()}

rels = ET.fromstring(parts["_rels/.rels"])
ET.SubElement(rels, f"{{{REL}}}Relationship", {
    "Type": "http://schemas.microsoft.com/office/2011/relationships/webextensiontaskpanes",
    "Target": "/ppt/webextensions/taskpanes.xml", "Id": "rIdFreeElementsTaskPane",
})
parts["_rels/.rels"] = ET.tostring(rels, encoding="utf-8", xml_declaration=True)
types = ET.fromstring(parts["[Content_Types].xml"])
for name, kind in (("taskpanes", "webextensiontaskpanes"), ("webextension", "webextension")):
    ET.SubElement(types, f"{{{CONTENT}}}Override", {
        "PartName": f"/ppt/webextensions/{name}.xml",
        "ContentType": f"application/vnd.ms-office.{kind}+xml",
    })
parts["[Content_Types].xml"] = ET.tostring(types, encoding="utf-8", xml_declaration=True)
parts["ppt/webextensions/taskpanes.xml"] = b'''<?xml version="1.0" encoding="UTF-8"?>
<wetp:taskpanes xmlns:wetp="http://schemas.microsoft.com/office/webextensions/taskpanes/2010/11"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <wetp:taskpane dockstate="right" visibility="1" width="270" row="1">
  <wetp:webextensionref r:id="rIdFreeElements"/>
 </wetp:taskpane>
</wetp:taskpanes>'''
parts["ppt/webextensions/_rels/taskpanes.xml.rels"] = f'''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="{REL}">
 <Relationship Id="rIdFreeElements" Type="http://schemas.microsoft.com/office/2011/relationships/webextension"
  Target="/ppt/webextensions/webextension.xml"/>
</Relationships>'''.encode()
parts["ppt/webextensions/webextension.xml"] = f'''<?xml version="1.0" encoding="UTF-8"?>
<we:webextension xmlns:we="http://schemas.microsoft.com/office/webextensions/webextension/2010/11"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" id="{{{identifier}}}">
 <we:reference id="{identifier}" version="{version}" store="developer" storeType="Registry"/>
 <we:alternateReferences/><we:properties/><we:bindings/><we:snapshot/>
</we:webextension>'''.encode()
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as output:
    for name, data in parts.items():
        output.writestr(name, data)
with zipfile.ZipFile(target) as result:
    assert result.testzip() is None
    for name in result.namelist():
        if name.endswith((".xml", ".rels")):
            ET.fromstring(result.read(name))
print(target)
