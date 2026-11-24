"""Build reviewed telephone pages; preview/apply a selective, backed-up publication.

Build: python migration/sync_telephony_docs.py --docs-dir /path/to/verasist/docs --output /tmp/telephony-pages.json
Preview: python migration/sync_telephony_docs.py --input /tmp/telephony-pages.json
Apply: python migration/sync_telephony_docs.py --input /tmp/telephony-pages.json --apply --backup /private/new-backup.json
"""
import argparse
import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from legacy_video_links import strip_legacy_video_links

PREFIX = 'guides/integrations/telephony/'
PRIMARY = {'overview': 1, 'inbound': 2, 'sip-trunk': 9, 'ip-pbx': 10, 'api-overview': 1}
API_OVERVIEW = 'api-reference/telephony-configs'
PROVIDERS = ('twilio', 'vonage', 'plivo', 'telnyx', 'cloudonix', 'vobiz', 'agent-stream')
ALLOWED = {(PREFIX + p, lang) for p in (*PRIMARY.keys(), *PROVIDERS) if p != 'api-overview' for lang in ('en', 'tr')}
ALLOWED |= {(API_OVERVIEW, lang) for lang in ('en', 'tr')}
NEW = {(PREFIX + 'ip-pbx', lang) for lang in ('en', 'tr')}


def normalize(content):
    content = strip_legacy_video_links(content).replace('https://api.verasist.ai', 'https://app.verasist.ai')
    return re.sub(r'(?<!/guides)/integrations/telephony/', '/' + PREFIX, content)


def build(docs_dir):
    from import_mdx_to_mongo import parse_frontmatter, convert_mdx_to_html
    local = Path(__file__).resolve().parents[2] / 'content/guides/integrations/telephony/tr'
    pages = []
    for lang in ('en', 'tr'):
        for name, order in PRIMARY.items():
            path = API_OVERVIEW if name == 'api-overview' else PREFIX + name
            source = (docs_dir / (path + '.mdx')) if lang == 'en' else local / (name + '.mdx')
            meta, body = parse_frontmatter(source.read_text())
            if not meta.get('title') or not meta.get('description'):
                raise ValueError(f'Missing frontmatter: {source}')
            pages.append(dict(path=path, lang=lang, title=meta['title'], excerpt=meta['description'],
                              content=normalize(convert_mdx_to_html(body)), order=order))
    policy = json.loads((Path(__file__).resolve().parents[2] / 'content/customer-publication.json').read_text())
    for override in policy['overrides']:
        if override['path'] in {PREFIX + p for p in PROVIDERS}:
            pages.append({**override, 'content': normalize(override['content'])})
    validate(pages)
    return pages


def validate(pages):
    if len(pages) != len(ALLOWED) or {(p['path'], p['lang']) for p in pages} != ALLOWED:
        raise ValueError('Payload must contain exactly the 24 reviewed English/Turkish telephone pages')
    for p in pages:
        if not p.get('content') or p['content'] != normalize(p['content']):
            raise ValueError(f'Unnormalized/empty content: {p["path"]} {p["lang"]}')


async def publish(pages, backup=None):
    from motor.motor_asyncio import AsyncIOMotorClient
    validate(pages)
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        documents = await db.documents.find({}, {'_id': 0}).to_list(None)
        indexed = {}
        for d in documents:
            key = (d.get('path'), d.get('lang'))
            indexed.setdefault(key, []).append(d)
        for key in ALLOWED - NEW:
            if len(indexed.get(key, [])) != 1:
                raise ValueError(f'Expected exactly one existing page: {key}')
        for key in NEW:
            if len(indexed.get(key, [])) > 1:
                raise ValueError(f'Duplicate new page: {key}')
        now = datetime.now(timezone.utc).isoformat()
        updates, inserts = [], []
        for page in pages:
            key = (page['path'], page['lang'])
            old = next(iter(indexed.get(key, [])), None)
            fields = {k: page[k] for k in ('content', 'title', 'excerpt', 'order') if k in page}
            if old:
                if any(old.get(k) != v for k, v in fields.items()):
                    updates.append((old, {**fields, 'updated_at': now}))
            else:
                reference = indexed[(PREFIX + 'sip-trunk', page['lang'])][0]
                inserts.append({**page, 'id': str(uuid.uuid4()), 'slug': page['path'].replace('/', '-'),
                                'section_id': reference['section_id'], 'parent_id': reference.get('parent_id'),
                                'published': True, 'created_at': now, 'updated_at': now})
        # Remove retired links in any other language/page too, without rewriting its prose.
        for old in documents:
            if (old.get('path'), old.get('lang')) in ALLOWED:
                continue
            content = strip_legacy_video_links(old.get('content', ''))
            if content != old.get('content', ''):
                updates.append((old, {'content': content, 'updated_at': now}))
        summary = {'update': len(updates), 'insert': len(inserts),
                   'pages': [{'path': d.get('path'), 'lang': d.get('lang')} for d, _ in updates] +
                            [{'path': d['path'], 'lang': d['lang']} for d in inserts]}
        print(json.dumps(summary, ensure_ascii=False))
        if backup is None:
            return
        # Exclusive file creation and compare-and-set protect backups and concurrent CMS edits.
        with Path(backup).open('x') as stream:
            json.dump({'documents': [old for old, _ in updates], 'inserted_documents': inserts}, stream,
                      ensure_ascii=False, indent=2, default=str)
        for old, fields in updates:
            query = {'id': old['id'], 'content': old.get('content', '')}
            if 'updated_at' in old:
                query['updated_at'] = old['updated_at']
            result = await db.documents.update_one(query, {'$set': fields})
            if result.matched_count != 1:
                raise RuntimeError(f'Concurrent edit; stopped without overwriting: {old["id"]}')
        for document in inserts:
            await db.documents.insert_one(document)
        for page in pages:
            actual = await db.documents.find_one({'path': page['path'], 'lang': page['lang']})
            assert all(actual[k] == page[k] for k in ('content', 'title', 'excerpt', 'order') if k in page)
        remaining = await db.documents.find({}, {'_id': 0, 'content': 1}).to_list(None)
        assert all(strip_legacy_video_links(d.get('content', '')) == d.get('content', '') for d in remaining)
        print('Applied and verified scoped publication; retained existing page IDs and unrelated content.')
    finally:
        client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--docs-dir', type=Path)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    if args.apply and not args.backup:
        parser.error('--apply requires a new --backup filename')
    if not args.input and not args.docs_dir:
        parser.error('provide --input or --docs-dir')
    pages = json.loads(args.input.read_text()) if args.input else build(args.docs_dir)
    validate(pages)
    if args.output:
        args.output.write_text(json.dumps(pages, ensure_ascii=False, indent=2))
    if args.input or args.apply:
        asyncio.run(publish(pages, args.backup if args.apply else None))
    else:
        print(f'Built {len(pages)} reviewed pages; no database changes.')
