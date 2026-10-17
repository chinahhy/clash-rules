"""Decode the pinned Mihomo MRS snapshots and compile genuine sing-box SRS.

Python 3.10+, standard library only. Does not read any subscription or credentials.
Run from any directory; binaries must be explicitly supplied.
"""
import argparse
import concurrent.futures
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

BASE = Path(__file__).resolve().parents[1]
REPO = BASE.parents[3]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def domain_pattern(pattern):
    """Mihomo: '+' = zero or more labels; '*' = exactly one label."""
    pattern = pattern.lower()
    if pattern.startswith('+.') and '*' not in pattern:
        return 'domain_suffix', pattern[2:]
    if '*' not in pattern and not pattern.startswith('.'):
        if '+' in pattern:
            raise ValueError('Invalid + wildcard placement')
        return 'domain', pattern
    prefix = ''
    if pattern.startswith('+.'):
        prefix, pattern = r'(?:[^.]+\.)*', pattern[2:]
    elif pattern.startswith('.'):
        prefix, pattern = r'(?:[^.]+\.)+', pattern[1:]
    labels = pattern.split('.')
    if any(not p or '+' in p or ('*' in p and p != '*') for p in labels):
        raise ValueError('Unsupported domain pattern')
    body = r'\.'.join(r'[^.]+' if p == '*' else re.escape(p) for p in labels)
    return 'domain_regex', '^' + prefix + body + '$'


def convert(text, behavior):
    values = {}
    count = 0
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith(('#', '//')):
            continue
        count += 1
        if behavior == 'domain':
            field, value = domain_pattern(line)
        elif behavior == 'ipcidr':
            field, value = 'ip_cidr', str(ipaddress.ip_network(line, strict=False))
        elif behavior == 'classical':
            parts = [p.strip() for p in line.split(',')]
            if len(parts) not in (2, 3) or (len(parts) == 3 and parts[2] != 'no-resolve'):
                raise ValueError(f'Unsupported LIST modifier at line {number}')
            kind, value = parts[:2]
            if kind == 'DOMAIN':
                field, value = 'domain', value.lower()
            elif kind == 'DOMAIN-SUFFIX':
                field, value = 'domain_suffix', value.lstrip('.').lower()
            elif kind == 'DOMAIN-KEYWORD':
                field, value = 'domain_keyword', value.lower()
            elif kind in ('IP-CIDR', 'IP-CIDR6'):
                field, value = 'ip_cidr', str(ipaddress.ip_network(value, strict=False))
            else:
                raise ValueError(f'Unsupported LIST kind {kind} at line {number}; conversion stopped')
            if len(parts) == 3 and field != 'ip_cidr':
                raise ValueError(f'Unexpected no-resolve at line {number}')
            # A headless IP rule does not resolve DNS. The config only inserts
            # an explicit resolve action immediately before the final cn_ip rule.
        else:
            raise ValueError('Unsupported behavior')
        values.setdefault(field, set()).add(value)
    if not count:
        raise ValueError('Empty rule set')
    return {'version': 4, 'rules': [{k: sorted(v) for k, v in sorted(values.items())}]}, count


def run(*args):
    return subprocess.run([str(a) for a in args], check=True, capture_output=True).stdout


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--sing-box', required=True)
    ap.add_argument('--mihomo', required=True)
    ap.add_argument('--cache', type=Path, required=True, help='Scratch directory outside the repository')
    args = ap.parse_args()
    sb, mh = Path(args.sing_box).resolve(), Path(args.mihomo).resolve()
    if '1.14.3' not in run(sb, 'version').decode() or 'v1.19.32' not in run(mh, '-v').decode():
        raise ValueError('Use the versions pinned in rule-sources.json')
    manifest = json.loads((BASE/'rule-sources.json').read_text(encoding='utf-8'))
    old = json.loads((BASE/'rule-lock.json').read_text(encoding='utf-8')) if (BASE/'rule-lock.json').exists() else []
    previous = {x['tag']: x for x in old}
    args.cache.mkdir(parents=True, exist_ok=True)
    def download(p):
        if p['kind'] == 'list':
            # Git text blobs use LF; normalize Windows checkout line endings
            # so the source digest is reproducible across operating systems.
            return p['tag'], (REPO/p['path']).read_bytes().replace(b'\r\n', b'\n')
        cached = args.cache/(p['tag']+'.mrs')
        if not cached.exists():
            with urllib.request.urlopen(p['url'], timeout=90) as response:
                data = response.read()
            cached.write_bytes(data)
        data = cached.read_bytes()
        if p['tag'] in previous and sha(data) != previous[p['tag']]['input_sha256']:
            raise ValueError('Pinned MRS digest mismatch: '+p['tag'])
        return p['tag'], data
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        inputs = dict(pool.map(download, manifest['providers']))
    rules = BASE/'rules'
    rules.mkdir(exist_ok=True)
    lock = []
    with tempfile.TemporaryDirectory(dir=args.cache) as temp:
        temp = Path(temp)
        for p in manifest['providers']:
            data = inputs[p['tag']]
            if p['kind'] == 'mrs':
                source, decoded = temp/'input.mrs', temp/'decoded.txt'
                source.write_bytes(data)
                run(mh, 'convert-ruleset', p['behavior'], 'mrs', source, decoded)
                text = decoded.read_text(encoding='utf-8-sig')
            else:
                text = data.decode('utf-8-sig')
            converted, count = convert(text, p['behavior'])
            output = rules/(p['tag']+'.json')
            output.write_text(json.dumps(converted,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
            binary = output.with_suffix('.srs')
            run(sb, 'rule-set', 'compile', output, '-o', binary)
            decoded = temp/'roundtrip.json'
            run(sb, 'rule-set', 'decompile', binary, '-o', decoded)
            # Compilation may canonicalize fields; require the official decoder
            # to read every binary rather than assuming the file extension proves it.
            roundtrip = json.loads(decoded.read_text(encoding='utf-8'))
            if not roundtrip.get('rules'):
                raise ValueError('Empty roundtrip: '+p['tag'])
            lock.append({'tag':p['tag'],'kind':p['kind'],'input_sha256':sha(data),
                         'source_entries':count,'json_sha256':sha(output.read_bytes()),
                         'srs_sha256':sha(binary.read_bytes())})
            print(f"{p['tag']}: {count} entries; compiled and decompiled")
    (BASE/'rule-lock.json').write_text(json.dumps(lock,indent=2)+'\n',encoding='utf-8',newline='\n')


if __name__ == '__main__':
    main()
