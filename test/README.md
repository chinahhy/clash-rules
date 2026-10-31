# Tests

## Relocated test templates

`config/test.json` and `config/test.js` were moved from `sing-box/config/` without changing configuration or script behavior. Their raw URLs are now:

- https://raw.githubusercontent.com/chinahhy/clash-rules/main/test/config/test.json
- https://raw.githubusercontent.com/chinahhy/clash-rules/main/test/config/test.js

Update any Sub-Store references to the old URLs manually. These are existing test templates, **not** the isolated configuration below: `test.json` retains its original TUN, listeners, API and rule sources. Moving files does not deploy or refresh any device configuration.

## Isolated test

Baseline: chinahhy/clash-rules main commit ebf23c49f7654c59f041d778f6a886430e3bc379. Config is derived from sing-box/config/linux.json and template.js; rules are copied from the same commit. Automatic selection accepts the same six regions without the numeric suffix constraint. Other routing remains unchanged. The API service and Clash API were removed, including their existing secrets; Clash API interactions are unavailable. TUN is removed, mixed listens only on 127.0.0.1:16666, and persistent cache is disabled. This is not equivalent to production: the bypass action is retained but auto_redirect is absent, so its behavior and compatibility must be checked with the actual sing-box version. This is not a transparent gateway test. Recheck port availability immediately before starting and prepare a rollback plan.

Own rule URLs temporarily target main/test/rules and do not exist until uploaded; main is mutable. Pin and verify a commit before actual testing. Third-party rules still follow their original upstreams and are not isolated snapshots. Keep subscriptions and credentials out of this repository. Not deployed to any device.

Run `node test/config/check-template.cjs` from the repository root to execute offline tests with fictional direct nodes; use `--emit` to print a generated JSON config for further checks. The emitted config contains fictional direct outbounds, not real proxy nodes, and cannot establish actual node connectivity.
