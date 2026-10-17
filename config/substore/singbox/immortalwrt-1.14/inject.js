// Sub-Store File / Script Operator. Parameters: name=singbox, secret=<private>.
// Same produceArtifact contract as xream's sing-box/template.js (reviewed at
// fb62d1d8f23774bb34d4487a2141c9c470466096). Do not log the returned node object.
// Filters below are copied from the uploaded Mihomo configuration, including
// its Japan exclusion. No direct fallback is inserted for an empty region.
const options = typeof $arguments === 'object' ? $arguments : {};
const collectionName = options.name || 'singbox';
const apiSecret = options.secret;
if (typeof apiSecret !== 'string' || apiSecret.length < 12 || apiSecret === '__SET_PRIVATE_API_SECRET__') {
  throw new Error('请在 Sub-Store 本文件的脚本参数 secret 中设置至少 12 位的私有面板口令；不要写入 GitHub');
}
const config = JSON.parse($content ?? $files[0]);
if (!Array.isArray(config.outbounds)) throw new Error('模板缺少 outbounds');
const data = await produceArtifact({
  name: collectionName,
  type: 'collection',
  platform: 'sing-box',
  produceOpts: { 'include-unsupported-proxy': false },
});
const produced = typeof data === 'string' ? JSON.parse(data) : data;
const nodes = [...(produced.outbounds || []), ...(produced.endpoints || [])];
if (!nodes.length) throw new Error('组合订阅没有可导出的 sing-box 节点；已停止生成');
const occupied = new Set();
for (const item of [...config.outbounds, ...(config.endpoints || []), ...nodes]) {
  if (!item || typeof item.tag !== 'string' || !item.tag || occupied.has(item.tag)) {
    throw new Error('存在空名称、重复节点名称或与策略组重名；请给每个子订阅添加不同名称前缀');
  }
  occupied.add(item.tag);
}
function regex(pattern) {
  const insensitive = pattern.startsWith('(?i)');
  return new RegExp(insensitive ? pattern.slice(4) : pattern, insensitive ? 'i' : '');
}
const filters = [
  {
    "tag": "♻️ 自动选择",
    "include": "^((?!(直连|剩余|流量|套餐|官网|网站|专业|到期|过期|重置|订阅|更新订阅|最新|5倍|下载|公告|客服|工单|倍率|3x|5x|7x|10x)).)*$",
    "exclude": null
  },
  {
    "tag": "🇯🇵 日本节点",
    "include": "(?i)(?=.*(日|jp|japan))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "exclude": "日本-中转 02"
  },
  {
    "tag": "🇹🇼 台湾节点",
    "include": "(?i)(?=.*(台|tw|taiwan|台湾|taipei|台北|taichung|台中|kaohsiung|高雄))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "exclude": null
  },
  {
    "tag": "🇭🇰 香港节点",
    "include": "(?i)(?=.*(港|hk|hongkong|hong kong))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5倍|5x|最新|下载)).)*$",
    "exclude": null
  },
  {
    "tag": "🇸🇬 狮城节点",
    "include": "(?i)(?=.*(新加坡|坡|狮城|sg|singapore))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "exclude": null
  },
  {
    "tag": "🇺🇲 美国节点",
    "include": "(?i)(?=.*(美|us|usa|unitedstates|united states))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "exclude": null
  },
  {
    "tag": "🇬🇧 英国节点",
    "include": "(?i)(?=.*(英|uk|gb|unitedkingdom|greatbritain|great britain|united kingdom))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "exclude": null
  },
  {
    "tag": "🌐 全部节点",
    "include": ".*",
    "exclude": null
  }
];
for (const filter of filters) {
  const group = config.outbounds.find(item => item.tag === filter.tag);
  if (!group || !['selector', 'urltest'].includes(group.type)) throw new Error('模板与注入脚本的策略组不一致');
  const include = regex(filter.include);
  const exclude = filter.exclude ? regex(filter.exclude) : null;
  const tags = nodes.filter(node => include.test(node.tag) && !(exclude && exclude.test(node.tag))).map(node => node.tag);
  if (!tags.length) throw new Error(`策略组 ${filter.tag} 没有匹配节点；请检查组合订阅及地区名称，已停止生成`);
  group.outbounds = [...new Set([...group.outbounds, ...tags])];
}
config.outbounds.push(...(produced.outbounds || []));
if (produced.endpoints?.length) config.endpoints = [...(config.endpoints || []), ...produced.endpoints];
for (const service of config.services || []) {
  if (service.type === 'api') service.secret = apiSecret;
}
if (config.experimental?.clash_api) config.experimental.clash_api.secret = apiSecret;
// Only the complete config contains credentials. Keep it inside private Sub-Store.
$content = JSON.stringify(config, null, 2);
