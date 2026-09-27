"""Apply the customer documentation policy without replacing unrelated content.

Dry run: python migration/customer_publication.py
Apply: python migration/customer_publication.py --apply --backup /tmp/customer-docs-backup.json
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[2] / 'content/customer-publication.json'


def load_policy():
    return json.loads(POLICY_PATH.read_text())


def customer_document(document):
    """Shared import guard: exclude internal pages and apply reviewed customer copy."""
    policy = load_policy()
    if document.get('path') in policy['excluded_paths']:
        return None
    for override in policy['overrides']:
        if (override['path'], override['lang']) == (document.get('path'), document.get('lang')):
            return {**document, 'content': override['content']}
    return document


async def apply(backup):
    from motor.motor_asyncio import AsyncIOMotorClient
    policy = load_policy()
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    try:
        db = client[os.environ.get('DB_NAME', 'verasist_docs')]
        selectors = [{'path': path} for path in policy['excluded_paths']]
        selectors += [{'path': p['path'], 'lang': p['lang']} for p in policy['overrides']]
        previous = await db.documents.find({'$or': selectors}, {'_id': 0}).to_list(None)
        with backup.open('x') as stream:
            json.dump(previous, stream, ensure_ascii=False, indent=2, default=str)
        updated = 0
        for page in policy['overrides']:
            key = {'path': page['path'], 'lang': page['lang']}
            if await db.documents.count_documents(key) != 1:
                raise ValueError(f'Expected one document: {key}')
        for page in policy['overrides']:
            result = await db.documents.update_one({'path': page['path'], 'lang': page['lang']}, {'$set': {'content': page['content']}})
            updated += result.matched_count
        # Deleting the public documents also removes direct path/slug access.
        # Simply setting published=False does not hide them from the current public API.
        removed = await db.documents.delete_many({'path': {'$in': policy['excluded_paths']}})
        print(f'Updated {updated} customer pages; removed {removed.deleted_count} internal pages. Backup: {backup}')
    finally:
        client.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    if args.apply:
        if not args.backup:
            parser.error('--apply requires --backup')
        asyncio.run(apply(args.backup))
    else:
        policy = load_policy()
        print(f"Would update {len(policy['overrides'])} pages and remove paths: {policy['excluded_paths']}")
