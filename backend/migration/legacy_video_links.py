"""Remove retired tutorial embeds/links while preserving other document content."""
import html
import re
from urllib.parse import urlsplit


def retired_video(url):
    value = html.unescape(url).strip()
    host = (urlsplit(value if not value.startswith('//') else 'https:' + value).hostname or '').lower()
    if any(host == domain or host.endswith('.' + domain) for domain in ('youtube.com', 'youtu.be', 'youtube-nocookie.com')):
        return True
    return (host == 'tella.tv' or host.endswith('.tella.tv')) and any(
        word in urlsplit(value).path.lower() for word in ('dograh', 'dobra')
    )


def _attribute(tag, name):
    match = re.search(r'\b' + name + r'''\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))''', tag, re.I)
    return next((v for v in match.groups() if v is not None), '') if match else ''


def strip_legacy_video_links(content):
    def iframe(match):
        return '' if retired_video(_attribute(match[0].split('>', 1)[0], 'src')) else match[0]

    result = re.sub(r'<iframe\b[^>]*>.*?</iframe\s*>', iframe, content, flags=re.I | re.S)
    result = re.sub(r'<iframe\b[^>]*/\s*>', iframe, result, flags=re.I | re.S)
    result = re.sub(r'<a\b([^>]*)>(.*?)</a\s*>',
                    lambda m: m[2] if retired_video(_attribute(m[1], 'href')) else m[0],
                    result, flags=re.I | re.S)
    result = re.sub(r'\[([^\]]+)\]\(([^)]+)\)',
                    lambda m: m[1] if retired_video(m[2]) else m[0], result)
    result = re.sub(r'(?:https?:)?//[^\s<>"\x27)]+',
                    lambda m: '' if retired_video(m[0]) else m[0], result, flags=re.I)
    if result != content:
        result = re.sub(r'<p>\s*</p>', '', result, flags=re.I)
    return result
