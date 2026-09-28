"""Prevent a private checkout or accidental extra files from becoming a release."""
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts'))
spec = importlib.util.spec_from_file_location('package_source', ROOT/'scripts/package-source.py')
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)


class PublicSourceGates(unittest.TestCase):
    def check(self, approved, indexed, *, symlink=False):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root/'scripts').mkdir()
            (root/'scripts/public-files.json').write_text(json.dumps(approved))
            (root/'README.md').write_text('Public documentation')
            if symlink:
                (root/'README.md').unlink()
                (root/'README.md').symlink_to(root/'scripts/public-files.json')
            with patch.object(source, 'ROOT', root), patch.object(
                    source.subprocess, 'check_output', return_value=('\0'.join(indexed)+'\0').encode()):
                return source.tracked_files()

    def test_accepts_exact_reviewed_file_set(self):
        names = ['README.md', 'scripts/public-files.json']
        self.assertEqual([str(path) for path in self.check(names, names)], names)

    def test_refuses_private_tracked_file(self):
        with self.assertRaisesRegex(ValueError, 'Unapproved'):
            self.check(['README.md'], ['README.md', 'docs/private-notes.md'])

    def test_refuses_missing_reviewed_file(self):
        with self.assertRaisesRegex(ValueError, 'missing'):
            self.check(['README.md', 'LICENSE'], ['README.md'])

    def test_refuses_symlink_even_when_listed(self):
        with self.assertRaisesRegex(ValueError, 'Non-public file'):
            self.check(['README.md'], ['README.md'], symlink=True)

    def test_refuses_packaged_binary_even_when_listed(self):
        with self.assertRaisesRegex(ValueError, 'Non-public file'):
            self.check(['native/payload.pkg'], ['native/payload.pkg'])


if __name__ == '__main__': unittest.main()
