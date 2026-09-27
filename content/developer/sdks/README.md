# SDK documentation

Customer-facing English source: main Verasist repository `docs/developer/sdks/*.mdx`.
`en/` mirrors those pages; `tr/` contains their Turkish translations and the same executable examples.

To refresh the live documentation, use `backend/migration/sync_sdk_docs.py` with the backend dependencies installed:

```bash
python backend/migration/sync_sdk_docs.py --output /tmp/sdk-pages.json
# Configure MONGO_URL and DB_NAME for the intended documentation instance.
python backend/migration/sync_sdk_docs.py --input /tmp/sdk-pages.json --apply --backup /tmp/sdk-pages-before.json
```

The first command only renders a payload. The second backs up existing SDK documents and updates exactly seven customer-facing paths in English and Turkish. It preserves existing IDs/slugs/publication state and does not clear collections. A pre-existing backup filename is rejected. Keep the backup outside the repository.

Do not run the full `import_mdx_to_mongo.py` entry point for this update: it clears collections. The selective script only imports its rendering helpers, protecting code fences before HTML conversion.

Verification: compile TypeScript examples, execute Python/TypeScript examples with mocked HTTP/media, check internal links, and confirm each code block survives HTML conversion. Device audio and real provider calls require a separate integration check.

Internal SDK development is intentionally excluded. Apply `backend/migration/customer_publication.py` after importing documentation to remove retired internal pages and apply the customer content policy.
