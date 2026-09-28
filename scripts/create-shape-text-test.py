"""Create a disposable native-shape test fixture from our existing smoke fixture."""
from pathlib import Path
import copy
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
output = root / 'dist/shape-text-smoke.pptx'
if output.exists():
    raise SystemExit(f'Test deck already exists; preserving edits: {output}')
ns = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
rel = 'http://schemas.openxmlformats.org/package/2006/relationships'
ct = 'http://schemas.openxmlformats.org/package/2006/content-types'
with zipfile.ZipFile(root / 'tests/fixtures/powerpoint-smoke.pptx') as z:
    parts = {n:z.read(n) for n in z.namelist()}
base = ET.fromstring(parts['ppt/slides/slide1.xml'])
presentation = ET.fromstring(parts['ppt/presentation.xml'])
slide_ids = presentation.find('p:sldIdLst',ns)
rels = ET.fromstring(parts['ppt/_rels/presentation.xml.rels'])
types = ET.fromstring(parts['[Content_Types].xml'])
slide_rels = ET.fromstring(parts['ppt/slides/_rels/slide1.xml.rels'])
for relationship in list(slide_rels):
    if 'notesSlide' in relationship.get('Type',''):
        slide_rels.remove(relationship)
for page,preset in enumerate(['chevron','rightArrow','roundRect','rect'],1):
    slide = copy.deepcopy(base)
    for i,shape in enumerate(slide.findall('.//p:sp',ns)):
        geometry = shape.find('p:spPr/a:prstGeom',ns)
        if geometry is None:
            continue
        geometry.set('prst',preset)
        adjustments = geometry.find('a:avLst',ns)
        if adjustments is None:
            adjustments = ET.SubElement(geometry,f'{{{ns["a"]}}}avLst')
        adjustments.clear()
        values = [35000+i*8000,30000+i*10000] if preset=='rightArrow' else [12000+i*12000] if preset!='rect' else []
        for j,value in enumerate(values):
            ET.SubElement(adjustments,f'{{{ns["a"]}}}gd',{'name':f'adj{j+1}' if preset=='rightArrow' else 'adj','fmla':f'val {value}'})
        if page == 4:
            tx = shape.find('p:txBody',ns)
            template = copy.deepcopy(tx.find('a:p',ns))
            for para in list(tx.findall('a:p',ns)):
                tx.remove(para)
            for line in [f'Step {i+1}', 'Explore the options', 'Choose a direction']:
                para = copy.deepcopy(template)
                texts = para.findall('.//a:t',ns)
                if texts: texts[0].text = line
                for t in texts[1:]: t.text = ''
                tx.append(para)
    parts[f'ppt/slides/slide{page}.xml'] = ET.tostring(slide,encoding='utf-8',xml_declaration=True)
    parts[f'ppt/slides/_rels/slide{page}.xml.rels'] = ET.tostring(slide_rels,encoding='utf-8',xml_declaration=True)
    if page > 1:
        rid = f'rIdShapeText{page}'
        ET.SubElement(slide_ids,f'{{{ns["p"]}}}sldId',{'id':str(400+page),f'{{{ns["r"]}}}id':rid})
        ET.SubElement(rels,f'{{{rel}}}Relationship',{'Id':rid,'Type':ns['r']+'/slide','Target':f'slides/slide{page}.xml'})
        ET.SubElement(types,f'{{{ct}}}Override',{'PartName':f'/ppt/slides/slide{page}.xml','ContentType':'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'})
parts['ppt/presentation.xml'] = ET.tostring(presentation,encoding='utf-8',xml_declaration=True)
parts['ppt/_rels/presentation.xml.rels'] = ET.tostring(rels,encoding='utf-8',xml_declaration=True)
parts['[Content_Types].xml'] = ET.tostring(types,encoding='utf-8',xml_declaration=True)
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in parts.items(): z.writestr(name,data)
print(output)
