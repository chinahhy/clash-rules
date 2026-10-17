#!/bin/sh
# ImmortalWrt/OpenWrt; run as root. The private URL lives only in substore.curl.
set -eu
umask 077
cfg_dir=/etc/sing-box
url_file="$cfg_dir/substore.curl"
config_file="$cfg_dir/config.json"
backup_file="$cfg_dir/config.json.bak"
if [ ! -r "$url_file" ]; then
  echo '请先在 /etc/sing-box/substore.curl 保存 Sub-Store 文件的私有下载 URL。' >&2
  exit 1
fi
stage_dir=$(mktemp -d "$cfg_dir/.substore-update.XXXXXX")
cleanup() {
  rm -f "$stage_dir/config.json" "$stage_dir/download.log" "$stage_dir/check.log"
  rmdir "$stage_dir"
}
trap cleanup EXIT HUP INT TERM
fail() {
  logger -t sing-box-update "$1"
  echo "$1" >&2
  exit 1
}
if ! curl --fail --silent --show-error --location --proto '=http,https' \
  --connect-timeout 15 --max-time 180 --config "$url_file" \
  --output "$stage_dir/config.json" 2>"$stage_dir/download.log"; then
  fail 'Sub-Store 下载失败，保留现有配置。'
fi
if grep -q '__SET_PRIVATE_API_SECRET__' "$stage_dir/config.json"; then
  fail '下载的是未处理模板，请复制 Sub-Store 文件下载链接并设置私有 secret。'
fi
if ! sing-box check -c "$stage_dir/config.json" >"$stage_dir/check.log" 2>&1; then
  fail '目标核心校验失败，保留现有配置；请在私有环境排查新配置。'
fi
had_backup=0
if [ -f "$config_file" ]; then
  cp -p "$config_file" "$backup_file"
  chmod 600 "$backup_file"
  had_backup=1
fi
chmod 600 "$stage_dir/config.json"
mv "$stage_dir/config.json" "$config_file"
if ! /etc/init.d/sing-box restart; then
  if [ "$had_backup" = 1 ]; then
    cp -p "$backup_file" "$config_file"
    /etc/init.d/sing-box restart || true
  fi
  fail '服务重启返回失败；存在旧配置时已恢复。请查看路由器日志。'
fi
logger -t sing-box-update '配置更新并请求重启；请核查进程、日志和实际流量。'
echo '配置更新并请求重启。重启命令成功不代表 DNS、TUN 和网络实测已通过。'
