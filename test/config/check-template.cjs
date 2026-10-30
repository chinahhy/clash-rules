'use strict';
// Offline test only. All nodes are fictional direct outbounds, not real subscriptions.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const nodes = ['香港 01', '日本 02', '台湾 03', '新加坡 04', '美国 05', '英国 06', '其他地区 04'].map(tag => ({ type: 'direct', tag }));
const quiet = { log() {} };
async function generate(scriptFile) {
  const source = fs.readFileSync(scriptFile, 'utf8');
  const run = new AsyncFunction('$arguments', '$content', '$files', 'ProxyUtils', 'produceArtifact', 'console', source + '\nreturn $content;');
  const content = fs.readFileSync(path.join(__dirname, 'linux.json'), 'utf8');
  const artifact = async () => JSON.stringify({ outbounds: nodes, endpoints: [] });
  return JSON.parse(await run({}, content, [], {}, artifact, quiet));
}
function group(config, tag) {
  const result = config.outbounds.find(x => x.tag === tag);
  assert(result, `missing group: ${tag}`);
  return result.outbounds;
}
(async () => {
  const test = await generate(path.join(__dirname, 'template.js'));
  const baseline = await generate(path.join(root, 'sing-box/config/template.js'));
  const auto = group(test, '♻️ 自动选择');
  for (const tag of ['香港 01', '日本 02', '台湾 03', '新加坡 04', '美国 05']) assert(auto.includes(tag), `missing: ${tag}`);
  assert(!auto.includes('其他地区 04'), 'non-region node entered auto selection');
  for (const tag of ['🇯🇵 日本节点', '🇹🇼 台湾节点', '🇭🇰 香港节点', '🇸🇬 狮城节点', '🇺🇲 美国节点', '🇬🇧 英国节点']) assert.deepStrictEqual(group(test, tag), group(baseline, tag), `region changed: ${tag}`);
  if (process.argv.includes('--emit')) process.stdout.write(JSON.stringify(test, null, 2) + '\n');
  else console.log('PASS: fictional nodes; suffix expansion and unchanged region groups');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
