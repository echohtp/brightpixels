import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const test = process.argv.includes('--test');
const config = {
  entryPoints: [test ? 'test/browser/react-confetti-fixture.jsx' : 'assets/react-confetti-demo.jsx'],
  bundle: true, format: 'esm', minify: true, legalComments: 'inline',
  define: { 'process.env.NODE_ENV': JSON.stringify(test ? 'development' : 'production') },
  outfile: test ? 'test/browser/react-confetti-fixture.bundle.js' : 'assets/react-confetti-demo.bundle.js',
  write: false,
};
const result = await build(config);
const content = result.outputFiles[0].text;
if (process.argv.includes('--check')) {
  if (await readFile(config.outfile, 'utf8') !== content) throw new Error('React confetti demo is stale. Run npm run build:confetti-demo.');
} else await writeFile(config.outfile, content);
