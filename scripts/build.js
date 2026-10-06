// Inlines src/ files into n8n Workflow SDK sources so Code nodes and prompts
// can live as normal, testable files in the repo.
//
//   __INCLUDE__('lib/a.js', 'adapters/x.js')  -> JSON string of the files joined
//   __TEXT__('prompts/youtube.txt')           -> JSON string of the file as-is
//   __ID__('sheet_id')                        -> JSON string from n8n/workflows/ids.json
//
// Included .js files lose their `const … = require(…)` and `module.exports`
// lines, because n8n Code nodes cannot load local modules.

const fs = require('node:fs');
const path = require('node:path');

const MODULE_LINE = /^(const .* = require\(|module\.exports)/;
const COMMENT_LINE = /^\s*(\/\/|\/\*\*|\*\/|\* |\*$)/;
const INCLUDE = /__INCLUDE__\(([^)]*)\)/g;
const TEXT = /__TEXT__\(\s*'([^']+)'\s*\)/g;
const ID = /__ID__\(\s*'([^']+)'\s*\)/g;

function readSrc(srcDir, file) {
  const full = path.join(srcDir, file);
  if (!fs.existsSync(full)) throw new Error(`include not found: ${file}`);
  return fs.readFileSync(full, 'utf8');
}

function stripModuleLines(code) {
  return code
    .split('\n')
    .filter((line) => !MODULE_LINE.test(line) && !COMMENT_LINE.test(line))
    .join('\n')
    .trim();
}

function inlineValues(code, srcDir, ids) {
  return code
    .replace(TEXT, (_, file) => JSON.stringify(readSrc(srcDir, file)))
    .replace(ID, (_, key) => {
      if (!(key in ids)) throw new Error(`unknown id: ${key}`);
      return JSON.stringify(ids[key] ?? '');
    });
}

function build(source, srcDir, ids = {}) {
  const withIncludes = source.replace(INCLUDE, (_, args) => {
    const files = [...args.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const code = files.map((f) => stripModuleLines(inlineValues(readSrc(srcDir, f), srcDir, ids))).join('\n');
    return JSON.stringify(code);
  });
  return inlineValues(withIncludes, srcDir, ids);
}

function main() {
  const root = path.join(__dirname, '..');
  const workflowsDir = path.join(root, 'n8n', 'workflows');
  const outDir = path.join(root, 'build');
  fs.mkdirSync(outDir, { recursive: true });
  const sources = fs.existsSync(workflowsDir)
    ? fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.workflow.js'))
    : [];
  const idsFile = path.join(workflowsDir, 'ids.json');
  const ids = fs.existsSync(idsFile) ? JSON.parse(fs.readFileSync(idsFile, 'utf8')) : {};
  for (const file of sources) {
    const source = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
    fs.writeFileSync(path.join(outDir, file), build(source, path.join(root, 'src'), ids));
    console.log(`built build/${file}`);
  }
  if (sources.length === 0) console.log('no workflow sources found');
}

if (require.main === module) main();

module.exports = { build };
