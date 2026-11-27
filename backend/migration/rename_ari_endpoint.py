"""Rename visible telephony terminology; preview by default, back up before applying."""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path


def rename(text):
    # Preserve URLs, HTML attributes and executable examples verbatim.
    protected = r'(<pre\b[^>]*>.*?</pre>|<code\b[^>]*>.*?</code>|```.*?```|`[^`]*`|https?://[^\s<>\)\]"\']+|<[^>]*>)'
    parts = re.split(protected, text, flags=re.S | re.I)
    for i in range(0, len(parts), 2):
        s = parts[i]
        for old, new in (
            ('Asterisk/FreePBX', 'IP PBX'),
            ('Asterisk SIP Trunk', 'SIP Trunk'),
            ("Verasist's managed Asterisk gateway", "Verasist's managed SIP gateway"),
            ("Verasist'in yönetilen Asterisk ağ geçidi", "Verasist'in yönetilen SIP ağ geçidi"),
            ("Verasist’in Asterisk katmanı", "Verasist’in SIP katmanı"),
            ('Asterisk call events', 'ARI endpoint call events'),
            ('your Asterisk server', 'your PBX'),
            ('over Asterisk', 'through your PBX'),
            ("Asterisk's NAT guide", 'PBX NAT configuration guide'),
            ('Asterisk NAT rehberine', 'PBX NAT rehberine'),
            ('Asterisk ARI', 'ARI endpoint'),
        ):
            s = s.replace(old, new)
        parts[i] = re.sub(r'\bAsterisk\b', 'ARI endpoint', s, flags=re.I)
    return ''.join(parts)


async def main(apply, backup):
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        changes = []
        async for page in db.documents.find({}):
            before = {k: page[k] for k in ('title', 'content', 'excerpt') if isinstance(page.get(k), str)}
            after = {k: rename(v) for k, v in before.items()}
            if before != after:
                changes.append(dict(id=page['id'], path=page.get('path'), lang=page.get('lang'), before=before, after=after))
        if apply:
            with Path(backup).open('x') as f:
                json.dump(changes, f, ensure_ascii=False, indent=2)
            for c in changes:
                result = await db.documents.update_one({'id': c['id'], **c['before']}, {'$set': c['after']})
                if result.matched_count != 1:
                    raise RuntimeError('Concurrent content edit: ' + c['id'])
        print(json.dumps({'mode': 'applied' if apply else 'preview', 'count': len(changes), 'pages': [{'path': c['path'], 'lang': c['lang']} for c in changes]}, ensure_ascii=False))
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
