# Verasist Docs

Bu proje, bir dokümantasyon sitesi ve yönetim paneli için frontend + backend yapısından oluşur.

Sunucuda önce ana Verasist Compose başlatılır. Ardından bu klasörde `.env.example` dosyasını `.env` olarak kopyalayıp değerleri doldurun ve `docker compose up -d --build` çalıştırın. Uygulama, varsayılan `verasist_app-network` ortak ağı üzerinden ana Nginx tarafından yayınlanır.

## Video dosyaları

Eğitim videoları imajdan bağımsız olarak `DOCS_VIDEOS_DIR` dizininden salt okunur
bağlanır. Varsayılan konum ana deponun `media/docs-videos` dizinidir. İlk kurulumda
özgün MP4 dosyalarını hazırlayın; kayıtlı dosya adları ve eski takvim bağlantısı
`content/video-assets.json` dosyasında tanımlıdır. Yeni referanslar ASCII dosya
adları kullanır; eski bağlantılar aynı dosyalara karşılık gelen takma adlarla korunur:

```bash
python3 backend/migration/restore_video_assets.py --source ../../media/landing-originals --target ../../media/docs-videos
docker compose up -d --no-deps --no-build frontend
```

Bu dizini yedeklemeye dahil edin. İmaj güncellemelerinde video dosyalarını koruyun.

## Gereksinimler

- Node.js ve npm
- Python 3.10+
- MongoDB

## 1) Projeyi klonlayın

```bash
git clone <repo-url>
cd verasist-docs
```

## 2) Backend kurulumu

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Backend için `.env` dosyası oluşturun:

```env
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=verasist_docs
JWT_SECRET=change-this-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

MongoDB’yi başlatın:

```bash
mkdir -p /home/ybulb/data/db
mongod --dbpath /home/ybulb/data/db --bind_ip 127.0.0.1 --port 27017
```

Backend’i çalıştırın:

```bash
cd backend
source .venv/bin/activate
python -m uvicorn server:app --host 127.0.0.1 --port 7000
```

Backend açıldıktan sonra aşağıdaki adreslere erişebilirsiniz:

- http://127.0.0.1:7000/
- http://127.0.0.1:7000/docs

## 3) Frontend kurulumu

```bash
cd ../frontend
npm install
```

Frontend için `.env` dosyası oluşturun veya güncelleyin:

```env
REACT_APP_BACKEND_URL=http://localhost:7000
REACT_APP_FRONTEND_URL=http://localhost:7010
PORT=7010
```

Frontend’i çalıştırın:

```bash
cd frontend
npm start
```

Frontend şu adreste açılır:

- http://localhost:7010

## 4) Test etme

- Backend: http://127.0.0.1:7000/docs
- Frontend: http://localhost:7010

## 5) Sık karşılaşılan sorunlar

- Backend startup sırasında MongoDB bağlantı hatası alıyorsanız MongoDB’nin çalıştığından emin olun.
- Frontend portu değişmek istiyorsanız `.env` dosyasındaki `PORT` değerini güncelleyin.
- Backend URL’sini değiştirmek istiyorsanız frontend `.env` dosyasındaki `REACT_APP_BACKEND_URL` değerini güncelleyin.

## Dil ve tema varsayılanları

İlk açılışta tarayıcının tercih sırasındaki ilk desteklenen dil (Türkçe/İngilizce)
kullanılır. Desteklenen dil bulunamazsa İngilizce seçilir. İlk içerik isteği de
aynı dilde gönderilir. Varsayılan tema koyudur; kullanıcının dil ve tema
seçimleri sonraki ziyaretler için saklanır.

Frontend yayın imajı: `local/verasist-docs-frontend:browser-defaults-20261116`.
Önceki frontend imajı: `local/verasist-docs-frontend:dev`. Yayın ve geri alma
işlemleri yalnızca `frontend` servisini `--no-deps --no-build` ile değiştirmelidir.
