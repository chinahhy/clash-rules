"""Build sing-box rules from the existing personal LIST files and Mihomo providers.

Personal files are read from this checkout. --upstream also refreshes the original
third-party providers from one MetaCubeX commit. Only validated SRS files are saved.
Python 3.10+, standard library only; no subscriptions or configuration secrets.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


PERSONAL = {
    "pt_domain": "PT.list",
    "giffgaff_domain": "giffgaff.list",
    "direct_domain": "Direct.list",
    "docker_domain": "Docker.list",
    "proxy_domain": "Proxy.list",
    "claude_domain": "Claude.list",
    "grok_domain": "Grok.list",
    "ai_other_domain": "AI-other.list",
    "byte_domain": "byte-muse.list",
}

# Keep the provider mapping from the original OpenClash configuration.
UPSTREAM = {
    "slack_domain": ("domain", "slack"),
    "whatsapp_domain": ("domain", "whatsapp"),
    "chatgpt_domain": ("domain", "openai"),
    "gemini_domain": ("domain", "google-gemini"),
    "reddit_domain": ("domain", "reddit"),
    "discord_domain": ("domain", "discord"),
    "private_domain": ("domain", "private"),
    "youtube_domain": ("domain", "youtube"),
    "google_domain": ("domain", "google"),
    "google_ip": ("ipcidr", "google"),
    "twitter_domain": ("domain", "twitter"),
    "twitter_ip": ("ipcidr", "twitter"),
    "github_domain": ("domain", "github"),
    "telegram_domain": ("domain", "telegram"),
    "instagram_domain": ("domain", "instagram"),
    "telegram_ip": ("ipcidr", "telegram"),
    "netflix_ip": ("ipcidr", "netflix"),
    "steam_domain": ("domain", "steam"),
    "facebook_domain": ("domain", "facebook"),
    "netflix_domain": ("domain", "netflix"),
    "paypal_domain": ("domain", "paypal"),
    "onedrive_domain": ("domain", "onedrive"),
    "microsoft_domain": ("domain", "microsoft"),
    "apple_domain": ("domain", "apple-cn"),
    "speedtest_domain": ("domain", "ookla-speedtest"),
    "tiktok_domain": ("domain", "tiktok"),
    "cloudflare_domain": ("domain", "cloudflare"),
    "pornhub_domain": ("domain", "pornhub"),
    "private_ip": ("ipcidr", "private"),
    "gfw_domain": ("domain", "gfw"),
    "geolocation-!cn": ("domain", "geolocation-!cn"),
    "cn_domain": ("domain", "cn"),
    "cn_ip": ("ipcidr", "cn"),
}


def domain_pattern(pattern):
    """Mihomo '+' matches zero or more labels; '*' matches exactly one label."""
    pattern = pattern.lower()
    if pattern.startswith("+.") and "*" not in pattern:
        return "domain_suffix", pattern[2:]
    if "*" not in pattern and not pattern.startswith("."):
        if "+" in pattern:
            raise ValueError("Invalid + wildcard placement")
        return "domain", pattern
    prefix = ""
    if pattern.startswith("+."):
        prefix, pattern = r"(?:[^.]+\.)*", pattern[2:]
    elif pattern.startswith("."):
        prefix, pattern = r"(?:[^.]+\.)+", pattern[1:]
    labels = pattern.split(".")
    if any(not p or "+" in p or ("*" in p and p != "*") for p in labels):
        raise ValueError("Unsupported domain wildcard")
    body = r"\.".join(r"[^.]+" if p == "*" else re.escape(p) for p in labels)
    return "domain_regex", "^" + prefix + body + "$"


def convert(text, behavior, source):
    values = {}
    count = 0
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith(("#", "//")):
            continue
        try:
            if behavior == "domain":
                field, value = domain_pattern(line)
            elif behavior == "ipcidr":
                field, value = "ip_cidr", str(ipaddress.ip_network(line, strict=False))
            else:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) not in (2, 3) or (len(parts) == 3 and parts[2] != "no-resolve"):
                    raise ValueError("Unsupported LIST syntax or modifier")
                kind, value = parts[:2]
                fields = {
                    "DOMAIN": "domain", "DOMAIN-SUFFIX": "domain_suffix",
                    "DOMAIN-KEYWORD": "domain_keyword", "DOMAIN-REGEX": "domain_regex",
                }
                if kind in fields:
                    field = fields[kind]
                    if field != "domain_regex":
                        value = value.lower()
                    if field == "domain_suffix":
                        value = value.lstrip(".")
                elif kind in ("IP-CIDR", "IP-CIDR6"):
                    network = ipaddress.ip_network(value, strict=False)
                    if network.version != (6 if kind == "IP-CIDR6" else 4):
                        raise ValueError("IP version does not match the rule type")
                    field, value = "ip_cidr", str(network)
                else:
                    raise ValueError("Unsupported LIST rule type; refusing to drop it")
                if len(parts) == 3 and field != "ip_cidr":
                    raise ValueError("no-resolve is only valid on IP rules")
            if not value:
                raise ValueError("Empty rule value")
        except ValueError as error:
            raise ValueError(f"{source}:{number}: {error}") from error
        values.setdefault(field, set()).add(value)
        count += 1
    if not count and behavior != "classical":
        raise ValueError(f"{source}: empty upstream rule set")
    # Empty personal lists are valid: deleting all entries must remove old matches.
    rules = [{key: sorted(value) for key, value in sorted(values.items())}] if count else []
    return {"version": 4, "rules": rules}, count


def run(binary, *arguments):
    result = subprocess.run([str(binary), *map(str, arguments)], capture_output=True, timeout=180)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace").strip())
    return result.stdout.decode("utf-8", errors="replace")


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "clash-rules-singbox-updater"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def build(repo, output, sing_box, mihomo=None, upstream_ref=None, cache=None):
    if not re.search(r"\b1\.14\.3\b", run(sing_box, "version")):
        raise ValueError("Use the pinned sing-box 1.14.3 compiler")
    inputs = [(tag, "classical", (repo / name).read_text(encoding="utf-8-sig"), name)
              for tag, name in PERSONAL.items()]
    with tempfile.TemporaryDirectory(prefix="singbox-rules-") as temporary:
        work = Path(temporary)
        if mihomo:
            if not re.search(r"\bv1\.19\.32\b", run(mihomo, "-v")):
                raise ValueError("Use the pinned Mihomo v1.19.32 MRS decoder")
            upstream_ref = upstream_ref or json.loads(download(
                "https://api.github.com/repos/MetaCubeX/meta-rules-dat/git/ref/heads/meta"
            ))["object"]["sha"]
            if not re.fullmatch(r"[a-f0-9]{40}", upstream_ref):
                raise ValueError("Upstream snapshot must be a full commit SHA")
            print(f"Upstream snapshot: {upstream_ref}")
            cache = cache or work / "mrs"
            cache.mkdir(parents=True, exist_ok=True)

            def decode(item):
                tag, (behavior, name) = item
                category = "geosite" if behavior == "domain" else "geoip"
                source = cache / f"{upstream_ref}-{tag}.mrs"
                if not source.exists():
                    source.write_bytes(download(
                        "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/"
                        f"{upstream_ref}/geo/{category}/{name}.mrs"
                    ))
                decoded = work / f"{tag}.txt"
                run(mihomo, "convert-ruleset", behavior, "mrs", source, decoded)
                return tag, behavior, decoded.read_text(encoding="utf-8-sig"), f"{category}/{name}.mrs"

            with ThreadPoolExecutor(max_workers=6) as pool:
                inputs.extend(pool.map(decode, UPSTREAM.items()))

        staged = {}
        for tag, behavior, text, source in inputs:
            converted, count = convert(text, behavior, source)
            source_json, binary = work / f"{tag}.json", work / f"{tag}.srs"
            source_json.write_text(json.dumps(converted, ensure_ascii=False, sort_keys=True), encoding="utf-8")
            run(sing_box, "rule-set", "compile", source_json, "-o", binary)
            decoded = work / f"{tag}.roundtrip.json"
            run(sing_box, "rule-set", "decompile", binary, "-o", decoded)
            roundtrip = json.loads(decoded.read_text(encoding="utf-8"))
            decoded_rules = roundtrip.get("rules")
            if count:
                valid = isinstance(decoded_rules, list) and bool(decoded_rules)
            else:
                # The official decompiler omits the rules field for an empty set.
                valid = decoded_rules in (None, [])
            if not valid:
                raise ValueError(f"{tag}: compiled rule set failed validation")
            staged[tag] = binary.read_bytes()
            print(f"Validated {tag}: {count} source entries")

        # Publish only after every source has parsed, compiled and decompiled.
        output.mkdir(parents=True, exist_ok=True)
        changed = []
        for tag, data in staged.items():
            target = output / f"{tag}.srs"
            if not target.exists() or target.read_bytes() != data:
                pending = target.with_suffix(".srs.tmp")
                pending.write_bytes(data)
                pending.replace(target)
                changed.append(tag)
        print(f"Validated {len(staged)} rule sets; updated {len(changed)}")
        return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--sing-box", type=Path, required=True)
    parser.add_argument("--mihomo", type=Path)
    parser.add_argument("--upstream", action="store_true")
    parser.add_argument("--upstream-ref")
    parser.add_argument("--cache", type=Path)
    args = parser.parse_args()
    if args.upstream and not args.mihomo:
        parser.error("--upstream requires --mihomo")
    repo = args.repo.resolve()
    build(repo, args.output or repo / "rules/singbox", args.sing_box.resolve(),
          args.mihomo.resolve() if args.upstream else None, args.upstream_ref, args.cache)


if __name__ == "__main__":
    main()
