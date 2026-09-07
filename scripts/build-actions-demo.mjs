import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const outfile = 'assets/actions-demo.bundle.js';
const result = await build({ entryPoints: ['assets/actions-demo.js'], bundle: true,
  format: 'esm', minify: true, legalComments: 'inline', outfile, write: false });
const content = result.outputFiles[0].text;
if (process.argv.includes('--check')) {
  if (await readFile(outfile, 'utf8') !== content) throw new Error('Action demo is stale. Run npm run build:actions-demo.');
} else await writeFile(outfile, content);
