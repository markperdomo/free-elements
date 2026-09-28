"""Shared native release settings; the version lives in package.json."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
BUNDLE = f'FreeElements-{VERSION}.bundle'
SHARED_ROOT = Path('/Library/Application Support/Microsoft/Office365/User Content.localized/Add-Ins.localized/Free Elements/Program')
USER_ROOT = Path.home() / 'Library/Group Containers/UBF8T346G9.Office/Free Elements/Program'

def library_path(root):
    return str(root / BUNDLE / 'Contents/MacOS/FreeElements')
