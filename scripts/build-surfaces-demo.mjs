import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const test = process.argv.includes('--test');
const outfile = test ? 'test/browser/react-surface-fixture.bundle.js' : 'assets/surfaces-demo.bundle.js';
const result = await build({ entryPoints: [test ? 'test/browser/react-surface-fixture.jsx' : 'assets/surfaces-demo.jsx'],
  bundle: true, format: 'esm', minify: true, legalComments: 'inline',
  define: { 'process.env.NODE_ENV': JSON.stringify(test ? 'development' : 'production') }, outfile, write: false });
const content = result.outputFiles[0].text;
if (process.argv.includes('--check')) {
  if (await readFile(outfile,'utf8') !== content) throw new Error('Surface demo is stale. Run npm run build:surfaces-demo.');
} else await writeFile(outfile,content);
