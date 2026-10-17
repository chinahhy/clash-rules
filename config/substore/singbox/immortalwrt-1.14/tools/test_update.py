import json, subprocess
from pathlib import Path
import argparse
ap=argparse.ArgumentParser()
ap.add_argument('--scratch', required=True, type=Path)
ap.add_argument('--shell', required=True, type=Path)
ap.add_argument('--node', required=True, type=Path)
args=ap.parse_args()
w=args.scratch.resolve()
w.mkdir(parents=True,exist_ok=True)
base=Path(__file__).resolve().parents[1]
root=w/'update-control-tests'
root.mkdir(exist_ok=True)
node=args.node.resolve()
shell=args.shell.resolve()
helper=root/'fileops.cjs'
helper.write_text('''const fs=require('fs');const [cmd,...a]=process.argv.slice(2);
switch(cmd){
case 'mktemp': console.log(fs.mkdtempSync(a[1].replace(/X{6}$/, '')));break;
case 'rm': for(const f of a.filter(x=>x!=='-f')){try{fs.unlinkSync(f)}catch(e){if(e.code!=='ENOENT')throw e}}break;
case 'rmdir':fs.rmdirSync(a[0]);break;
case 'cp':fs.copyFileSync(a.at(-2),a.at(-1));break;
case 'mv':fs.renameSync(a[0],a[1]);break;
case 'chmod':break;
case 'grep':process.exit(fs.readFileSync(a[2],'utf8').includes(a[1])?0:1);break;
case 'write':fs.writeFileSync(a[0],a[1]);break;
default:throw Error('Unexpected test helper operation');}
''',encoding='utf-8')
script=(base/'update-config.sh').read_text(encoding='utf-8')
prelude=f'''fileops() {{ '{node.as_posix()}' '{helper.as_posix()}' "$@"; }}
mktemp() {{ fileops mktemp "$@"; }}
rm() {{ fileops rm "$@"; }}
rmdir() {{ fileops rmdir "$@"; }}
cp() {{ fileops cp "$@"; }}
mv() {{ fileops mv "$@"; }}
chmod() {{ fileops chmod "$@"; }}
grep() {{ fileops grep "$@"; }}
logger() {{ :; }}
curl() {{
  [ "${{TEST_DOWNLOAD_FAIL:-0}}" = 0 ] || return 1
  while [ "$#" -gt 0 ]; do
    if [ "$1" = '--output' ]; then shift; target="$1"; fi
    shift
  done
  fileops write "$target" '{{"test":"new-config"}}'
}}
singbox_mock() {{ [ "${{TEST_CHECK_FAIL:-0}}" = 0 ]; }}
restart_mock() {{ [ "${{TEST_RESTART_FAIL:-0}}" = 0 ]; }}
'''
import os
for case,flag in [('download-failure','TEST_DOWNLOAD_FAIL'),('check-failure','TEST_CHECK_FAIL'),('restart-failure','TEST_RESTART_FAIL'),('success',None)]:
    directory=root/case
    directory.mkdir(exist_ok=True)
    (directory/'config.json').write_text('old-config')
    (directory/'substore.curl').write_text('url = "http://127.0.0.1/test"')
    test=root/(case+'.sh')
    test.write_text(prelude+script.replace('cfg_dir=/etc/sing-box',f"cfg_dir='{directory.as_posix()}'").replace('/etc/init.d/sing-box restart','restart_mock').replace('sing-box check','singbox_mock check'),encoding='utf-8')
    environment=os.environ.copy()
    if flag:environment[flag]='1'
    result=subprocess.run([str(shell),str(test)],env=environment,capture_output=True)
    if flag:
        assert result.returncode!=0,(case,result.stdout,result.stderr)
        messages={'download-failure':'Sub-Store 下载失败','check-failure':'目标核心校验失败','restart-failure':'服务重启返回失败'}
        assert messages[case] in result.stderr.decode('utf-8'), (case, 'unexpected failure path')
        assert (directory/'config.json').read_text()=='old-config',case
    else:
        assert result.returncode==0,(case,result.stderr)
        assert json.loads((directory/'config.json').read_text())=={'test':'new-config'}
        assert (directory/'config.json.bak').read_text()=='old-config'
    assert not list(directory.glob('.substore-update.*')),case
    print('PASS:',case)
print('Shell control-flow tests use mocked curl, core, service, and filesystem commands; no router access.')
