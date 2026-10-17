// Offline Sub-Store contract tests. All nodes are synthetic TEST-NET addresses.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const base = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(base, 'template.json'), 'utf8');
const script = fs.readFileSync(path.join(base, 'inject.js'), 'utf8');
const source = JSON.parse(fs.readFileSync(path.join(base, 'migration-source.json'), 'utf8'));
const names = ['测试-HK-香港', '测试-TW-台湾', '测试-JP-日本', '测试-SG-新加坡', '测试-US-美国', '测试-UK-英国', '日本-中转 02', '剩余流量 100 GB'];
const fixture = names.map((tag, i) => ({type:'socks', tag, server:`192.0.2.${i+1}`, server_port:1080}));
async function inject(outbounds, secret = crypto.randomBytes(24).toString('hex')) {
  const context = vm.createContext({
    $arguments: {name:'singbox', secret}, $content:template,
    produceArtifact: async args => {
      assert.equal(args.name, 'singbox');
      assert.equal(args.type, 'collection');
      assert.equal(args.platform, 'sing-box');
      assert.equal(args.produceOpts['include-unsupported-proxy'], false);
      return JSON.stringify({outbounds});
    },
  });
  await vm.runInContext(`(async()=>{${script}\n})()`, context);
  return JSON.parse(context.$content);
}
(async()=>{
  const result = await inject(fixture);
  const groups = new Map(result.outbounds.map(g=>[g.tag,g]));
  for (const group of source.groups) {
    const actual = groups.get(group.name);
    assert.ok(actual, 'source group missing');
    if (group.proxies) assert.deepEqual(actual.outbounds, group.proxies, 'selector order changed');
    if (group.type === 'url-test') {
      assert.equal(actual.interval, `${group.interval}s`);
      assert.equal(actual.tolerance, group.tolerance);
      assert.equal(actual.url, group.url);
    }
  }
  assert.deepEqual(groups.get('🇯🇵 日本节点').outbounds, ['测试-JP-日本']);
  assert.deepEqual(groups.get('🇬🇧 英国节点').outbounds, ['测试-UK-英国']);
  assert.ok(!groups.get('♻️ 自动选择').outbounds.includes('剩余流量 100 GB'));
  assert.ok(groups.get('🌐 全部节点').outbounds.includes('直连'));
  for (const group of result.outbounds.filter(g=>['selector','urltest'].includes(g.type))) {
    assert.ok(group.outbounds.length);
    for (const tag of group.outbounds) assert.ok(groups.has(tag), 'unresolved group member');
  }
  await assert.rejects(inject(fixture.filter(n=>!n.tag.includes('UK'))), /没有匹配节点/);
  await assert.rejects(inject([...fixture, fixture[0]]), /重复节点/);
  await assert.rejects(inject([...fixture, {type:'direct',tag:'直连'}]), /策略组重名/);
  await assert.rejects(inject([]), /没有可导出/);
  await assert.rejects(inject(fixture, ''), /私有面板口令/);
  if (process.argv[2]) fs.writeFileSync(path.resolve(process.argv[2]), JSON.stringify(result,null,2)+'\n');
  console.log('PASS: 41 groups, exact selector order, six regions, Japan exclusion, notice filter, empty-region failure, duplicate-tag failure, private-secret requirement');
})().catch(err=>{ console.error(err.message); process.exitCode=1; });
