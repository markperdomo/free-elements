import { access, readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const source = fileURLToPath(new URL('../public/manifest.xml', import.meta.url));
const staged = fileURLToPath(new URL('../dist/sideload/free-elements.xml', import.meta.url));
const target = path.join(homedir(), 'Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/free-elements.xml');
const ownId = '71209546-c69f-414c-9272-62b30ff06d1c';
const dry = process.argv.includes('--dry-run'), remove = process.argv.includes('--remove');
const stage = process.argv.includes('--stage');
async function stageManifest() {
  await mkdir(path.dirname(staged), { recursive: true });
  await writeFile(staged, await readFile(source), { mode: 0o644 });
  console.log(`Manifest ready for Finder: ${staged}`);
  console.log(`Copy it into: ${path.dirname(target)}`);
  console.log('Replace only your existing Free Elements manifest. Restart PowerPoint after copying.');
}
async function main() {
if (process.platform !== 'darwin') { console.error('This sideload helper is for macOS.'); process.exit(1); }
if (stage && (dry || remove)) throw new Error('Use --stage by itself to prepare a manifest for Finder.');
if (stage) { await stageManifest(); return; }
console.log(`${dry ? 'Would ' : ''}${remove ? 'Remove' : 'Copy manifest to'}: ${target}`);
// A preview must work even when macOS protects the Office container from this terminal.
if (dry) { console.log('Preview only. The installed manifest ownership check runs before any write or removal.'); return; }
let existing = null;
try { existing = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing !== null && !existing.includes(`<Id>${ownId}</Id>`)) throw new Error('The target filename belongs to another add-in. Refusing to overwrite or remove it.');
  if (remove) { if (existing !== null) await unlink(target); }
  else {
    let installed = false;
    for (const app of ['/Applications/Microsoft PowerPoint.app', path.join(homedir(), 'Applications/Microsoft PowerPoint.app')]) {
      try { await access(app); installed = true; } catch {}
    }
    if (!installed) throw new Error('PowerPoint is not installed in /Applications or ~/Applications. Use the browser playground for now.');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(source), { mode: 0o644 });
  }
  console.log('Restart PowerPoint. For installation, keep npm run start:office running and open Home → Add-ins → Free Elements.');
}
try { await main(); }
catch (error) {
  if (['EPERM', 'EACCES'].includes(error.code)) {
    console.error('macOS denied terminal access to PowerPoint’s protected folder. Use Finder for this copy; no broader disk permissions are needed.');
    if (remove) console.error(`In Finder, remove only: ${target}`);
    else await stageManifest();
  } else console.error(error.message);
  process.exitCode = 1;
}
