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

Extraction and report guides have a separate scoped publisher:

```bash
python backend/migration/sync_extraction_report_docs.py --docs-dir /path/to/verasist/docs --output /tmp/extraction-report-pages.json
python backend/migration/sync_extraction_report_docs.py --input /tmp/extraction-report-pages.json
python backend/migration/sync_extraction_report_docs.py --input /tmp/extraction-report-pages.json --apply --backup /private/new-extraction-report-backup.json
```

English sources are under `docs/guides/workflows/` and `docs/guides/analytics/` in
the main repository. Turkish sources are under the corresponding `content/guides/`
folders. Existing Turkish Agent/End Call content is retained in the reviewed HTML
policy with the extraction section corrected. This publisher accepts only the 14
reviewed pages, keeps existing IDs/slugs, adds Data Extraction under Nodes, and
parents Create Charts/Analyze Charts beneath the existing Reports document. It
previews by default and requires a new backup filename to apply. Preserve these
parent relationships when publishing selectively; no service restart is needed.


Current guide content
---------------------

`guides/updates/{en,tr}/` contains reviewed tool/live-operation content, with
JSON frontmatter and HTML bodies. `guides/tool-catalog.json` tracks the 37 tools.
Publish with `sync_guide_workshops.py --source-dir content/guides/updates`; it
previews unless `--apply --backup NEW_FILE` is supplied. Keep backups outside
Git and customer-publication overrides aligned. Existing Mermaid diagrams
remain; only the IP PBX and SIP Trunk guides embed a Three.js workshop.

Visible telephony terminology uses **ARI endpoint** for ARI access and **SIP gateway** for SIP transport. Preserve executable examples and official source URLs. `backend/migration/rename_ari_endpoint.py` previews scoped display-text changes; apply with `--apply --backup NEW_FILE`. It preserves document IDs, routes, HTML attributes and code blocks.
