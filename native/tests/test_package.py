import pathlib, tempfile, subprocess, unittest, zipfile, xml.etree.ElementTree as ET, shutil, json
ROOT=pathlib.Path(__file__).resolve().parents[2]
R='http://schemas.openxmlformats.org/package/2006/relationships'
C='http://schemas.openxmlformats.org/package/2006/content-types'
BUNDLE='FreeElements-'+json.loads((ROOT/'package.json').read_text())['version']+'.bundle'

class NativePackaging(unittest.TestCase):
    def make_input(self, folder, *, vba=True, content_type='application/vnd.ms-powerpoint.addin.macroEnabled.main+xml'):
        path=folder/'source.ppam'
        with zipfile.ZipFile(path,'w') as z:
            z.writestr('[Content_Types].xml',f'<Types xmlns="{C}"><Override PartName="/ppt/presentation.xml" ContentType="{content_type}"/></Types>')
            z.writestr('_rels/.rels',f'<Relationships xmlns="{R}"><Relationship Id="office" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>')
            z.writestr('ppt/presentation.xml','<presentation/>')
            if vba: z.writestr('ppt/vbaProject.bin',b'unit-test-only VBA stand-in\x00\xff')
        bundle=folder/BUNDLE/'Contents/MacOS'
        bundle.mkdir(parents=True)
        (bundle/'FreeElements').write_bytes(b'unit-test-only native stand-in')
        return path

    def run_package(self, folder, path):
        return subprocess.run(['python3',str(ROOT/'scripts/package-native.py'),'--input',str(path),'--output',str(folder/'FreeElements.ppam')],capture_output=True,text=True)

    def test_refuses_hollow_addin(self):
        with tempfile.TemporaryDirectory() as t:
            f=pathlib.Path(t); result=self.run_package(f,self.make_input(f,vba=False))
            self.assertNotEqual(result.returncode,0)
            self.assertIn('no compiled VBA',result.stderr)
            self.assertFalse((f/'FreeElements.ppam').exists())

    def test_refuses_presentation_disguised_as_addin(self):
        with tempfile.TemporaryDirectory() as t:
            f=pathlib.Path(t); result=self.run_package(f,self.make_input(f,content_type='application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml'))
            self.assertNotEqual(result.returncode,0)
            self.assertIn('real PowerPoint Open XML Add-in',result.stderr)

    def test_preserves_vba_and_adds_unique_ribbon(self):
        with tempfile.TemporaryDirectory() as t:
            f=pathlib.Path(t); source=self.make_input(f)
            result=self.run_package(f,source)
            self.assertEqual(result.returncode,0,result.stderr)
            with zipfile.ZipFile(source) as original, zipfile.ZipFile(f/'FreeElements.ppam') as built:
                self.assertEqual(original.read('ppt/vbaProject.bin'),built.read('ppt/vbaProject.bin'))
                self.assertIsNone(built.testzip())
                rels=ET.fromstring(built.read('_rels/.rels'))
                self.assertEqual(len([r for r in rels if r.get('Target')=='customUI/customUI14.xml']),1)
                ribbon=ET.fromstring(built.read('customUI/customUI14.xml'))
                self.assertIn('FreeElementsRibbon',ET.tostring(ribbon).decode())
                button=ribbon.find('.//{http://schemas.microsoft.com/office/2009/07/customui}button')
                image_rels=ET.fromstring(built.read('customUI/_rels/customUI14.xml.rels'))
                image=next(r for r in image_rels if r.get('Id')==button.get('image'))
                self.assertEqual(image.get('Type'),'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image')
                image_part='customUI/'+image.get('Target')
                self.assertEqual(built.read(image_part),(ROOT/'public/assets/icon-80.png').read_bytes())
                types=ET.fromstring(built.read('[Content_Types].xml'))
                self.assertEqual(next(t for t in types if t.get('PartName')=='/'+image_part).get('ContentType'),'image/png')
            shutil.copy2(f/'FreeElements.ppam',f/'again.ppam')
            result=self.run_package(f,f/'again.ppam')
            self.assertEqual(result.returncode,0,result.stderr)
            with zipfile.ZipFile(f/'FreeElements.ppam') as built:
                rels=ET.fromstring(built.read('_rels/.rels'))
                self.assertEqual(len([r for r in rels if r.get('Target')=='customUI/customUI14.xml']),1)

if __name__=='__main__': unittest.main()
