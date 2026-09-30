# Hoya 自用规则

## Shadowrocket 使用约定

- `Shadowrocket/hoya.conf` 不包含节点凭证、MITM CA 或 CA 口令；配置通过 `update-url` 从本仓库 main 分支远程更新。
- `Hoya Amap Clean` 只保留 `Shadowrocket/modules/Hoya-Amap-Clean.sgmodule`；旧版 v1.2 文件仅作为禁用占位，不能与新版同时启用。
- 高德模块会追加有限的 `amap.com` MITM 主机名；使用前必须在 Shadowrocket 中单独确认并信任本机 CA。
- `Hoya-AdBlock-Plus` 和 `Hoya-Privacy` 都是可选增强模块，和主配置的拦截规则叠加，出现登录、推送或统计异常时先关闭模块定位。
- `Hoya-Network-Debug` 只在排查出口和 DNS 时启用，测试结束后关闭。
- 修改规则后先在 Shadowrocket 的“测试规则”中核对策略，再做真实连接测试；不要把导出的配置文件直接提交到仓库。
