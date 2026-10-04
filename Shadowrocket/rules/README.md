# wrt1 规则兼容快照

来源：[MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat/tree/meta)。本目录是 2026-10-04 根据 wrt1 当前配置引用的公开文本源生成的快照，包含 33 个文件、164453 个条目；不包含节点、订阅或路由器凭据。

转换保持条目语义与原顺序：

- geosite `+.example.com` → Shadowrocket 域名集 `.example.com`，同时匹配根域名和子域名；精确域名不变。
- geoip IPv4 / IPv6 CIDR → `IP-CIDR` / `IP-CIDR6` 规则。
- 每个文件头记录公开源地址、原文 SHA256、条目数及引用类型；主配置使用 `DOMAIN-SET` 或 `RULE-SET` 与之对应。

域名集避免为每个域名重复存储规则类型；全部文件约 2.57 MB。规则按来源配置的优先顺序引用，不把 Clash `.mrs` 二进制直接交给 Shadowrocket。

这些兼容文件随配置更新提交一起发布，不会自行追踪 MetaCubeX 日更。以后按 wrt1 新配置同步时，应重新生成并同时提交；已有的 PT、Direct、Proxy、Docker 等自定义列表仍在线更新。规则内容与上游缓存是否恰好同一版本需另行核对，本版读取的是生成时最新公开文本。
