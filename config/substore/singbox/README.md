# sing-box 配置

日常使用只看两个文件：

| 文件 | 用途 |
| --- | --- |
| [linux.json](linux.json) | ImmortalWrt 裸核配置模板，包含你的策略组和分流规则 |
| [substore.js](substore.js) | Sub-Store 注入组合订阅节点的脚本 |

原有 [iphone.json](iphone.json) 保留。

## Sub-Store 设置

1. 创建名为 `singbox` 的组合订阅，选择你的机场订阅。
2. 在文件管理新建远程文件，地址填写：

   ```text
   https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/linux.json
   ```

3. 添加脚本操作，地址填写：

   ```text
   https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/substore.js
   ```

4. 在脚本的私有参数中设置 `name=singbox` 和至少 12 位的 `secret` 面板口令。
5. 预览确认六个地区都有节点后，复制**生成文件的下载链接**给路由器。未经注入的模板不能直接使用。

## 其他内容不用手动操作

- `immortalwrt-1.14/rules/`：配置自动下载的 42 个 SRS 规则文件。
- [maintenance.zip](immortalwrt-1.14/maintenance.zip)：转换来源、校验记录、维护工具和详细部署说明，需要维护时才解压。
- `immortalwrt-1.14/template.json` 与 `inject.js`：保留旧链接，内容与新入口一致。

维护时将压缩包解压到 `immortalwrt-1.14/`，得到 `maintenance/`，再查看其中的 README。

教程的国内 IP 提前绕过、QUIC/STUN 阻断、DNS/TUN 核心行为保持不变，mixed 端口为 7893。已通过官方 1.14.3 Schema、规则转换和模拟节点注入检查；真实 Sub-Store 实例、ImmortalWrt 启动及网络行为仍需实测。
