#!/usr/bin/env python3
"""Validate local runtime resources and create a reproducible unpacked-extension ZIP."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def package(source, output):
    source = source.resolve()
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    version = manifest.get('version', '')
    if manifest.get('manifest_version') != 3 or not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('需要有效的 MV3 manifest 与三段式版本号。')
    required = {'manifest.json', manifest['background']['service_worker'], manifest['action']['default_popup']}
    required.update(manifest.get('icons', {}).values())
    for script in manifest.get('content_scripts', []):
        required.update(script.get('js', []))
        required.update(script.get('css', []))
    files = sorted(p for p in source.rglob('*') if not any(part.startswith('.') for part in p.relative_to(source).parts))
    for file in files:
        if file.is_symlink():
            raise ValueError('不打包符号链接：{}'.format(file))
        if not file.is_file():
            continue
        targets = []
        if file.suffix in ('.js', '.mjs'):
            targets = re.findall(r'''from\s+['"](\.[^'"]+)['"]''', file.read_text(encoding='utf-8'))
        if file.suffix == '.html':
            targets += re.findall(r'''<(?:script|link)\b[^>]*(?:src|href)=['"]([^'"]+)['"]''', file.read_text(encoding='utf-8'))
        for target in targets:
            resolved = (file.parent / target).resolve()
            if not resolved.is_relative_to(source):
                raise ValueError('资源必须在扩展目录内：{}'.format(target))
            required.add(resolved.relative_to(source).as_posix())
    for name in sorted(required):
        file = (source / name).resolve()
        if not file.is_relative_to(source) or not file.is_file():
            raise ValueError('缺少运行文件或路径无效：{}'.format(name))
    output.mkdir(parents=True, exist_ok=True)
    archive = output / ('stmh-toolbox-' + version + '.zip')
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for file in files:
            if not file.is_file():
                continue
            info = zipfile.ZipInfo('stmh-chrome/' + file.relative_to(source).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            zipped.writestr(info, file.read_bytes(), compresslevel=9)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (output / 'SHA256SUMS').write_text(digest + '  ' + archive.name + '\n', encoding='utf-8')
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'stmh-chrome')
    parser.add_argument('--out-dir', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    try:
        print(package(args.source, args.out_dir))
    except (ValueError, KeyError, OSError, TypeError) as error:
        print('打包失败：{}'.format(error), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
