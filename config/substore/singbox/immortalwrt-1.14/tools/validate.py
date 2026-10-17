"""Validate without printing configuration credentials. See README for arguments."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

BASE = Path(__file__).resolve().parents[1]


def load(p):
    return json.loads(Path(p).read_text(encoding='utf-8-sig'))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--schema', required=True, type=Path)
    ap.add_argument('--reference', required=True, type=Path, help='Pinned qichiyuhub Linux template')
    ap.add_argument('--rendered', required=True, type=Path, help='Offline fixture or privately rendered config')
    ap.add_argument('--sing-box', required=True, type=Path)
    ap.add_argument('--scratch', required=True, type=Path, help='Writable private scratch directory')
    args = ap.parse_args()
    from jsonschema import Draft202012Validator
    config, reference, rendered = load(BASE/'template.json'), load(args.reference), load(args.rendered)
    errors = list(Draft202012Validator(load(args.schema)).iter_errors(rendered))
    if errors:
        # Do not include schema messages: they can contain the instance's secrets.
        raise ValueError(f'Official schema rejected {len(errors)} item(s)')
    for key in reference:
        if key not in {'outbounds','route','inbounds','services','experimental'}:
            assert config[key] == reference[key], f'Tutorial core changed: {key}'
    expected = copy.deepcopy(reference['inbounds'])
    next(i for i in expected if i['tag']=='mixed-in')['listen_port'] = 7893
    assert config['inbounds'] == expected
    expected = copy.deepcopy(reference['services'])
    for s in expected:
        if s['type']=='api': s['secret']='__SET_PRIVATE_API_SECRET__'
    assert config['services'] == expected
    expected = copy.deepcopy(reference['experimental'])
    expected['clash_api']['secret']='__SET_PRIVATE_API_SECRET__'
    assert config['experimental'] == expected
    for key in reference['route']:
        if key not in {'rules','rule_set','final'}:
            assert config['route'][key] == reference['route'][key]
    assert config['route']['rules'][:9] == reference['route']['rules'][:9]
    ref_sets = reference['route']['rule_set']
    assert config['route']['rule_set'][:len(ref_sets)] == ref_sets
    source = load(BASE/'migration-source.json')
    mapping = load(BASE/'rule-order.json')
    assert [x['source'] for x in mapping] == source['rules']
    actual_order = []
    for entry in mapping:
        parts = entry['source'].split(',')
        if parts[0]=='MATCH':
            assert config['route']['final'] == parts[1]
        else:
            target = config['route']['rules'][entry['target_index']]
            assert target == {'rule_set':parts[1],'outbound':parts[2]}
            actual_order.append(entry['target_index'])
    assert actual_order == sorted(actual_order)
    assert len(mapping) == 43 and len(source['groups']) == 41
    expected_tags = {p['tag'] for p in load(BASE/'rule-sources.json')['providers']}
    locked = load(BASE/'rule-lock.json')
    assert {r['tag'] for r in locked} == expected_tags
    for item in locked:
        for extension, field in [('json','json_sha256'),('srs','srs_sha256')]:
            data = (BASE/'rules'/f"{item['tag']}.{extension}").read_bytes()
            assert hashlib.sha256(data).hexdigest() == item[field], 'Rule file digest changed'
    # Check every reference, including unused DNS rule sets and aliases.
    tags = [i['tag'] for i in rendered['outbounds']+rendered.get('endpoints',[])]
    assert len(tags)==len(set(tags))
    tag_set = set(tags)
    graph = {i['tag']:i.get('outbounds',[]) for i in rendered['outbounds']}
    def visit(tag, active):
        assert tag not in active, 'Selector reference cycle'
        for child in graph.get(tag,[]):
            assert child in tag_set, 'Unresolved outbound reference'
            visit(child, active|{tag})
    for tag in graph:
        visit(tag, set())
    check = copy.deepcopy(rendered)
    if os.name=='nt':
        check['inbounds']=[i for i in check['inbounds'] if i['type']!='tun']
        scope='Windows userspace only; Linux TUN/auto_redirect runtime NOT verified'
    else:
        scope='Full config check; device startup and real traffic still require testing'
    # Temporary rendered configs can contain credentials; always remove them.
    args.scratch.mkdir(parents=True,exist_ok=True)
    scratch=args.scratch.resolve()
    with tempfile.TemporaryDirectory(dir=scratch) as temp:
        assert Path(temp).resolve().is_relative_to(scratch)
        p=Path(temp)/'check.json'
        p.write_text(json.dumps(check,ensure_ascii=False),encoding='utf-8')
        result=subprocess.run([str(args.sing_box.resolve()),'check','-c',str(p)],capture_output=True)
        if result.returncode:
            raise ValueError('sing-box check failed; inspect privately on the target device')
    print('PASS: official schema; tutorial core unchanged; 43-rule order; 41 groups; 42 rule-set digests; reference graph')
    print('PASS: '+scope)


if __name__=='__main__':
    main()
