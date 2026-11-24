# Customer documentation publication

The public site documents the hosted Verasist service at `https://app.verasist.ai`.
Keep platform deployment, environment-variable reference, source development and server operations out of customer documentation. Customer application code, API keys, callback services and device audio setup belong in the integration guides.

`customer-publication.json` records excluded paths and reviewed English/Turkish HTML overrides for existing pages. The MDX importer applies this policy to imported documents. SDK pages have their own bilingual MDX sources and selective sync script.

To apply the policy to an existing documentation database (with the backend environment configured):

```bash
python backend/migration/customer_publication.py
python backend/migration/customer_publication.py --apply --backup /tmp/customer-docs-before.json
```

The first command previews the scope. The second requires a new backup filename, updates only listed pages, and removes excluded paths in every language. Existing document IDs and slugs are preserved for retained pages. Removal is intentional: `published=False` alone does not prevent access through the public path and slug endpoints.

Keep backups outside Git. Before publishing, check navigation, direct path/slug responses, links to retired pages, and SDK examples. SDK development and deployment instructions can remain in the private engineering repository; do not add them to this site's source list.

The Turkish agent terminology migration previews its changes by default:

```bash
python backend/migration/rename_agent_terminology.py
python backend/migration/rename_agent_terminology.py --apply --backup /tmp/agent-terminology-before.json
```

It updates display text in Turkish documents and video descriptions, preserving page identifiers, links and English content.

Telephone guides use the English MDX pages in the main repository's `docs/` tree
and the Turkish MDX sources under `content/guides/integrations/telephony/tr/`.
Build and preview the selective publication before applying it:

```bash
python backend/migration/sync_telephony_docs.py --docs-dir /path/to/verasist/docs --output /tmp/telephony-pages.json
python backend/migration/sync_telephony_docs.py --input /tmp/telephony-pages.json
python backend/migration/sync_telephony_docs.py --input /tmp/telephony-pages.json --apply --backup /private/new-telephony-backup.json
```

The sync updates the 24 reviewed English/Turkish telephone pages, creates only
missing IP PBX pages, preserves existing IDs/slugs, and removes retired YouTube
and Dograh/Dobra tutorial links without rewriting unrelated page text. A new
backup file is mandatory for applying; concurrent CMS content edits stop the sync.
The customer-publication import guard also removes retired video links so a later
import cannot restore them. Keep reviewed HTML overrides in
`customer-publication.json` aligned with these MDX sources.
