# sing-box

- [linux.json](linux.json)：ImmortalWrt 裸核配置，mixed 端口 7893。
- [substore.js](substore.js)：组合订阅节点注入脚本。
- [iphone.json](iphone.json)：原有 iPhone 配置。

在 Sub-Store 新建组合订阅，名称设为 `singbox`。

文件管理 → 新建远程文件，填写模板地址：

```text
https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/linux.json
```

添加脚本操作，填写脚本地址：

```text
https://raw.githubusercontent.com/chinahhy/clash-rules/main/config/substore/singbox/substore.js
```

脚本私有参数设置 `name=singbox`、`secret=至少12位的面板口令`。预览确认六地区节点后，复制生成文件的下载链接给路由器；不要直接使用未经注入的模板。

规则由配置自动读取仓库 `rules/singbox/`。更新过旧模板的用户请在 Sub-Store 刷新一次远程文件。

保留教程的 DNS/TUN、国内 IP 提前绕过和 QUIC/STUN 阻断。已通过官方 1.14.3 Schema 和离线检查，真实 Sub-Store 与 ImmortalWrt 运行仍需实测。
