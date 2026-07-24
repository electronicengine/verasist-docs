#!/usr/bin/env python3
"""
MDX → Turkish HTML Content Migration Script

Reads Mintlify docs (MDX files) and:
1. Parses the docs.json navigation structure to extract Guide tab content
2. Parses each MDX file (frontmatter + body)
3. Converts MDX body to HTML (handling Mintlify components)
4. Outputs a ready-to-use seed data structure for verasist-docs MongoDB

Usage:
    python migration/mdx_to_seed.py > migration/seed_output.json

The output JSON can be used to:
- Update the SEED_DOCS / SEED_SECTIONS in backend/server.py
- Or be imported directly via a migration script
"""

import json
import re
import os
import sys
from pathlib import Path
from typing import Optional

# --- Configuration ---
DOCS_DIR = Path("/root/verasist/docs")
DOCS_JSON_PATH = DOCS_DIR / "docs.json"
OUTPUT_DIR = Path("/root/verasist/submodules/verasist-docs/backend/migration")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# --- Mintlify component → HTML mapping ---
# These regex patterns convert common Mintlify MDX components to HTML

def convert_mdx_to_html(mdx_body: str) -> str:
    """Convert MDX body content to clean HTML."""
    html = mdx_body

    # --- GFM Tables (must run before other markdown conversions) ---
    html = _convert_gfm_tables(html)

    # --- Mintlify components ---

    # <Note> → <blockquote class="note">
    html = re.sub(r'<Note>\s*\n?(.*?)\n?\s*</Note>', r'<blockquote class="note">\1</blockquote>', html, flags=re.DOTALL)

    # <Warning> → <blockquote class="warning">
    html = re.sub(r'<Warning>\s*\n?(.*?)\n?\s*</Warning>', r'<blockquote class="warning">\1</blockquote>', html, flags=re.DOTALL)

    # <Info> → <blockquote class="info">
    html = re.sub(r'<Info>\s*\n?(.*?)\n?\s*</Info>', r'<blockquote class="info">\1</blockquote>', html, flags=re.DOTALL)

    # <Check> → <span class="check">✓</span>
    html = re.sub(r'<Check\s*/>', '<span class="check">✓</span>', html)

    # <AccordionGroup> / <Accordion title="..."> → <details>/<summary>
    html = re.sub(r'<Accordion\s+title="([^"]*)"\s*>\s*\n?(.*?)\n?\s*</Accordion>',
                  r'<details><summary>\1</summary>\2</details>', html, flags=re.DOTALL)
    html = re.sub(r'<AccordionGroup>\s*\n?(.*?)\n?\s*</AccordionGroup>',
                  r'<div class="accordion-group">\1</div>', html, flags=re.DOTALL)

    # <Tabs> / <Tab title="..."> → tab container (simplified as section headers)
    html = re.sub(r'<Tabs>\s*\n?', '<div class="tabs">', html)
    html = re.sub(r'</Tabs>', '</div>', html)
    html = re.sub(r'<Tab\s+title="([^"]*)"\s*>\s*\n?(.*?)\n?\s*</Tab>',
                  r'<div class="tab-content" data-tab="\1"><h4>\1</h4>\2</div>', html, flags=re.DOTALL)

    # <CardGroup> / <Card title="..." icon="..." href="..."> → link cards
    html = re.sub(r'<CardGroup\s+cols\s*=\s*{?\d*}?\s*>\s*\n?', '<div class="card-grid">', html)
    html = re.sub(r'</CardGroup>', '</div>', html)
    html = re.sub(r'<Card\s+title="([^"]*)"(?:\s+icon="([^"]*)")?(?:\s+href="([^"]*)")?\s*/>',
                  r'<a href="\3" class="card"><strong>\1</strong></a>', html)

    # <Frame> → <div class="frame">
    html = re.sub(r'<Frame>\s*\n?(.*?)\n?\s*</Frame>',
                  r'<div class="frame">\1</div>', html, flags=re.DOTALL)

    # <CodeGroup> → preserve code blocks
    html = re.sub(r'<CodeGroup>\s*\n?', '', html)
    html = re.sub(r'</CodeGroup>', '', html)

    # --- JSX <img> → HTML <img> (before markdown conversions) ---
    html = re.sub(r'<img\s+(.*?)/?>', _convert_jsx_img, html, flags=re.DOTALL)

    # --- Markdown → HTML conversions ---

    # Code blocks — mermaid gets special handling
    html = re.sub(r'```mermaid\n(.*?)```', r'<div class="mermaid">\n\1\n</div>', html, flags=re.DOTALL)
    # Other fenced code blocks
    html = re.sub(r'```(\w*)\n(.*?)```', r'<pre><code class="language-\1">\2</code></pre>', html, flags=re.DOTALL)

    # Inline code (`code`)
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)

    # Bold (**text**)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)

    # Italic (*text*)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

    # Images ![alt](url)
    html = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img src="\2" alt="\1" />', html)

    # Links [text](url)
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)

    # --- Post-markdown normalizations ---

    # Normalize image paths: ../images/ → /images/
    html = re.sub(r'src="\.\./images/', r'src="/images/', html)

    # Convert className→class on any HTML element
    html = re.sub(r'className="', 'class="', html)

    # Headings
    html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)  # h1 → h2 (title is separate)

    # Unordered lists
    html = re.sub(r'(?:^[-*]\s+.+\n?)+', _wrap_list_items_ul, html, flags=re.MULTILINE)

    # Ordered lists
    html = re.sub(r'(?:^\d+\.\s+.+\n?)+', _wrap_list_items_ol, html, flags=re.MULTILINE)

    # Blockquotes (> text)
    html = re.sub(r'^>\s?(.+)$', r'<blockquote>\1</blockquote>', html, flags=re.MULTILINE)

    # Horizontal rules
    html = re.sub(r'^---$', r'<hr />', html, flags=re.MULTILINE)

    # Protect mermaid blocks: collapse inner \n\n before paragraph splitting
    _MERMAID_PLACEHOLDER = '\x00MERMAID_NL\x00'
    html = re.sub(
        r'(<div class="mermaid">)(.*?)(</div>)',
        lambda m: m.group(1) + m.group(2).replace('\n\n', _MERMAID_PLACEHOLDER) + m.group(3),
        html, flags=re.DOTALL,
    )

    # Paragraphs (double newlines)
    paragraphs = html.split('\n\n')
    result = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if p.startswith('<') and not p.startswith('<a ') and not p.startswith('<strong') and not p.startswith('<code') and not p.startswith('<em'):
            result.append(p)
        elif p.startswith('<pre') or p.startswith('<div') or p.startswith('<blockquote') or p.startswith('<ul') or p.startswith('<ol') or p.startswith('<h') or p.startswith('<hr') or p.startswith('<img') or p.startswith('<details') or p.startswith('<table') or p.startswith('<thead') or p.startswith('<tbody') or p.startswith('<tr') or p.startswith('<th') or p.startswith('<td'):
            result.append(p)
        else:
            result.append(f'<p>{p}</p>')

    return '\n'.join(result).replace(_MERMAID_PLACEHOLDER, '\n\n')


def _wrap_list_items_ul(match):
    """Wrap markdown list items in <ul> tags."""
    items = match.group(0).strip()
    items = re.sub(r'^[-*]\s+', '<li>', items, flags=re.MULTILINE)
    items = re.sub(r'$', '</li>', items, flags=re.MULTILINE)
    # Add closing </li> to each line
    lines = items.split('\n')
    wrapped = '\n'.join(f'{line}</li>' if line.startswith('<li>') and not line.endswith('</li>') else line for line in lines)
    return f'<ul>\n{wrapped}\n</ul>'


def _convert_jsx_img(match: re.Match) -> str:
    """Convert JSX <img ... /> to plain HTML <img ... />."""
    attrs = match.group(1)

    # Convert style={{...}} → style="..."
    def _style_replacer(m):
        inner = m.group(1)
        inner = re.sub(r'([a-z])([A-Z])', r'\1-\2', inner).lower()
        inner = inner.replace('"', '').replace("'", '')
        inner = re.sub(r',\s*', '; ', inner)
        inner = re.sub(r':\s+', ':', inner)
        return f'style="{inner}"'

    attrs = re.sub(r'style=\{\{([^}]+)\}\}', _style_replacer, attrs)

    # className="..." → class="..."
    attrs = re.sub(r'className="', 'class="', attrs)

    return f'<img {attrs.strip()} />'


def _wrap_list_items_ol(match):
    """Wrap markdown ordered list items in <ol> tags."""
    items = match.group(0).strip()
    items = re.sub(r'^\d+\.\s+', '<li>', items, flags=re.MULTILINE)
    lines = items.split('\n')
    wrapped = '\n'.join(f'{line}</li>' if line.startswith('<li>') and not line.endswith('</li>') else line for line in lines)
    return f'<ol>\n{wrapped}\n</ol>'


def _convert_gfm_tables(text: str) -> str:
    """Convert GFM-style markdown tables to HTML <table> elements."""
    lines = text.split('\n')
    result: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        if '|' not in line or line.strip().startswith('<'):
            result.append(line)
            i += 1
            continue

        stripped = line.strip()
        is_table_row = stripped.startswith('|') or stripped.endswith('|') or stripped.count('|') >= 1
        if not is_table_row:
            result.append(line)
            i += 1
            continue

        if i + 1 >= len(lines):
            result.append(line)
            i += 1
            continue

        next_line = lines[i + 1].strip()
        is_separator = bool(re.match(r'^\|?[\s\-:]+\|[\s\-:|]+\|?$', next_line))
        if not is_separator:
            result.append(line)
            i += 1
            continue

        # Collect table rows
        table_lines = [line]
        j = i + 1
        while j < len(lines):
            candidate = lines[j].strip()
            if j == i + 1:
                table_lines.append(lines[j])
                j += 1
                continue
            if candidate and ('|' in candidate):
                if not candidate.startswith('#') and not candidate.startswith('<') and not re.match(r'^[-*]\s', candidate):
                    table_lines.append(lines[j])
                    j += 1
                    continue
            break

        html_table = _render_html_table(table_lines)
        result.append(html_table)
        i = j

    return '\n'.join(result)


def _render_html_table(table_lines: list[str]) -> str:
    """Render GFM table lines as an HTML <table>."""
    if len(table_lines) < 2:
        return '\n'.join(table_lines)

    header_cells = _parse_table_row(table_lines[0])
    alignments = _parse_alignments(table_lines[1])

    thead = '<thead>\n<tr>\n'
    for idx, cell in enumerate(header_cells):
        align = alignments[idx] if idx < len(alignments) else ''
        align_attr = f' align="{align}"' if align else ''
        thead += f'<th{align_attr}>{cell.strip()}</th>\n'
    thead += '</tr>\n</thead>'

    tbody = '<tbody>\n'
    for line in table_lines[2:]:
        cells = _parse_table_row(line)
        tbody += '<tr>\n'
        for idx, cell in enumerate(cells):
            align = alignments[idx] if idx < len(alignments) else ''
            align_attr = f' align="{align}"' if align else ''
            tbody += f'<td{align_attr}>{cell.strip()}</td>\n'
        tbody += '</tr>\n'
    tbody += '</tbody>'

    return f'<table>\n{thead}\n{tbody}\n</table>'


def _parse_table_row(line: str) -> list[str]:
    """Parse a GFM table row into cells."""
    stripped = line.strip()
    if stripped.startswith('|'):
        stripped = stripped[1:]
    if stripped.endswith('|'):
        stripped = stripped[:-1]
    return [c for c in stripped.split('|')]


def _parse_alignments(separator_line: str) -> list[str]:
    """Parse column alignments from a GFM separator line."""
    cells = _parse_table_row(separator_line)
    alignments = []
    for cell in cells:
        cell = cell.strip().replace(' ', '')
        left = cell.startswith(':')
        right = cell.endswith(':')
        if left and right:
            alignments.append('center')
        elif right:
            alignments.append('right')
        elif left:
            alignments.append('left')
        else:
            alignments.append('')
    return alignments


def parse_frontmatter(content: str):
    """Parse YAML frontmatter from MDX file."""
    if not content.startswith('---'):
        return {}, content

    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content

    frontmatter_text = parts[1].strip()
    body = parts[2].strip()

    # Simple YAML parser (title: "value", description: "value")
    meta = {}
    for line in frontmatter_text.split('\n'):
        line = line.strip()
        if ':' in line:
            key, _, value = line.partition(':')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            meta[key] = value

    return meta, body


def extract_path_from_filename(filepath: Path) -> str:
    """Convert MDX file path to Mintlify URL path.
    E.g., /root/verasist/docs/voice-agent/start-call.mdx → voice-agent/start-call
    """
    rel = filepath.relative_to(DOCS_DIR)
    # Remove .mdx extension
    path = str(rel).replace('.mdx', '')
    # Handle index files: getting-started/index → getting-started
    if path.endswith('/index'):
        path = path[:-6]
    return path


def collect_guides_pages(docs_json: dict) -> list:
    """
    Traverse the docs.json navigation structure and collect all page paths
    under the "Guides" tab.
    """
    pages = []
    tabs = docs_json.get("navigation", {}).get("tabs", [])

    for tab in tabs:
        if tab.get("tab") != "Guides":
            continue

        for group in tab.get("groups", []):
            group_name = group.get("group", "")
            group_pages = group.get("pages", [])
            _collect_pages(group_pages, group_name, pages)

    return pages


def _collect_pages(pages_list, group_name: str, result: list):
    """Recursively collect page paths from navigation structure."""
    for item in pages_list:
        if isinstance(item, str):
            # Simple page reference
            result.append({"path": item, "group": group_name})
        elif isinstance(item, dict):
            if "pages" in item:
                # Nested group
                sub_group = item.get("group", group_name)
                _collect_pages(item["pages"], sub_group, result)
            elif "page" in item:
                # Usually referenced in API reference
                pass


def process_mdx_file(filepath: Path) -> Optional[dict]:
    """Parse a single MDX file and return document data."""
    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        print(f"  WARNING: Could not read {filepath}: {e}", file=sys.stderr)
        return None

    meta, body = parse_frontmatter(content)
    if not meta.get("title"):
        print(f"  WARNING: No title in {filepath}", file=sys.stderr)
        return None

    path = extract_path_from_filename(filepath)
    html = convert_mdx_to_html(body)

    return {
        "path": path,
        "title": meta.get("title", filepath.stem),
        "excerpt": meta.get("description", ""),
        "content": html,
        "source_file": str(filepath),
    }


# --- Section mapping ---
# Maps Mintlify group names to Turkish section slugs
GROUP_TO_SECTION = {
    "Getting started": "baslangic",
    "Core Concepts": "temel-kavramlar",
    "Configurations": "yapilandirma",
    "Voice Agent Builder": "sesli-asistan",
    "Telephony": "telefon",
    "Channels": "kanallar",
    "Other Integrations": "entegrasyonlar",
}

SECTION_ORDER = {
    "baslangic": 1,
    "temel-kavramlar": 2,
    "yapilandirma": 3,
    "sesli-asistan": 4,
    "telefon": 5,
    "kanallar": 6,
    "entegrasyonlar": 7,
}

SECTION_TITLES = {
    "baslangic": "Başlangıç",
    "temel-kavramlar": "Temel Kavramlar",
    "yapilandirma": "Yapılandırma",
    "sesli-asistan": "Sesli Asistan Oluşturucu",
    "telefon": "Telefon",
    "kanallar": "Kanallar",
    "entegrasyonlar": "Diğer Entegrasyonlar",
}


def main():
    print("=== MDX → Seed Data Migration ===", file=sys.stderr)
    print(f"Docs directory: {DOCS_DIR}", file=sys.stderr)

    # Load docs.json
    if not DOCS_JSON_PATH.exists():
        print(f"ERROR: docs.json not found at {DOCS_JSON_PATH}", file=sys.stderr)
        sys.exit(1)

    docs_json = json.loads(DOCS_JSON_PATH.read_text())

    # Collect all Guides pages
    pages = collect_guides_pages(docs_json)
    print(f"Found {len(pages)} pages in Guides tab", file=sys.stderr)

    # Process each page
    documents = []
    not_found = []
    for page in pages:
        page_path = page["path"]
        group = page["group"]

        # Find the MDX file
        mdx_path = DOCS_DIR / f"{page_path}.mdx"
        if not mdx_path.exists():
            not_found.append(page_path)
            print(f"  NOT FOUND: {mdx_path}", file=sys.stderr)
            continue

        doc = process_mdx_file(mdx_path)
        if doc:
            doc["group"] = group
            doc["section_slug"] = GROUP_TO_SECTION.get(group, "diger")
            documents.append(doc)
            print(f"  OK: {page_path}", file=sys.stderr)

    print(f"\nProcessed {len(documents)} documents", file=sys.stderr)
    if not_found:
        print(f"Not found ({len(not_found)}):", file=sys.stderr)
        for p in not_found:
            print(f"  - {p}", file=sys.stderr)

    # Generate output: Python seed data format
    sections_output = []
    for slug, title in SECTION_TITLES.items():
        sections_output.append({
            "slug": slug,
            "title": title,
            "order": SECTION_ORDER[slug],
        })

    docs_output = []
    for doc in documents:
        section_slug = doc["section_slug"]
        order = documents.index(doc) + 1
        docs_output.append({
            "section_slug": section_slug,
            "slug": doc["path"].replace("/", "-"),
            "path": doc["path"],
            "title": doc["title"],
            "excerpt": doc.get("excerpt", ""),
            "order": order,
            "content": doc["content"],
        })

    result = {
        "sections": sections_output,
        "documents": docs_output,
        "stats": {
            "total_docs": len(documents),
            "not_found": len(not_found),
            "by_section": {},
        },
    }

    # Count by section
    for doc in documents:
        sec = doc["section_slug"]
        result["stats"]["by_section"][sec] = result["stats"]["by_section"].get(sec, 0) + 1

    # Write output
    output_path = OUTPUT_DIR / "seed_data.json"
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nOutput written to: {output_path}", file=sys.stderr)

    # Also generate a summary
    print("\n=== Summary ===", file=sys.stderr)
    for sec, count in sorted(result["stats"]["by_section"].items()):
        print(f"  {SECTION_TITLES.get(sec, sec)}: {count} documents", file=sys.stderr)

    return result


if __name__ == "__main__":
    main()
