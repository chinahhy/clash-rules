// 基于 xream/scripts 的 sing-box/template.js：
// https://github.com/xream/scripts/blob/fb62d1d8f23774bb34d4487a2141c9c470466096/surge/modules/sub-store-scripts/sing-box/template.js
// Sub-Store 脚本操作链接：
// https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/template2.js
// 默认读取组合订阅 singbox2，匹配自动选择、全部节点和六个地区组。
// 可通过链接参数覆盖 name、type、outbound；不在日志中输出节点数据或订阅 URL。
log(`🚀 开始`)

let {
  type = '组合订阅',
  name = 'singbox2',
  outbound = [
    "🕳^♻️\\ 自动选择$🏷^((?!(直连|剩余|流量|套餐|官网|网站|专业|到期|过期|重置|订阅|更新订阅|最新|5倍|下载|公告|客服|工单|倍率|3x|5x|7x|10x)).)*$",
    "🕳^🇯🇵\\ 日本节点$🏷ℹ️^(?!.*(?:日本-中转 02))(?:(?=.*(日|jp|japan))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$)",
    "🕳^🇹🇼\\ 台湾节点$🏷ℹ️(?=.*(台|tw|taiwan|台湾|taipei|台北|taichung|台中|kaohsiung|高雄))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "🕳^🇭🇰\\ 香港节点$🏷ℹ️(?=.*(港|hk|hongkong|hong kong))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5倍|5x|最新|下载)).)*$",
    "🕳^🇸🇬\\ 狮城节点$🏷ℹ️(?=.*(新加坡|坡|狮城|sg|singapore))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "🕳^🇺🇲\\ 美国节点$🏷ℹ️(?=.*(美|us|usa|unitedstates|united states))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "🕳^🇬🇧\\ 英国节点$🏷ℹ️(?=.*(英|uk|gb|unitedkingdom|greatbritain|great britain|united kingdom))^((?!(剩余|套餐|官网|专业|3x|更新订阅|5x|最新|5倍|下载)).)*$",
    "🕳^🌐\\ 全部节点$🏷.*"
  ].join('\n'),
  includeUnsupportedProxy,
  url
} = $arguments ?? {}

log(`传入参数 type: ${type}, name: ${name}, outbound: ${outbound}`)

type = /^1$|col|组合/i.test(type) ? 'collection' : 'subscription'

const parser = ProxyUtils.JSON5 || JSON
log(`① 使用 ${ProxyUtils.JSON5 ? 'JSON5' : 'JSON'} 解析配置文件`)
let config
try {
  config = parser.parse($content ?? $files[0])
} catch (e) {
  log(`${e.message ?? e}`)
  throw new Error(`配置文件不是合法的 ${ProxyUtils.JSON5 ? 'JSON5' : 'JSON'} 格式`)
}
log(`② 获取订阅`)

let proxies = []
let outbounds = []
let endpoints = []
let data = {}
if (url) {
  log(`直接从 URL 读取订阅`)
  data = await produceArtifact({
    name,
    type,
    platform: 'sing-box',
    produceOpts: {
      'include-unsupported-proxy': includeUnsupportedProxy,
    },
    subscription: {
      name,
      url,
      source: 'remote',
    },
  })
} else {
  log(`将读取名称为 ${name} 的 ${type === 'collection' ? '组合' : ''}订阅`)
  data = await produceArtifact({
    name,
    type,
    platform: 'sing-box',
    produceOpts: {
      'include-unsupported-proxy': includeUnsupportedProxy,
    },
  })
}
data = JSON.parse(data)
outbounds = data.outbounds ?? []
endpoints = data.endpoints ?? []
proxies = [...outbounds, ...endpoints]
log(`获取到 ${outbounds.length} 个节点, ${endpoints.length} 个端点`)

log(`③ outbound 规则解析`)
const outboundRules = outbound
  .split('🕳')
  .map(i => i.trim())
  .filter(i => i)
  .map(i => {
    let [outboundPattern, tagPattern = '.*'] = i.split('🏷')
    const tagRegex = createTagRegExp(tagPattern)
    log(`匹配 🏷 ${tagRegex} 的节点将插入匹配 🕳 ${createOutboundRegExp(outboundPattern)} 的 outbound 中`)
    return [outboundPattern, tagRegex]
  })

log(`④ outbound 插入节点`)
if (!Array.isArray(config.outbounds)) {
  config.outbounds = []
}
config.outbounds.map(outbound => {
  outboundRules.map(([outboundPattern, tagRegex]) => {
    const outboundRegex = createOutboundRegExp(outboundPattern)
    if (outboundRegex.test(outbound.tag)) {
      if (!Array.isArray(outbound.outbounds)) {
        outbound.outbounds = []
      }
      const tags = getTags(proxies, tagRegex)
      log(`🕳 ${outbound.tag} 匹配 ${outboundRegex}, 插入 ${tags.length} 个 🏷 匹配 ${tagRegex} 的节点`)
      outbound.outbounds.push(...tags)
    }
  })
})

const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

let compatible
log(`⑤ 空 outbounds 检查`)
config.outbounds.map(outbound => {
  outboundRules.map(([outboundPattern, tagRegex]) => {
    const outboundRegex = createOutboundRegExp(outboundPattern)
    if (outboundRegex.test(outbound.tag)) {
      if (!Array.isArray(outbound.outbounds)) {
        outbound.outbounds = []
      }
      if (outbound.outbounds.length === 0) {
        if (!compatible) {
          config.outbounds.push(compatible_outbound)
          compatible = true
        }
        log(`🕳 ${outbound.tag} 的 outbounds 为空, 自动插入 COMPATIBLE(direct)`)
        outbound.outbounds.push(compatible_outbound.tag)
      }
    }
  })
})

config.outbounds.push(...outbounds)
if (!Array.isArray(config.endpoints)) {
  config.endpoints = []
}
config.endpoints.push(...endpoints)

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
function log(v) {
  console.log(`[📦 sing-box 模板脚本] ${v}`)
}
function createTagRegExp(tagPattern) {
  return new RegExp(tagPattern.replace('ℹ️', ''), tagPattern.includes('ℹ️') ? 'i' : undefined)
}
function createOutboundRegExp(outboundPattern) {
  return new RegExp(outboundPattern.replace('ℹ️', ''), outboundPattern.includes('ℹ️') ? 'i' : undefined)
}

log(`🔚 结束`)
