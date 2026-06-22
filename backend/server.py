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
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

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

class DocumentIn(BaseModel):
    title: str
    slug: Optional[str] = None
    section_id: str
    content: str = ""
    excerpt: str = ""
    order: int = 0
    published: bool = True

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
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "slug": slug,
        "order": body.order,
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
async def list_documents(section_id: Optional[str] = None):
    q = {}
    if section_id:
        q["section_id"] = section_id
    docs = await db.documents.find(q, {"_id": 0, "content": 0}).sort("order", 1).to_list(1000)
    return docs

@api.get("/documents/{slug}")
async def get_document(slug: str):
    doc = await db.documents.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Doküman bulunamadı")
    return doc

@api.post("/documents")
async def create_document(body: DocumentIn, user: dict = Depends(get_current_user)):
    slug = body.slug or slugify(body.title)
    if await db.documents.find_one({"slug": slug}):
        slug = f"{slug}-{str(uuid.uuid4())[:6]}"
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "slug": slug,
        "section_id": body.section_id,
        "content": body.content,
        "excerpt": body.excerpt,
        "order": body.order,
        "published": body.published,
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
        "content": body.content,
        "excerpt": body.excerpt,
        "order": body.order,
        "published": body.published,
        "updated_at": now_iso(),
    }
    if body.slug:
        upd["slug"] = body.slug
    res = await db.documents.update_one({"id": did}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Doküman bulunamadı")
    doc = await db.documents.find_one({"id": did}, {"_id": 0})
    return doc

@api.delete("/documents/{did}")
async def delete_document(did: str, user: dict = Depends(get_current_user)):
    await db.documents.delete_one({"id": did})
    return {"ok": True}

# ----- Search -----
@api.get("/search")
async def search(q: str = Query(..., min_length=1)):
    rx = re.compile(re.escape(q), re.IGNORECASE)
    docs = await db.documents.find(
        {"$or": [{"title": rx}, {"content": rx}, {"excerpt": rx}], "published": True},
        {"_id": 0, "content": 0},
    ).limit(30).to_list(30)
    # Build snippets
    for d in docs:
        d["match"] = "title" if rx.search(d.get("title", "")) else "content"
    return docs

# ----- Health -----
@api.get("/")
async def root():
    return {"status": "ok", "name": "Dökümantasyon API"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----- Seeding -----
SEED_SECTIONS = [
    {"slug": "baslangic", "title": "Başlangıç", "order": 1},
    {"slug": "yapilandirma", "title": "Yapılandırma", "order": 2},
    {"slug": "dagitim", "title": "Dağıtım", "order": 3},
    {"slug": "api-referansi", "title": "API Referansı", "order": 4},
]

SEED_DOCS = [
    # baslangic
    {
        "section_slug": "baslangic",
        "slug": "giris",
        "title": "Giriş",
        "excerpt": "Açık kaynak sesli yapay zekâ ajan platformuna genel bakış ve hızlı tanıtım.",
        "order": 1,
        "content": """<h2>Platform Hakkında</h2>
<p>Bu platform, <strong>açık kaynak sesli yapay zekâ ajanları</strong> oluşturmak için tasarlanmış, sürükle-bırak iş akışı düzenleyicisine sahip bir geliştirme ortamıdır. Tıpkı kapalı kaynaklı alternatiflerin yaptığı gibi sesli botlar oluşturmanıza imkân tanır; ancak şu farklarla:</p>
<ul>
<li><strong>%100 açık kaynak</strong> — sağlayıcı bağımlılığı yok, tam şeffaflık.</li>
<li><strong>Kendi sunucunuzda barındırılabilir</strong> — istediğiniz yere kurun, altyapınızın sahibi olun.</li>
<li><strong>Tam kontrol</strong> — her satır kod açık ve özelleştirilebilir.</li>
<li><strong>2 dakikalık kurulum</strong> — sıfırdan çalışan sesli bota iki dakika içinde ulaşın.</li>
</ul>
<h2>Genel Bakış</h2>
<p>Aşağıdaki dökümantasyon, platformun yeteneklerini öğrenmenize, kendi botunuzu yapılandırmanıza ve üretim ortamına dağıtmanıza yardımcı olacak şekilde düzenlenmiştir.</p>
<h2>Sonraki Adımlar</h2>
<p>Devam etmek için <a href="/docs/onkosullar">Önkoşullar</a> bölümünü inceleyin veya doğrudan <a href="/docs/kurulum">Kurulum</a> adımlarına geçin.</p>""",
    },
    {
        "section_slug": "baslangic",
        "slug": "onkosullar",
        "title": "Önkoşullar",
        "excerpt": "Sistem gereksinimleri, bağımlılıklar ve hazırlanmanız gereken araçlar.",
        "order": 2,
        "content": """<h2>Sistem Gereksinimleri</h2>
<p>Platformu yerel makinenizde sorunsuz çalıştırmak için aşağıdaki minimum kaynaklara ihtiyacınız vardır:</p>
<ul>
<li>İşletim Sistemi: macOS 12+, Linux (Ubuntu 20.04+) veya Windows 11 (WSL2)</li>
<li>RAM: En az 8 GB (16 GB önerilir)</li>
<li>Disk: 10 GB boş alan</li>
<li>Docker Desktop veya Docker Engine 20.10+</li>
</ul>
<h2>Gerekli Hesaplar</h2>
<p>Sesli ajanların tam olarak çalışabilmesi için aşağıdaki üçüncü taraf hizmetlere kayıt olmanız gerekir:</p>
<ol>
<li>Bir <strong>LLM sağlayıcısı</strong> hesabı (OpenAI, Anthropic veya Google).</li>
<li>Bir <strong>telefon sağlayıcısı</strong> hesabı (Twilio veya benzeri).</li>
<li>İsteğe bağlı olarak konuşma sentezi için <strong>ElevenLabs</strong>.</li>
</ol>
<h2>Geliştirici Araçları</h2>
<p>Kodu klonlamak için <code>git</code>, betikleri çalıştırmak için <code>bash</code> ve container yönetimi için <code>docker</code> yüklü olmalıdır.</p>""",
    },
    {
        "section_slug": "baslangic",
        "slug": "kurulum",
        "title": "Kurulum",
        "excerpt": "Docker ile iki dakikada platformu çalıştırma adımları.",
        "order": 3,
        "content": """<h2>Hızlı Kurulum</h2>
<p>Yerel makinenizde küçük bir başlatma betiğiyle Docker kullanarak platformu çalıştırın.</p>
<h3>macOS / Linux</h3>
<pre><code>curl -o docker-compose.yaml https://raw.githubusercontent.com/your-org/your-repo/main/docker-compose.yaml \\
  && curl -o start.sh https://raw.githubusercontent.com/your-org/your-repo/main/scripts/start.sh \\
  && chmod +x start.sh \\
  && ./start.sh</code></pre>
<h3>Windows (PowerShell)</h3>
<pre><code>iwr -useb https://raw.githubusercontent.com/your-org/your-repo/main/scripts/start.ps1 | iex</code></pre>
<h2>Telemetri</h2>
<p>Ürünü geliştirmek için anonim kullanım verileri topluyoruz. Devre dışı bırakmak için başlatma betiğini çalıştırmadan önce <code>ENABLE_TELEMETRY=false</code> ortam değişkenini ayarlayın.</p>
<h2>Doğrulama</h2>
<p>Kurulum tamamlandığında <code>http://localhost:3000</code> adresinden yönetim paneline erişebilirsiniz.</p>""",
    },
    {
        "section_slug": "baslangic",
        "slug": "sorun-giderme",
        "title": "Sorun Giderme",
        "excerpt": "Sık karşılaşılan kurulum sorunları ve çözümleri.",
        "order": 4,
        "content": """<h2>Docker Başlatma Hataları</h2>
<p>Eğer <code>docker compose up</code> komutu hata veriyorsa öncelikle Docker servisinin çalıştığından emin olun. Linux üzerinde:</p>
<pre><code>sudo systemctl status docker</code></pre>
<h2>Port Çakışmaları</h2>
<p>3000, 8000 veya 5432 numaralı portlar başka bir uygulama tarafından kullanılıyorsa <code>.env</code> dosyasındaki port değerlerini değiştirin.</p>
<h2>Webhook Ulaşamıyor</h2>
<p>Yerel makineniz dış dünyaya kapalıysa, telefon sağlayıcısının webhook çağrılarını alabilmek için <code>ngrok</code> gibi bir tünel aracını kullanın.</p>
<blockquote><strong>İpucu:</strong> Sorun devam ederse <code>logs/</code> dizinindeki çıktıları inceleyerek hata satırlarını yakalayabilirsiniz.</blockquote>""",
    },
    # yapilandirma
    {
        "section_slug": "yapilandirma",
        "slug": "cikarim-saglayicilari",
        "title": "Çıkarım Sağlayıcıları",
        "excerpt": "LLM çıkarım sağlayıcılarını yapılandırma rehberi.",
        "order": 1,
        "content": """<h2>Genel Bakış</h2>
<p>Platform; OpenAI, Anthropic ve Google Gemini gibi LLM sağlayıcılarıyla çalışacak şekilde tasarlanmıştır. Her sağlayıcı için API anahtarınızı ortam değişkeni olarak tanımlamanız yeterlidir.</p>
<h3>OpenAI</h3>
<pre><code>OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"</code></pre>
<h3>Anthropic</h3>
<pre><code>ANTHROPIC_API_KEY="sk-ant-..."
ANTHROPIC_MODEL="claude-3-5-sonnet-latest"</code></pre>
<h3>Google Gemini</h3>
<pre><code>GOOGLE_API_KEY="..."
GEMINI_MODEL="gemini-2.0-flash"</code></pre>
<h2>Sağlayıcı Seçimi</h2>
<p>Yönetim panelinden <em>Ayarlar → Çıkarım Sağlayıcısı</em> menüsüne giderek varsayılan sağlayıcıyı seçebilir, her bir bot için ayrı bir sağlayıcı tanımlayabilirsiniz.</p>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "telefon-saglayicilari",
        "title": "Telefon Sağlayıcıları",
        "excerpt": "Telefon altyapısı için Twilio ve diğer entegrasyonların yapılandırması.",
        "order": 2,
        "content": """<h2>Twilio Entegrasyonu</h2>
<p>Twilio hesabınızdan <strong>Account SID</strong> ve <strong>Auth Token</strong> bilgilerini alın, ardından <code>.env</code> dosyasına ekleyin:</p>
<pre><code>TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+90..."</code></pre>
<h2>Webhook Yapılandırması</h2>
<p>Twilio konsolundan numaranızın <em>Voice</em> webhook URL'sini şu şekilde ayarlayın:</p>
<pre><code>https://example.com/api/voice/incoming</code></pre>
<h2>Test Çağrısı</h2>
<p>Yapılandırmayı doğrulamak için kendi telefonunuzdan Twilio numarasını arayın. Bot karşılama mesajını okumalıdır.</p>""",
    },
    {
        "section_slug": "yapilandirma",
        "slug": "webhooks",
        "title": "Webhook'lar",
        "excerpt": "Olay tabanlı entegrasyonlar için webhook tanımlama.",
        "order": 3,
        "content": """<h2>Webhook Olayları</h2>
<p>Platform aşağıdaki olayları HTTP POST ile dış sistemlere iletebilir:</p>
<ul>
<li><code>call.started</code> — Yeni bir çağrı başladığında.</li>
<li><code>call.ended</code> — Çağrı sonlandığında, süre ve kayıt URL'si ile.</li>
<li><code>intent.detected</code> — Niyet motoru bir niyet tespit ettiğinde.</li>
</ul>
<h2>İmza Doğrulama</h2>
<p>Her webhook isteği <code>X-Signature</code> başlığı ile imzalanır. Gizli anahtarınızla HMAC-SHA256 kullanarak gövdeyi doğrulayın.</p>""",
    },
    # dagitim
    {
        "section_slug": "dagitim",
        "slug": "dagitim-giris",
        "title": "Dağıtıma Giriş",
        "excerpt": "Üretim ortamına dağıtım için genel stratejiler.",
        "order": 1,
        "content": """<h2>Dağıtım Seçenekleri</h2>
<p>Platformu üretim ortamına almak için üç ana yaklaşım vardır:</p>
<ol>
<li><strong>Tek sunucu (VPS):</strong> Hızlı ve basit, küçük projeler için idealdir.</li>
<li><strong>Kubernetes:</strong> Ölçeklenebilirlik ve yüksek erişilebilirlik gereken kurumsal projeler için.</li>
<li><strong>Yönetilen platformlar:</strong> Render, Railway veya Fly.io gibi PaaS sağlayıcıları.</li>
</ol>
<h2>Hangi Yöntemi Seçmeli?</h2>
<p>Eğer takımınızda DevOps deneyimi sınırlıysa <em>yönetilen platform</em> seçeneğiyle başlamanızı öneririz.</p>""",
    },
    {
        "section_slug": "dagitim",
        "slug": "docker-ile-dagitim",
        "title": "Docker ile Dağıtım",
        "excerpt": "Tek sunucu üzerinde Docker Compose ile production dağıtımı.",
        "order": 2,
        "content": """<h2>Sunucu Hazırlığı</h2>
<p>Ubuntu 22.04 LTS önerilir. Docker ve Docker Compose'u yükleyin:</p>
<pre><code>curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER</code></pre>
<h2>Reverse Proxy</h2>
<p>Üretim ortamında HTTPS sonlandırması için <strong>Caddy</strong> veya <strong>Traefik</strong> kullanmanızı öneririz. Caddy örnek yapılandırması:</p>
<pre><code>example.com {
  reverse_proxy localhost:3000
}</code></pre>
<h2>Yedekleme</h2>
<p>Veritabanı yedeklerini günlük olarak almak için bir <code>cron</code> görevi tanımlayın.</p>""",
    },
    # api
    {
        "section_slug": "api-referansi",
        "slug": "api-kimlik-dogrulama",
        "title": "Kimlik Doğrulama",
        "excerpt": "API isteklerini yetkilendirme ve token yönetimi.",
        "order": 1,
        "content": """<h2>Bearer Token</h2>
<p>Tüm API uç noktaları <code>Authorization: Bearer &lt;token&gt;</code> başlığı ile yetkilendirilir.</p>
<h2>Token Oluşturma</h2>
<p>Yönetim panelinden <em>Ayarlar → API Anahtarları</em> bölümüne giderek yeni bir anahtar üretin. Anahtarlar yalnızca oluşturma anında bir kez gösterilir; güvenli bir yerde saklayın.</p>
<pre><code>curl -H "Authorization: Bearer YOUR_TOKEN" https://example.com/api/calls</code></pre>""",
    },
    {
        "section_slug": "api-referansi",
        "slug": "api-uc-noktalar",
        "title": "Uç Noktalar",
        "excerpt": "Tüm REST uç noktalarının listesi ve örnek istekleri.",
        "order": 2,
        "content": """<h2>Çağrılar</h2>
<ul>
<li><code>GET /api/calls</code> — Tüm çağrıları listeler.</li>
<li><code>GET /api/calls/:id</code> — Tek bir çağrının ayrıntısı.</li>
<li><code>POST /api/calls</code> — Giden çağrı başlatır.</li>
</ul>
<h2>Ajanlar</h2>
<ul>
<li><code>GET /api/agents</code> — Tüm ajanları listeler.</li>
<li><code>POST /api/agents</code> — Yeni ajan oluşturur.</li>
<li><code>PUT /api/agents/:id</code> — Ajanı günceller.</li>
</ul>
<h2>Yanıt Formatı</h2>
<p>Tüm yanıtlar JSON formatındadır ve hata durumlarında <code>error</code> alanı, kullanıcıya gösterilebilecek bir mesaj içerir.</p>""",
    },
]

@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.sections.create_index("slug", unique=True)
    await db.sections.create_index("id", unique=True)
    await db.documents.create_index("slug", unique=True)
    await db.documents.create_index("id", unique=True)
    await db.documents.create_index("section_id")

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
            await db.sections.insert_one({
                "id": sid,
                "slug": s["slug"],
                "title": s["title"],
                "order": s["order"],
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        for d in SEED_DOCS:
            await db.documents.insert_one({
                "id": str(uuid.uuid4()),
                "slug": d["slug"],
                "title": d["title"],
                "section_id": slug_to_id[d["section_slug"]],
                "content": d["content"],
                "excerpt": d["excerpt"],
                "order": d["order"],
                "published": True,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
        logger.info("Tohum içerik yüklendi.")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
