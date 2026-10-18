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

---

## 9. 2026-10-18 22:15 网页图片大面积加载失败（fake-ip 映射丢失）

### 9.1 症状

- 网页正文能打开，但图片/静态资源大量裂图、转圈
- 与节点质量无关：同时刻从路由器 `curl -x 127.0.0.1:6666` 拉 google/hdslb 图片均 200

### 9.2 根因（两个叠加）

1. `experimental.cache_file` 只开了 `store_dns: true`，**没开 `store_fakeip`**
   → DNS 缓存（含 fake-ip 的 A 记录）跨重启保留，但「fake-ip → 域名」反向映射只存在内存里，重启即丢。
2. 22:01 因改配置重启 sing-box，此前的 fake-ip 记录全成「无主地址」。

证据（sing-box 自己的报错）：

```
ERROR router: missing fakeip record, try enable `experimental.cache_file`
ERROR connection: open connection to 198.19.1.177:443 ...: i/o timeout
ERROR connection: open connection to 198.18.0.84:443 using outbound/direct[直连]: i/o timeout
```

20 分钟内累计 300+ 次发往 198.18.0.x / 198.19.1.x 的连接超时。
198.18.0.0/16 是**上一版** fake-ip 段（现为 198.19.0.0/16），客户端旧缓存里的地址同样无映射。

### 9.3 修复

```sh
# 1. /etc/momo/run/config.json 的 experimental.cache_file 增加 store_fakeip
"cache_file": { "enabled": true, "path": "/etc/sing-box/cache.db",
                "store_dns": true, "store_fakeip": true }

# 2. 丢掉已被污染的缓存
mv /etc/sing-box/cache.db /etc/sing-box/cache.db.poisoned

# 3. 只重启内核（procd 自动拉起，不会重新拉订阅覆盖配置）
kill $(cat /var/run/momo/momo.pid)
```

客户端侧：`ipconfig /flushdns` + 重启浏览器；iPhone 关一次 Wi-Fi 再开。

### 9.4 注意事项

- 只能 `kill` 内核进程重启；`/etc/init.d/momo restart` 在 `prefer=remote` 时会重新拉订阅并覆盖 `run/config.json` 的手改。
- 改 fake-ip 段（198.18 → 198.19）等于让全网旧缓存全部作废，**非必要不要换段**。
- 长期修复必须写回 `config/substore/singbox/linux.json`，否则下次 momo 重启后手改丢失、故障复现。

---

## 10. 2026-10-18 22:40 DNS 出站与 Proxy 解耦（台湾节点抖动 → DNS 全断）

### 10.1 病因

`dns.servers.google`（8.8.8.8 DoH）的 `detour` 是 `默认代理` → `🫎 Proxy`，而 `🫎 Proxy` 没写 `default`，
sing-box 默认选**成员列表第一个 = `🇹🇼 台湾节点`**。所以：

```
DNS(8.8.8.8) → 默认代理 → 🫎 Proxy → 🇹🇼 台湾节点(urltest)
```

`[SCNET] 🇹🇼 台湾 09`（`twszgbkfgybwzggcdwsqqnbqw.jiedddym.com` → `1.165.2.48`，HiNet）在 14:03–14:10 抖动，
而 urltest 要等下一轮（5m）才换节点，期间所有走 google 的 DNS 全部超时：

```
ERROR [2386119206 7.29s] dns: exchange failed for getsharex.com. IN A: dial tcp 1.165.2.48:443: i/o timeout
```

表现：**正文能开、图片裂**（图片域名要现场解析，DNS 卡在台湾组；正文走 `♻️ 自动选择` 有 130 个节点兜底）。

### 10.2 改动

| 项 | 改前 | 改后 |
|---|---|---|
| DNS 出站 | `默认代理`（→ Proxy → 台湾） | 新增 `DNS出站` selector，成员 香港/日本/狮城/自动选择，`default: 🇭🇰 香港节点` |
| `🫎 Proxy` 默认 | 无（= 数组第一个 台湾） | `"default": "♻️ 自动选择"` |
| `🇹🇼 台湾节点` interval | 5m | 2m |
| `🇭🇰 香港节点` interval | 5m | 2m（DNS 现在骑在它上面，必须更快收敛） |

其余地区组保持 5m：探测开销 = 成员数 × 频率，全改 2m 会让 175 个节点探测频率翻 2.5 倍，而收益只是
“不用手动切的组更快发现死节点”。

### 10.3 验证

```
GET /proxies/DNS出站  → now = 🇭🇰 香港节点
GET /proxies/🫎 Proxy   → now = ♻️ 自动选择
日志：outbound/anytls[[SCNET] 🇭🇰 香港 07]: outbound connection to 8.8.8.8:443
重启后 ERROR：0（只剩 3 条旧的 “did not closed properly” 与客户端残留 198.18 旧地址）
```

### 10.4 回滚

```sh
cp -f /etc/momo/run/config.json.bak.before_dnsout /etc/momo/run/config.json
kill $(cat /var/run/momo/momo.pid)
```
