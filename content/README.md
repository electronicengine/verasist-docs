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
