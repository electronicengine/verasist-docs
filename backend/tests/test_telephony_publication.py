"""Publication proofs: retired videos, safe host matching, bilingual scope and links."""
import json
import sys
from pathlib import Path

import pytest

MIGRATIONS = Path(__file__).resolve().parents[1] / 'migration'
sys.path.insert(0, str(MIGRATIONS))
from legacy_video_links import strip_legacy_video_links
from sync_telephony_docs import normalize, validate


@pytest.mark.parametrize('url', [
    'https://www.youtube.com/embed/old', 'https://youtu.be/old',
    '//www.youtube-nocookie.com/embed/old',
    'https://www.tella.tv/video/setting-up-telephony-configurations-in-dobra-f6zj/embed',
])
def test_removes_retired_iframe_without_deleting_nearby_instructions(url):
    text = f'<h2>Setup</h2><iframe src="{url}" allowfullscreen></iframe><p>Save your trunk.</p>'
    assert strip_legacy_video_links(text) == '<h2>Setup</h2><p>Save your trunk.</p>'


def test_removes_links_but_retains_text_and_product_integration():
    text = '<p>Read <a href="https://youtu.be/old">the instructions</a>.</p> https://youtube.com/watch?v=old'
    assert strip_legacy_video_links(text) == '<p>Read the instructions.</p> '
    google = '<p>YouTube integration: <a href="https://www.googleapis.com/auth/youtube.upload">scope</a></p>'
    assert strip_legacy_video_links(google) == google


@pytest.mark.parametrize('content', [
    '<iframe src="https://www.tella.tv/video/current-verasist/embed"></iframe>',
    '<a href="https://youtube.com.example.com/other">Other</a>',
    '<p>IP phone → PBX → Verasist; <strong>do not change ARI</strong>.</p>',
])
def test_other_content_and_hosts_are_preserved(content):
    assert strip_legacy_video_links(content) == content


def test_normalization_is_idempotent_and_uses_live_routes():
    text = '<a href="/integrations/telephony/ip-pbx">PBX</a> https://api.verasist.ai/api/v1/telephony/inbound/run'
    result = normalize(text)
    assert '/guides/integrations/telephony/ip-pbx' in result
    assert 'https://app.verasist.ai/api/v1/telephony/inbound/run' in result
    assert normalize(result) == result
    assert normalize('<a href="/guides/integrations/telephony/sip-trunk">SIP</a>') == '<a href="/guides/integrations/telephony/sip-trunk">SIP</a>'


def test_partial_or_foreign_publication_payload_is_rejected():
    with pytest.raises(ValueError):
        validate([{'path': 'unrelated', 'lang': 'tr', 'content': '<p>Other</p>'}])


def test_customer_import_cannot_restore_old_video_embeds():
    from customer_publication import customer_document
    result = customer_document({'path': 'other', 'lang': 'en', 'id': 'preserved',
                                'content': '<p>Keep me</p><iframe src="https://www.youtube.com/embed/old"></iframe>'})
    assert result['id'] == 'preserved'
    assert result['content'] == '<p>Keep me</p>'
