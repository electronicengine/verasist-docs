"""Build SDK pages from content/developer/sdks; selectively apply with a backup.

Build: python migration/sync_sdk_docs.py --output /tmp/sdk-pages.json
Apply: python migration/sync_sdk_docs.py --input /tmp/sdk-pages.json --apply --backup /tmp/sdk-backup.json
Requires the backend dependencies and MONGO_URL/DB_NAME for applying.
"""
import argparse
import asyncio
import html
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

PAGES = ('introduction', 'build-an-agent', 'live-voice-session', 'text-session',
         'tools', 'outbound-calls', 'api-capabilities', 'development')


def build():
    from import_mdx_to_mongo import parse_frontmatter, convert_mdx_to_html
    root = Path(__file__).resolve().parents[2] / 'content/developer/sdks'
    result = []
    for lang in ('en', 'tr'):
        for order, page in enumerate(PAGES):
            meta, body = parse_frontmatter((root / lang / f'{page}.mdx').read_text())
            blocks = []

            def protect(match):
                language = match[1].split()[0]
                blocks.append(f'<pre><code class="language-{html.escape(language, quote=True)}">'
                              f'{html.escape(match[2])}</code></pre>')
                return f'SDKCODEPLACEHOLDER{len(blocks)-1}END'

            body = re.sub(r'```([^\n]+)\n(.*?)```', protect, body, flags=re.S)
            rendered = convert_mdx_to_html(body)
            for i, block in enumerate(blocks):
                marker = f'SDKCODEPLACEHOLDER{i}END'
                rendered = rendered.replace(f'<p>{marker}</p>', block).replace(marker, block)
            result.append(dict(path=f'developer/sdks/{page}', lang=lang, title=meta['title'],
                               excerpt=meta['description'], content=rendered, order=order))
    return result


async def apply(pages, backup):
    from motor.motor_asyncio import AsyncIOMotorClient
    allowed = {(f'developer/sdks/{page}', lang) for page in PAGES for lang in ('en', 'tr')}
    if len(pages) != len(allowed) or {(p['path'], p['lang']) for p in pages} != allowed:
        raise ValueError('Payload must contain exactly the 16 SDK pages')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        sections = await db.sections.find({'slug': 'sdks'}).to_list(10)
        if len(sections) != 1:
            raise ValueError('Expected exactly one existing SDK section')
        section = sections[0]['id']
        previous = []
        for page in pages:
            matches = await db.documents.find({'path': page['path'], 'lang': page['lang']}, {'_id': 0}).to_list(2)
            if len(matches) > 1:
                raise ValueError(f"Duplicate document: {page['path']} {page['lang']}")
            previous.extend(matches)
        # Exclusive creation avoids overwriting an earlier backup.
        with Path(backup).open('x') as stream:
            json.dump(previous, stream, ensure_ascii=False, indent=2, default=str)
        for page in pages:
            key = {'path': page['path'], 'lang': page['lang']}
            update = {**page, 'section_id': section, 'updated_at': datetime.now(timezone.utc).isoformat()}
            await db.documents.update_one(key, {'$set': update, '$setOnInsert': {
                'id': str(uuid.uuid4()), 'slug': page['path'].replace('/', '-'),
                'parent_id': None, 'published': True,
            }}, upsert=True)
            actual = await db.documents.find_one(key)
            assert all(actual[k] == v for k, v in update.items())
        print(f'Updated and verified {len(pages)} SDK documents; backed up {len(previous)} existing documents.')
    finally:
        client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    pages = json.loads(args.input.read_text()) if args.input else build()
    if args.output:
        args.output.write_text(json.dumps(pages, ensure_ascii=False, indent=2))
    if args.apply:
        if not args.backup:
            parser.error('--apply requires --backup')
        asyncio.run(apply(pages, args.backup))
    else:
        print(f'Prepared {len(pages)} SDK documents; no database changes.')
