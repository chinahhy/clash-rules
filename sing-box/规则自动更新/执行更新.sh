#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo '请通过 GitHub Actions 运行此脚本。' >&2
  exit 1
fi
cd "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"

curl -fL --retry 3 -o "$RUNNER_TEMP/sing-box.tar.gz" https://github.com/SagerNet/sing-box/releases/download/v1.14.3/sing-box-1.14.3-linux-amd64.tar.gz
printf 'e2bdf179c15a3652955dc44867e33ca0965c9c9b91b34267dcc5a5d639a5feee  %s\n' "$RUNNER_TEMP/sing-box.tar.gz" | sha256sum --check --status
tar -xzf "$RUNNER_TEMP/sing-box.tar.gz" -C "$RUNNER_TEMP" sing-box-1.14.3-linux-amd64/sing-box
curl -fL --retry 3 -o "$RUNNER_TEMP/mihomo.gz" https://github.com/MetaCubeX/mihomo/releases/download/v1.19.32/mihomo-linux-amd64-compatible-v1.19.32.gz
printf 'ba3ce607747a07f948fc35780e108a4a7c7f552a38b9bd4d115f313ebcb89c20  %s\n' "$RUNNER_TEMP/mihomo.gz" | sha256sum --check --status
gzip -dc "$RUNNER_TEMP/mihomo.gz" > "$RUNNER_TEMP/mihomo"
chmod +x "$RUNNER_TEMP/sing-box-1.14.3-linux-amd64/sing-box" "$RUNNER_TEMP/mihomo"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
for attempt in 1 2 3; do
  # A concurrent source edit must be rebuilt, never overwritten or rebased blindly.
  git fetch origin main
  git reset --hard origin/main
  options=()
  # An empty rules directory needs all upstream rule sets on the first build.
  if [[ "$REFRESH_UPSTREAM" == 'true' ]] || ! compgen -G 'sing-box/rules/*.srs' > /dev/null; then
    options+=(--upstream)
  fi
  python3 "sing-box/规则自动更新/生成规则.py" \
    --output sing-box/rules \
    --sing-box "$RUNNER_TEMP/sing-box-1.14.3-linux-amd64/sing-box" \
    --mihomo "$RUNNER_TEMP/mihomo" "${options[@]}"
  python3 "sing-box/规则自动更新/检查配置.py"
  git add -- sing-box/rules/*.srs
  if git diff --cached --quiet; then exit 0; fi
  git commit -m 'chore: update sing-box rule sets'
  if git push origin HEAD:main; then exit 0; fi
  sleep 2
done
echo 'Could not publish after three attempts; no force push was used.' >&2
exit 1
