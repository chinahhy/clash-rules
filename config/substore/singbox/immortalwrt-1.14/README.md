# Hoya · ImmortalWrt 裸核 sing-box 1.14

以用户提供的 `openclash-config.yaml` 迁移个人规则与策略组，基于用户确认的七尺宇当前 Linux 模板。**保留教程核心，尚未在真实路由器启动验证。** 原仓库文件均保留；本目录已发布到 main 分支。

## 使用范围与优先级

参考模板固定在 [qichiyuhub/rule · 9477bb6](https://github.com/qichiyuhub/rule/blob/9477bb620036e183e09d53c017a9c196d6f7f8ba/config/singbox/1.14X/linux.json)。保留其 DNS、双栈 TUN 地址、auto_route、auto_redirect、国内/私网 IP 提前 bypass、嗅探、DNS 劫持、853/QUIC/STUN 拒绝、ICMP、Direct/Global 模式、下载 HTTP client、缓存与面板等核心逻辑。mixed 端口按用户要求改为 **7893**。

个人策略层包含原 YAML 的 **41 个组、42 个 RULE-SET 与最后 MATCH，共 43 条规则**。规则顺序及策略去向逐项记录于 [rule-order.json](rule-order.json)。日本/台湾/香港/狮城/美国/英国六组均保留为测速组；日本 60 秒，其余地区与自动选择 300 秒，tolerance=20，测速 URL 与原文件相同。原 selector 的候选顺序不变；日本排除项 `日本-中转 02` 不变。增加的“默认代理”仅转入 `🫎 Proxy`，供教程的 Google DNS 使用；GLOBAL 用于教程全局模式。

**提前 bypass 及教程前置规则的优先级高于个人规则表。** 因此某个域名即使属于个人代理规则，连接到大陆/私网 IP 时也可能提前直连；QUIC/STUN/853 拒绝同样先执行。这是按用户后续明确要求保留的教程行为，不能将它描述为与 Mihomo 全部运行行为完全一致。

DNS 按用户最新要求保留教程原值：国内 Ali/Tencent DoH、境外 Google DoH 经“默认代理”、FakeIP `198.19.0.0/16`、`strategy: ipv4_only`。**没有移植 YAML 的运营商 DNS、28/8 FakeIP 或 1053 监听。** TUN 仍有 IPv4 与 IPv6 地址；`ipv4_only` 是 DNS 策略，并不关闭 ImmortalWrt 系统 IPv6，也不阻断所有 IPv6 字面地址流量。需要完整禁用 IPv6 时，应另行调整系统与模板，不能声称本版已经实现。

Mihomo `no-resolve` 的五处规则之前不主动插入解析；最后 `cn_ip` 前保留教程 mixed-in resolve，并补一条通用 resolve 供剩余域名匹配中国 IP。Mihomo 的 `lazy`、`max-failed-times`、`expected-status` 没有对应的 sing-box urltest 字段，未捏造等价配置；测速内部机制可能不同。

## Sub-Store：组合订阅自动注入

1. 在你自己的 Sub-Store **订阅管理**中添加/更新原机场订阅。订阅 URL、token、节点密码仅保存在私有 Sub-Store。多个机场建议各自加不同名称前缀，保留地区关键词。
2. 新建**组合订阅**，内部名称设为 `singbox`，选择上述子订阅。不要用未转换的机场订阅直接替代最终配置文件。
3. 在**文件管理**中新建文件，例如 `hoya-singbox-immortalwrt`；选择**远程文件**，URL 填入：

   ```text
   https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/immortalwrt-1.14/template.json
   ```

4. 在这个文件上添加**脚本操作 / Script Operator**，选择链接，填入：

   ```text
   https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/immortalwrt-1.14/inject.js
   ```

5. 使用脚本的可视化参数编辑，设置 `name=singbox`、`secret=你自己的至少12位面板口令`。口令仅存在 Sub-Store 私有参数中，不要填进 GitHub 文件、公开脚本 URL 或本仓库。它会同时填入教程原生 API 与 Clash API 的 secret。组合订阅名称不同则相应修改 name。
6. 保存并预览生成文件，确认六地区组内都有实际节点。原始筛选正则按 YAML 保留：只有旗帜而没有中文/英文地区关键词的节点不一定会匹配。无英国等任一必需地区时生成会报错，应补齐该地区节点或明确修改分组与引用；不会偷偷转成直连。
7. 复制**此文件的下载/分享链接**给路由器使用。不要复制组合订阅的“仅节点”链接，也不要把生成的完整配置上传到公开 GitHub。预览中的节点地址和凭证属于私有信息。

每次请求这个生成文件，脚本会通过 `produceArtifact({type:'collection', name, platform:'sing-box'})` 取得组合订阅当前导出结果，再注入策略组；实际机场刷新频率还受 Sub-Store 的订阅缓存、子订阅更新与文件缓存设置影响。修改机场后先在 Sub-Store 更新子订阅和文件再验证；路由器定时拉取最终文件实现自动更新。文件预览/下载与定时任务仍需在用户自己的 Sub-Store 实例实测。

已核查 [xream 原模板脚本](https://github.com/xream/scripts/blob/fb62d1d8f23774bb34d4487a2141c9c470466096/surge/modules/sub-store-scripts/sing-box/template.js)：支持组合订阅、outbounds/endpoints 与组正则注入，但空组会补 `COMPATIBLE(direct)`，且当前实现打印导出数据。本目录使用独立 `inject.js`，沿用其导出契约，保留原 YAML 的正则及排除项，拒绝空组和名称冲突，不记录节点对象或密钥。不要再叠加运行 xream 原脚本，以免重复插入。

## 路由器部署与自动更新

先按[教程](https://www.qichiyu.com/1124.html)安装**官方 sing-box 1.14.3**。本版不使用 Fork 专有 providers 字段。先备份现有配置及 DHCP/DNS 设置；切换时停用 OpenClash、Momo 等其他代理核心及其流量接管，避免端口和路由冲突。本次没有连接或修改你的路由器。

将本目录 `update-config.sh` 上传到 `/etc/sing-box/update-config.sh`。在路由器本机编辑 `/etc/sing-box/substore.curl`，内容如下，替换为第 7 步复制的私有文件链接：

```text
url = "你的Sub-Store私有文件下载链接"
```

在路由器执行：

```sh
chmod 600 /etc/sing-box/substore.curl
chmod 700 /etc/sing-box/update-config.sh
sing-box version
uci set sing-box.main.enabled=1
uci commit sing-box
sh /etc/sing-box/update-config.sh
logread -e sing-box
```

脚本先下载到本目录的私有临时文件，目标核心 `sing-box check` 通过后才替换配置，旧配置保存为 `config.json.bak`。重启命令返回失败时会尝试恢复备份；procd 接受重启请求不等于进程已健康运行，启动异常仍须查看日志并手动回退。文件下载失败或校验失败不覆盖旧配置。脚本不打印私有 URL 和配置校验原文。

OpenWrt 本机接口上的 53 端口（如 dnsmasq 接收的 LAN DNS）不能仅凭 TUN 劫持就认定已接管。核查 dnsmasq 实际上游，不要继续指向旧 OpenClash 的 1053；教程 TUN 未指定 dns_address 时默认 DNS 为 `172.19.0.2`，可在路由器本机验证通向此地址的 DNS 路径，再按自己的 LAN/DHCP 配置调整转发。[官方 TUN DNS 文档](https://sing-box.sagernet.org/configuration/inbound/tun/#dns_mode)说明了此限制。本版没有修改你的 dnsmasq。

本机、LAN 客户端分别实测：DNS 查询、国内直连、GitHub/AI 的出口、英国 GiffGaff、日本排除项、QUIC/STUN 拒绝、IPv6 行为与重启后的防火墙规则。Clash API 仍为教程的 9095，原生 API 为 9090，mixed 为 7893；面板口令为上述私有 secret。教程的监听地址与面板下载方式没有改动。

实测通过后再启用自启：

```sh
/etc/init.d/sing-box enable
```

如需每天 4 点更新，在路由器计划任务中**只添加一次**：

```cron
0 4 * * * sh /etc/sing-box/update-config.sh >/dev/null 2>&1
```

保存后重启 cron。时区使用路由器系统时区；脚本状态可从 `logread -e sing-box-update` 查看。手动更新不要与计划任务同时执行；脚本没有并发更新锁。回退可将 `config.json.bak` 复制为 `config.json` 后重启服务。

## 规则来源与后续更新

42 个规则集全部为真实转换结果，合计读取 **165324 条源记录**（包含跨集合重叠，不能当作唯一域名数量）：

- 33 个 MRS：固定 [MetaCubeX/meta-rules-dat · 48fce8a](https://github.com/MetaCubeX/meta-rules-dat/tree/48fce8a7df81e254ee1dc8b64d2d34f840208849/geo)，用官方 Mihomo v1.19.32 解码为文本，再用官方 sing-box 1.14.3 编译成 SRS。**没有将 .mrs 改扩展名，也没有假定同名 SRS 内容相同。**
- 9 个个人 LIST：PT、Direct、Docker、Proxy、Claude、Grok、AI-other、giffgaff、byte-muse，读取仓库原文件，支持本次实际出现的 DOMAIN、DOMAIN-SUFFIX、IP-CIDR。遇到未知规则类型/修饰符即失败，不默默丢弃。
- 每组同时保留可审阅 JSON 与编译 SRS；[rule-sources.json](rule-sources.json) 记录来源，[rule-lock.json](rule-lock.json) 记录输入与输出 SHA256、源记录数。规则是此时刻的快照，不冒称上传 YAML 当时的 MRS 缓存内容。
- 教程 DNS 与核心所需的另外 25 个规则集保持原远程 URL，包括 gh-proxy 路径；已实际下载并经官方核心读取。它们会随上游更新，未冻结为个人规则快照。

模板以 main 分支 URL 下载个人 SRS。以后如需改分支名称，须同步修改 `template.json` 中 42 个规则 URL 及 Sub-Store 文件/脚本 URL。个人根目录 LIST 后续改变不会自动改写本目录快照；需要重新运行转换工具并提交新规则文件，路由器才会获取新快照。

转换工具仅使用 Python 标准库；自行下载并核对两款官方核心后运行（占位路径需替换）：

```sh
python tools/build_rules.py --sing-box /path/to/sing-box --mihomo /path/to/mihomo --cache /private/scratch/rule-downloads
```

MRS 固定提交不变时会核对已有输入哈希。LIST 输入哈希按 Git 文本的 LF 换行标准化，避免 Windows 检出换行造成差异。主动更新 MetaCubeX 快照时需更改 manifest 固定提交并审阅 lock 变化；不要将缓存目录或真实导出配置放进仓库。

## 已完成验证与未完成项

详见 [validation.json](validation.json)。已完成：官方 1.14.3 Schema、42 组编译/反编译、43 条顺序映射、41 组及引用无环、模板核心逐项相等、模拟六地区注入及失败路径、保留的 25 个远程规则下载读取、Windows 用户态 `sing-box check`。

**未完成：真实 Sub-Store 实例导出、真实节点协议兼容性和连通性、ImmortalWrt/Linux 完整配置 check 与启动、TUN/fw4/dnsmasq/LAN/IPv6 实测、定时更新实测。** Windows 官方核心对完整配置报 `auto_redirect is only supported on Linux`，这是平台限制；未为通过本机检查而修改交付配置。没有声明路由器已部署或运行通过。

可重复的离线注入测试：

```sh
node tools/test_injection.cjs /private/scratch/rendered-fixture.json
sing-box schema -o /private/scratch/schema.json
# validate.py 另需 jsonschema 库；reference 是上述固定版本的教程 Linux 模板。
python tools/validate.py --schema /private/scratch/schema.json --reference /private/scratch/linux.json --rendered /private/scratch/rendered-fixture.json --sing-box /path/to/sing-box --scratch /private/scratch/check
# 更新脚本控制流程测试使用替身，不访问路由器或真实订阅。
python tools/test_update.py --scratch /private/scratch/update-tests --shell /bin/sh --node /path/to/node
```

当前在线文档可能领先至 1.15，实际 Schema 以官方 1.14.3 二进制 `sing-box schema` 生成为准。[官方 Schema 说明](https://github.com/SagerNet/sing-box/blob/v1.14.3/docs/configuration/schema.md)、[官方 1.14.3 TUN 文档](https://github.com/SagerNet/sing-box/blob/v1.14.3/docs/configuration/inbound/tun.md)、[官方路由动作](https://github.com/SagerNet/sing-box/blob/v1.14.3/docs/configuration/route/rule_action.md)。
