from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ----- Uploads directory -----
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# ----- MongoDB -----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ----- JWT -----
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Kimlik doğrulaması gerekli")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token tipi")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

# ----- Models -----
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SectionIn(BaseModel):
    title: str
    slug: Optional[str] = None
    order: int = 0
    tab_id: Optional[str] = None

class TabIn(BaseModel):
    title: str
    slug: Optional[str] = None
    order: int = 0

class DocumentIn(BaseModel):
    title: str
    slug: Optional[str] = None
    path: Optional[str] = None
    section_id: str
    parent_id: Optional[str] = None
    content: str = ""
    excerpt: str = ""
    order: int = 0
    published: bool = True
    lang: str = "tr"

class VideoIn(BaseModel):
    title: str
    title_en: str = ""
    filename: str
    description: str = ""
    description_en: str = ""
    document_id: Optional[str] = None
    section_id: Optional[str] = None
    section_ids: Optional[List[str]] = None
    order: int = 0

# ----- App -----
app = FastAPI()
api = APIRouter(prefix="/api")

def slugify(text: str) -> str:
    text = text.lower().strip()
    tr_map = {"ı": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c", "İ": "i"}
    for k, v in tr_map.items():
        text = text.replace(k, v)
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or str(uuid.uuid4())[:8]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ----- Auth endpoints -----
@api.post("/auth/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = create_access_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "admin")},
    }

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}

# ----- Tabs -----
@api.get("/tabs")
async def list_tabs():
    tabs = await db.tabs.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return tabs

@api.post("/tabs")
async def create_tab(body: TabIn, user: dict = Depends(get_current_user)):
    slug = body.slug or slugify(body.title)
    if await db.tabs.find_one({"slug": slug}):
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "slug": slug,
        "order": body.order,
        "created_at": now_iso(),
    }
    await db.tabs.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/tabs/{tid}")
async def update_tab(tid: str, body: TabIn, user: dict = Depends(get_current_user)):
    upd = {"title": body.title, "order": body.order}
    if body.slug:
        upd["slug"] = body.slug
    res = await db.tabs.update_one({"id": tid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Tab bulunamadı")
    return {"ok": True}

@api.delete("/tabs/{tid}")
async def delete_tab(tid: str, user: dict = Depends(get_current_user)):
    # Cascade: delete sections and their docs
    sections = await db.sections.find({"tab_id": tid}).to_list(500)
    for s in sections:
        await db.documents.delete_many({"section_id": s["id"]})
    await db.sections.delete_many({"tab_id": tid})
    await db.tabs.delete_one({"id": tid})
    return {"ok": True}

# ----- Sections -----
@api.get("/sections")
async def list_sections():
    sections = await db.sections.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    return sections

@api.post("/sections")
async def create_section(body: SectionIn, user: dict = Depends(get_current_user)):
    slug = body.slug or slugify(body.title)
    if await db.sections.find_one({"slug": slug}):
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"
    tab_id = body.tab_id
    if not tab_id:
        first_tab = await db.tabs.find_one({}, sort=[("order", 1)])
        tab_id = first_tab["id"] if first_tab else None
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "slug": slug,
        "order": body.order,
        "tab_id": tab_id,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.sections.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/sections/{sid}")
async def update_section(sid: str, body: SectionIn, user: dict = Depends(get_current_user)):
    upd = {"title": body.title, "order": body.order, "updated_at": now_iso()}
    if body.slug:
        upd["slug"] = body.slug
    if body.tab_id:
        upd["tab_id"] = body.tab_id
    res = await db.sections.update_one({"id": sid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Bölüm bulunamadı")
    return {"ok": True}

@api.delete("/sections/{sid}")
async def delete_section(sid: str, user: dict = Depends(get_current_user)):
    await db.sections.delete_one({"id": sid})
    await db.documents.delete_many({"section_id": sid})
    return {"ok": True}

# ----- Documents -----
@api.get("/documents")
async def list_documents(
    section_id: Optional[str] = None,
    lang: str = Query("tr"),
):
    q: dict = {"lang": lang}
    if section_id:
        q["section_id"] = section_id
    docs = await db.documents.find(q, {"_id": 0, "content": 0}).sort("order", 1).to_list(1000)
    return docs

@api.get("/documents/by-path/{path:path}")
async def get_document_by_path(
    path: str,
    lang: str = Query("tr"),
):
    """Look up a document by its Mintlify-style path (e.g. voice-agent/start-call)."""
    doc = await db.documents.find_one({"path": path, "lang": lang}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Doküman bulunamadı")
    return doc

@api.get("/documents/{slug}")
async def get_document(
    slug: str,
    lang: str = Query("tr"),
):
    doc = await db.documents.find_one({"slug": slug, "lang": lang}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Doküman bulunamadı")
    return doc

@api.post("/documents")
async def create_document(body: DocumentIn, user: dict = Depends(get_current_user)):
    slug = body.slug or slugify(body.title)
    if await db.documents.find_one({"slug": slug, "lang": body.lang}):
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "slug": slug,
        "path": body.path,
        "section_id": body.section_id,
        "parent_id": body.parent_id,
        "content": body.content,
        "excerpt": body.excerpt,
        "order": body.order,
        "published": body.published,
        "lang": body.lang,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.documents.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/documents/{did}")
async def update_document(did: str, body: DocumentIn, user: dict = Depends(get_current_user)):
    upd = {
        "title": body.title,
        "section_id": body.section_id,
        "parent_id": body.parent_id,
        "content": body.content,
        "excerpt": body.excerpt,
        "order": body.order,
        "published": body.published,
        "lang": body.lang,
        "updated_at": now_iso(),
    }
    if body.slug:
        upd["slug"] = body.slug
    if body.path is not None:
        upd["path"] = body.path
    res = await db.documents.update_one({"id": did}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Doküman bulunamadı")
    doc = await db.documents.find_one({"id": did}, {"_id": 0})
    return doc

@api.delete("/documents/{did}")
async def delete_document(did: str, user: dict = Depends(get_current_user)):
    await db.documents.delete_one({"id": did})
    return {"ok": True}

# ----- Videos -----
@api.get("/videos")
async def list_videos(document_id: Optional[str] = None, section_id: Optional[str] = None):
    q: dict = {}
    if document_id:
        q["document_id"] = document_id
    elif section_id:
        q["$or"] = [{"section_id": section_id}, {"section_ids": section_id}]
    videos = await db.videos.find(q, {"_id": 0}).sort("order", 1).to_list(100)
    return videos

@api.post("/videos")
async def create_video(body: VideoIn, user: dict = Depends(get_current_user)):
    video = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "title_en": body.title_en,
        "filename": body.filename,
        "description": body.description,
        "description_en": body.description_en,
        "document_id": body.document_id,
        "section_id": body.section_id,
        "section_ids": body.section_ids or [],
        "order": body.order,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.videos.insert_one(video)
    video.pop("_id", None)
    return video

@api.put("/videos/{vid}")
async def update_video(vid: str, body: VideoIn, user: dict = Depends(get_current_user)):
    upd = {
        "title": body.title,
        "title_en": body.title_en,
        "filename": body.filename,
        "description": body.description,
        "description_en": body.description_en,
        "document_id": body.document_id,
        "section_id": body.section_id,
        "section_ids": body.section_ids or [],
        "order": body.order,
        "updated_at": now_iso(),
    }
    res = await db.videos.update_one({"id": vid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Video bulunamadı")
    video = await db.videos.find_one({"id": vid}, {"_id": 0})
    return video

@api.delete("/videos/{vid}")
async def delete_video(vid: str, user: dict = Depends(get_current_user)):
    res = await db.videos.delete_one({"id": vid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Video bulunamadı")
    return {"ok": True}

# ----- Navigation -----
@api.get("/navigation")
async def get_navigation(lang: str = Query("tr")):
    """Return the full navigation tree: tabs → sections → documents with paths."""
    tabs = await db.tabs.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    sections = await db.sections.find({}, {"_id": 0}).sort("order", 1).to_list(500)
    docs = await db.documents.find(
        {"published": True, "lang": lang}, {"_id": 0, "content": 0}
    ).sort("order", 1).to_list(2000)

    # Build tree: tab → sections → documents
    result = []
    for tab in tabs:
        tab_sections = []
        for sec in sections:
            if sec.get("tab_id") != tab["id"]:
                continue
            sec_docs = [d for d in docs if d.get("section_id") == sec["id"]]
            # Build nested doc tree using parent_id
            root_docs = [d for d in sec_docs if not d.get("parent_id")]
            child_docs = [d for d in sec_docs if d.get("parent_id")]
            # Attach children to parents
            for root in root_docs:
                children = [
                    {"id": c["id"], "slug": c["slug"], "path": c.get("path", c["slug"]),
                     "title": c["title"], "excerpt": c.get("excerpt", ""), "order": c["order"]}
                    for c in child_docs if c["parent_id"] == root["id"]
                ]
                children.sort(key=lambda x: x["order"])
                root["children"] = children if children else None
            root_docs.sort(key=lambda x: x["order"])
            tab_sections.append({
                "id": sec["id"],
                "slug": sec["slug"],
                "title": sec["title"],
                "order": sec["order"],
                "documents": [
                    {
                        "id": d["id"],
                        "slug": d["slug"],
                        "path": d.get("path", d["slug"]),
                        "title": d["title"],
                        "excerpt": d.get("excerpt", ""),
                        "order": d["order"],
                        "children": d.get("children"),
                    }
                    for d in root_docs
                ],
            })
        tab_sections.sort(key=lambda x: x["order"])
        result.append({
            "id": tab["id"],
            "slug": tab["slug"],
            "title": tab["title"],
            "order": tab["order"],
            "sections": tab_sections,
        })
    return result

# ----- Search -----
@api.get("/search")
async def search(q: str = Query(..., min_length=1), lang: str = Query("tr")):
    rx = re.compile(re.escape(q), re.IGNORECASE)
    docs = await db.documents.find(
        {"$or": [{"title": rx}, {"content": rx}, {"excerpt": rx}, {"path": rx}],
         "published": True, "lang": lang},
        {"_id": 0, "content": 0},
    ).limit(30).to_list(30)
    # Build snippets
    for d in docs:
        d["match"] = "title" if rx.search(d.get("title", "")) else "content"
    return docs

# ----- Image Upload -----
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "svg"}

@api.post("/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Desteklenmeyen dosya türü: .{ext}. İzin verilenler: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # Generate unique filename
    name = f"{uuid.uuid4().hex[:10]}.{ext}"
    filepath = UPLOADS_DIR / name
    content = await file.read()

    # Basic size check (10 MB)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Dosya boyutu 10 MB'dan küçük olmalıdır")

    filepath.write_bytes(content)
    return {"url": f"/uploads/{name}", "filename": name}

# ----- Health -----
@api.get("/")
async def root():
    return {"status": "ok", "name": "Dökümantasyon API"}

app.include_router(api)

# Serve uploaded images
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# CORS: allow all origins in dev, restrict in production via DOCS_CORS_ORIGINS env var
cors_origins = os.environ.get("DOCS_CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins if o.strip()] or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----- Seeding -----

# Seed video tutorials – filenames map to /public/videos/
SEED_VIDEOS = [
    {
        "title": "Vera Asistanı ve MCP Araçları",
        "title_en": "Vera Assistant and MCP Tools",
        "filename": "Vera_Asistanı_ve_MCP_Araçları.mp4",
        "description": "Sesli asistan oluşturma ve MCP araçlarının kullanımı.",
        "description_en": "Creating voice assistants and using MCP tools.",
        "order": 1,
    },
    {
        "title": "Araçlar, Dosyalar ve iframe",
        "title_en": "Tools, Files and iframe",
        "filename": "araçlar-dosyalar-iframe_1080p.mp4",
        "description": "İş akışında araçlar, dosya yükleme ve iframe kullanımı.",
        "description_en": "Using tools, file uploads and iframes in workflows.",
        "order": 2,
    },
    {
        "title": "Asistanlar ve Entegrasyon",
        "title_en": "Assistants and Integration",
        "filename": "asistanlar_ve_entegrasyon.mp4",
        "description": "Asistan yapılandırması ve harici entegrasyonlar.",
        "description_en": "Assistant configuration and external integrations.",
        "order": 3,
    },
    {
        "title": "İş Akışı ve Test Araması",
        "title_en": "Workflow and Test Call",
        "filename": "iş_akışı_ve_test_araması.mp4",
        "description": "İş akışı düzenleyicisi ve test araması yapma.",
        "description_en": "Workflow editor and making test calls.",
        "order": 4,
    },
    {
        "title": "Raporlar ve Çağrı Kayıtları",
        "title_en": "Reports and Call Records",
        "filename": "raporlar-çağrı kayıtları_1080p.mp4",
        "description": "Raporlama paneli ve çağrı kayıtlarının incelenmesi.",
        "description_en": "Reports dashboard and reviewing call recordings.",
        "order": 5,
    },
    {
        "title": "Çağrı Planları ve Takvim",
        "title_en": "Call Plans and Calendar",
        "filename": "çağrı_planları-takvim.mp4",
        "description": "Kampanya ve çağrı planlarının takvim ile yönetimi.",
        "description_en": "Managing campaigns and call plans with calendar.",
        "order": 6,
    },
]

# Sections grouped by Mintlify "Guides" tab structure
# Maps to: Getting Started, Core Concepts, Configurations, Voice Agent Builder, Telephony, Channels, Integrations
SEED_SECTIONS = [
    {"slug": "baslangic", "title": "Başlangıç", "order": 1},
    {"slug": "temel-kavramlar", "title": "Temel Kavramlar", "order": 2},
    {"slug": "yapilandirma", "title": "Yapılandırma", "order": 3},
    {"slug": "sesli-asistan", "title": "Sesli Asistan Oluşturucu", "order": 4},
    {"slug": "telefon", "title": "Telefon", "order": 5},
    {"slug": "kanallar", "title": "Kanallar", "order": 6},
    {"slug": "entegrasyonlar", "title": "Diğer Entegrasyonlar", "order": 7},
]

# Mintlify-path-based seed docs for the "Guides" tab (Rehberler)
SEED_DOCS = [
    # ===== baslangic (Getting Started) =====
    {
        "section_slug": "baslangic",
        "slug": "index",
        "path": "getting-started/index",
        "title": "Giriş",
        "excerpt": "Verasist sesli yapay zeka platformuna genel bakış.",
        "order": 1,
        "content": """<h2>Verasist Nedir?</h2>
<p>Verasist, <strong>sesli yapay zeka ajanları</strong> oluşturmak ve dağıtmak için tasarlanmış açık kaynaklı bir platformdur. Sürükle-bırak iş akışı düzenleyicisi sayesinde kod yazmadan karmaşık sesli etkileşimler tasarlayabilirsiniz.</p>
<h2>Neden Verasist?</h2>
<ul>
<li><strong>%100 Açık Kaynak</strong> — Satıcı bağımlılığı yok, tam şeffaflık.</li>
<li><strong>Kendi Sunucunuzda</strong> — Verileriniz sizde kalır, altyapınızın sahibi siz olursunuz.</li>
<li><strong>Çok Kanallı</strong> — Telefon, WebRTC, WhatsApp, Telegram ve daha fazlası.</li>
<li><strong>Esnek Yapılandırma</strong> — Her sağlayıcıyı değiştirebilir, özelleştirebilirsiniz.</li>
</ul>
<h2>Dökümantasyon Yapısı</h2>
<p>Bu rehberler aşağıdaki sırayla ilerlemeniz için tasarlanmıştır:</p>
<ol>
<li><strong>Temel Kavramlar</strong> — Verasist'in nasıl çalıştığını anlayın</li>
<li><strong>Yapılandırma</strong> — LLM, ses, transkripsiyon ayarlarını yapın</li>
<li><strong>Sesli Asistan Oluşturucu</strong> — İş akışları ve araçlarla ajanlar oluşturun</li>
<li><strong>Telefon / Kanallar</strong> — Ajanlarınızı dünyaya bağlayın</li>
</ol>""",
    },
    {
        "section_slug": "baslangic",
        "slug": "prerequisites",
        "path": "getting-started/prerequisites",
        "title": "Ön Koşullar",
        "excerpt": "Verasist'i kullanmaya başlamak için gerekli sistem gereksinimleri ve hesaplar.",
        "order": 2,
        "content": """<h2>Sistem Gereksinimleri</h2>
<ul>
<li><strong>İşletim Sistemi:</strong> macOS 12+, Linux (Ubuntu 20.04+), Windows 11 (WSL2)</li>
<li><strong>RAM:</strong> En az 8 GB (16 GB önerilir)</li>
<li><strong>Disk:</strong> 10 GB boş alan</li>
<li><strong>Docker:</strong> Docker Desktop veya Docker Engine 20.10+</li>
<li><strong>Git:</strong> Son sürüm</li>
</ul>
<h2>Gerekli Hesaplar</h2>
<p>Sesli ajanların çalışması için aşağıdaki harici servislere ihtiyacınız olacak:</p>
<ol>
<li><strong>LLM Sağlayıcısı:</strong> OpenAI, Anthropic veya Google Gemini hesabı</li>
<li><strong>Telefon Sağlayıcısı:</strong> Twilio, Vonage veya benzeri (telefon entegrasyonu için)</li>
<li><strong>Ses Sentezi (opsiyonel):</strong> ElevenLabs, Deepgram veya Azure</li>
<li><strong>Transkripsiyon (opsiyonel):</strong> Deepgram, AssemblyAI veya Azure</li>
</ol>
<h2>Sonraki Adım</h2>
<p>Gereksinimleri karşıladıktan sonra <a href=\"/getting-started/troubleshooting\">Sorun Giderme</a> sayfasını da inceleyebilirsiniz.</p>""",
    },
    {
        "section_slug": "baslangic",
        "slug": "troubleshooting",
        "path": "getting-started/troubleshooting",
        "title": "Sorun Giderme",
        "excerpt": "Sık karşılaşılan sorunlar ve çözümleri.",
        "order": 3,
        "content": """<h2>Docker Başlatma Hataları</h2>
<p><code>docker compose up</code> komutu hata veriyorsa Docker servisinin çalıştığından emin olun:</p>
<pre><code>sudo systemctl status docker</code></pre>
<h2>Port Çakışmaları</h2>
<p>3000, 5432 veya 6379 portları başka uygulamalar tarafından kullanılıyorsa <code>.env</code> dosyasındaki port değerlerini değiştirin.</p>
<h2>Veritabanı Bağlantı Hataları</h2>
<p>PostgreSQL bağlantı hatası alıyorsanız:</p>
<ol>
<li><code>docker compose ps</code> ile servislerin durumunu kontrol edin</li>
<li>Veritabanı container'ının <code>healthy</code> durumuna gelmesini bekleyin</li>
<li><code>.env</code> dosyasındaki <code>DATABASE_URL</code> değerini doğrulayın</li>
</ol>
<h2>API Anahtarı Hataları</h2>
<p>LLM veya ses sağlayıcılarından kimlik doğrulama hatası alıyorsanız:</p>
<ul>
<li>API anahtarlarının doğru olduğundan emin olun</li>
<li>Sağlayıcı hesabınızda yeterli bakiye/ kota olduğunu kontrol edin</li>
<li><code>.env</code> dosyasındaki değişken adlarının tam eşleştiğini doğrulayın</li>
</ul>""",
    },
    # ===== temel-kavramlar (Core Concepts) =====
    {
        "section_slug": "temel-kavramlar",
        "slug": "how-verasist-works",
        "path": "core-concepts/how-verasist-works",
        "title": "Verasist Nasıl Çalışır?",
        "excerpt": "Verasist platformunun mimarisi ve temel çalışma prensipleri.",
        "order": 1,
        "content": """<h2>Platform Mimarisi</h2>
<p>Verasist, mikroservis mimarisine dayalı modüler bir platformdur. Ana bileşenler:</p>
<ul>
<li><strong>API (FastAPI):</strong> Tüm iş mantığını yöneten Python backend</li>
<li><strong>UI (Next.js):</strong> Yönetim paneli ve iş akışı düzenleyicisi</li>
<li><strong>Worker (ARQ):</strong> Arka plan görevleri için Redis tabanlı iş kuyruğu</li>
<li><strong>Pipecat:</strong> Gerçek zamanlı ses işleme motoru</li>
<li><strong>PostgreSQL:</strong> Ana veritabanı</li>
<li><strong>Redis:</strong> Önbellek ve mesaj kuyruğu</li>
<li><strong>MinIO:</strong> Ses dosyaları için S3 uyumlu depolama</li>
</ul>
<h2>Temel Akış</h2>
<ol>
<li>Bir arama başlatılır (gelen veya giden)</li>
<li>Pipecat ses akışını işler, konuşmayı metne çevirir</li>
<li>LLM yanıt üretir</li>
<li>Ses sentezi yanıtı sese dönüştürür</li>
<li>İş akışı mantığı etkileşimi yönetir</li>
</ol>""",
    },
    {
        "section_slug": "temel-kavramlar",
        "slug": "workflows-and-agents",
        "path": "core-concepts/workflows-and-agents",
        "title": "İş Akışları ve Ajanlar",
        "excerpt": "İş akışı ve ajan kavramlarının detaylı açıklaması.",
        "order": 2,
        "content": """<h2>İş Akışı Nedir?</h2>
<p>İş akışı (workflow), bir sesli etkileşimin baştan sona nasıl ilerleyeceğini tanımlayan görsel bir diyagramdır. Düğümler (nodes) ve bağlantılardan (edges) oluşur.</p>
<h2>Ajan Nedir?</h2>
<p>Ajan (agent), bir iş akışının çalışan örneğidir. Her ajan:</p>
<ul>
<li>Bir iş akışı şablonuna bağlıdır</li>
<li>Kendi LLM, ses ve araç yapılandırmasına sahiptir</li>
<li>Bir telefon numarası veya WebRTC uç noktası ile ilişkilendirilebilir</li>
</ul>
<h2>Düğüm Türleri</h2>
<p>İş akışlarında kullanabileceğiniz temel düğüm türleri:</p>
<ul>
<li><strong>Start Call:</strong> Aramanın başlangıcını tanımlar</li>
<li><strong>Agent:</strong> LLM tabanlı konuşma ajanı</li>
<li><strong>Global:</strong> Tüm iş akışı için geçerli ayarlar</li>
<li><strong>End Call:</strong> Aramanın sonlandırılması</li>
<li><strong>API Trigger:</strong> Harici API çağrıları ile tetikleme</li>
<li><strong>Webhook:</strong> Dış sistemlere olay bildirimi</li>
</ul>""",
    },
    {
        "section_slug": "temel-kavramlar",
        "slug": "calls-and-runs",
        "path": "core-concepts/calls-and-runs",
        "title": "Aramalar ve Çalıştırmalar",
        "excerpt": "Arama (call) ve çalıştırma (run) kavramları arasındaki farklar.",
        "order": 3,
        "content": """<h2>Arama (Call) Nedir?</h2>
<p>Arama, bir telefon görüşmesini veya WebRTC oturumunu temsil eder. Her aramanın bir başlangıç ve bitiş zamanı, durumu ve ilişkili çalıştırmaları vardır.</p>
<h2>Çalıştırma (Run) Nedir?</h2>
<p>Çalıştırma, bir arama içindeki tek bir iş akışı yürütmesidir. Bir arama birden fazla çalıştırma içerebilir (örneğin, aktarma sonrası).</p>
<h2>Durumlar</h2>
<ul>
<li><strong>queued:</strong> Kuyrukta bekliyor</li>
<li><strong>in-progress:</strong> Devam ediyor</li>
<li><strong>completed:</strong> Başarıyla tamamlandı</li>
<li><strong>failed:</strong> Hata ile sonlandı</li>
<li><strong>cancelled:</strong> İptal edildi</li>
</ul>""",
    },
    {
        "section_slug": "temel-kavramlar",
        "slug": "context-and-variables",
        "path": "core-concepts/context-and-variables",
        "title": "Bağlam ve Değişkenler",
        "excerpt": "İş akışlarında bağlam (context) ve değişken kullanımı.",
        "order": 4,
        "content": """<h2>Bağlam (Context) Nedir?</h2>
<p>Bağlam, bir arama boyunca tüm düğümler arasında paylaşılan anahtar-değer deposudur. Ajanın konuşma geçmişini, kullanıcı bilgilerini ve araç sonuçlarını taşır.</p>
<h2>Değişken Kullanımı</h2>
<p>İş akışlarında <code>{{ degisken_adi }}</code> sözdizimi ile değişkenleri kullanabilirsiniz:</p>
<pre><code>Merhaba {{ musteri_adi }}, {{ urun }} hakkında size nasıl yardımcı olabilirim?</code></pre>
<h2>Sistem Değişkenleri</h2>
<ul>
<li><code>{{ caller_number }}</code> — Arayan numarası</li>
<li><code>{{ called_number }}</code> — Aranan numara</li>
<li><code>{{ call_sid }}</code> — Oturum kimliği</li>
<li><code>{{ timestamp }}</code> — Zaman damgası</li>
</ul>
<h2>Özel Değişkenler</h2>
<p>API tetikleyicileri veya webhook'lar aracılığıyla özel değişkenler enjekte edebilirsiniz. Bunlar bağlamda saklanır ve tüm düğümler tarafından okunabilir.</p>""",
    },
    {
        "section_slug": "temel-kavramlar",
        "slug": "campaigns",
        "path": "core-concepts/campaigns",
        "title": "Kampanyalar",
        "excerpt": "Toplu arama kampanyaları oluşturma ve yönetme.",
        "order": 5,
        "content": """<h2>Kampanya Nedir?</h2>
<p>Kampanya, bir kişi listesine toplu olarak arama yapmanızı sağlayan bir özelliktir. Her kişi için ayrı ayrı arama başlatılır ve sonuçlar raporlanır.</p>
<h2>Kampanya Oluşturma</h2>
<ol>
<li>Bir iş akışı oluşturun ve test edin</li>
<li>Kampanya bölümüne gidin</li>
<li>Kişi listenizi yükleyin (CSV formatında)</li>
<li>Arama zamanlamasını ve tekrar deneme ayarlarını yapılandırın</li>
<li>Kampanyayı başlatın</li>
</ol>
<h2>Kampanya Metrikleri</h2>
<ul>
<li>Toplam kişi sayısı</li>
<li>Başarılı aramalar</li>
<li>Cevapsız aramalar</li>
<li>İptal edilenler</li>
<li>İlerleme yüzdesi</li>
</ul>""",
    },
    {
        "section_slug": "temel-kavramlar",
        "slug": "platform-ui-overview",
        "path": "core-concepts/platform-ui-overview",
        "title": "Platform Arayüzüne Genel Bakış",
        "excerpt": "Verasist yönetim panelinin bölümleri ve kullanımı.",
        "order": 6,
        "content": """<h2>Yönetim Paneli Bölümleri</h2>
<p>Verasist yönetim paneli dört ana bölümden oluşur:</p>
<h3>1. Oluştur (Build)</h3>
<ul>
<li><strong>İş Akışları:</strong> İş akışlarınızı oluşturun ve düzenleyin</li>
<li><strong>Araçlar:</strong> HTTP API, arama sonlandırma gibi araçları yapılandırın</li>
<li><strong>Bilgi Tabanı:</strong> Ajanlarınızın kullanacağı belgeleri yükleyin</li>
<li><strong>Dosyalar:</strong> Ses kayıtları ve medya dosyalarınız</li>
</ul>
<h3>2. Entegrasyonlar</h3>
<ul>
<li><strong>Telefon Yapılandırmaları:</strong> Telefon sağlayıcılarınızı yönetin</li>
<li><strong>Kanallar:</strong> WhatsApp, Telegram, Instagram entegrasyonları</li>
</ul>
<h3>3. Gözlemle (Observe)</h3>
<ul>
<li><strong>Çalıştırmalar:</strong> Tüm arama kayıtlarını görüntüleyin</li>
<li><strong>Kayıtlar:</strong> Ses kayıtlarını dinleyin</li>
<li><strong>İzleme:</strong> LLM çağrılarının detaylı loglarını inceleyin</li>
</ul>
<h3>4. Ayarlar</h3>
<ul>
<li><strong>Model Yapılandırmaları:</strong> LLM modellerini yapılandırın</li>
<li><strong>API Anahtarları:</strong> API erişimini yönetin</li>
<li><strong>MCP:</strong> Model Context Protocol ayarları</li>
</ul>""",
    },
    # ===== yapilandirma (Configurations) =====
    {
        "section_slug": "yapilandirma",
        "slug": "inference-providers",
        "path": "configurations/inference-providers",
        "title": "Çıkarım Sağlayıcıları",
        "excerpt": "LLM çıkarım sağlayıcılarının yapılandırılması.",
        "order": 1,
        "content": """<h2>Desteklenen Sağlayıcılar</h2>
<p>Verasist aşağıdaki LLM sağlayıcılarını destekler:</p>
<ul>
<li><strong>OpenAI:</strong> GPT-4o, GPT-4o-mini, GPT-3.5-turbo</li>
<li><strong>Anthropic:</strong> Claude 3.5 Sonnet, Claude 3 Haiku</li>
<li><strong>Google:</strong> Gemini 2.0 Flash, Gemini 1.5 Pro</li>
<li><strong>Groq:</strong> Llama 3, Mixtral</li>
<li><strong>Together AI:</strong> Çeşitli açık kaynak modeller</li>
<li><strong>Fireworks:</strong> Hızlı çıkarım için optimize edilmiş modeller</li>
</ul>
<h2>Yapılandırma</h2>
<p>Her sağlayıcı için API anahtarınızı <code>.env</code> dosyasında veya yönetim paneli üzerinden tanımlayın:</p>
<pre><code>OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_API_KEY="..."
GROQ_API_KEY="..."</code></pre>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "llm",
        "path": "configurations/llm",
        "title": "LLM Yapılandırması",
        "excerpt": "Dil modeli parametreleri ve ince ayarlar.",
        "order": 2,
        "content": """<h2>Model Parametreleri</h2>
<p>Her ajan için aşağıdaki LLM parametrelerini özelleştirebilirsiniz:</p>
<ul>
<li><strong>Model:</strong> Kullanılacak model (örn. gpt-4o-mini)</li>
<li><strong>Sıcaklık (Temperature):</strong> 0.0 - 2.0 arası, yaratıcılık seviyesi</li>
<li><strong>Maksimum Token:</strong> Yanıt uzunluğu sınırı</li>
<li><strong>Sistem Mesajı:</strong> Ajanın davranışını belirleyen prompt</li>
</ul>
<h2>Sistem Mesajı Örneği</h2>
<pre><code>Sen bir müşteri hizmetleri temsilcisisin. Kibar, yardımsever ve profesyonel bir dil kullan. Müşterinin sorununu anlamak için sorular sor.</code></pre>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "voice",
        "path": "configurations/voice",
        "title": "Ses Yapılandırması",
        "excerpt": "Ses sentezi (TTS) sağlayıcıları ve ses ayarları.",
        "order": 3,
        "content": """<h2>Desteklenen TTS Sağlayıcıları</h2>
<ul>
<li><strong>ElevenLabs:</strong> Yüksek kaliteli yapay sesler</li>
<li><strong>Deepgram:</strong> Gerçek zamanlı ses sentezi</li>
<li><strong>Azure:</strong> Microsoft'un nöral sesleri</li>
<li><strong>Play.ht:</strong> Çok dilli ses sentezi</li>
<li><strong>Cartesia:</strong> Düşük gecikmeli ses</li>
<li><strong>Rime:</strong> Özelleştirilebilir ses profilleri</li>
</ul>
<h2>Ses Seçimi</h2>
<p>Her ajan için farklı bir ses seçebilirsiniz. Sesler; cinsiyet, yaş, aksan ve dil desteğine göre filtrelenebilir.</p>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "transcriber",
        "path": "configurations/transcriber",
        "title": "Transkripsiyon Yapılandırması",
        "excerpt": "Konuşma tanıma (STT) sağlayıcılarının yapılandırılması.",
        "order": 4,
        "content": """<h2>Desteklenen STT Sağlayıcıları</h2>
<ul>
<li><strong>Deepgram:</strong> Gerçek zamanlı, yüksek doğruluklu transkripsiyon</li>
<li><strong>AssemblyAI:</strong> Gelişmiş konuşma analizi özellikleri</li>
<li><strong>Azure:</strong> Çok dilli konuşma tanıma</li>
<li><strong>Groq (Whisper):</strong> Hızlı ve ücretsiz seçenek</li>
</ul>
<h2>Dil Desteği</h2>
<p>Transkripsiyon için hedef dili belirleyebilirsiniz. Türkçe, İngilizce ve 50'den fazla dil desteklenir.</p>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "api-keys",
        "path": "configurations/api-keys",
        "title": "API Anahtarları",
        "excerpt": "API anahtarlarının oluşturulması ve yönetilmesi.",
        "order": 5,
        "content": """<h2>API Anahtarı Oluşturma</h2>
<p>Harici uygulamaların Verasist API'sine erişmesi için API anahtarı oluşturmanız gerekir:</p>
<ol>
<li>Yönetim panelinde <strong>Ayarlar → API Anahtarları</strong> bölümüne gidin</li>
<li>"Yeni Anahtar Oluştur" düğmesine tıklayın</li>
<li>Anahtar için bir isim verin</li>
<li>Oluşturulan anahtarı güvenli bir yerde saklayın — sadece bir kez gösterilir</li>
</ol>
<h2>Kullanım</h2>
<pre><code>curl -H "Authorization: Bearer vrt_..." https://api.verasist.ai/api/v1/agents</code></pre>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "interruption",
        "path": "configurations/interruption",
        "title": "Kesme (Interruption) Yapılandırması",
        "excerpt": "Kullanıcının ajanı sözle kesme davranışının ayarlanması.",
        "order": 6,
        "content": """<h2>Kesme Nedir?</h2>
<p>Kesme (interruption veya barge-in), kullanıcının ajan konuşurken söze girebilmesi özelliğidir. Bu sayede konuşmalar daha doğal hale gelir.</p>
<h2>Kesme Hassasiyeti</h2>
<p>Kesme hassasiyeti 0.0 ile 1.0 arasında ayarlanabilir:</p>
<ul>
<li><strong>0.0 - 0.3:</strong> Ajanın sözünün kesilmesi zor</li>
<li><strong>0.4 - 0.6:</strong> Dengeli (varsayılan)</li>
<li><strong>0.7 - 1.0:</strong> Ajanın sözü kolayca kesilebilir</li>
</ul>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "tracing",
        "path": "configurations/tracing",
        "title": "İzleme (Tracing)",
        "excerpt": "LLM çağrılarının ve iş akışı adımlarının izlenmesi.",
        "order": 7,
        "content": """<h2>İzleme Nedir?</h2>
<p>İzleme, ajanınızın her adımını kaydeden bir hata ayıklama aracıdır. LLM çağrıları, araç kullanımları ve iş akışı geçişlerini görsel olarak takip edebilirsiniz.</p>
<h2>Langfuse Entegrasyonu</h2>
<p>Verasist, Langfuse ile entegre çalışır. <code>.env</code> dosyasına aşağıdaki değişkenleri ekleyin:</p>
<pre><code>LANGFUSE_PUBLIC_KEY="pk-..."
LANGFUSE_SECRET_KEY="sk-..."
LANGFUSE_HOST="https://cloud.langfuse.com"</code></pre>
<p>Veya yönetim panelinden <strong>Ayarlar → İzleme</strong> bölümünde yapılandırın.</p>""",
    },
    # ===== sesli-asistan (Voice Agent Builder) =====
    {
        "section_slug": "sesli-asistan",
        "slug": "introduction",
        "path": "voice-agent/introduction",
        "title": "Sesli Asistan Oluşturucuya Giriş",
        "excerpt": "İş akışı düzenleyicisinin kullanımına giriş.",
        "order": 1,
        "content": """<h2>İş Akışı Düzenleyicisi</h2>
<p>Verasist'in sürükle-bırak iş akışı düzenleyicisi, görsel olarak sesli ajan davranışlarını tasarlamanızı sağlar. Her düğüm bir eylemi temsil eder ve bağlantılar akışı belirler.</p>
<h2>Temel İşlemler</h2>
<ul>
<li><strong>Düğüm ekleme:</strong> Sol panelden bir düğümü tuvale sürükleyin</li>
<li><strong>Bağlantı oluşturma:</strong> Düğüm çıkışından diğer düğüm girişine sürükleyin</li>
<li><strong>Düzenleme:</strong> Düğüme çift tıklayarak ayarlarını açın</li>
<li><strong>Silme:</strong> Düğümü seçip Delete tuşuna basın</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "editing-a-workflow",
        "path": "voice-agent/editing-a-workflow",
        "title": "İş Akışı Düzenleme",
        "excerpt": "İş akışlarının detaylı düzenlenmesi ve yapılandırılması.",
        "order": 2,
        "content": """<h2>Temel Ayarlar</h2>
<p>Her iş akışı için yapılandırabileceğiniz temel ayarlar:</p>
<ul>
<li><strong>İsim:</strong> İş akışının tanımlayıcı adı</li>
<li><strong>Açıklama:</strong> İş akışının ne yaptığına dair kısa açıklama</li>
<li><strong>Şablon Değişkenleri:</strong> İş akışında kullanılabilecek özel değişkenler</li>
<li><strong>Kayıt:</strong> Aramaların kaydedilip kaydedilmeyeceği</li>
<li><strong>Dağıtım:</strong> Widget olarak web sitesine ekleme ayarları</li>
</ul>
<h2>Global Düğüm</h2>
<p>Global düğüm, tüm iş akışı için geçerli olan varsayılan ayarları içerir: LLM modeli, ses, transkripsiyon sağlayıcısı ve kesme hassasiyeti.</p>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "start-call",
        "path": "voice-agent/start-call",
        "title": "Start Call Düğümü",
        "excerpt": "Arama başlangıcını tanımlayan Start Call düğümünün yapılandırılması.",
        "order": 3,
        "content": """<h2>Start Call Nedir?</h2>
<p>Start Call düğümü, her iş akışının giriş noktasıdır. Arama başladığında ilk çalışan düğümdür.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>Karşılama Mesajı:</strong> Arayan kişiye okunacak ilk mesaj</li>
<li><strong>Başlangıç Gecikmesi:</strong> Mesajın okunmaya başlamadan önceki bekleme süresi</li>
<li><strong>Değişken Atama:</strong> Başlangıçta bağlama eklenecek değişkenler</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "end-call",
        "path": "voice-agent/end-call",
        "title": "End Call Düğümü",
        "excerpt": "Aramayı sonlandıran End Call düğümü.",
        "order": 4,
        "content": """<h2>End Call Nedir?</h2>
<p>End Call düğümü, iş akışının sonlandığı ve aramanın bitirileceği noktayı belirtir.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>Kapanış Mesajı:</strong> Aramayı sonlandırmadan önce okunacak mesaj</li>
<li><strong>Webhook Bildirimi:</strong> Arama sonu bilgisinin gönderileceği URL</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "agent",
        "path": "voice-agent/agent",
        "title": "Agent Düğümü",
        "excerpt": "LLM tabanlı konuşma ajanını yapılandıran Agent düğümü.",
        "order": 5,
        "content": """<h2>Agent Düğümü</h2>
<p>Agent düğümü, iş akışının kalbidir. LLM ile konuşma mantığını yürütür ve araçları kullanır.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>Sistem Mesajı (Prompt):</strong> Ajanın rolünü ve davranışını belirleyen talimat</li>
<li><strong>LLM Modeli:</strong> Hangi dil modelinin kullanılacağı</li>
<li><strong>Sıcaklık:</strong> Yanıtların yaratıcılık seviyesi</li>
<li><strong>Araçlar:</strong> Ajanın kullanabileceği araçların listesi</li>
<li><strong>Bilgi Tabanı:</strong> Ajanın başvurabileceği belgeler</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "global",
        "path": "voice-agent/global",
        "title": "Global Düğüm",
        "excerpt": "Tüm iş akışı için geçerli varsayılan ayarları içeren Global düğüm.",
        "order": 6,
        "content": """<h2>Global Düğüm</h2>
<p>Global düğüm, iş akışındaki tüm Agent düğümleri için varsayılan ayarları belirler. Her Agent düğümü bu ayarları geçersiz kılabilir.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>Varsayılan LLM:</strong> Sağlayıcı, model ve sıcaklık</li>
<li><strong>Varsayılan Ses:</strong> TTS sağlayıcısı ve ses seçimi</li>
<li><strong>Varsayılan Transkripsiyon:</strong> STT sağlayıcısı ve dil</li>
<li><strong>Kesme Hassasiyeti:</strong> Varsayılan kesme ayarı</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "api-trigger",
        "path": "voice-agent/api-trigger",
        "title": "API Trigger Düğümü",
        "excerpt": "Harici API çağrıları ile iş akışını tetikleme.",
        "order": 7,
        "content": """<h2>API Trigger Nedir?</h2>
<p>API Trigger düğümü, iş akışını harici bir HTTP isteği ile tetiklemenizi sağlar. Bu sayede arama sırasında dış sistemlerden veri çekebilir veya işlem yapabilirsiniz.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>URL:</strong> Çağrılacak API uç noktası</li>
<li><strong>Metot:</strong> GET, POST, PUT, DELETE</li>
<li><strong>Başlıklar:</strong> İsteğe eklenecek HTTP başlıkları</li>
<li><strong>Gövde:</strong> POST/PUT istekleri için gövde şablonu</li>
<li><strong>Değişken Atama:</strong> API yanıtının bağlama nasıl eşleneceği</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "webhook",
        "path": "voice-agent/webhook",
        "title": "Webhook Düğümü",
        "excerpt": "İş akışı olaylarını dış sistemlere bildirme.",
        "order": 8,
        "content": """<h2>Webhook Düğümü</h2>
<p>Webhook düğümü, iş akışı sırasında belirli olayları dış sistemlere HTTP POST ile bildirmenizi sağlar.</p>
<h2>Yapılandırma</h2>
<ul>
<li><strong>Webhook URL:</strong> Bildirimin gönderileceği adres</li>
<li><strong>Olay Türü:</strong> Hangi olayda tetikleneceği</li>
<li><strong>Gövde Şablonu:</strong> Gönderilecek JSON verisinin yapısı</li>
<li><strong>Güvenlik:</strong> İmza doğrulama için gizli anahtar</li>
</ul>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "pre-recorded-audio",
        "path": "voice-agent/pre-recorded-audio",
        "title": "Önceden Kaydedilmiş Ses",
        "excerpt": "İş akışlarında önceden kaydedilmiş ses dosyalarının kullanımı.",
        "order": 9,
        "content": """<h2>Önceden Kaydedilmiş Ses Kullanımı</h2>
<p>TTS (metin-ses) sentezi yerine, belirli mesajlar için önceden kaydedilmiş ses dosyalarını kullanabilirsiniz.</p>
<h2>Ses Yükleme</h2>
<ol>
<li><strong>Dosyalar</strong> bölümüne gidin</li>
<li>Ses dosyası yükleyin (MP3, WAV formatları desteklenir)</li>
<li>İş akışı düzenleyicisinde bir düğüme ses referansı ekleyin</li>
</ol>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "template-variables",
        "path": "voice-agent/template-variables",
        "title": "Şablon Değişkenleri",
        "excerpt": "İş akışlarında dinamik içerik için şablon değişkenleri.",
        "order": 10,
        "content": """<h2>Şablon Değişkenleri</h2>
<p>Şablon değişkenleri, iş akışı mesajlarını dinamik hale getirmenizi sağlar. <code>{{ degisken }}</code> sözdizimi ile kullanılır.</p>
<h2>Tanımlama</h2>
<p>İş akışı ayarlarından özel değişkenler tanımlayabilirsiniz. Bu değişkenler arama başlatılırken API üzerinden değer alır.</p>
<h2>Örnek Kullanım</h2>
<pre><code>Merhaba {{ musteri_adi }}, {{ siparis_no }} numaralı siparişiniz {{ siparis_durumu }} durumunda.</code></pre>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "add-to-website",
        "path": "voice-agent/add-to-website",
        "title": "Web Sitesine Ekleme",
        "excerpt": "Sesli asistanı web sitenize widget olarak ekleme.",
        "order": 11,
        "content": """<h2>Widget Entegrasyonu</h2>
<p>Verasist ajanınızı web sitenize bir widget olarak ekleyebilirsiniz. Üç farklı mod desteklenir:</p>
<h3>Kayan Widget (Floating)</h3>
<p>Sayfanın sağ alt köşesinde görünen sohbet baloncuğu. Kullanıcı tıkladığında açılır.</p>
<h3>Satır İçi Bileşen (Inline)</h3>
<p>Sayfanın belirli bir bölümüne gömülü olarak çalışır. Tam boyut kontrolü sizdedir.</p>
<h3>Başsız Mod (Headless)</h3>
<p>Sadece API üzerinden kontrol edilen, görsel arayüzü olmayan mod. Tam özelleştirme imkanı sunar.</p>""",
    },
    {
        "section_slug": "sesli-asistan",
        "slug": "knowledge-base",
        "path": "voice-agent/knowledge-base",
        "title": "Bilgi Tabanı",
        "excerpt": "Ajanların kullanacağı bilgi tabanının oluşturulması.",
        "order": 12,
        "content": """<h2>Bilgi Tabanı Nedir?</h2>
<p>Bilgi tabanı, ajanınızın soruları yanıtlarken başvurabileceği belgeler koleksiyonudur. PDF, TXT, DOCX gibi formatlarda belge yükleyebilirsiniz.</p>
<h2>Belge Yükleme</h2>
<ol>
<li><strong>Dosyalar → Bilgi Tabanı</strong> bölümüne gidin</li>
<li>Belgelerinizi sürükleyip bırakın veya seçin</li>
<li>Belgeler otomatik olarak işlenir ve vektör veritabanına eklenir</li>
</ol>
<h2>Ajan Yapılandırması</h2>
<p>Agent düğümünde "Bilgi Tabanı" seçeneğini aktif edin ve kullanılacak belgeleri seçin.</p>""",
    },
    # ===== telefon (Telephony) =====
    {
        "section_slug": "telefon",
        "slug": "overview",
        "path": "integrations/telephony/overview",
        "title": "Telefon Entegrasyonuna Genel Bakış",
        "excerpt": "Telefon sağlayıcıları ve entegrasyon seçenekleri.",
        "order": 1,
        "content": """<h2>Telefon Altyapısı</h2>
<p>Verasist, birden fazla telefon sağlayıcısı ile çalışabilir. Her sağlayıcı için ayrı yapılandırma oluşturabilirsiniz.</p>
<h2>Desteklenen Sağlayıcılar</h2>
<ul>
<li><strong>Twilio:</strong> Küresel, güvenilir (önerilen)</li>
<li><strong>Vonage:</strong> Ekonomik, iyi API</li>
<li><strong>Plivo:</strong> Düşük maliyetli</li>
<li><strong>Telnyx:</strong> Yüksek kaliteli ses</li>
<li><strong>Cloudonix:</strong> Özelleştirilebilir</li>
<li><strong>Vobiz:</strong> Türkiye odaklı</li>
<li><strong>SIP Trunk:</strong> Kendi altyapınızı getirin</li>
</ul>""",
    },
    {
        "section_slug": "telefon",
        "slug": "inbound",
        "path": "integrations/telephony/inbound",
        "title": "Gelen Aramalar",
        "excerpt": "Gelen aramaların yapılandırılması ve yönlendirilmesi.",
        "order": 2,
        "content": """<h2>Gelen Arama Yapılandırması</h2>
<p>Gelen aramalar için bir telefon numarası satın almanız ve bir iş akışına bağlamanız gerekir.</p>
<h3>Adımlar</h3>
<ol>
<li>Telefon sağlayıcınızdan bir numara satın alın</li>
<li>Verasist'te Telefon Yapılandırması oluşturun</li>
<li>Numarayı yapılandırmaya bağlayın</li>
<li>Webhook URL'sini sağlayıcınızın konsoluna girin</li>
</ol>""",
    },
    # ===== kanallar (Channels) =====
    {
        "section_slug": "kanallar",
        "slug": "overview",
        "path": "integrations/channels/overview",
        "title": "Kanallara Genel Bakış",
        "excerpt": "WhatsApp, Telegram, Instagram gibi mesajlaşma kanalları.",
        "order": 1,
        "content": """<h2>Çok Kanallı Destek</h2>
<p>Verasist, sesli aramaların yanı sıra mesajlaşma kanallarını da destekler:</p>
<ul>
<li><strong>WhatsApp:</strong> Dünyanın en popüler mesajlaşma uygulaması</li>
<li><strong>Telegram:</strong> Bot API ile kolay entegrasyon</li>
<li><strong>Instagram:</strong> Sosyal medya üzerinden müşteri iletişimi</li>
</ul>""",
    },
    {
        "section_slug": "kanallar",
        "slug": "whatsapp",
        "path": "integrations/channels/whatsapp",
        "title": "WhatsApp Entegrasyonu",
        "excerpt": "WhatsApp Business API ile entegrasyon.",
        "order": 2,
        "content": """<h2>WhatsApp Business API</h2>
<p>Verasist, WhatsApp Business API üzerinden WhatsApp entegrasyonunu destekler.</p>
<h3>Gereksinimler</h3>
<ul>
<li>Onaylı bir WhatsApp Business hesabı</li>
<li>Meta Developer hesabı</li>
<li>Webhook yapılandırması</li>
</ul>""",
    },
    {
        "section_slug": "kanallar",
        "slug": "telegram",
        "path": "integrations/channels/telegram",
        "title": "Telegram Entegrasyonu",
        "excerpt": "Telegram Bot API ile entegrasyon.",
        "order": 3,
        "content": """<h2>Telegram Bot API</h2>
<p>Telegram entegrasyonu için bir bot oluşturmanız ve token'ı Verasist'e tanımlamanız yeterlidir.</p>
<h3>Adımlar</h3>
<ol>
<li>@BotFather ile yeni bir bot oluşturun</li>
<li>Bot token'ını alın</li>
<li>Verasist Kanallar bölümünde Telegram'ı ekleyin</li>
<li>Webhook URL'sini ayarlayın</li>
</ol>""",
    },
    {
        "section_slug": "kanallar",
        "slug": "instagram",
        "path": "integrations/channels/instagram",
        "title": "Instagram Entegrasyonu",
        "excerpt": "Instagram mesajlaşma entegrasyonu.",
        "order": 4,
        "content": """<h2>Instagram Messaging API</h2>
<p>Instagram entegrasyonu, işletme hesapları için mesajlaşma özelliğini kullanır.</p>
<h3>Gereksinimler</h3>
<ul>
<li>Instagram profesyonel hesap</li>
<li>Bağlı bir Facebook sayfası</li>
<li>Meta Developer uygulaması</li>
</ul>""",
    },
    # ===== entegrasyonlar (Other Integrations) =====
    {
        "section_slug": "entegrasyonlar",
        "slug": "mcp",
        "path": "integrations/mcp",
        "title": "MCP (Model Context Protocol)",
        "excerpt": "Model Context Protocol ile araç ve veri kaynağı entegrasyonu.",
        "order": 1,
        "content": """<h2>MCP Nedir?</h2>
<p>Model Context Protocol (MCP), yapay zeka modellerinin harici araçlara ve veri kaynaklarına standart bir şekilde bağlanmasını sağlayan açık bir protokoldür.</p>
<h2>Verasist MCP Desteği</h2>
<p>Verasist, MCP sunucularını ajanlarınıza araç olarak bağlamanızı sağlar:</p>
<ul>
<li>Harici MCP sunucularını yapılandırın</li>
<li>Araçları otomatik olarak keşfedin</li>
<li>Ajanlarınıza yeni yetenekler ekleyin</li>
</ul>""",
    },
]

@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tabs.create_index("slug", unique=True)
    await db.tabs.create_index("id", unique=True)
    await db.sections.create_index("slug", unique=True)
    await db.sections.create_index("id", unique=True)
    await db.documents.create_index([("slug", 1), ("lang", 1)], unique=True)
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index("section_id")
    await db.documents.create_index("parent_id")
    await db.documents.create_index([("path", 1), ("lang", 1)], unique=True, sparse=True)
    # Text index for search (MongoDB $text operator) — language-neutral
    try:
        await db.documents.create_index(
            [("title", "text"), ("content", "text"), ("excerpt", "text")],
            default_language="none",
            name="text_search_idx",
        )
    except Exception:
        pass  # Index may already exist with different options

    # Seed tabs (idempotent)
    seed_tabs = [
        {"slug": "rehberler", "title": "Rehberler", "order": 1,
         "section_slugs": ["baslangic", "temel-kavramlar", "yapilandirma", "sesli-asistan", "telefon", "kanallar", "entegrasyonlar"]},
        {"slug": "gelistirici", "title": "Geliştirici", "order": 2, "section_slugs": []},
        {"slug": "api-referansi", "title": "API Referansı", "order": 3, "section_slugs": []},
    ]
    tab_slug_to_id = {}
    for t in seed_tabs:
        existing = await db.tabs.find_one({"slug": t["slug"]})
        if existing:
            tab_slug_to_id[t["slug"]] = existing["id"]
        else:
            tid = str(uuid.uuid4())
            tab_slug_to_id[t["slug"]] = tid
            await db.tabs.insert_one({
                "id": tid,
                "slug": t["slug"],
                "title": t["title"],
                "order": t["order"],
                "created_at": now_iso(),
            })

    # Migrate existing sections to tabs
    for t in seed_tabs:
        for sec_slug in t["section_slugs"]:
            await db.sections.update_one(
                {"slug": sec_slug, "$or": [{"tab_id": None}, {"tab_id": {"$exists": False}}]},
                {"$set": {"tab_id": tab_slug_to_id[t["slug"]]}},
            )
    # Default any remaining sections without tab to first tab
    default_tab_id = tab_slug_to_id["rehberler"]
    await db.sections.update_many(
        {"$or": [{"tab_id": None}, {"tab_id": {"$exists": False}}]},
        {"$set": {"tab_id": default_tab_id}},
    )

    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Yönetici",
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info("Admin kullanıcısı oluşturuldu: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed sections & docs (only if completely empty)
    if await db.sections.count_documents({}) == 0:
        slug_to_id = {}
        for s in SEED_SECTIONS:
            sid = str(uuid.uuid4())
            slug_to_id[s["slug"]] = sid
            # Find tab for this section
            tab_for_section = default_tab_id
            for t in seed_tabs:
                if s["slug"] in t["section_slugs"]:
                    tab_for_section = tab_slug_to_id[t["slug"]]
                    break
            await db.sections.insert_one({
                "id": sid,
                "slug": s["slug"],
                "title": s["title"],
                "order": s["order"],
                "tab_id": tab_for_section,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        for d in SEED_DOCS:
            await db.documents.insert_one({
                "id": str(uuid.uuid4()),
                "slug": d["slug"],
                "path": d.get("path"),
                "title": d["title"],
                "section_id": slug_to_id[d["section_slug"]],
                "parent_id": None,
                "content": d["content"],
                "excerpt": d["excerpt"],
                "order": d["order"],
                "published": True,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Tohum içerik yüklendi (%d bölüm, %d doküman).", len(SEED_SECTIONS), len(SEED_DOCS))

    # Seed videos (only if completely empty)
    if await db.videos.count_documents({}) == 0:
        for v in SEED_VIDEOS:
            await db.videos.insert_one({
                "id": str(uuid.uuid4()),
                "title": v["title"],
                "title_en": v["title_en"],
                "filename": v["filename"],
                "description": v["description"],
                "description_en": v["description_en"],
                "document_id": None,
                "section_id": None,
                "order": v["order"],
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Tohum videolar yüklendi (%d video).", len(SEED_VIDEOS))

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
