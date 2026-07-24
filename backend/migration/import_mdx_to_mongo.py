#!/usr/bin/env python3
"""
MDX → MongoDB Import Script

Reads all Mintlify docs (MDX files) from /root/verasist/docs/, parses them
according to docs.json navigation structure, converts MDX to HTML, and writes
directly to MongoDB for the verasist-docs backend.

Usage:
    cd /root/verasist/submodules/verasist-docs/backend
    # Set MONGO_URL and DB_NAME env vars (or create .env file)
    python migration/import_mdx_to_mongo.py

The script:
    1. Connects to MongoDB and clears tabs/sections/documents collections
    2. Parses docs.json to extract the full navigation hierarchy (3 tabs, all groups)
    3. Creates tabs and sections in MongoDB
    4. Processes each MDX file: frontmatter → metadata, MDX body → HTML
    5. Handles nested groups via parent_id for hierarchical sidebar display
    6. Reports statistics on processed/skipped files
"""

import asyncio
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# ═══════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════

DOCS_DIR = Path("/root/verasist/docs")
DOCS_JSON_PATH = DOCS_DIR / "docs.json"
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent

# Load .env from backend directory
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.environ.get("DB_NAME", "verasist_docs")


# ═══════════════════════════════════════════════════════════════════════
# MDX → HTML Conversion (from existing mdx_to_seed.py)
# ═══════════════════════════════════════════════════════════════════════

def parse_frontmatter(content: str):
    """Parse YAML frontmatter from MDX file. Returns (meta_dict, body_str)."""
    if not content.startswith("---"):
        return {}, content

    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    frontmatter_text = parts[1].strip()
    body = parts[2].strip()

    meta = {}
    for line in frontmatter_text.split("\n"):
        line = line.strip()
        if ":" in line:
            key, sep, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            meta[key] = value

    return meta, body


def convert_mdx_to_html(mdx_body: str) -> str:
    """Convert MDX body content to clean HTML, handling Mintlify components."""
    html = mdx_body

    # ── GFM Tables (must run before other markdown conversions) ──
    html = _convert_gfm_tables(html)

    # ── Mintlify components ──

    # <Note> → <blockquote class="note">
    html = re.sub(
        r"<Note>\s*\n?(.*?)\n?\s*</Note>",
        r'<blockquote class="note">\1</blockquote>',
        html, flags=re.DOTALL,
    )
    # <Warning> → <blockquote class="warning">
    html = re.sub(
        r"<Warning>\s*\n?(.*?)\n?\s*</Warning>",
        r'<blockquote class="warning">\1</blockquote>',
        html, flags=re.DOTALL,
    )
    # <Info> → <blockquote class="info">
    html = re.sub(
        r"<Info>\s*\n?(.*?)\n?\s*</Info>",
        r'<blockquote class="info">\1</blockquote>',
        html, flags=re.DOTALL,
    )
    # <Check /> → <span class="check">✓</span>
    html = re.sub(r"<Check\s*/>", '<span class="check">✓</span>', html)

    # <AccordionGroup> / <Accordion title="...">
    html = re.sub(
        r'<Accordion\s+title="([^"]*)"\s*>\s*\n?(.*?)\n?\s*</Accordion>',
        r"<details><summary>\1</summary>\2</details>",
        html, flags=re.DOTALL,
    )
    html = re.sub(
        r"<AccordionGroup>\s*\n?(.*?)\n?\s*</AccordionGroup>",
        r'<div class="accordion-group">\1</div>',
        html, flags=re.DOTALL,
    )

    # <Tabs> / <Tab title="...">
    html = re.sub(r"<Tabs>\s*\n?", '<div class="tabs">', html)
    html = re.sub(r"</Tabs>", "</div>", html)
    html = re.sub(
        r'<Tab\s+title="([^"]*)"\s*>\s*\n?(.*?)\n?\s*</Tab>',
        r'<div class="tab-content" data-tab="\1"><h4>\1</h4>\2</div>',
        html, flags=re.DOTALL,
    )

    # <CardGroup> / <Card title="..." icon="..." href="...">
    html = re.sub(r"<CardGroup\s+cols\s*=\s*{?\d*}?\s*>\s*\n?", '<div class="card-grid">', html)
    html = re.sub(r"</CardGroup>", "</div>", html)
    html = re.sub(
        r'<Card\s+title="([^"]*)"(?:\s+icon="([^"]*)")?(?:\s+href="([^"]*)")?\s*/>',
        r'<a href="\3" class="card"><strong>\1</strong></a>', html,
    )

    # <Frame>
    html = re.sub(
        r"<Frame>\s*\n?(.*?)\n?\s*</Frame>",
        r'<div class="frame">\1</div>',
        html, flags=re.DOTALL,
    )

    # <CodeGroup> — strip wrapper, keep inner code blocks
    html = re.sub(r"<CodeGroup>\s*\n?", "", html)
    html = re.sub(r"</CodeGroup>", "", html)

    # <Snippet file="..."> — strip, we don't have those files
    html = re.sub(r'<Snippet\s+file="[^"]*"\s*/>', "", html)

    # ── JSX <img> → HTML <img> (before markdown conversions) ──
    # Convert style={{...}} to inline style="..." and className→class
    html = re.sub(
        r'<img\s+(.*?)/?>',
        _convert_jsx_img,
        html,
        flags=re.DOTALL,
    )

    # ── Markdown → HTML ──

    # Fenced code blocks — mermaid gets special handling
    html = re.sub(
        r"```mermaid\n(.*?)```",
        r'<div class="mermaid">\n\1\n</div>',
        html, flags=re.DOTALL,
    )
    # Other fenced code blocks (```lang ... ```)
    html = re.sub(
        r"```(\w*)\n(.*?)```",
        r'<pre><code class="language-\1">\2</code></pre>',
        html, flags=re.DOTALL,
    )

    # Inline code
    html = re.sub(r"`([^`]+)`", r"<code>\1</code>", html)

    # Bold / Italic
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"\*(.+?)\*", r"<em>\1</em>", html)

    # Images ![alt](url)
    html = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" />', html)

    # Links [text](url)
    html = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', html)

    # ── Post-markdown normalizations ──

    # Normalize image paths: ../images/ → /images/ (after all img src are produced)
    html = re.sub(
        r'src="\.\./images/',
        r'src="/images/',
        html,
    )

    # Convert className→class on any HTML element (for iframe, img, div etc.)
    html = re.sub(r'className="', 'class="', html)

    # Headings (h1 → h2 since title is the h1)
    html = re.sub(r"^#### (.+)$", r"<h4>\1</h4>", html, flags=re.MULTILINE)
    html = re.sub(r"^### (.+)$", r"<h3>\1</h3>", html, flags=re.MULTILINE)
    html = re.sub(r"^## (.+)$", r"<h2>\1</h2>", html, flags=re.MULTILINE)
    html = re.sub(r"^# (.+)$", r"<h2>\1</h2>", html, flags=re.MULTILINE)

    # Blockquotes
    html = re.sub(r"^>\s?(.+)$", r"<blockquote>\1</blockquote>", html, flags=re.MULTILINE)

    # Horizontal rules
    html = re.sub(r"^---$", r"<hr />", html, flags=re.MULTILINE)

    # Unordered / Ordered lists
    html = re.sub(r"(?:^[-*]\s+.+\n?)+", _wrap_list_items_ul, html, flags=re.MULTILINE)
    html = re.sub(r"(?:^\d+\.\s+.+\n?)+", _wrap_list_items_ol, html, flags=re.MULTILINE)

    # Protect mermaid blocks: collapse inner newlines so paragraph splitting
    # doesn't break the diagram source.  Restore after paragraph wrapping.
    _MERMAID_PLACEHOLDER = "\x00MERMAID_NL\x00"
    html = re.sub(
        r"(<div class=\"mermaid\">)(.*?)(</div>)",
        lambda m: m.group(1) + m.group(2).replace("\n\n", _MERMAID_PLACEHOLDER) + m.group(3),
        html, flags=re.DOTALL,
    )

    # Paragraphs: wrap text blocks not already inside HTML tags
    paragraphs = html.split("\n\n")
    result = []
    block_tags = {
        "<pre", "<div", "<blockquote", "<ul", "<ol", "<h", "<hr",
        "<img", "<iframe", "<details", "<table", "<thead", "<tbody", "<tr", "<th", "<td",
        "<a ", "<strong", "<code", "<em", "<p", "<li",
    }
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if any(p.startswith(t) for t in block_tags):
            result.append(p)
        else:
            result.append(f"<p>{p}</p>")

    return "\n".join(result).replace(_MERMAID_PLACEHOLDER, "\n\n")


def _wrap_list_items_ul(match):
    items = match.group(0).strip()
    items = re.sub(r"^[-*]\s+", "<li>", items, flags=re.MULTILINE)
    lines = items.split("\n")
    wrapped = "\n".join(
        f"{line}</li>" if line.startswith("<li>") and not line.endswith("</li>") else line
        for line in lines
    )
    return f"<ul>\n{wrapped}\n</ul>"


def _convert_jsx_img(match: re.Match) -> str:
    """Convert JSX <img ... /> to plain HTML <img ... />.

    Handles:
      - style={{...}}  →  style="..."
      - className="..." → class="..."
      - Strips trailing />
    """
    attrs = match.group(1)

    # Convert style={{...}} → style="..."
    def _style_replacer(m):
        inner = m.group(1)
        # Convert JSX camelCase to CSS kebab-case in style object
        inner = re.sub(r'([a-z])([A-Z])', r'\1-\2', inner).lower()
        # Remove JSX {{ }} wrapper and quotes
        inner = inner.replace('"', '').replace("'", '')
        # Convert comma to semicolon
        inner = re.sub(r',\s*', '; ', inner)
        # Convert colon+space to colon
        inner = re.sub(r':\s+', ':', inner)
        return f'style="{inner}"'

    attrs = re.sub(r'style=\{\{([^}]+)\}\}', _style_replacer, attrs)

    # className="..." → class="..."
    attrs = re.sub(r'className="', 'class="', attrs)

    return f'<img {attrs.strip()} />'


def _convert_gfm_tables(text: str) -> str:
    """Convert GFM-style markdown tables to HTML <table> elements.

    Handles tables like:
        | Header 1 | Header 2 |
        |----------|----------|
        | Cell 1   | Cell 2   |

    Also handles tables WITHOUT leading/trailing pipes:
        Header 1 | Header 2
        ----------|----------
        Cell 1   | Cell 2
    """
    lines = text.split("\n")
    result: list[str] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        # Detect a potential table: must contain at least one | separator
        if "|" not in line or line.strip().startswith("<"):
            result.append(line)
            i += 1
            continue

        # Check if this line and the next line form a table header + separator
        stripped = line.strip()
        # Line should be a table row (starts/ends with | or contains at least 2 pipes)
        is_table_row = stripped.startswith("|") or stripped.endswith("|") or stripped.count("|") >= 1

        if not is_table_row:
            result.append(line)
            i += 1
            continue

        # Look ahead: we need at least 2 lines (header + separator)
        if i + 1 >= len(lines):
            result.append(line)
            i += 1
            continue

        next_line = lines[i + 1].strip()
        # Check if next line is a table separator: contains |, -, and : optionally
        is_separator = bool(re.match(r"^\|?[\s\-:]+\|[\s\-:|]+\|?$", next_line))

        if not is_separator:
            result.append(line)
            i += 1
            continue

        # We have a table! Collect all rows until a non-table line
        table_lines = [line]
        j = i + 1
        while j < len(lines):
            sep_line = lines[j].strip()
            if j == i + 1:
                # This is the separator line
                table_lines.append(lines[j])
                j += 1
                continue
            candidate = lines[j].strip()
            if candidate and ("|" in candidate):
                # Check if it looks like a table row (not a heading, list, or HTML)
                if not candidate.startswith("#") and not candidate.startswith("<") and not re.match(r"^[-*]\s", candidate):
                    table_lines.append(lines[j])
                    j += 1
                    continue
            break

        # Convert collected table lines to HTML
        html_table = _render_html_table(table_lines)
        result.append(html_table)
        i = j

    return "\n".join(result)


def _render_html_table(table_lines: list[str]) -> str:
    """Render GFM table lines as an HTML <table>."""
    if len(table_lines) < 2:
        return "\n".join(table_lines)

    # Parse header
    header_cells = _parse_table_row(table_lines[0])
    # Skip separator line (index 1)
    # Parse alignments from separator
    alignments = _parse_alignments(table_lines[1])

    # Build header
    thead = "<thead>\n<tr>\n"
    for idx, cell in enumerate(header_cells):
        align = alignments[idx] if idx < len(alignments) else ""
        align_attr = f' align="{align}"' if align else ""
        thead += f"<th{align_attr}>{cell.strip()}</th>\n"
    thead += "</tr>\n</thead>"

    # Build body
    tbody = "<tbody>\n"
    for line in table_lines[2:]:
        cells = _parse_table_row(line)
        tbody += "<tr>\n"
        for idx, cell in enumerate(cells):
            align = alignments[idx] if idx < len(alignments) else ""
            align_attr = f' align="{align}"' if align else ""
            tbody += f"<td{align_attr}>{cell.strip()}</td>\n"
        tbody += "</tr>\n"
    tbody += "</tbody>"

    return f"<table>\n{thead}\n{tbody}\n</table>"


def _parse_table_row(line: str) -> list[str]:
    """Parse a GFM table row into cells, stripping leading/trailing pipes."""
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [c for c in stripped.split("|")]


def _parse_alignments(separator_line: str) -> list[str]:
    """Parse column alignments from a GFM separator line."""
    cells = _parse_table_row(separator_line)
    alignments = []
    for cell in cells:
        cell = cell.strip().replace(" ", "")
        left = cell.startswith(":")
        right = cell.endswith(":")
        if left and right:
            alignments.append("center")
        elif right:
            alignments.append("right")
        elif left:
            alignments.append("left")
        else:
            alignments.append("")
    return alignments


def _wrap_list_items_ol(match):
    items = match.group(0).strip()
    items = re.sub(r"^\d+\.\s+", "<li>", items, flags=re.MULTILINE)
    lines = items.split("\n")
    wrapped = "\n".join(
        f"{line}</li>" if line.startswith("<li>") and not line.endswith("</li>") else line
        for line in lines
    )
    return f"<ol>\n{wrapped}\n</ol>"


# ═══════════════════════════════════════════════════════════════════════
# Navigation parsing: extract all pages from docs.json with tab/group info
# ═══════════════════════════════════════════════════════════════════════

def slugify_english(text: str) -> str:
    """Slugify text for use as document/section slug (English-friendly)."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or str(uuid.uuid4())[:8]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def collect_all_pages(docs_json: dict) -> list:
    """
    Traverse the full docs.json navigation and return a flat list of page dicts.
    Each dict: {"path": str, "tab": str, "group": str, "parent_group": str|None}
    """
    pages = []
    tabs = docs_json.get("navigation", {}).get("tabs", [])

    for tab in tabs:
        tab_name = tab.get("tab", "")
        for group in tab.get("groups", []):
            group_name = group.get("group", "")
            _collect_pages(group.get("pages", []), tab_name, group_name, None, pages)

    return pages


def _collect_pages(items, tab_name: str, group_name: str, parent_group: str | None, result: list):
    """Recursively collect page paths with their group hierarchy."""
    for item in items:
        if isinstance(item, str):
            result.append({
                "path": item,
                "tab": tab_name,
                "group": group_name,
                "parent_group": parent_group,
            })
        elif isinstance(item, dict):
            sub_pages = item.get("pages")
            sub_group = item.get("group")
            if sub_pages is not None and sub_group is not None:
                # This is a nested group (has a "group" key and "pages" key)
                _collect_pages(sub_pages, tab_name, sub_group, group_name, result)
            elif sub_pages is not None:
                # Has "pages" but no "group" — use current group
                _collect_pages(sub_pages, tab_name, group_name, parent_group, result)


# ═══════════════════════════════════════════════════════════════════════
# Tab & Section definitions
# ═══════════════════════════════════════════════════════════════════════

# Tab definitions — slugs match what server.py expects
TAB_DEFS = [
    {"slug": "rehberler", "title": "Guides", "order": 1},
    {"slug": "gelistirici", "title": "Developer", "order": 2},
    {"slug": "api-referansi", "title": "API Reference", "order": 3},
]

# Maps docs.json tab name → tab slug
TAB_NAME_TO_SLUG = {
    "Guides": "rehberler",
    "Developer": "gelistirici",
    "API Reference": "api-referansi",
}

# Maps (group_name, parent_group, tab_name) → (section_slug, section_title, tab_slug, order)
# Keys get progressively less specific: the lookup tries most-specific first.
# Use (group_name, parent_group, tab_name) for ambiguous entries,
# (group_name, tab_name) for groups unique within a tab,
# (group_name,) for globally unique groups.
GROUP_TO_SECTION = {
    # ── Guides tab ──
    ("Getting Started", None, "Guides"):    ("getting-started",       "Getting Started",       "rehberler", 1),
    ("Workflows", None, "Guides"):          ("workflows",              "Workflows",              "rehberler", 2),
    ("Nodes", "Workflows", "Guides"):       ("workflows-nodes",        "Nodes",                  "rehberler", 3),
    ("Tools", "Workflows", "Guides"):       ("workflows-tools",        "Tools",                  "rehberler", 4),
    # Workflows > Tools subgroups (voice-agent built-in/integration/custom tools)
    ("Built-in Tools", "Tools", "Guides"):  ("workflows-tools",        "Tools",                  "rehberler", 4),
    ("Integrations", "Tools", "Guides"):    ("workflows-tools",        "Tools",                  "rehberler", 4),
    ("Custom Tools", "Tools", "Guides"):    ("workflows-tools",        "Tools",                  "rehberler", 4),
    ("Planning", None, "Guides"):           ("planning",               "Planning",               "rehberler", 5),
    ("Analytics", None, "Guides"):          ("analytics",              "Analytics",              "rehberler", 6),
    # Top-level Integrations and its subgroups
    ("Integrations", None, "Guides"):       ("integrations",           "Integrations",           "rehberler", 7),
    ("Telephony", "Integrations", "Guides"):("telephony",              "Telephony",              "rehberler", 8),
    ("Channels", "Integrations", "Guides"): ("channels",               "Channels",               "rehberler", 9),
    ("E-Commerce", "Integrations", "Guides"):("ecommerce",             "E-Commerce",             "rehberler", 10),
    ("Applications", "Integrations", "Guides"):("applications",        "Applications",           "rehberler", 11),
    ("MCP", "Integrations", "Guides"):      ("mcp",                    "MCP",                    "rehberler", 12),

    # ── Developer tab ──
    ("Getting Started", None, "Developer"): ("dev-getting-started",    "Getting Started",       "gelistirici", 1),
    ("Core Concepts", None, "Developer"):   ("core-concepts",          "Core Concepts",         "gelistirici", 2),
    ("SDKs", None, "Developer"):            ("sdks",                   "SDKs",                   "gelistirici", 3),
    ("Definitions", None, "Developer"):     ("definitions",            "Definitions",            "gelistirici", 4),
    ("Configurations", None, "Developer"):  ("configurations",         "Configurations",         "gelistirici", 5),

    # ── API Reference tab ──
    ("Resources", None, "API Reference"):             ("api-resources",       "Resources",              "api-referansi", 1),
    ("API Keys", "Resources", "API Reference"):       ("api-keys",            "API Keys",               "api-referansi", 2),
    ("Agents", "Resources", "API Reference"):         ("agents",              "Agents",                 "api-referansi", 3),
    ("Runs", "Agents", "API Reference"):              ("runs",                "Runs",                   "api-referansi", 4),
    ("Runs", "Resources", "API Reference"):           ("runs",                "Runs",                   "api-referansi", 4),
    ("Campaigns", "Resources", "API Reference"):      ("campaigns",           "Campaigns",              "api-referansi", 5),
    ("Telephony Configurations", "Resources", "API Reference"): ("telephony-configs", "Telephony Configurations", "api-referansi", 6),
    ("Phone Numbers", "Telephony Configurations", "API Reference"): ("telephony-configs", "Telephony Configurations", "api-referansi", 6),
    ("Authentication & Errors", None, "API Reference"):("api-auth-errors",    "Authentication & Errors", "api-referansi", 7),
}

# Sections that should appear as nested-group parent documents (not as standalone sections)
# Key: (group_name, parent_group, tab_name) — matches GROUP_TO_SECTION key style
# These are groups from docs.json that have children — we create a parent doc for them
NESTED_GROUP_PARENTS = {
    ("Built-in Tools", "Tools", "Guides"):     {"parent_section": "workflows-tools", "parent_group": "Tools"},
    ("Integrations", "Tools", "Guides"):       {"parent_section": "workflows-tools", "parent_group": "Tools"},
    ("Custom Tools", "Tools", "Guides"):       {"parent_section": "workflows-tools", "parent_group": "Tools"},
    ("API Keys", "Resources", "API Reference"): {"parent_section": "api-keys",        "parent_group": "Resources"},
    ("Agents", "Resources", "API Reference"):   {"parent_section": "agents",          "parent_group": "Resources"},
    ("Runs", "Agents", "API Reference"):        {"parent_section": "runs",            "parent_group": "Agents"},
    ("Campaigns", "Resources", "API Reference"):{"parent_section": "campaigns",       "parent_group": "Resources"},
    ("Telephony Configurations", "Resources", "API Reference"): {"parent_section": "telephony-configs", "parent_group": "Resources"},
    ("Phone Numbers", "Telephony Configurations", "API Reference"): {"parent_section": "telephony-configs", "parent_group": "Telephony Configurations"},
}


# ═══════════════════════════════════════════════════════════════════════
# Main import logic
# ═══════════════════════════════════════════════════════════════════════

async def clear_collections(db):
    """Remove all existing tabs, sections, and documents."""
    print("Clearing existing collections...")
    await db.tabs.delete_many({})
    await db.sections.delete_many({})
    await db.documents.delete_many({})
    print("  ✓ tabs, sections, documents cleared")


async def create_indexes(db):
    """Create required MongoDB indexes (matching server.py on_startup)."""
    print("Creating indexes...")
    await db.tabs.create_index("slug", unique=True)
    await db.tabs.create_index("id", unique=True)
    await db.sections.create_index("slug", unique=True)
    await db.sections.create_index("id", unique=True)
    # Compound unique indexes for bilingual support: (slug, lang) and (path, lang)
    await db.documents.create_index([("slug", 1), ("lang", 1)], unique=True)
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index("section_id")
    await db.documents.create_index("parent_id")
    await db.documents.create_index([("path", 1), ("lang", 1)], unique=True, sparse=True)
    try:
        await db.documents.create_index(
            [("title", "text"), ("content", "text"), ("excerpt", "text")],
            default_language="none",
            name="text_search_idx",
        )
    except Exception:
        pass
    print("  ✓ indexes created")


async def create_tabs_and_sections(db):
    """Create tabs and sections in MongoDB. Returns {section_slug: section_id}."""
    print("\nCreating tabs...")
    tab_slug_to_id = {}
    for t in TAB_DEFS:
        tid = str(uuid.uuid4())
        tab_slug_to_id[t["slug"]] = tid
        await db.tabs.insert_one({
            "id": tid,
            "slug": t["slug"],
            "title": t["title"],
            "order": t["order"],
            "created_at": now_iso(),
        })
        print(f"  ✓ tab: {t['slug']} ({t['title']})")

    print("\nCreating sections...")
    # Deduplicate sections: collect unique (slug, title, tab) tuples
    seen_sections = {}
    for group_name, (sec_slug, sec_title, tab_slug, order) in GROUP_TO_SECTION.items():
        key = (sec_slug, tab_slug)
        if key not in seen_sections:
            seen_sections[key] = (sec_slug, sec_title, tab_slug, order)

    section_slug_to_id = {}
    for (sec_slug, tab_slug), (_, sec_title, _, order) in seen_sections.items():
        sid = str(uuid.uuid4())
        section_slug_to_id[sec_slug] = sid
        tab_id = tab_slug_to_id[tab_slug]
        await db.sections.insert_one({
            "id": sid,
            "slug": sec_slug,
            "title": sec_title,
            "order": order,
            "tab_id": tab_id,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        print(f"  ✓ section: {sec_slug} ({sec_title}) → tab={tab_slug}")

    return tab_slug_to_id, section_slug_to_id


async def import_documents(db, pages: list, section_slug_to_id: dict):
    """
    Process all pages: read MDX, convert to HTML, insert into MongoDB.
    Handles nested groups via parent_id.
    """
    print(f"\nProcessing {len(pages)} pages from docs.json...")

    # Track parent docs for nested groups: (section_slug, parent_group) → document_id
    nested_parent_ids: dict[tuple, str] = {}
    # Track order counters per (section_slug, parent_id) for correct ordering
    order_counters: dict[tuple, int] = {}

    processed = 0
    skipped_not_found = []
    skipped_no_title = []
    stats_by_section: dict[str, int] = {}

    for i, page in enumerate(pages):
        page_path = page["path"]
        tab_name = page["tab"]
        group_name = page["group"]
        parent_group = page.get("parent_group")

        # Find the MDX file
        mdx_path = DOCS_DIR / f"{page_path}.mdx"
        if not mdx_path.exists():
            skipped_not_found.append(page_path)
            if len(skipped_not_found) <= 20:  # Don't flood output
                print(f"  NOT FOUND: {page_path}")
            continue

        # Parse MDX
        try:
            content = mdx_path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"  ERROR reading {mdx_path}: {e}")
            skipped_not_found.append(page_path)
            continue

        meta, body = parse_frontmatter(content)
        title = meta.get("title", "")
        if not title:
            skipped_no_title.append(page_path)
            print(f"  NO TITLE: {page_path}")
            continue

        # Convert MDX body to HTML
        html = convert_mdx_to_html(body)

        # Determine section using composite key lookup
        # Try most-specific keys first: (group, parent_group, tab), then (group, parent_group), then (group, tab), then (group,)
        sec_info = None
        for key in [
            (group_name, parent_group, tab_name),
            (group_name, parent_group),
            (group_name, tab_name),
            (group_name,),
        ]:
            sec_info = GROUP_TO_SECTION.get(key)
            if sec_info is not None:
                break

        if not sec_info:
            print(f"  WARNING: Unknown group '{group_name}' for {page_path}, skipping")
            skipped_not_found.append(page_path)
            continue

        sec_slug, sec_title, tab_slug, _ = sec_info
        section_id = section_slug_to_id.get(sec_slug)
        if not section_id:
            print(f"  WARNING: No section_id for slug '{sec_slug}' ({page_path})")
            skipped_not_found.append(page_path)
            continue

        # Determine parent_id for nested groups (composite key lookup)
        parent_id = None
        if parent_group is not None:
            nested_info = None
            for key in [
                (group_name, parent_group, tab_name),
                (group_name, parent_group),
                (group_name, tab_name),
                (group_name,),
            ]:
                nested_info = NESTED_GROUP_PARENTS.get(key)
                if nested_info is not None:
                    break

            if nested_info:
                parent_key = (nested_info["parent_section"], group_name)
                if parent_key not in nested_parent_ids:
                    # Create a synthetic parent document for this nested group
                    parent_doc_id = str(uuid.uuid4())
                    parent_section_id = section_slug_to_id.get(nested_info["parent_section"], section_id)
                    nested_parent_ids[parent_key] = parent_doc_id
                    parent_doc = {
                        "id": parent_doc_id,
                        "slug": slugify_english(group_name),
                        "path": f"_parent/{slugify_english(group_name)}",
                        "title": group_name,
                        "section_id": parent_section_id,
                        "parent_id": None,
                        "content": f"<p>Documentation for {group_name}.</p>",
                        "excerpt": f"Overview of {group_name}",
                        "order": 0,
                        "published": True,
                        "lang": "en",
                        "created_at": now_iso(),
                        "updated_at": now_iso(),
                    }
                    # Don't include path at all — sparse unique index allows
                    # multiple documents without the path field.
                    await db.documents.insert_one(parent_doc)
                    print(f"  ✓ created parent doc: {group_name} (section={nested_info['parent_section']})")
                parent_id = nested_parent_ids[parent_key]

        # Document slug from path
        doc_slug = page_path.replace("/", "-")

        # Order: per (section_id, parent_id) scope
        order_key = (section_id, parent_id or "__root__")
        order_counters[order_key] = order_counters.get(order_key, 0) + 1
        order = order_counters[order_key]

        # Insert document
        doc = {
            "id": str(uuid.uuid4()),
            "slug": doc_slug,
            "path": page_path,
            "title": title,
            "section_id": section_id,
            "parent_id": parent_id,
            "content": html,
            "excerpt": meta.get("description", ""),
            "order": order,
            "published": True,
            "lang": "en",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.documents.insert_one(doc)

        processed += 1
        stats_by_section[sec_slug] = stats_by_section.get(sec_slug, 0) + 1

        if processed % 20 == 0:
            print(f"  ... {processed} documents processed")

    # Print summary of not-found if many were skipped silently
    if len(skipped_not_found) > 20:
        print(f"  ... and {len(skipped_not_found) - 20} more not found (see summary)")

    return processed, skipped_not_found, skipped_no_title, stats_by_section


async def main():
    print("=" * 60)
    print("  MDX → MongoDB Import Script")
    print("=" * 60)
    print(f"  Docs dir:    {DOCS_DIR}")
    print(f"  MongoDB:     {MONGO_URL}")
    print(f"  Database:    {DB_NAME}")
    print()

    # ── Connect to MongoDB ──
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    try:
        # Verify connection
        await client.admin.command("ping")
        print("✓ MongoDB connection successful\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to MongoDB: {e}")
        sys.exit(1)

    # ── Load docs.json ──
    if not DOCS_JSON_PATH.exists():
        print(f"ERROR: docs.json not found at {DOCS_JSON_PATH}")
        sys.exit(1)

    docs_json = json.loads(DOCS_JSON_PATH.read_text())

    # ── Collect all pages ──
    pages = collect_all_pages(docs_json)
    print(f"Pages found in docs.json: {len(pages)}")

    # Count by tab
    tab_counts = {}
    for p in pages:
        tab = p["tab"]
        tab_counts[tab] = tab_counts.get(tab, 0) + 1
    for tab, count in sorted(tab_counts.items()):
        print(f"  {tab}: {count} pages")

    # ── Phase 1: Clear existing data ──
    await clear_collections(db)

    # ── Phase 2: Create indexes ──
    await create_indexes(db)

    # ── Phase 3: Create tabs and sections ──
    tab_slug_to_id, section_slug_to_id = await create_tabs_and_sections(db)

    # ── Phase 4: Process MDX files and insert documents ──
    processed, skipped_not_found, skipped_no_title, stats_by_section = await import_documents(
        db, pages, section_slug_to_id
    )

    # ── Phase 5: Verify and report ──
    tab_count = await db.tabs.count_documents({})
    section_count = await db.sections.count_documents({})
    doc_count = await db.documents.count_documents({})

    print("\n" + "=" * 60)
    print("  IMPORT SUMMARY")
    print("=" * 60)
    print(f"  Tabs in MongoDB:      {tab_count}")
    print(f"  Sections in MongoDB:  {section_count}")
    print(f"  Documents in MongoDB: {doc_count}")
    print(f"  MDX files processed:  {processed}")
    print(f"  Skipped (not found):  {len(skipped_not_found)}")
    print(f"  Skipped (no title):   {len(skipped_no_title)}")
    print()

    if skipped_not_found:
        print("Files not found (no MDX exists):")
        for p in skipped_not_found:
            print(f"  - {p}")
        print()

    if skipped_no_title:
        print("Files with no title:")
        for p in skipped_no_title:
            print(f"  - {p}")
        print()

    print("Documents by section:")
    for sec_slug, count in sorted(stats_by_section.items()):
        # Find section title
        sec_title = sec_slug
        for group_name, (slug, title, _, _) in GROUP_TO_SECTION.items():
            if slug == sec_slug:
                sec_title = title
                break
        print(f"  {sec_slug} ({sec_title}): {count}")

    print("\n✓ Import complete.")

    # Close connection
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
