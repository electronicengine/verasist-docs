"""Public docs chat, bridged to the configured Verasist text-session workflow.

Document access belongs to the workflow's MCP tools. This service never indexes,
searches, or injects documentation into the conversation.
"""
import base64
import json
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo import ReturnDocument


def now():
    return datetime.now(timezone.utc)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


class SettingsInput(BaseModel):
    workflow_uuid: UUID | None = None
    api_key: str = Field(default="", max_length=4096)
    enabled: bool = False


class SessionInput(BaseModel):
    lang: str = Field(default="tr", pattern="^(tr|en)$")


class MessageInput(BaseModel):
    request_id: UUID
    text: str = Field(min_length=1, max_length=4000)


class TextSessions:
    """Async adapter for the same /apps text-session API used by the TS SDK."""
    async def request(self, key, method, path, body=None):
        base = os.environ.get("VERASIST_API_URL", "https://app.verasist.ai").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
                response = await client.request(method, base + "/api/v1/apps" + path,
                                                headers={"X-API-Key": key}, json=body)
        except httpx.RequestError:
            raise HTTPException(502, "Vera’ya ulaşılamadı. Aynı mesajı yeniden deneyebilirsiniz.") from None
        if response.status_code >= 400:
            code = 409 if response.status_code == 409 else 503 if response.status_code in (401, 402, 403, 404) else 502
            raise HTTPException(code, "Vera yanıtı tamamlayamadı. Yeniden deneyin veya yöneticiyle iletişime geçin.")
        try:
            return response.json()
        except ValueError:
            raise HTTPException(502, "Vera geçersiz yanıt verdi.") from None


    async def stream(self, key, path, body):
        base = os.environ.get("VERASIST_API_URL", "https://app.verasist.ai").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
                async with client.stream("POST", base + "/api/v1/apps" + path,
                                         headers={"X-API-Key": key, "Accept": "text/event-stream"}, json=body) as response:
                    if response.status_code >= 400:
                        raise HTTPException(409 if response.status_code == 409 else 502, "Vera yanıtı henüz tamamlanamadı. Sohbet durumu kontrol ediliyor.")
                    event, data = "", []
                    async for line in response.aiter_lines():
                        if line.startswith("event:"):
                            event = line[6:].strip()
                        elif line.startswith("data:"):
                            data.append(line[5:].removeprefix(" "))
                        elif not line and data:
                            payload = json.loads("\n".join(data))
                            data = []
                            if event == "session.error":
                                raise HTTPException(502, "Vera yanıtı tamamlayamadı.")
                            if event in {"session.started", "assistant.delta", "tool.started", "tool.completed", "session.completed"}:
                                yield event, payload
                            if event == "session.completed":
                                return
                    raise HTTPException(502, "Yanıt akışı kesildi. Sohbet durumu kontrol ediliyor.")
        except (httpx.RequestError, ValueError):
            raise HTTPException(502, "Vera bağlantısı kesildi. Sohbet durumu kontrol ediliyor.") from None


class VeraChat:
    def __init__(self, db, secret, remote=None):
        self.db = db
        self.cipher = Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))
        self.remote = remote or TextSessions()

    async def indexes(self):
        await self.db.vera_sessions.create_index("expires_at", expireAfterSeconds=0)
        await self.db.vera_limits.create_index("expires_at", expireAfterSeconds=0)

    async def settings(self):
        return await self.db.vera_settings.find_one({"_id": "assistant"}) or {}

    @staticmethod
    def public_settings(settings):
        return {"workflow_uuid": settings.get("workflow_uuid", ""),
                "enabled": bool(settings.get("enabled")), "has_api_key": bool(settings.get("api_key"))}

    def api_key(self, settings):
        try:
            return self.cipher.decrypt(settings["api_key"].encode()).decode()
        except Exception:
            raise HTTPException(503, "Vera bağlantı ayarlarını kontrol edin.") from None

    async def save_settings(self, body):
        previous = await self.settings()
        encrypted = previous.get("api_key")
        if body.api_key.strip():
            encrypted = self.cipher.encrypt(body.api_key.strip().encode()).decode()
        value = {"workflow_uuid": str(body.workflow_uuid) if body.workflow_uuid else "",
                 "api_key": encrypted, "enabled": body.enabled, "version": str(uuid4())}
        if body.enabled:
            if not value["workflow_uuid"] or not encrypted:
                raise HTTPException(422, "Workflow UUID’si ve API anahtarı gerekli.")
            await self.remote.request(self.api_key(value), "GET", f"/workflows/{value['workflow_uuid']}/check")
        await self.db.vera_settings.replace_one({"_id": "assistant"}, {"_id": "assistant", **value}, upsert=True)
        return self.public_settings(value)

    async def configured(self):
        settings = await self.settings()
        if not settings.get("enabled") or not settings.get("workflow_uuid") or not settings.get("api_key"):
            raise HTTPException(503, "Vera henüz etkinleştirilmedi.")
        return settings

    async def limit(self, bucket, maximum, seconds):
        moment = now()
        window = int(moment.timestamp()) // seconds
        row = await self.db.vera_limits.find_one_and_update(
            {"_id": f"{bucket}:{window}"},
            {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": moment + timedelta(seconds=seconds * 2)}},
            upsert=True, return_document=ReturnDocument.AFTER)
        if row["count"] > maximum:
            raise HTTPException(429, "Çok fazla istek. Lütfen biraz sonra tekrar deneyin.")

    async def create(self, lang, address):
        settings = await self.configured()
        await self.limit("create:" + token_hash(address), 40, 3600)
        await self.limit("create:all", 300, 86400)
        token = secrets.token_urlsafe(32)
        session = {"_id": token_hash(token), "version": settings["version"],
                   "workflow_uuid": settings["workflow_uuid"], "lang": lang,
                   "request_id": str(uuid4()), "run_id": None, "messages": [], "completed": {},
                   "pending": None, "closed": False, "expires_at": now() + timedelta(hours=24)}
        await self.db.vera_sessions.insert_one(session)
        return {"session_token": token, **self.snapshot(session)}

    @staticmethod
    def snapshot(session):
        pending = session.get("pending")
        return {"messages": session["messages"], "closed": session["closed"],
                "pending": {"request_id": pending["request_id"], "text": pending["text"]} if pending else None,
                "busy": bool(pending and session.get("lock_until") and session["lock_until"].replace(tzinfo=timezone.utc) > now())}

    async def load(self, token):
        if not token or len(token) > 128:
            raise HTTPException(404, "Sohbet bulunamadı. Yeni sohbet başlatın.")
        session = await self.db.vera_sessions.find_one({"_id": token_hash(token), "expires_at": {"$gt": now()}})
        if not session:
            raise HTTPException(404, "Sohbetin süresi doldu. Yeni sohbet başlatın.")
        settings = await self.configured()
        if session["version"] != settings["version"]:
            raise HTTPException(409, "Vera ayarları değişti. Yeni sohbet başlatın.")
        return session, settings

    async def lock(self, session):
        lease = str(uuid4())
        result = await self.db.vera_sessions.update_one(
            {"_id": session["_id"], "$or": [{"lock_until": {"$exists": False}}, {"lock_until": {"$lt": now()}}]},
            {"$set": {"lease": lease, "lock_until": now() + timedelta(minutes=5)}})
        if result.modified_count != 1:
            raise HTTPException(409, "Önceki yanıt hazırlanıyor. Lütfen bekleyin.")
        return lease

    async def send(self, token, body, on_event=None):
        session, settings = await self.load(token)
        await self.limit("message:" + session["_id"], 20, 60)
        lease = await self.lock(session)
        key = {"_id": session["_id"], "lease": lease}
        try:
            # Read after acquiring the cross-worker lease to avoid stale messages.
            session = await self.db.vera_sessions.find_one(key)
            request_id = str(body.request_id)
            if request_id in session["completed"]:
                if session["completed"][request_id] != body.text:
                    raise HTTPException(409, "Mesaj kimliği başka bir mesaj için kullanılmış.")
                return self.snapshot(session)
            if session["closed"] or len(session["completed"]) >= 40:
                raise HTTPException(409, "Bu sohbet tamamlandı. Yeni sohbet başlatın.")
            pending = session.get("pending")
            if pending and (pending["request_id"] != request_id or pending["text"] != body.text):
                raise HTTPException(409, "Önce bekleyen mesajı yeniden deneyin.")
            api_key = self.api_key(settings)
            if session["run_id"] is None:
                state = await self.remote.request(api_key, "POST", f"/workflows/{session['workflow_uuid']}/sessions", {
                    "request_id": session["request_id"],
                    "initial_context": {"source": "verasist-docs", "locale": session["lang"]},
                })
                session["run_id"] = state["run_id"]
                await self.db.vera_sessions.update_one(key, {"$set": {"run_id": state["run_id"]}})
            run = f"/sessions/{session['run_id']}"
            state = await self.remote.request(api_key, "GET", run)
            if pending is None:
                pending = {"request_id": request_id, "text": body.text, "revision": state["revision"], "turn_count": len(state.get("turns", []))}
                await self.db.vera_sessions.update_one(key, {"$set": {"pending": pending}})
            if on_event:
                on_event("session.started", {"request_id": request_id, "pending": {"request_id": request_id, "text": body.text}})

            async def run_turn(path, payload):
                if not on_event:
                    return await self.remote.request(api_key, "POST", path, payload)
                async for event, data in self.remote.stream(api_key, path, payload):
                    if event in {"assistant.delta", "tool.started", "tool.completed"}:
                        on_event(event, {**data, "request_id": request_id})
                    elif event == "session.completed":
                        return data
                raise HTTPException(502, "Yanıt tamamlanamadı.")

            # Only inspect turns after the revision reserved for this request.
            first_turn = pending.get("turn_count", max(0, len(state.get("turns", [])) - 1))
            accepted = state["revision"] > pending["revision"] and any(
                turn.get("user") == body.text for turn in state.get("turns", [])[first_turn:])
            if not accepted:
                state = await run_turn(run + "/messages", {
                    "text": body.text, "expected_revision": pending["revision"],
                })
            elif state.get("status") == "pending_assistant_turn" and not state.get("closed"):
                state = await run_turn(run + "/execute", {})
            if state.get("status") == "pending_assistant_turn":
                raise HTTPException(502, "Yanıt henüz tamamlanmadı. Yeniden deneyin.")
            return await self.save_answer(session, key, pending, state, first_turn)
        finally:
            await self.db.vera_sessions.update_one(key, {"$unset": {"lease": "", "lock_until": ""}})

    async def save_answer(self, session, key, pending, state, first_turn):
        request_id = pending["request_id"]
        reply = "\n\n".join(turn["assistant"] for turn in state.get("turns", [])[first_turn:] if turn.get("assistant"))
        messages = session["messages"] + [
            {"id": request_id + ":user", "role": "user", "text": pending["text"]},
            {"id": request_id + ":assistant", "role": "assistant", "text": reply},
        ]
        session.update(messages=messages, pending=None, closed=bool(state.get("closed")))
        session["completed"][request_id] = pending["text"]
        await self.db.vera_sessions.update_one(key, {"$set": {
            "messages": messages, "pending": None, "completed": session["completed"], "closed": session["closed"],
        }})
        return self.snapshot(session)

    async def read(self, token):
        session, settings = await self.load(token)
        snapshot = self.snapshot(session)
        if not session.get("pending") or snapshot["busy"] or session["run_id"] is None:
            return snapshot
        lease = await self.lock(session)
        key = {"_id": session["_id"], "lease": lease}
        try:
            session = await self.db.vera_sessions.find_one(key)
            pending = session.get("pending")
            if not pending:
                return self.snapshot(session)
            state = await self.remote.request(self.api_key(settings), "GET", f"/sessions/{session['run_id']}")
            if state.get("status") == "pending_assistant_turn":
                return {**self.snapshot(session), "busy": True}
            first_turn = pending.get("turn_count", max(0, len(state.get("turns", [])) - 1))
            if state["revision"] > pending["revision"] and any(turn.get("user") == pending["text"] for turn in state.get("turns", [])[first_turn:]):
                return await self.save_answer(session, key, pending, state, first_turn)
            return {**self.snapshot(session), "busy": False}
        finally:
            await self.db.vera_sessions.update_one(key, {"$unset": {"lease": "", "lock_until": ""}})

    async def close(self, token):
        session, settings = await self.load(token)
        lease = await self.lock(session)
        key = {"_id": session["_id"], "lease": lease}
        try:
            if session["run_id"] is not None:
                try:
                    await self.remote.request(self.api_key(settings), "POST", f"/sessions/{session['run_id']}/close", {})
                except HTTPException:
                    pass  # Local revocation still prevents further use of this session.
            await self.db.vera_sessions.update_one(key, {"$set": {"closed": True}})
        finally:
            await self.db.vera_sessions.update_one(key, {"$unset": {"lease": "", "lock_until": ""}})
        return {"closed": True}


def create_router(service, get_user):
    router = APIRouter()

    async def admin(user=Depends(get_user)):
        if user.get("role") != "admin":
            raise HTTPException(403, "Yönetici yetkisi gerekli.")
        return user

    @router.get("/admin/vera")
    async def settings(user=Depends(admin)):
        return service.public_settings(await service.settings())

    @router.put("/admin/vera")
    async def save(body: SettingsInput, user=Depends(admin)):
        return await service.save_settings(body)

    @router.get("/vera/status")
    async def status():
        value = await service.settings()
        return {"enabled": bool(value.get("enabled") and value.get("workflow_uuid") and value.get("api_key"))}

    @router.post("/vera/sessions")
    async def create(body: SessionInput, request: Request):
        return await service.create(body.lang, request.client.host if request.client else "unknown")

    @router.get("/vera/session")
    async def get(x_vera_session: str = Header(default="")):
        return await service.read(x_vera_session)

    @router.post("/vera/messages")
    async def send(body: MessageInput, request: Request, x_vera_session: str = Header(default="")):
        if "text/event-stream" in request.headers.get("accept", ""):
            from chat_stream import stream_response
            return await stream_response(lambda emit: service.send(x_vera_session, body, emit))
        return await service.send(x_vera_session, body)

    @router.delete("/vera/session")
    async def close(x_vera_session: str = Header(default="")):
        return await service.close(x_vera_session)

    return router
