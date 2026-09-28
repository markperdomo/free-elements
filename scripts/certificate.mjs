import { mkdir, access, writeFile, chmod } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = fileURLToPath(new URL('../.certs/', import.meta.url));
await mkdir(dir, { recursive: true, mode: 0o700 });
const key = path.join(dir, 'localhost.key'), cert = path.join(dir, 'localhost.crt');
let exists = false;
for (const file of [key, cert]) { try { await access(file); exists = true; } catch {} }
if (exists) {
  console.error('A certificate or key already exists in .certs. Keep the existing pair, or move it aside before generating a new one.');
  process.exitCode = 1;
} else {
  const config = path.join(dir, 'localhost.cnf');
  await writeFile(config, '[req]\nprompt = no\ndistinguished_name = dn\nx509_extensions = ext\n[dn]\nCN = localhost\nO = Free Elements Development\n[ext]\nsubjectAltName = DNS:localhost,IP:127.0.0.1\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\n');
  const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365', '-keyout', key, '-out', cert, '-config', config], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr || result.error?.message); process.exitCode = 1; }
  else { await chmod(key, 0o600); console.log(`Created a localhost certificate at ${cert}.\nNo trust settings were changed. Follow docs/INSTALLATION.md to trust it before using Office.`); }
}
