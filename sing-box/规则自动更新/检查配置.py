"""Check canonical sing-box templates and their repository rule references."""

import json
from pathlib import Path
from urllib.parse import unquote


def validate(repo):
    prefix = "raw.githubusercontent.com/chinahhy/clash-rules/main/"
    configs = sorted((repo / "sing-box/config").glob("*.json"))
    if not configs:
        raise ValueError("No sing-box configuration templates found")
    checked = 0
    for config in configs:
        data = json.loads(config.read_text(encoding="utf-8-sig"))
        for ruleset in data.get("route", {}).get("rule_set", []):
            url = ruleset.get("url", "")
            if prefix not in url:
                continue
            tags = ruleset["tag"]
            if isinstance(tags, str):
                tags = [tags]
            for tag in tags:
                resolved = url.replace("{tag}", tag)
                relative = unquote(resolved.split(prefix, 1)[1].split("?", 1)[0].split("#", 1)[0])
                if not relative.startswith("sing-box/rules/") or ".." in Path(relative).parts:
                    raise ValueError(f"{config.name}: rule URL uses a noncanonical path")
                target = repo / relative
                if not target.is_file():
                    raise ValueError(f"{config.name}: missing rule file {relative}")
                if ruleset.get("format") == "source":
                    json.loads(target.read_text(encoding="utf-8-sig"))
                checked += 1
    print(f"Validated {len(configs)} configs and {checked} repository rule references")
    return len(configs), checked


if __name__ == "__main__":
    validate(Path(__file__).resolve().parents[2])
