"""Preview terminology updates; apply with --apply --backup PATH. Run in docs backend."""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

WORD = re.compile(r'\basistan', re.IGNORECASE)
FIELDS = ('title', 'content', 'excerpt')


def rename(text):
    def replacement(match):
        word = match.group()
        return 'AJAN' if word.isupper() else 'Ajan' if word[0].isupper() else 'ajan'
    def visible_attribute(match):
        return match[1] + WORD.sub(replacement, match[2]) + match[3]
    parts = []
    for part in re.split(r'(<[^>]*>)', text):
        if part.startswith('<'):
            part = re.sub(r'''((?:title|alt|aria-label)\s*=\s*["'])(.*?)(["'])''',
                          visible_attribute, part)
        else:
            part = WORD.sub(replacement, part)
        parts.append(part)
    return ''.join(parts)


async def main(apply, backup):
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        changes = []
        for collection, query, fields in (
            ('documents', {'lang': 'tr'}, FIELDS),
            ('videos', {}, ('title', 'description')),
        ):
            async for page in db[collection].find(query):
                before = {key: page[key] for key in fields if isinstance(page.get(key), str)}
                after = {key: rename(value) for key, value in before.items()}
                if before != after:
                    changes.append({'collection': collection, 'id': page['id'],
                                    'path': page.get('path'), 'before': before, 'after': after})
        if apply:
            with Path(backup).open('x') as stream:
                json.dump(changes, stream, ensure_ascii=False, indent=2)
            for change in changes:
                # Avoid overwriting a concurrent editor's changes.
                selector = {'id': change['id'], **change['before']}
                result = await db[change['collection']].update_one(selector, {'$set': change['after']})
                if result.matched_count != 1:
                    raise RuntimeError(f"Document changed during update: {change['id']}")
                actual = await db[change['collection']].find_one({'id': change['id']})
                assert actual.get('path') == change['path']
                assert all(actual[key] == value for key, value in change['after'].items())
        print(json.dumps({'mode': 'applied' if apply else 'preview', 'records': len(changes),
                          'documents': sum(c['collection'] == 'documents' for c in changes),
                          'videos': sum(c['collection'] == 'videos' for c in changes)}))
    finally:
        client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup')
    args = parser.parse_args()
    if args.apply and not args.backup:
        parser.error('--apply requires --backup')
    asyncio.run(main(args.apply, args.backup))
