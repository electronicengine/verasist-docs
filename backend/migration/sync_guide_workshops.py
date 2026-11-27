"""Publish reviewed customer guides only; preserve IDs and unrelated Developer/API pages.

Preview: python sync_guide_workshops.py --source-dir content/guides/updates
Apply: append --apply --backup /private/new-backup.json
Sources use JSON-valued frontmatter and reviewed HTML bodies. Never imports server setup docs.
"""
import argparse
import asyncio
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path


def load_pages(source_dir):
    pages = []
    for lang in ('en', 'tr'):
        for source in sorted((source_dir / lang).glob('*.mdx')):
            _, front, body = source.read_text().split('---', 2)
            page = {k.strip(): json.loads(v) for k, v in (line.split(':', 1) for line in front.strip().splitlines())}
            page.update(lang=lang, content=body.strip())
            if not page['path'].startswith('guides/') or not page['reference'].startswith('guides/'):
                raise ValueError('Only guides are allowed')
            if not page['title'] or not page['content'] or '<script' in page['content'].lower():
                raise ValueError('Invalid content')
            pages.append(page)
    keys = {(p['path'], p['lang']) for p in pages}
    if not pages or len(keys) != len(pages) or any((p, other) not in keys for p, _ in keys for other in ('en', 'tr')):
        raise ValueError('Expected unique bilingual guide sources')
    return pages


def fingerprint(documents):
    return hashlib.sha256(json.dumps(sorted(documents, key=lambda d: d['id']), sort_keys=True, default=str).encode()).hexdigest()


async def publish(pages, backup=None):
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        before = await db.documents.find({}, {'_id': 0}).to_list(None)
        indexed = {(d.get('path'), d.get('lang')): d for d in before}
        if len(indexed) != len(before):
            raise ValueError('Duplicate path/language documents')
        now = datetime.now(timezone.utc).isoformat()
        updates, inserts = [], []
        tabs = await db.tabs.find({}, {'_id': 0}).to_list(None)
        guide_tab = next(t for t in tabs if t['slug'] == 'rehberler')
        sections = await db.sections.find({'tab_id': guide_tab['id']}, {'_id': 0}).to_list(None)
        section_ids = {s['id'] for s in sections}
        for p in pages:
            existing = indexed.get((p['path'], p['lang']))
            reference = indexed[p['reference'], p['lang']]
            if reference['section_id'] not in section_ids or (existing and existing['section_id'] not in section_ids):
                raise ValueError('Guide section boundary violated')
            fields = {k: p[k] for k in ('title', 'excerpt', 'content')}
            # Legacy Turkish tool rows pointed at English category IDs, hiding them in navigation.
            # Keep the same category path while selecting its counterpart in this document language.
            if existing and existing.get('parent_id'):
                parent = next((d for d in before if d['id'] == existing['parent_id']), None)
                if parent and parent.get('lang') != p['lang']:
                    localized = indexed.get((parent.get('path'), p['lang']))
                    if localized and localized.get('section_id') == existing['section_id']:
                        fields['parent_id'] = localized['id']
            if existing:
                if any(existing.get(k) != v for k, v in fields.items()):
                    updates.append((existing, {**fields, 'updated_at': now}))
            else:
                inserts.append({**fields, 'path': p['path'], 'lang': p['lang'], 'id': str(uuid.uuid4()),
                    'slug': p['path'].replace('/', '-'), 'section_id': reference['section_id'],
                    'parent_id': reference['id'] if '/tools/' in p['path'] else reference.get('parent_id'),
                    'order': p['order'], 'published': True, 'created_at': now, 'updated_at': now})
        summary = {'update': len(updates), 'insert': len(inserts), 'paths': sorted({p['path'] for p in pages})}
        print(json.dumps(summary, ensure_ascii=False))
        if backup is None:
            return
        with backup.open('x') as f:
            json.dump({'documents': [d for d, _ in updates], 'inserted_documents': inserts}, f, ensure_ascii=False, indent=2)
        for old, fields in updates:
            query = {'id': old['id'], 'content': old.get('content'), 'updated_at': old.get('updated_at')}
            result = await db.documents.update_one(query, {'$set': fields})
            if result.matched_count != 1:
                raise RuntimeError('Concurrent CMS edit; stopped without overwriting ' + old['id'])
        for doc in inserts:
            await db.documents.insert_one(dict(doc))
        after = await db.documents.find({}, {'_id': 0}).to_list(None)
        changed = {old['id'] for old, _ in updates} | {d['id'] for d in inserts}
        if fingerprint([d for d in before if d['id'] not in changed]) != fingerprint([d for d in after if d['id'] not in changed]):
            raise RuntimeError('Unrelated document changed concurrently; inspect backup')
        current = {(d.get('path'), d.get('lang')): d for d in after}
        for p in pages:
            actual = current[p['path'], p['lang']]
            assert all(actual[k] == p[k] for k in ('title', 'excerpt', 'content'))
        print('Verified guide-only publication; Developer/API and all unrelated pages unchanged.')
    finally:
        client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    if args.apply and not args.backup:
        parser.error('--apply requires a new backup file')
    asyncio.run(publish(load_pages(args.source_dir), args.backup if args.apply else None))
