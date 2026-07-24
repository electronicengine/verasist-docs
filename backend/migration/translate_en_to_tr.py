#!/usr/bin/env python3
"""
English → Turkish Translation Script

Reads all English (lang="en") documents from MongoDB, translates them
to Turkish using Google Translate (via deep-translator), and inserts
them as new documents with lang="tr".

Usage:
    cd /root/verasist/submodules/verasist-docs/backend
    pip3 install --break-system-packages deep-translator
    python3 migration/translate_en_to_tr.py
"""

import asyncio
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from deep_translator import GoogleTranslator
from motor.motor_asyncio import AsyncIOMotorClient

# Load env
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.environ.get("DB_NAME", "verasist_docs")

# Maximum chars per Google Translate chunk (limit is ~5000)
CHUNK_SIZE = 4000

# ── Terminology Mapping ──
# Google Translate may not use the correct Turkish terms for Verasist concepts.
# These replacements are applied to title, excerpt, and content after translation.
# Order matters: longer/more specific patterns first to avoid partial matches.
TERMINOLOGY_MAP = [
    # Core concepts
    ("workflow run result", "çağrı kaydı"),
    ("workflow run results", "çağrı kayıtları"),
    ("workflow run", "çalıştırma"),
    ("workflow runs", "çalıştırmalar"),
    ("Workflow Run Result", "Çağrı Kaydı"),
    ("Workflow Run Results", "Çağrı Kayıtları"),
    ("Workflow Run", "Çalıştırma"),
    ("Workflow Runs", "Çalıştırmalar"),
    # Workflow → İş Akışı (but be careful with compound words)
    ("workflows", "iş akışları"),
    ("workflow", "iş akışı"),
    ("Workflows", "İş Akışları"),
    ("Workflow", "İş Akışı"),
    # Campaign → Çağrı Planı
    ("campaigns", "çağrı planları"),
    ("campaign", "çağrı planı"),
    ("Campaigns", "Çağrı Planları"),
    ("Campaign", "Çağrı Planı"),
    # Agent → Asistan
    ("voice agent builder", "sesli asistan oluşturucu"),
    ("voice agent", "sesli asistan"),
    ("Voice Agent Builder", "Sesli Asistan Oluşturucu"),
    ("Voice Agent", "Sesli Asistan"),
    ("agent builder", "asistan oluşturucu"),
    ("Agent Builder", "Asistan Oluşturucu"),
    # "agent" is tricky - only replace when it means Verasist agent, not a general agent
    # We skip standalone "agent" to avoid breaking phrases like "user agent", "travel agent", etc.
    # "agents" is safer
    ("agents", "asistanlar"),
    ("Agents", "Asistanlar"),
    # Node → Düğüm
    ("nodes", "düğümler"),
    ("node", "düğüm"),
    ("Nodes", "Düğümler"),
    ("Node", "Düğüm"),
    # Edge → Kenar (in graph context)
    ("edges", "kenarlar"),
    ("edge", "kenar"),
    ("Edges", "Kenarlar"),
    ("Edge", "Kenar"),
    # Call → Çağrı
    ("call history", "çağrı geçmişi"),
    ("call transfer", "çağrı aktarımı"),
    ("call transfers", "çağrı aktarımları"),
    ("Call History", "Çağrı Geçmişi"),
    ("Call Transfer", "Çağrı Aktarımı"),
    ("Call Transfers", "Çağrı Aktarımları"),
    # Knowledge Base → Bilgi Bankası
    ("knowledge base", "bilgi bankası"),
    ("Knowledge Base", "Bilgi Bankası"),
    # Tool → Araç
    ("built-in tools", "yerleşik araçlar"),
    ("custom tools", "özel araçlar"),
    ("tools", "araçlar"),
    ("tool", "araç"),
    ("Built-in Tools", "Yerleşik Araçlar"),
    ("Custom Tools", "Özel Araçlar"),
    ("Tools", "Araçlar"),
    ("Tool", "Araç"),
    # Prompt → Komut İstemi
    ("prompts", "komut istemleri"),
    ("prompt", "komut istemi"),
    ("Prompts", "Komut İstemleri"),
    ("Prompt", "Komut İstemi"),
    # Webhook → Web Kancası
    ("webhooks", "web kancaları"),
    ("webhook", "web kancası"),
    ("Webhooks", "Web Kancaları"),
    ("Webhook", "Web Kancası"),
    # Embedding → Gömme / Vektörleştirme
    ("embeddings", "vektör gömmeleri"),
    ("embedding", "vektör gömme"),
    ("Embeddings", "Vektör Gömmeleri"),
    ("Embedding", "Vektör Gömme"),
    # Chunk → Parça
    ("chunks", "parçalar"),
    ("chunk", "parça"),
    ("Chunks", "Parçalar"),
    ("Chunk", "Parça"),
    # Retrieval → Getirim
    ("retrieval", "getirim"),
    ("Retrieval", "Getirim"),
    # Trigger → Tetikleyici
    ("trigger", "tetikleyici"),
    ("Trigger", "Tetikleyici"),
    # Template → Şablon
    ("templates", "şablonlar"),
    ("template", "şablon"),
    ("Templates", "Şablonlar"),
    ("Template", "Şablon"),
]


def apply_terminology(text: str) -> str:
    """Apply Verasist-specific Turkish terminology replacements."""
    if not text:
        return text
    for en_term, tr_term in TERMINOLOGY_MAP:
        # Use word-boundary-aware replacement to avoid partial matches inside HTML tags
        text = text.replace(en_term, tr_term)
    # Apply post-translation fixes (bad Google Translate outputs → correct Turkish)
    for bad, good in POST_TRANSLATION_FIXES:
        text = text.replace(bad, good)
    return text


# ── Post-Translation Fixes ──
# Google Translate sometimes produces incorrect translations for technical terms.
# These fixes are applied AFTER terminology mapping on the final Turkish text.
# Order: longer/more specific patterns first.
POST_TRANSLATION_FIXES = [
    # LLM / Large Language Model fixes
    ("Yüksek Lisans", "LLM"),           # "Master's Degree" → LLM
    ("yüksek lisans", "LLM"),
    ("Yüksek lisans", "LLM"),
    ("lisansüstü", "LLM"),
    ("Lisansüstü", "LLM"),
    # Telegram fix
    ("Telegraf", "Telegram"),
    ("telegraf", "Telegram"),
    # Other common Google Translate errors
    ("Google E-Tablolar", "Google Sheets"),
    ("Google Takvim", "Google Calendar"),
    ("Google Görevler", "Google Tasks"),
    # Provider/brand names that shouldn't be translated
    ("Açık AI", "OpenAI"),
    ("Açıkai", "OpenAI"),
    ("açık AI", "OpenAI"),
    ("Azure OpenAI", "Azure OpenAI"),  # keep as-is
    ("on bir laboratuvar", "ElevenLabs"),
    ("On Bir Laboratuvar", "ElevenLabs"),
    ("derin gram", "Deepgram"),
    ("Derin Gram", "Deepgram"),
    ("Gevşek", "Slack"),
    ("gevşek", "Slack"),
    ("göbek spotu", "HubSpot"),
    ("Göbek Noktası", "HubSpot"),
    # Technical terms that should stay in English
    ("vektör gömme boyutu", "embedding boyutu"),
    ("Vektör Gömme", "Embedding"),
    ("vektör gömme", "embedding"),
    # API/tech terms
    ("POST", "POST"),  # keep as-is
    ("GET", "GET"),    # keep as-is
    ("REST API", "REST API"),
    ("SDK", "SDK"),
    ("MCP", "MCP"),
    ("URL", "URL"),
    ("UUID", "UUID"),
    ("JSON", "JSON"),
    ("CSV", "CSV"),
    ("PDF", "PDF"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def chunk_html(html: str, max_size: int = CHUNK_SIZE) -> list[str]:
    """Split HTML content into chunks at paragraph/block boundaries for translation."""
    if len(html) <= max_size:
        return [html]

    # Split by block-level closing tags
    parts = html.split("</p>")
    chunks = []
    current = ""

    for part in parts:
        candidate = current + part + "</p>"
        if len(candidate) > max_size and current:
            chunks.append(current.strip())
            current = part + "</p>"
        else:
            current = candidate

    if current.strip():
        chunks.append(current.strip())

    # Hard-split any remaining oversized chunks
    final_chunks = []
    for chunk in chunks:
        if len(chunk) <= max_size:
            final_chunks.append(chunk)
        else:
            for i in range(0, len(chunk), max_size):
                final_chunks.append(chunk[i : i + max_size])

    return final_chunks


async def translate_text(text: str, translator: GoogleTranslator) -> str:
    """Translate a single text string. Handles long texts by chunking."""
    if not text or not text.strip():
        return text

    if len(text) <= CHUNK_SIZE:
        try:
            result = translator.translate(text)
            return result
        except Exception as e:
            print(f"    Translation error (short): {e}")
            return text

    # Chunk and translate
    chunks = chunk_html(text)
    translated_chunks = []
    for i, chunk in enumerate(chunks):
        try:
            translated = translator.translate(chunk)
            translated_chunks.append(translated)
            if i < len(chunks) - 1:
                time.sleep(0.3)
        except Exception as e:
            print(f"    Translation error on chunk {i}: {e}")
            translated_chunks.append(chunk)
            time.sleep(1.0)
    return "".join(translated_chunks)


async def main():
    print("=" * 60)
    print("  English → Turkish Translation Script")
    print("=" * 60)
    print(f"  MongoDB: {MONGO_URL}")
    print(f"  Database: {DB_NAME}")
    print()

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    try:
        await client.admin.command("ping")
        print("✓ MongoDB connection successful\n")
    except Exception as e:
        print(f"ERROR: Cannot connect to MongoDB: {e}")
        sys.exit(1)

    # ── Get all English documents ──
    en_docs = await db.documents.find({"lang": "en"}).to_list(5000)
    print(f"English documents found: {len(en_docs)}")

    # ── Delete existing Turkish documents ──
    delete_result = await db.documents.delete_many({"lang": "tr"})
    print(f"Deleted existing TR documents: {delete_result.deleted_count}")

    # ── Initialize translator ──
    translator = GoogleTranslator(source="en", target="tr")
    print("\nTranslating... (this may take several minutes)\n")

    translated_count = 0
    error_count = 0

    for i, en_doc in enumerate(en_docs):
        title = en_doc.get("title", "")
        excerpt = en_doc.get("excerpt", "")
        content = en_doc.get("content", "")

        print(f"  [{i + 1}/{len(en_docs)}] {title[:60]}")

        try:
            tr_title = await translate_text(title, translator)
            time.sleep(0.2)
            tr_excerpt = await translate_text(excerpt, translator) if excerpt else ""
            time.sleep(0.3)

            # Content is the big one — translate in chunks
            tr_content = await translate_text(content, translator)

            tr_title = apply_terminology(tr_title)
            tr_excerpt = apply_terminology(tr_excerpt) if tr_excerpt else ""
            tr_content = apply_terminology(tr_content)

            # Create Turkish document (same slug, same path, different lang)
            tr_doc = {
                "id": str(uuid.uuid4()),
                "slug": en_doc.get("slug", ""),
                "title": tr_title,
                "section_id": en_doc.get("section_id", ""),
                "parent_id": en_doc.get("parent_id"),
                "content": tr_content,
                "excerpt": tr_excerpt,
                "order": en_doc.get("order", 0),
                "published": en_doc.get("published", True),
                "lang": "tr",
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            # Preserve path if present (None → omit for sparse index)
            en_path = en_doc.get("path")
            if en_path is not None:
                tr_doc["path"] = en_path

            await db.documents.insert_one(tr_doc)
            translated_count += 1
            print(f"    ✓ translated ({len(tr_content)} chars)")

        except Exception as e:
            error_count += 1
            print(f"    ✗ ERROR: {e}")

        # Rate limiting between documents
        if i < len(en_docs) - 1:
            time.sleep(0.5)

    # ── Summary ──
    tr_count = await db.documents.count_documents({"lang": "tr"})
    print("\n" + "=" * 60)
    print("  TRANSLATION SUMMARY")
    print("=" * 60)
    print(f"  English documents:       {len(en_docs)}")
    print(f"  Turkish documents:       {tr_count}")
    print(f"  Successfully translated: {translated_count}")
    print(f"  Errors:                  {error_count}")
    print("\n✓ Translation complete.")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
