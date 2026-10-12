"""Exercise the docs HTTP bridge without Mongo, LLMs or real session writes."""
import json
from datetime import datetime, timedelta, timezone
import httpx
import pytest
import vera_chat


def adapter(monkeypatch, handler):
    client = httpx.AsyncClient
    monkeypatch.setattr(vera_chat.httpx, 'AsyncClient', lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs))
    monkeypatch.setenv('VERASIST_API_URL', 'https://api.example')
    return vera_chat.TextSessions()


@pytest.mark.asyncio
async def test_unified_creation_preserves_server_key_and_context(monkeypatch):
    calls = []
    async def handler(request):
        calls.append(request)
        return httpx.Response(200, json={'run_id': 3, 'revision': 0})
    remote = adapter(monkeypatch, handler)
    body = {'run_type': 'text', 'request_id': 'c68d3e25-58d9-4ee5-8329-2d4ab6d75746', 'initial_context': {'locale': 'tr'}}
    await remote.request('server-only-key', 'POST', '/workflow/workflow-uuid', body)
    assert calls[0].url.path == '/api/v1/public/agent/workflow/workflow-uuid'
    assert calls[0].headers['X-API-Key'] == 'server-only-key'
    assert json.loads(calls[0].content) == body


@pytest.mark.asyncio
@pytest.mark.parametrize('streaming', [False, True, 'event'])
async def test_queued_turn_polls_state_without_repeating_post(monkeypatch, streaming):
    calls = []
    state = {'run_id': 3, 'revision': 2, 'status': 'idle', 'turns': [{'assistant': 'Hello'}]}
    async def handler(request):
        calls.append((request.method, request.url.path))
        if request.method == 'POST':
            receipt = {'workflow_run_id': 3, 'deadline': (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()}
            if streaming == 'event':
                return httpx.Response(200, text='event: session.queued\ndata: ' + json.dumps(receipt) + '\n\n', headers={'Content-Type': 'text/event-stream'})
            return httpx.Response(202, json=receipt)
        return httpx.Response(200, json=state)
    remote = adapter(monkeypatch, handler)
    if streaming:
        assert [event async for event in remote.stream('key', '/runs/3/execute', {})] == [('session.completed', state)]
    else:
        assert await remote.request('key', 'POST', '/runs/3/execute', {}) == state
    assert calls == [('POST', '/api/v1/public/agent/runs/3/execute'), ('GET', '/api/v1/public/agent/runs/3')]
