"""Publication/coverage acceptance without connecting to a database."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('guide_sync', ROOT / 'backend/migration/sync_guide_workshops.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def test_reviewed_release_stays_in_bilingual_guides():
    pages = sync.load_pages(ROOT / 'content/guides/updates')
    assert len(pages) == 86
    assert len({p['path'] for p in pages}) == 43
    for p in pages:
        assert p['path'].startswith('guides/')
        assert p['reference'].startswith('guides/')
        assert p['content'] and p['title']
    paths = {p['path'] for p in pages}
    assert {'guides/planning/live-monitoring', 'guides/planning/live-guidance',
            'guides/planning/call-transfers', 'guides/workflows/tools/call-transfer'} <= paths


def test_every_current_tool_still_has_bilingual_documentation():
    tools = json.loads((ROOT / 'content/guides/tool-catalog.json').read_text())
    pages = {(p['path'],p['lang']):p for p in sync.load_pages(ROOT / 'content/guides/updates')}
    assert len(tools) == 37
    for slug in tools:
        for lang in ('en','tr'):
            assert ('guides/workflows/tools/' + slug,lang) in pages
    assert '<div class="mermaid">' in pages['guides/workflows/tools/call-transfer','en']['content']


def test_live_guidance_and_transfer_limits_are_explicit():
    pages = {(p['path'],p['lang']):p for p in sync.load_pages(ROOT / 'content/guides/updates')}
    monitor = pages['guides/planning/live-monitoring','en']['content']
    guidance = pages['guides/planning/live-guidance','en']['content']
    transfer = pages['guides/workflows/tools/call-transfer','en']['content']
    assert 'does not provide live audio listening' in monitor
    assert 'next response' in guidance and 'permanent agent instructions' in guidance
    assert 'requires Post-transfer STT' in transfer
    assert '5 and 120 seconds' in transfer and 'SIP/ARI' in transfer
    assert 'does not transfer WebRTC' in transfer
