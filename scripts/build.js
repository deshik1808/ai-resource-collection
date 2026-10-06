// Inlines src/ files into n8n Workflow SDK sources so Code nodes and prompts
// can live as normal, testable files in the repo.
//
//   __INCLUDE__('lib/a.js', 'adapters/x.js')  -> JSON string of the files joined
//   __TEXT__('prompts/youtube.txt')           -> JSON string of the file as-is
//
// Included .js files lose their `const … = require(…)` and `module.exports`
// lines, because n8n Code nodes cannot load local modules.

const fs = require('node:fs');
const path = require('node:path');

const MODULE_LINE = /^(const .* = require\(|module\.exports)/;
const INCLUDE = /__INCLUDE__\(([^)]*)\)/g;
const TEXT = /__TEXT__\(\s*'([^']+)'\s*\)/g;

function readSrc(srcDir, file) {
  const full = path.join(srcDir, file);
  if (!fs.existsSync(full)) throw new Error(`include not found: ${file}`);
  return fs.readFileSync(full, 'utf8');
}

function stripModuleLines(code) {
  return code
    .split('\n')
    .filter((line) => !MODULE_LINE.test(line))
    .join('\n')
    .trim();
}

function build(source, srcDir) {
  return source
    .replace(INCLUDE, (_, args) => {
      const files = [...args.matchAll(/'([^']+)'/g)].map((m) => m[1]);
      const code = files.map((f) => stripModuleLines(readSrc(srcDir, f))).join('\n');
      return JSON.stringify(code);
    })
    .replace(TEXT, (_, file) => JSON.stringify(readSrc(srcDir, file)));
}

function main() {
  const root = path.join(__dirname, '..');
  const workflowsDir = path.join(root, 'n8n', 'workflows');
  const outDir = path.join(root, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  const sources = fs.existsSync(workflowsDir)
    ? fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.workflow.js'))
    : [];
  for (const file of sources) {
    const source = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
    fs.writeFileSync(path.join(outDir, file), build(source, path.join(root, 'src')));
    console.log(`built build/${file}`);
  }
  if (sources.length === 0) console.log('no workflow sources found');
}

if (require.main === module) main();

module.exports = { build };
