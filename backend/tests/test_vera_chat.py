"""Isolated Mongo tests; never use the documentation database or a real LLM."""
import asyncio
import copy
import os
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

from vera_chat import VeraChat, SettingsInput, MessageInput, create_router


class Remote:
    def __init__(self):
        self.calls = []
        self.runs = {}
        self.creations = {}
        self.fail = None
        self.entered = None
        self.release = None

    async def request(self, key, method, path, body=None):
        self.calls.append((method, path, copy.deepcopy(body)))
        assert key == "private-api-key"
        if path.endswith('/check'):
            return {'published': True, 'text_tools': True}
        if '/workflows/' in path:
            rid = self.creations.setdefault(body['request_id'], len(self.creations) + 1)
            self.runs.setdefault(rid, {'run_id': rid, 'revision': 0, 'closed': False, 'status': 'idle', 'turns': []})
            return copy.deepcopy(self.runs[rid])
        rid = int(path.split('/')[2])
        state = self.runs[rid]
        if path.endswith('/messages'):
            assert body['expected_revision'] == state['revision']
            state['revision'] += 1
            state['turns'].append({'user': body['text'], 'assistant': 'Vera: ' + body['text']})
            if self.entered:
                self.entered.set()
                await self.release.wait()
            if self.fail:
                failure, self.fail = self.fail, None
                state['status'] = 'pending_assistant_turn' if failure == 'pending' else 'idle'
                raise HTTPException(502, 'Simulated lost response')
        if path.endswith('/execute'):
            state['status'] = 'idle'
            state['revision'] += 1
        if path.endswith('/close'):
            state['closed'] = True
        return copy.deepcopy(state)


@pytest.fixture
def run():
    url = os.environ.get('VERA_TEST_MONGO_URL')
    if not url:
        pytest.skip('Set VERA_TEST_MONGO_URL to an isolated test Mongo server')
    def runner(check):
        async def scenario():
            client = AsyncIOMotorClient(url)
            db = client['vera_test_' + uuid4().hex]
            service = VeraChat(db, 'test-encryption-secret', Remote())
            try:
                await service.indexes()
                await service.save_settings(SettingsInput(workflow_uuid=uuid4(), api_key='private-api-key', enabled=True))
                await check(service)
            finally:
                await client.drop_database(db.name)
                client.close()
        asyncio.run(scenario())
    return runner


def test_admin_settings_hide_and_preserve_encrypted_key(run):
    async def check(service):
        stored = await service.settings()
        assert stored['api_key'] != 'private-api-key'
        assert 'private-api-key' not in str(service.public_settings(stored))
        await service.save_settings(SettingsInput(workflow_uuid=stored['workflow_uuid'], enabled=True))
        assert (await service.settings())['api_key'] == stored['api_key']
        app = FastAPI()
        async def member(): return {'role': 'member'}
        app.include_router(create_router(service, member), prefix='/api')
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as http:
            assert (await http.get('/api/admin/vera')).status_code == 403
            assert (await http.put('/api/admin/vera', json={'enabled': False})).status_code == 403
            assert (await http.get('/api/vera/status')).json() == {'enabled': True}
            assert (await http.get('/api/vera/session', headers={'X-Vera-Session': 'guess'})).status_code == 404
    run(check)


def test_independent_sessions_send_only_user_message_and_no_document_context(run):
    async def check(service):
        first = await service.create('tr', 'test')
        second = await service.create('en', 'test')
        assert not service.remote.runs  # opening the panel does not run an LLM
        body = MessageInput(request_id=uuid4(), text='SDK nasıl kullanılır?')
        answer = await service.send(first['session_token'], body)
        assert [m['role'] for m in answer['messages']] == ['user', 'assistant']
        other, _ = await service.load(second['session_token'])
        assert other['messages'] == [] and other['run_id'] is None
        remote_body = next(body for _, path, body in service.remote.calls if path.endswith('/messages'))
        assert remote_body == {'text': body.text, 'expected_revision': 0}
        creation = next(body for _, path, body in service.remote.calls if path.endswith('/sessions'))
        assert 'instructions' not in creation and 'tool_transport' not in creation
        assert creation['initial_context'] == {'source': 'verasist-docs', 'locale': 'tr'}
        again = await service.send(first['session_token'], body)
        assert again == answer
        assert len([1 for _, path, _ in service.remote.calls if path.endswith('/messages')]) == 1
        with pytest.raises(HTTPException) as error:
            await service.send(first['session_token'], MessageInput(request_id=body.request_id, text='Different'))
        assert error.value.status_code == 409
    run(check)


@pytest.mark.parametrize('failure', ['lost', 'pending'])
def test_lost_response_retries_never_duplicate_a_user_turn(run, failure):
    async def check(service):
        token = (await service.create('tr', 'test'))['session_token']
        body = MessageInput(request_id=uuid4(), text='Merhaba')
        service.remote.fail = failure
        with pytest.raises(HTTPException): await service.send(token, body)
        session, _ = await service.load(token)
        assert service.snapshot(session)['pending']['text'] == 'Merhaba'
        with pytest.raises(HTTPException) as conflict:
            await service.send(token, MessageInput(request_id=uuid4(), text='Another message'))
        assert conflict.value.status_code == 409
        result = await service.send(token, body)
        assert len(result['messages']) == 2 and result['pending'] is None
        assert len([1 for _, path, _ in service.remote.calls if path.endswith('/messages')]) == 1
        assert len([1 for _, path, _ in service.remote.calls if path.endswith('/execute')]) == (1 if failure == 'pending' else 0)
    run(check)


def test_cross_worker_lock_and_session_revocation(run):
    async def check(service):
        token = (await service.create('tr', 'test'))['session_token']
        body = MessageInput(request_id=uuid4(), text='Question')
        service.remote.entered, service.remote.release = asyncio.Event(), asyncio.Event()
        active = asyncio.create_task(service.send(token, body))
        await service.remote.entered.wait()
        try:
            with pytest.raises(HTTPException) as conflict: await service.send(token, body)
            assert conflict.value.status_code == 409
        finally: service.remote.release.set()
        await active
        await service.close(token)
        with pytest.raises(HTTPException) as closed: await service.send(token, MessageInput(request_id=uuid4(), text='Later'))
        assert closed.value.status_code == 409
        settings = await service.settings()
        fresh = (await service.create('en', 'test'))['session_token']
        await service.save_settings(SettingsInput(workflow_uuid=settings['workflow_uuid'], enabled=True))
        with pytest.raises(HTTPException) as changed: await service.load(fresh)
        assert changed.value.status_code == 409
    run(check)


def test_limits_and_disabled_configuration(run):
    async def check(service):
        await service.limit('test', 1, 60)
        with pytest.raises(HTTPException) as limited: await service.limit('test', 1, 60)
        assert limited.value.status_code == 429
        await service.save_settings(SettingsInput(enabled=False))
        with pytest.raises(HTTPException) as disabled: await service.create('tr', 'test')
        assert disabled.value.status_code == 503
    run(check)


def test_stream_visible_before_save_and_disconnect_keeps_persistence(run):
    async def check(service):
        from chat_stream import stream_response
        entered, release = asyncio.Event(), asyncio.Event()
        async def stream(key, path, body):
            yield 'tool.started', {'run_id': 1, 'turn_id': 'turn', 'tool_call_id': 'tool', 'function_name': 'search_docs', 'status': 'running'}
            yield 'assistant.delta', {'run_id': 1, 'turn_id': 'turn', 'segment_id': '0', 'sequence': 1, 'delta': 'Vera: Türkçe 🌍'}
            entered.set()
            await release.wait()
            state = await service.remote.request(key, 'POST', path, body)
            state['turns'].append({'user': None, 'assistant': 'Transfer karşılaması'})
            yield 'session.completed', state
        service.remote.stream = stream
        created = await service.create('tr', 'stream-test')
        token = created['session_token']
        body = MessageInput(request_id=uuid4(), text='Türkçe 🌍')
        response = await stream_response(lambda emit: service.send(token, body, emit))
        iterator = response.body_iterator
        assert 'session.started' in await anext(iterator)
        tool_event = await anext(iterator)
        assert 'tool.started' in tool_event and 'search_docs' in tool_event
        assert str(body.request_id) in tool_event
        assert 'Türkçe 🌍' in await anext(iterator)
        await entered.wait()
        snapshot = await service.read(token)
        assert snapshot['pending'] and snapshot['busy']
        assert snapshot['messages'] == []
        await iterator.aclose()  # The browser disconnects while the model is waiting.
        release.set()
        for _ in range(100):
            snapshot = await service.read(token)
            if snapshot['pending'] is None:
                break
            await asyncio.sleep(.01)
        assert snapshot['pending'] is None
        assert snapshot['messages'][-1]['text'] == 'Vera: Türkçe 🌍\n\nTransfer karşılaması'
        assert len([c for c in service.remote.calls if c[1].endswith('/messages')]) == 1
        assert not any(c[1].endswith('/execute') for c in service.remote.calls)
    run(check)
