// 下载专用 Sub-Store 模板：配合 linux-download.json 使用。
// 目标：Telegram / YouTube / X (Twitter) 视频下载；不按地区分组。
// 默认读取“singbox”组合订阅，保持与现有 template.js 相同的订阅入口。
// 通过 Sub-Store 生成 sing-box 节点后，注入一个自动测速组和一个手动选择组。
// 延迟不等于吞吐量：自动优选只按连接延迟挑选；需要时可手动选择实测最快节点。
// 重要：没有可用节点时报错，不静默切换为直连。

const DOWNLOAD_AUTO = '🚀 自动优选'
const DOWNLOAD_SELECT = '📥 下载出口'
const {
  type: inputType = '组合订阅',
  name = 'singbox',
  includeUnsupportedProxy,
  url,
} = $arguments ?? {}
const type = /^1$|col|组合/i.test(inputType) ? 'collection' : 'subscription'
const parser = ProxyUtils.JSON5 || JSON

let config
try {
  config = parser.parse($content ?? $files[0])
} catch (error) {
  throw new Error('下载版 JSON 配置解析失败: ' + (error.message ?? String(error)))
}

if (!Array.isArray(config.outbounds)) {
  throw new Error('下载版缺少 outbounds 数组')
}
const auto = config.outbounds.find(o => o.tag === DOWNLOAD_AUTO && o.type === 'urltest')
const selector = config.outbounds.find(o => o.tag === DOWNLOAD_SELECT && o.type === 'selector')
if (!auto || !selector) {
  throw new Error('请搭配 linux-download.json 使用 template-download.js')
}

const produceOpts = { 'include-unsupported-proxy': includeUnsupportedProxy }
const request = { name, type, platform: 'sing-box', produceOpts }
if (url) {
  request.subscription = { name, url, source: 'remote' }
}
const raw = await produceArtifact(request)
const data = JSON.parse(raw)
const outbounds = data.outbounds ?? []
const endpoints = data.endpoints ?? []
if (!Array.isArray(outbounds) || !Array.isArray(endpoints)) {
  throw new Error('订阅结果格式不正确：outbounds/endpoints 必须为数组')
}

const nodes = [...outbounds, ...endpoints]
if (!nodes.length) {
  throw new Error('下载版订阅没有节点：请检查 singbox 组合订阅和 Sub-Store 过滤条件')
}
const tags = new Set(config.outbounds.map(o => o.tag))
for (const node of nodes) {
  if (!node || typeof node.tag !== 'string' || !node.tag.trim()) {
    throw new Error('下载版订阅存在缺少 tag 的节点')
  }
  if (tags.has(node.tag)) {
    throw new Error('下载版发现重复或冲突的节点名: ' + node.tag)
  }
  tags.add(node.tag)
}

const nodeTags = nodes.map(node => node.tag)
auto.outbounds = nodeTags
selector.outbounds = [DOWNLOAD_AUTO, ...nodeTags]
selector.default = DOWNLOAD_AUTO
config.outbounds.push(...outbounds)
if (!Array.isArray(config.endpoints)) config.endpoints = []
config.endpoints.push(...endpoints)

console.log('[📥 下载专用] 注入 ' + outbounds.length + ' 个代理节点、' + endpoints.length + ' 个端点；不建立地区组')
$content = JSON.stringify(config, null, 2)
