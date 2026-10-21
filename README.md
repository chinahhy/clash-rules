# Hoya 自用规则

自用的 Mihomo、sing-box、Shadowrocket 配置和分流规则。配置按个人环境维护，使用前请检查节点订阅、网卡、端口和 DNS 设置。

## 目录

```text
.
├── .github/workflows/      # GitHub 自动任务入口
├── mihomo/
│   ├── config/            # Mihomo 配置和覆写模板
│   └── rules/             # 自用 .list 规则
├── sing-box/
│   ├── config/            # Sub-Store 基础配置和节点脚本
│   ├── rules/             # 自动生成的 .srs 和 DNS 规则 JSON
│   └── 规则自动更新/       # 生成、检查和发布规则的程序
└── Shadowrocket/
    ├── hoya.conf          # Shadowrocket 主配置
    ├── modules/           # 可选模块
    ├── rules/             # 兼容规则快照
    └── scripts/           # 模块脚本
```

`.github/workflows` 是 GitHub 识别自动任务的固定入口，需要保留在仓库根目录；实际更新程序放在 [sing-box/规则自动更新](sing-box/规则自动更新/)。

## Mihomo

配置位于 [mihomo/config](mihomo/config/)，自用规则位于 [mihomo/rules](mihomo/rules/)。

| 配置 | 用途 |
| --- | --- |
| [overwrite.yaml](mihomo/config/overwrite.yaml) | 覆写模板，不含节点和订阅配置 |
| [smart--template.yaml](mihomo/config/smart--template.yaml) | 配置模板，按个人环境调整后使用 |
| [star-noleak.yaml](mihomo/config/star-noleak.yaml) | 包含 DNS、TUN 等设置的配置 |

## sing-box

### 基础配置

[sing-box/config](sing-box/config/) 中的 JSON 是用于 Sub-Store 的基础模板，需要搭配节点脚本生成配置；节点订阅在 Sub-Store 中单独维护。

| 配置 | 用途 | 原始文件 |
| --- | --- | --- |
| [iphone.json](sing-box/config/iphone.json) | iPhone 基础模板 | [原始地址](https://raw.githubusercontent.com/chinahhy/clash-rules/main/sing-box/config/iphone.json) |
| [linux.json](sing-box/config/linux.json) | Linux 基础模板 | [原始地址](https://raw.githubusercontent.com/chinahhy/clash-rules/main/sing-box/config/linux.json) |
| [windows.json](sing-box/config/windows.json) | Windows 基础模板 | [原始地址](https://raw.githubusercontent.com/chinahhy/clash-rules/main/sing-box/config/windows.json) |
| [test.json](sing-box/config/test.json) | 测试基础模板 | [原始地址](https://raw.githubusercontent.com/chinahhy/clash-rules/main/sing-box/config/test.json) |

Windows 模板面向 sing-box 1.14，TUN 需要管理员权限。启用严格路由和 DNS 劫持，并通过 `mixed` 入站设置系统代理；代理端口 `127.0.0.1:6666`、面板 `127.0.0.1:9090` 仅供本机访问。API 密钥占位符须在自己的配置中替换，勿将真实密钥提交到仓库。

### 节点脚本

| 脚本 | 用途 |
| --- | --- |
| [template-default.js](sing-box/config/template-default.js) | 默认脚本，读取组合订阅 `singbox` |
| [template.js](sing-box/config/template.js) | 区域节点筛选版本，“自动选择”只收各地区 01、02、03 节点 |
| [template2.js](sing-box/config/template2.js) | 默认读取组合订阅 `singbox2`，包含面向 sing-box 1.14 的节点兼容处理 |
| [test.js](sing-box/config/test.js) | 测试脚本，用于验证节点处理逻辑 |

脚本的原始地址位于各文件开头的“Sub-Store 脚本操作链接”。组合订阅名称需要与自己的 Sub-Store 配置一致。

修改基础配置或脚本后，在 Sub-Store 中重新生成，再让客户端刷新配置并检查实际连接。仓库提交成功不代表设备已经使用新配置。

### 规则文件

[sing-box/rules](sing-box/rules/) 当前保存：

- 42 个 `.srs`：9 个自用规则集，以及 33 个来自 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) 的规则集。
- [fakeipfilter-cn.json](sing-box/rules/fakeipfilter-cn.json) 和 [fakeipfilter-!cn.json](sing-box/rules/fakeipfilter-!cn.json)：单独维护的 DNS 规则源文件。

自用规则修改对应的 `.list`，由自动任务生成 `.srs`：

| 规则源 | 生成文件 |
| --- | --- |
| [PT.list](mihomo/rules/PT.list) | [pt_domain.srs](sing-box/rules/pt_domain.srs) |
| [giffgaff.list](mihomo/rules/giffgaff.list) | [giffgaff_domain.srs](sing-box/rules/giffgaff_domain.srs) |
| [Direct.list](mihomo/rules/Direct.list) | [direct_domain.srs](sing-box/rules/direct_domain.srs) |
| [Docker.list](mihomo/rules/Docker.list) | [docker_domain.srs](sing-box/rules/docker_domain.srs) |
| [Proxy.list](mihomo/rules/Proxy.list) | [proxy_domain.srs](sing-box/rules/proxy_domain.srs) |
| [Claude.list](mihomo/rules/Claude.list) | [claude_domain.srs](sing-box/rules/claude_domain.srs) |
| [Grok.list](mihomo/rules/Grok.list) | [grok_domain.srs](sing-box/rules/grok_domain.srs) |
| [AI-other.list](mihomo/rules/AI-other.list) | [ai_other_domain.srs](sing-box/rules/ai_other_domain.srs) |
| [byte-muse.list](mihomo/rules/byte-muse.list) | [byte_domain.srs](sing-box/rules/byte_domain.srs) |

[Tem.list](mihomo/rules/Tem.list) 暂未加入自动编译映射，不会自动生成对应的 `.srs`。

### 自动更新

任务入口：[自动更新 sing-box 规则](https://github.com/chinahhy/clash-rules/actions/workflows/update-singbox-rules.yml)。

- 修改上表的 9 个 `.list`、sing-box 基础配置、DNS 规则 JSON 或更新程序后，自动执行检查和更新。
- 普通提交重建 9 个自用规则集；每天北京时间 10:47 定时全量刷新，也可在 Actions 页面点击 `Run workflow` 手动运行。
- 定时、手动运行以及 `.srs` 输出目录为空时，会同时刷新第三方规则。
- 编译后执行反编译校验，并检查基础配置引用的本仓库规则文件是否存在；全部通过后才提交生成结果。没有变化时不产生额外提交。

更新程序位于 [sing-box/规则自动更新](sing-box/规则自动更新/)：

| 文件 | 作用 |
| --- | --- |
| [生成规则.py](sing-box/规则自动更新/生成规则.py) | 读取自用规则、获取第三方规则、编译并校验 `.srs` |
| [检查配置.py](sing-box/规则自动更新/检查配置.py) | 检查基础配置和仓库规则引用 |
| [执行更新.sh](sing-box/规则自动更新/执行更新.sh) | 下载固定版本工具，执行生成、检查和提交 |

## Shadowrocket

主配置：[hoya.conf](Shadowrocket/hoya.conf) · [原始地址](https://raw.githubusercontent.com/chinahhy/clash-rules/main/Shadowrocket/hoya.conf)。

- 节点订阅由 Shadowrocket 单独维护。主配置不包含节点凭证、MITM CA 或 CA 口令。
- 配置通过 `update-url` 从本仓库 `main` 分支更新；手机中更新配置后，重新连接 VPN，全局路由保持“配置”。
- 自用规则文件位于 [mihomo/rules](mihomo/rules/)；第三方规则使用 [Shadowrocket/rules](Shadowrocket/rules/) 中的 33 个兼容文本快照，来源说明见 [规则目录 README](Shadowrocket/rules/README.md)。
- 修改后先使用“测试规则”核对策略，再做实际连接测试。

可选模块位于 [Shadowrocket/modules](Shadowrocket/modules/)：

- 高德清理使用 `Hoya-Amap-Clean.sgmodule`；旧版 v1.2 文件仅作为禁用占位，不要与新版同时启用。
- `Hoya-AdBlock-Plus`、`Hoya-Privacy` 按需启用，出现登录、推送或连接异常时先关闭模块定位。
- `Hoya-Network-Debug` 只在排查时启用，结束后关闭。
- 使用 MITM 模块前，在 Shadowrocket 中单独确认并信任本机 CA。

## 维护

- 自用规则以 `mihomo/rules/*.list` 为源文件，生成的 `.srs` 由自动任务更新；DNS 规则 JSON 单独维护。
- 配置和规则地址以本文链接及当前 `main` 分支为准。新增规则时同步调整生成映射、任务触发路径和配置引用。
- 回退时同时检查配置及其引用的规则，避免版本不一致。
- 不要提交含节点口令、订阅凭证或 MITM CA 的导出配置。
