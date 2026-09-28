"""Release gates must reject machine-specific and changed installation payloads."""
import hashlib
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts'))
from native_config import VERSION, BUNDLE, SHARED_ROOT, library_path
spec = importlib.util.spec_from_file_location('package_installer', ROOT/'scripts/package-installer.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerReleaseGates(unittest.TestCase):
    def make_payload(self, directory):
        source = pathlib.Path(directory)
        (source/'FreeElements.ppam').write_bytes(b'test fixture')
        binary = source/BUNDLE/'Contents/MacOS/FreeElements'
        binary.parent.mkdir(parents=True)
        binary.write_bytes(b'test binary fixture')
        metadata = {'version': VERSION, 'distribution': True, 'libraryPath': library_path(SHARED_ROOT),
                    'architectures': ['arm64', 'x86_64'],
                    'files': {str(f.relative_to(source)): hashlib.sha256(f.read_bytes()).hexdigest()
                              for f in source.rglob('*') if f.is_file()}}
        (source/'build.json').write_text(json.dumps(metadata))
        return source, metadata

    def test_accepts_intact_portable_payload(self):
        with tempfile.TemporaryDirectory() as directory:
            source, metadata = self.make_payload(directory)
            self.assertEqual(installer.validate_payload(source), metadata)

    def test_refuses_per_user_build(self):
        with tempfile.TemporaryDirectory() as directory:
            source, metadata = self.make_payload(directory)
            metadata['distribution'] = False
            (source/'build.json').write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'per-user'):
                installer.validate_payload(source)

    def test_refuses_modified_native_binary(self):
        with tempfile.TemporaryDirectory() as directory:
            source, _ = self.make_payload(directory)
            (source/BUNDLE/'Contents/MacOS/FreeElements').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                installer.validate_payload(source)

    def test_refuses_extra_payload_files(self):
        with tempfile.TemporaryDirectory() as directory:
            source, _ = self.make_payload(directory)
            (source/'private.key').write_bytes(b'not for release')
            with self.assertRaisesRegex(ValueError, 'files differ'):
                installer.validate_payload(source)

    def test_refuses_missing_architecture(self):
        with tempfile.TemporaryDirectory() as directory:
            source, metadata = self.make_payload(directory)
            metadata['architectures'] = ['arm64']
            (source/'build.json').write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'Intel'):
                installer.validate_payload(source)

    def test_refuses_machine_specific_library_path(self):
        with tempfile.TemporaryDirectory() as directory:
            source, metadata = self.make_payload(directory)
            metadata['libraryPath'] = '/Users/someone/FreeElements'
            (source/'build.json').write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'shared installation'):
                installer.validate_payload(source)


if __name__ == '__main__': unittest.main()
