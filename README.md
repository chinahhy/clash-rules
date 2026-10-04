# Hoya 自用规则

## Shadowrocket 使用约定

- `Shadowrocket/hoya.conf` 不包含节点凭证、MITM CA 或 CA 口令；配置通过 `update-url` 从本仓库 main 分支远程更新。
- `Hoya Amap Clean` 只保留 `Shadowrocket/modules/Hoya-Amap-Clean.sgmodule`；旧版 v1.2 文件仅作为禁用占位，不能与新版同时启用。
- 高德模块会追加有限的 `amap.com` MITM 主机名；使用前必须在 Shadowrocket 中单独确认并信任本机 CA。
- `Hoya-AdBlock-Plus` 和 `Hoya-Privacy` 都是可选增强模块；主配置不内置广告/HTTPDNS 拦截，出现登录、推送或连接异常时先关闭模块定位。
- `Hoya-Network-Debug` 只在排查出口和 DNS 时启用，测试结束后关闭。
- 修改规则后先在 Shadowrocket 的“测试规则”中核对策略，再做真实连接测试；不要把导出的配置文件直接提交到仓库。

## 2026-10-04：按 wrt1 当前配置适配

本版依据 wrt1 正在启用的 `star-SK2-SC.yaml`，并读取运行中的策略选择；此前的 `star8.yaml` 已不是当前配置。所有 wrt1 操作均为只读。

- ChatGPT 默认美国，Google / YouTube / GitHub / Slack / Docker 默认香港，Gemini / Netflix 默认日本，强制代理默认台湾；其余服务按本次 wrt1 实际选择设置。
- 仅保留“服务组 → 地区测速 → 节点”的结构；日本测速间隔 60 秒，其余地区 300 秒，测速 URL 与 wrt1 相同。筛选同时接受中英文及地区旗帜，排除“家里”、直连和订阅提示条目。
- wrt1 的运营商 DNS 不直接移植到移动网络；手机使用可独立连接的公共 DoH，单独指定节点域名 DNS。公共 IPv4 DNS 作为故障回退，回退时不提供加密。
- 抖音和高德继续明确 `DIRECT`；PT、Apple-CN、局域网和国内规则统一使用内置 `DIRECT`。QUIC 不再由主配置强制阻断。
- `Shadowrocket/rules/` 保存 wrt1 所用 33 个 MetaCubeX 规则源的兼容文本快照：域名使用 `DOMAIN-SET`，IP 使用 `RULE-SET`。43 条来源规则保持原顺序；9 个已有自定义规则继续引用本仓库原文件。

手机操作：打开当前 `hoya.conf` 的配置详情，点击“更新”，完成后重新连接 VPN。无需重新导入配置或添加模块。全局路由需保持“配置”。原节点订阅仍由 Shadowrocket 单独维护，此文件不会安装节点或包含订阅口令。

已验证规则映射、组引用、正则筛选及公共 DNS；iPhone 的实际订阅、网络链路与使用体验仍需更新后实测。回退以 Git 提交为准，同时回退 `hoya.conf` 与其引用的规则快照，保留 `update-url`。
