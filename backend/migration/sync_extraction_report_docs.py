"""Selectively publish extraction/report guides, retaining IDs and navigation parents.

Build with --docs-dir /path/to/docs --output /tmp/extraction-report-pages.json.
Preview with --input FILE. Apply with --input FILE --apply --backup NEW_FILE.
"""
import argparse
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

PATHS = ('guides/workflows/data-extraction', 'guides/workflows/global',
         'guides/workflows/agent', 'guides/workflows/end-call', 'guides/analytics/reports',
         'guides/analytics/report-charts', 'guides/analytics/chart-analysis')
PLACEMENT = {
    'guides/workflows/data-extraction': ('guides/workflows/global', False, 7),
    'guides/analytics/report-charts': ('guides/analytics/reports', True, 1),
    'guides/analytics/chart-analysis': ('guides/analytics/reports', True, 2),
}
ALLOWED = {(path, lang) for path in PATHS for lang in ('en', 'tr')}
NEW = {(path, lang) for path in PLACEMENT for lang in ('en', 'tr')}


def validate(pages):
    if len(pages) != len(ALLOWED) or {(p['path'], p['lang']) for p in pages} != ALLOWED:
        raise ValueError('Expected exactly 14 reviewed extraction/report pages')
    if any(not p.get('content') for p in pages):
        raise ValueError('Empty content')


def build(docs_dir):
    from import_mdx_to_mongo import parse_frontmatter, convert_mdx_to_html
    base = Path(__file__).resolve().parents[2] / 'content'
    policy = json.loads((base / 'customer-publication.json').read_text())
    reviewed = {(p['path'], p['lang']): p for p in policy['overrides']}
    pages = []
    for lang in ('en', 'tr'):
        for path in PATHS:
            if lang == 'tr' and path in ('guides/workflows/agent', 'guides/workflows/end-call'):
                pages.append(dict(reviewed[path, lang]))
                continue
            source = docs_dir / (path + '.mdx') if lang == 'en' else base / Path(path).parent / 'tr' / (Path(path).name + '.mdx')
            meta, body = parse_frontmatter(source.read_text())
            if not meta.get('title') or not meta.get('description'):
                raise ValueError(f'Missing frontmatter: {source}')
            pages.append(dict(path=path, lang=lang, title=meta['title'], excerpt=meta['description'], content=convert_mdx_to_html(body)))
    validate(pages)
    return pages


async def publish(pages, backup=None):
    from motor.motor_asyncio import AsyncIOMotorClient
    validate(pages)
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        keys = [{'path': p, 'lang': lang} for p, lang in ALLOWED]
        existing = await db.documents.find({'$or': keys}, {'_id': 0}).to_list(None)
        by_key = {}
        for doc in existing:
            key = (doc['path'], doc['lang'])
            if key in by_key:
                raise ValueError(f'Duplicate document: {key}')
            by_key[key] = doc
        if any(key not in by_key for key in ALLOWED - NEW):
            raise ValueError('An existing reference page is missing')
        updates, inserts = [], []
        now = datetime.now(timezone.utc).isoformat()
        for page in pages:
            key = (page['path'], page['lang'])
            old = by_key.get(key)
            fields = {k: page[k] for k in ('content', 'title', 'excerpt') if k in page}
            if page['path'] in PLACEMENT:
                reference, child, order = PLACEMENT[page['path']]
                parent = by_key[reference, page['lang']]
                fields.update(section_id=parent['section_id'], parent_id=parent['id'] if child else parent.get('parent_id'), order=order)
            if old:
                if any(old.get(k) != v for k, v in fields.items()):
                    updates.append((old, {**fields, 'updated_at': now}))
            else:
                inserts.append({**page, **fields, 'id': str(uuid.uuid4()),
                                'slug': page['path'].replace('/', '-'), 'published': True,
                                'created_at': now, 'updated_at': now})
        print(json.dumps({'update': len(updates), 'insert': len(inserts), 'pages': [
            {'path': d['path'], 'lang': d['lang']} for d, _ in updates] + [
            {'path': d['path'], 'lang': d['lang']} for d in inserts]}, ensure_ascii=False))
        if backup is None:
            return
        with Path(backup).open('x') as output:
            json.dump({'documents': [old for old, _ in updates], 'inserted_documents': inserts},
                      output, ensure_ascii=False, indent=2, default=str)
        for old, fields in updates:
            selector = {'id': old['id'], 'content': old.get('content', '')}
            if 'updated_at' in old:
                selector['updated_at'] = old['updated_at']
            result = await db.documents.update_one(selector, {'$set': fields})
            if result.matched_count != 1:
                raise RuntimeError('Concurrent CMS edit; publication stopped: ' + old['id'])
        for doc in inserts:
            await db.documents.insert_one(doc)
        for page in pages:
            doc = await db.documents.find_one({'path': page['path'], 'lang': page['lang']})
            assert all(doc[k] == page[k] for k in ('content', 'title', 'excerpt') if k in page)
            if page['path'] in PLACEMENT:
                ref, child, order = PLACEMENT[page['path']]
                parent = by_key[ref, page['lang']]
                assert doc['parent_id'] == (parent['id'] if child else parent.get('parent_id'))
                assert doc['section_id'] == parent['section_id'] and doc['order'] == order
        print('Published and verified extraction/report guides and navigation; existing IDs preserved.')
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
        parser.error('--apply requires a new backup filename')
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
