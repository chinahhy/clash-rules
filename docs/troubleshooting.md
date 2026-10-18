# 旁路由 sing-box 分流异常排查记录

> 记录时间：2026-10-18
> 环境：iKuai 主路由 `10.0.0.1` + ImmortalWrt 旁路由 `10.0.0.2`（momo 插件，仅内核，核心为 sing-box 1.14.3）

## 1. 拓扑

```
                         ┌──────────────┐
   光猫/PPPoE ───────────│ iKuai        │ 10.0.0.1
                         │ DHCP / NAT   │
                         └──────┬───────┘
                                │ 10.0.0.0/24
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
  ┌─────┴─────┐          ┌──────┴──────┐          ┌──────┴──────┐
  │ Windows PC│          │ iPhone      │          │ Sub-Store   │
  │ 10.0.0.118│          │ WiFi        │          │ 10.0.0.104  │
  │ gw .2     │          │ gw .2       │          │ :6969       │
  └─────┬─────┘          └──────┬──────┘          └─────────────┘
        │                       │
        └───────────┬───────────┘
                    │
            ┌───────┴────────┐
            │ 10.0.0.2       │
            │ momo + sing-box│
            │ TUN + redirect │
            └────────────────┘
```

订阅链路：

```
GitHub (chinahhy/clash-rules)
   ├── config/substore/singbox/linux.json     ← 基础配置（分组、规则集、DNS）
   └── config/substore/singbox/template.js    ← 节点注入脚本
        ↓  Sub-Store 按脚本生成（有缓存）
        ↓  http://10.0.0.104:6969/<token>/api/file/singbox-linux
        ↓  momo 拉取 → /etc/momo/run/config.json
        ↓  sing-box -D /etc/momo/run run
```

## 2. 症状

- Windows 上 ChatGPT 网页版「一会儿能上一会儿不能上」
- iPhone 连同一 WiFi、同样网关 `10.0.0.2`，一直正常
- 百度等国内站点始终正常

## 3. 结论速览

| # | 问题 | 影响 | 修复 |
|---|---|---|---|
| 1 | `🇯🇵 日本节点` 的 urltest `interval` 是 **60s**（其它组均为 300s），且 `tolerance: 20` | 13~17 个节点每分钟重测重选，选中坏节点就整分钟断流 | `interval` → 300s，7 个 urltest 组 `tolerance` 统一 → 100 |
| 2 | 自定义规则集 URL **缺少 `gh-proxy.com` 前缀**，而 `default_http_client` 是 `直连下载` | 42 个规则集里的 9 个（`direct_domain`、`claude_domain`、`grok_domain`、`ai_other_domain`、`byte_domain`、`docker_domain`、`proxy_domain`、`pt_domain`、`giffgaff_domain`）**从未加载成功** | 两处 `url` 加 `https://gh-proxy.com/` 前缀 |
| 3 | 日本组的过滤正则 `(?=.*(日\|jp\|japan))` 中「日」匹配到了「**尼日利亚**」 | 2 个尼日利亚节点混进日本组，参与健康检查 | 改为 `(?!.*(?:尼日利亚))(?:.*(日本\|japan\|jp))` |
| 4 | Windows 双网卡双默认网关：有线 `10.0.0.118 → .2`，WiFi `10.0.0.112 → .1` | WiFi 那条路对 fake-ip（198.19.x）是 100% 黑洞 | 关闭 Windows 的 WiFi 网卡 |

## 4. 关键证据

### 4.1 双网关对 fake-ip 是死路

```
src=10.0.0.118 -> 198.19.0.197:443   OK      （有线，走 .2）
src=10.0.0.112 -> 198.19.0.197:443   TIMEOUT （WiFi，走 .1）
src=10.0.0.112 -> 153.3.238.28:443   OK      （真实 IP，.1 正常）
```

原因：`198.19.0.0/16` 是 sing-box 的 fake-ip 段，只有旁路由认得，iKuai 会当作公网地址转发后丢弃。
只要 Windows 触发一次网关回退（Dead Gateway Detection），ChatGPT 立刻挂，而百度照常。

### 4.2 故障形态：TLS 握手中途被 RST

```
00 ERR[tls] SSLEOFError at=0.28s src=10.0.0.118
```

TCP 能建连（0.01s），TLS 在 ~0.28s 被对端关闭。日志显示此时连接走的是 trojan 节点：

```
11:52:00 outbound/trojan[[SCHOT] 🇯🇵 日本 11]: outbound connection to ab.chatgpt.com:443
11:52:03 outbound/trojan[[SCHOT] 🇯🇵 日本 02]: outbound connection to ab.chatgpt.com:443
11:57:10 outbound/trojan[[SCHOT] 🇯🇵 日本 07]: outbound connection to chatgpt.com:443   ← 恢复
```

即：节点隧道建立成功，但对端把连接掐掉。URLTest 每 60 秒换一次节点，换到坏节点就整段时间失败。

### 4.3 规则集加载情况

```
ERROR router: fetch rule-set claude_domain: Get
  "https://raw.githubusercontent.com/chinahhy/clash-rules/main/rules/singbox/claude_domain.srs":
  dial tcp 185.199.110.133:443: i/o timeout
```

`default_http_client: 直连下载`（detour = 直连），所以规则集是**直连**去拉 raw.githubusercontent.com，国内必超时。

修复后用 `/connections` 实测确认：

```
claude.ai -> rule=rule_set=claude_domain  => route(👒 ClaudeCode)
poe.com   -> rule=rule_set=ai_other_domain => route(🤖 AI其它)
```

## 5. 修改的文件

| 文件 | 改动 |
|---|---|
| `config/substore/singbox/linux.json` | 日本组 `interval` 300s；7 个 urltest 组 `tolerance` 100；两处规则集 `url` 加 `gh-proxy.com`；`fakeipfilter` 指向本仓库 |
| `config/substore/singbox/template.js` | 日本组过滤正则排除「尼日利亚」 |
| `rules/singbox/fakeipfilter-cn.json` | 新增，DNS 层例外名单（NTP / 联通性检测） |
| `rules/singbox/fakeipfilter-!cn.json` | 新增，DNS 层例外名单（STUN / 强制门户检测） |

提交：

```
41f4a34 tune(singbox): set tolerance 100 for all urltest groups
200a77e fix(template): exclude Nigeria nodes from Japan group
3f680c4 fix(singbox): add gh-proxy prefix to rule-set URLs
9a91553 Update linux.json
```

## 6. 验证清单

重载后确认：

- [ ] `/etc/momo/run/config.json` 里 `tolerance: 20` 计数为 0
- [ ] `🇯🇵 日本节点` 成员数 = 17（不含尼日利亚）
- [ ] 日本组 `"interval": "5m0s"`
- [ ] 规则集 `url` 均带 `gh-proxy.com`
- [ ] `claude.ai` / `poe.com` 能命中各自规则集
- [ ] chatgpt.com 连续 20 次请求 0 失败

## 7. 运维注意事项

### 7.1 Sub-Store 缓存（最容易踩）

Sub-Store 会缓存 `linux.json` 和 `template.js`（gh-proxy 的 CDN 也会缓存）。
**每次改完这两个文件，必须把引用链接的 `?v=` 加 1**，否则生成结果不变。

```
https://gh-proxy.com/https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/linux.json?v=3
https://gh-proxy.com/https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/template.js?v=2
```

判断方法：打开订阅地址，搜 `"interval": "60s"`，如果还能搜到就是缓存没刷新。

### 7.2 规则集必须走 gh-proxy

`route.default_http_client` 是 `直连下载`（detour = 直连），raw.githubusercontent.com 在国内直连不通。
所有 `rule_set.url` 都必须带 `https://gh-proxy.com/` 前缀，包括自己仓库的。

### 7.3 分组过滤正则要小心单字

`template.js` 里地区组的过滤用了 `ℹ️` 前缀（不区分大小写），单字匹配很容易误伤：

- `日` 会匹配 `尼日利亚`
- `美` 会匹配 `美国`，但也可能匹配别的词
- `英` 同理

新增地区时建议用完整词（`日本`、`japan`、`jp`）并加排除项。

### 7.4 selector 状态

sing-box 1.14 的 selector 选择在重载后会保留（实测 `🫆 ChatGPT` 仍是台湾节点）。
但**重新生成订阅并重建配置**时不一定保留，切换过的组建议记一下。

### 7.5 客户端侧

- Windows 不要同时开有线 + WiFi 并都带默认网关，fake-ip 场景下 WiFi 那条路是黑洞
- 系统代理 `10.0.0.2:7893` 曾经被写进注册表，但 7893 并未监听，属于残留，建议清掉
- IPv6 建议在客户端关闭，避免 AAAA 绕过 fake-ip 直连

## 8. 常用命令

```sh
# 路由器上
ps w | grep sing-box
tail -50 /var/log/momo/core.log
grep -iE 'ERROR' /var/log/momo/core.log | tail -20
curl -s -H 'Authorization: Bearer <secret>' http://127.0.0.1:9095/proxies
curl -s -H 'Authorization: Bearer <secret>' http://127.0.0.1:9095/connections
```

```powershell
# Windows 上
ssh -p 20221 root@10.0.0.2
nslookup chatgpt.com                       # 应返回 198.19.x.x（fake-ip）
route print -4 | Select-String "0.0.0.0"   # 只应有一个默认网关
```
