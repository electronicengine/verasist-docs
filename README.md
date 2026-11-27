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

Frontend yayın imajı: `local/verasist-docs-frontend:lab-fxo-three-analog-20261127`.
Önceki frontend imajı: `local/verasist-docs-frontend:lab-english-paths-20261127`. Yayın ve geri alma
işlemleri yalnızca `frontend` servisini `--no-deps --no-build` ile değiştirmelidir.

## Telefon entegrasyonu öğrenme atölyesi

`/verasistLAB/pbx` doküman düzeninden bağımsız, tam ekran Three.js atölyesidir.
Dört sekme: Verasist uygulama akışı, sabit/mobil hat, PBX santral ve santralsiz IP telefon.
PBX santral ayarlarında Yerel SIP, Uzak SIP, VPN üzerinden SIP, Doğrudan ARI ve Telefon numarasına yönlendirme seçilir.
İlk sekme güvenilir giriş/DID eşleşmesi, organizasyonun telefon yapılandırması,
aktif numara, yayımlanmış iş akışı, çağrı çalışması, model paketi ve konuşma pipeline’ını gösterir.
Pipeline, Realtime ve Live seçenekleri vardır. Ham ses ile yapılandırma/metin yolları ayrıdır;
organizasyon ve iş akışı kutuları fiziksel ses sunucuları değildir.
IP santral ve SIP trunk sayfalarına iframe olarak gömülür. Parent tema/dil mesajları
aynı origin ve parent kaynağından doğrulanır; mevcut adım korunur.
Kurum içi ve dış ağ akışlarında Ethernet switch ile modem/router ayrı nesnelerdir.
Telefonlar kurum/sanal santrale veya destekleyen operatöre kaydolur; doğrudan
telefon registrar desteği mevcut Verasist panelinde yoktur. Santralli sahnelerde
IP telefonlar ve ATA/analog uçlar; sabit/mobil sahnede normal şebeke telefonları görünür.
Verasist uygulama sekmesinde ise kurum telefonları veya ARI/bridge iç şeması yer almaz.
Kablolar masaüstü/mobilde kesişmeyen kollara yerleştirilir; yanıt sesi ayrı dönüş hattını kullanır.

`frontend/src/components/telephony/story/scenarios.js` eğitim akışlarını;
`StoryStage.jsx` 3B cihazları, kabloları ve hareketli paketleri içerir.
Cihaz, kablo veya mesaj seçildiğinde ayrıntı çekmecesi açılır. Paketler sentetiktir;
bu atölye canlı çağrı başlatmaz. Santral ve SIP trunk dokümanlarından bağlantı verilir.
Eski `?ders=` bağlantıları yeni senaryolara yönlenir.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/scenarios.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-browser.mjs
```

Tarayıcı testi altı sekmeyi, iki kayıt yönünü, iki dokümanda iframe ve tema eşlemesini, tüm adımları, iki yönlü ses yollarını, duraklatmayı,
analog dönüşümü, mobil görünümü ve doküman bağlantısını doğrular.
Frontend yayını yalnızca `frontend` servisini değiştirir. Önceki imaj
`local/verasist-docs-frontend:telephony-step-setup-20261126` geri dönüş için korunur.


Santralsiz IP telefon sekmesi (`/verasistLAB/ip-phone`) tek akışta iki aşamadır:
önce IP telefon operatöre kaydolur ve Verasist olmadan çağrıyı cevaplar;
ilk görüşmeden sonra Verasist operatör bağlantısına eklenir. Telefonun kaydı
operatörde kalır. Ana numara Verasist’e yönlenir; Verasist personel için ayrı bir
numara/izinli SIP hedefi arar. Operatörün bu kayıt ve yönlendirmeleri desteklemesi
gerekir; ana numaraya geri arama döngüsü açıkça ayrılır. İkinci aşamada yalnızca
tek Verasist nesnesi eklenir; YZ işlemcisi ve medya köprüsü çizilmez.
`phase.stage`, görünür düğümleri ve bağlantıları seçer. İlk aşamanın ses yolu
müşteri → operatör → modem → telefon; ikinci aşamada müşteri → operatör →
Verasist → operatör → modem → telefondur. Kurum santrali yoktur.

Atölye Türkçe/İngilizce içerik sunar; `english.js` metinleri protokol mantığından
ayırır. Iframe dokümanın dilini ve tema tokenlarını kullanır. Aynı origin/parent’tan
gelen tema/dil mesajları seçili adımı korur. Standalone görünümde dil değiştirilebilir.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/scenarios.test.js src/components/telephony/story/english.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-locale.mjs
```


Atölye tipografisi dokümanla aynıdır: Work Sans gövde, Outfit başlık, JetBrains Mono
paket örneği. El yazısı fontu ve dosyaları kaldırıldı. Sekme sırası:
normal santral, Verasist ile santral, Verasist IVR, dahili Verasist,
santralsiz IP telefon ile Verasist, Verasist nasıl çalışır.
Sekmeler geniş görünümde altı; dar görünümde üç sütunla, metin kesilmeden yerleşir.
Okuma rehberi, oynatıcının altındaki klavye ile açılabilir ipucu bölümündedir.


Paket ayrıntıları `PacketStack` içinde renkli mesaj bölümleri ve açılabilir alanlar
olarak gösterilir. `packetModel.js` seçili örnekteki SIP başlıklarını, Digest
alanlarını, SDP gövdesini, SIPfrag sonucunu, RTP ve raw WebSocket sesini ayırır.
ARI JSON olayları ve analog hatlar ayrı türlerdir; örnekte olmayan ağ başlıkları
uydurulmaz. `packetFields.js` alanların Türkçe/İngilizce görev açıklamalarını taşır.
Cihaz etiketleri küçük başlar; hover ve klavye odağında tam adları açılır.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/packetModel.test.js src/components/telephony/story/scenarios.test.js src/components/telephony/story/english.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-packets.mjs
```

Cihaz etiketleri artık modelin merkezine projekte edilir; normal görünümde 7 px
(mobilde 6 px), %25 arka plan opaklığı kullanır. Nesne veya etiket hover’ı
ve klavye odağı tam adı büyütür; canvas raycast hover’ı çağrı akışını değiştirmez.


Numaralı adım açıklamaları sınırlı yükseklikte, klavye/dokunma/tekerlek ile
kaydırılabilir. Okuma alanına odaklanmak veya kaydırmak oynatmayı durdurur; yeni
adımda okuma alanı başa döner. Adım numarası ve ayrıntı düğmesi sabit kalır.
`setupHints.js` altı senaryoda ilgili IP telefon, ATA, santral, operatör ve Verasist
ayarlarının nerede yapılacağını Türkçe/İngilizce gösterir. Önceden kurulum,
otomatik protokol işlemi, personel eylemi ve servis yöneticisi ayarları ayrılır.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/setupHints.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-setup.mjs
```


Santralsiz IP telefon sekmesindeki bağlantı seçimi mevcut doğrudan SIP akışını
korur; numaraya yönlendirme seçeneği 34 adımlık alternatif sunar. İlk normal
görüşmeden sonra kurum operatörü A, ana numarayı B operatöründeki ayrı Verasist
numarasına yönlendirir. Yalnızca B→Verasist SIP bağlantısıdır; A↔B erişimi
şematik genel telefon şebekesidir. Ayrı, yönlendirilmemiş personel hattı A’da
telefona ulaşır. İki bacak Verasist’te köprülenir; ses ve kapanış ayrı gösterilir.
`forwardingScenario.js` bu akışı, `OperatorHint.jsx` kaynaklı operatör koşullarını
taşır. TT numara yönlendirmesi belgelenmiştir; Vodafone/Turkcell’de ilgili
hat/paket desteği ve haricî SIP izni teyitsizdir. Tüm akış saha testi olarak sunulmaz.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/forwardingScenario.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-forwarding.mjs
```


Rehber belgeleri ve animasyon kapsamı
------------------------------------

3B iframe yalnız `guides/integrations/telephony/ip-pbx` ve `sip-trunk`
sayfalarına eklenir. Diğer rehberlerdeki 3B atölyeler ve `/ogren/rehber` rotası
kaldırıldı. Yeni araç, Shopify, canlı takip, operatör yönlendirmesi ve çağrı
aktarımı belgeleri korunur. Eski Mermaid şemaları korunmuş; çağrı transferindeki
eksik İngilizce şema yayın öncesi belge yedeğinden geri eklenmiştir.

Güncel 37 araç kataloğu `content/guides/tool-catalog.json`; iki dilde
gözden geçirilmiş belge kaynakları `content/guides/updates/{en,tr}/` altındadır.
`sync_guide_workshops.py` adlı yayıncı belge ID/slug’larını ve diğer bölümleri
koruyarak yalnız bu kaynakları yayımlar; varsayılan önizleme, uygulama için yeni
yedek zorunludur. Türkçe araçların üst kategori bağlantısı aynı kategori
yolunun Türkçe ID’sine düzeltilmiştir.

```bash
python backend/migration/sync_guide_workshops.py --source-dir content/guides/updates
python backend/migration/sync_guide_workshops.py --source-dir content/guides/updates --apply --backup /private/new-guide-backup.json
```


Telefon atölyesinde sahne alanı
-----------------------------

Varsayılan görünüm yalnız 3B sahne, kısa adım başlığı ve kompakt oynatma
çubuğunu gösterir. Açıklama/kurulum kartları, tam adım listesi, senaryo ayarları
(hedef dahili, kayıt ve bağlantı yöntemi, operatör kaynakları) ve okuma rehberi
isteğe bağlı panellerdedir. Masaüstünde yan panel, mobilde alt panel açılır.
Panel açmak oynatmayı durdurur; kapatmak adımı, kamerayı ve ilerlemeyi korur.
Adımlar kaydırıcı, önceki/sonraki düğmeleri veya adım listesinden seçilebilir.
Uzun açıklama paneli kaydırılır ve adım değiştiğinde başa döner.

Güncel arayüz doğrulaması (önceki yerleşim için yazılmış tarayıcı
kontrollerinin yerine):

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-compact.mjs
```

Bu kontrol altı senaryonun tüm adımlarını, TR/EN, 320–1440 px, panel/odak/scroll
davranışını, iki dokümanın iframe’ini ve ses/paket ayrıntılarına erişimi kapsar.
Geri dönüş imajı: `local/verasist-docs-frontend:telephony-only-20261126`.

The first telephony tab has a **Call route** selector: the original carrier → office PBX flow, or carrier → Verasist DID reception. The latter keeps the office PBX out of customer–AI audio and uses a separate staff DID for an answered, Verasist-anchored transfer. External SIP delivery and both number routes require carrier support; this is an illustrative successful call, not an operator certification.

Verify the new route (all packets, both languages, three extension targets and responsive selection):

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-sip-number.mjs
```

The first workshop tab, **Landline / mobile**, demonstrates ordinary public-number forwarding without an office PBX, IP phone or ATA. Choose the existing office line (analog/mobile) and a separate staff destination (mobile/landline) in Scenario settings. It includes the original handset-only call, carrier forwarding, B–Verasist SIP/SDP, AI media, staff answer and Verasist-anchored audio bridging, plus termination. Source links and line-specific requirements live in its settings drawer. The forwarded main number cannot double as the staff return number.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-public-line.mjs
```

In both connection modes of **IP phone with Verasist, no PBX**, the original phone 201 handles the baseline call. Verasist transfers to a different physical phone 202 using separate operator account `office-a-202` and unforwarded staff number `12025550201`. Staff signaling and both media directions reach 202; the forwarded main number is never dialed for transfer.

Telephony scenes with an office IP network now draw a separate Ethernet switch and modem/router NAT boundary. Local PBX traffic stays on the LAN; external signaling and both media directions follow switch → router → WAN. Hosted PBX registration and operator-registered phones cross the office router, while carrier-to-Verasist cloud audio and public analog/mobile forwarding do not. Open the router, a step explanation or packet details for the LAN/WAN NAT accordion: signaling vs RTP access, reachable SDP, conditional port forwarding, symmetric media and CGNAT requirements. These are illustrative NAT deployments; private carrier access/public IP topologies may differ.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-telephony-network.mjs
```

The workshop **Inside Verasist** tab describes the application lifecycle rather than PBX/ARI internals: trusted ingress/DID → organization-scoped telephony configuration → active number → inbound workflow → run with pinned released definition → effective model package → workflow engine → media transport and selected voice pipeline. Choose Pipeline, Realtime or Live in Scenario settings. Configuration resolution and text/tool frames are blue; raw input speech ends at STT in Pipeline mode, while generated TTS audio returns through output transport. Realtime/Live use a voice service without separate STT/TTS processors; their auxiliary/backend LLM branch is not an audio route.

Implementation evidence: `api/services/telephony/ari_manager.py` (`_handler_for_inbound`, `_handle_inbound_stasis_start`), `api/db/workflow_run_client.py` (`create_workflow_run`), `api/services/configuration/ai_model_configuration.py` (`get_effective_ai_model_configuration_for_workflow`), and `api/services/pipecat/run_pipeline.py` / `pipeline_builder.py`. IDs and frames in the illustration are synthetic, not an executable API contract.

Other scenes use ordered tree layouts; the platform scene uses routed feedback lanes. `sceneLayout.test.js` checks both desktop and mobile cable routes for intersections and wires passing through unrelated nodes.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-platform-scene.mjs
```

The platform scene uses software notation rather than infrastructure hardware: entity cards for organization/configuration/number/workflow/run, a package tile, a flow-engine module, distinct STT/TTS transforms, a hexagonal LLM and a waveform speech module. An external speaker sits outside the Verasist boundary. Two aligned bands show context above the media pipeline (parallel columns on mobile); a separate perimeter lane returns response audio directly to the speaker. Inactive associations are muted.

## Adımlar panelinde Mermaid mesaj akışı

Tüm animasyonların ve alt senaryolarının Adımlar panelinde **Adım listesi** ve
**Mermaid mesaj akışı** sekmeleri bulunur. Diyagram aynı animasyon verisinden
üretilir; seçili adıma kadar biriken mesajlar veya tüm akış gösterilebilir. Panelden adım seçmek 3B
oynatıcıyı da o adıma taşır. Kontrol mesajları ve eşzamanlı iki yönlü ses,
paralel dallarda gösterilir. SIP uçları, paket ileten switch/router ve
analog/operatör ses yolları ayrılır. Verasist uygulama akışında yazılım
mesajları ile ham ses ayrı tutulur. Diyagram iki yönde kaydırılır; Mermaid
kaynağı açılabilir. Türkçe/İngilizce ve açık/koyu tema desteklenir.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand --runTestsByPath src/components/telephony/story/sequenceDiagram.test.js
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-message-sequence.mjs
```

Atölyede Verasist uygulama akışı ilk sekmedir. Konuşma adımında STT/LLM/TTS metin trafiği ve araç/bilgi bankası istek-yanıtları sesle birlikte hareket eder. Yanıt çıkışı aynı Verasist medya sınırından dış konuşmacıya döner.

Mermaid mesaj görünümünde adım başlığı ve taşıma yolu panelleri kullanılmaz. Verasist uygulama akışında organizasyon, telefon yapılandırması, aktif numara, iş akışı ve çalışma için ayrı yazılım ikonları vardır. Üç veritabanı simgesi aynı kayıt deposunun mantıksal gruplarını gösterir; sorgu ve eşleşen kayıt dönüşü mavi veri yolunda canlandırılır.

Atölye üst başlığı, tarayıcı başlığı ve doküman menüsü bağlantısı iki dilde de **Verasist LAB** adını kullanır.

Senaryo ayarları STT/LLM/TTS ve Live seçeneklerini sunar; Realtime seçeneği menüden kaldırılmıştır. Yazılım sınırının metin etiketi gösterilmez.

Numara senaryoları yönetilen hizmet modelini gösterir: kurum SIP numarasını Verasist üzerinden alır; Verasist operatör altyapısından sağlanan numarayı kuruma tahsis eder, telefon yapılandırmasına kaydeder ve yayımlanmış ajana bağlar. Operatör çağrı teslimi ve mevcut numaradan yönlendirme koşulları korunur.

PBX santral sekmesindeki ayrı SIP hesabı senaryosu Verasist numara operatörü B ve kurum operatörü A düğümlerini ayırır. Müşteri sesi B–Verasist üzerinde; personel aktarımı Verasist–B–A–kurum santrali yolundadır. Aynı operatörün ayrı hesaplarla hizmet vermesi de mümkündür.

PBX yönlendirme senaryosunda müşterinin aradığı mevcut +12025550101 korunur. A bu numarayı B’de Verasist’in tahsis ettiği +12025550301 numarasına yönlendirir. Verasist seçilen dahiliye ait ayrı dönüş DID’sini arar; PBX DID rotasıyla 201/202/301 hedefini seçer. Dönüş numarası yönlendirilmez. Örnek, hedef başına ayrı dönüş DID’si gerektirir; tek numaradan rastgele özel dahili arandığı varsayılmaz.

PBX yönlendirme senaryosunda A operatöründeki koşulsuz yönlendirme kuralı ayrı mantıksal nesnedir. Yönetici kuralı operatörün desteklediği panel/talep/servis kodu ile kaydeder; çağrı geldiğinde A bu kuralı okur ve B’deki Verasist DID’sine yönlendirir. Operatörün iç protokolü veya tüm ürünlere ortak bir servis kodu varsayılmaz. Bu model PBX üzerinden dış arama yönlendirmesinden ayrılır. Kaynak: https://www.turktelekom.com.tr/yardim/bireysel-ev-telefonu/faydali-bilgiler-ve-araclar

## PBX bağlantı modelleri

`pbxConnectionScenario.js` yerel SIP, internet/NAT üzerinden SIP, VPN üzerinden SIP
ve doğrudan ARI için aynı karşılama–aktarım öyküsünü farklı kontrol/medya yollarıyla
üretir. Telefon numarasına yönlendirme `sipNumberScenario.js` üzerinden mevcut
ana numarayı korur; operatör kuralı ve ayrı dahili dönüş DID’si görünür kalır.

- Yerel SIP: Verasist Asterisk ve PBX aynı LAN’dadır; bu bacakta NAT yoktur.
- Uzak SIP: bu örnek IP eşleşmeli, erişilebilir WAN/NAT kurulumu kullanır.
  SDP/sinyal adresleri, SIP/RTP erişimi ve CGNAT kısıtı kurulum adımında gösterilir.
- VPN: görünür tünel ve özel ağ rotaları kullanılır; genel SIP/RTP port eşlemesi
  tünelin iç yoluna uygulanmaz. VPN’in kendi dış erişimi ayrıca gerekir.
- ARI: yerel/bulut seçilebilir. Verasist kurum Asterisk’ini yönetir; bizim
  Asterisk aracı değildir. Kontrol HTTP(S)/olay WS ile, ajan sesi medya WSS ile
  taşınır. Personel cevaplayınca kurum köprüsü kullanılır ve YZ medya bacağı ayrılır.
- Modeller entegrasyon mimarisi örnekleridir; mevcut ürünün bütün bu bağlantıları
  otomatik sağladığı veya her kurum PBX’inin desteklediği anlamına gelmez.

Eski kayıt/bağlantı, IVR ve dahili Verasist sekmeleri gezinmeden çıkarılmıştır;
eski URL’ler PBX bölümünü açar. Adımlar/Mermaid, iki dil, temalar ve iframe korunur.
Regresyon kontrolleri:

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-pbx-models.mjs
```

PBX model ekranlarında motor marka adı yerine kurum PBX’i, Verasist SIP ve Verasist ARI adları kullanılır. ARI/modül, ağ erişimi ve medya gereksinimleri korunur.

## SIP ile ARI arasındaki görsel fark

ARI modelinde mor kontrol/olay yolu ile yeşil medya WSS yolu ayrı mantıksal
bağlantılar olarak çizilir. Bu yollar aynı fiziksel LAN/WAN’ı paylaşabilir;
çizimdeki kontrol ve medya kartları ayrı telefon sunucuları değildir.
Aktarım cevaplandıktan sonra ajan medya yolu pasifleşir; kurum PBX’indeki köprü
halka ile vurgulanır. SIP modelinde iki telefon sunucusu kalır; müşteri–personel
medyası Verasist SIP köprüsünden geçmeye devam eder. Sahnedeki kısa açıklama,
seçili adımın protokolünü ve köprü konumunu belirtir. Mermaid mantıksal kontrol
kartlarını API çağrısı üreten ayrı sunucular gibi göstermez.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-ari-sip-difference.mjs
```

## Santralsiz IP telefon: üç yöntem, iki konum

`phoneConnectionScenario.js` üç bağlantı yöntemini yerel/bulut konumuyla
birleştirir. Senaryo ayarlarında bağlantı yöntemi ve Verasist konumu ayrı seçilir.

- **Verasist’e kayıt:** 201/202 hesapları Verasist kayıt hizmetinde oluşturulur;
  REGISTER/challenge/kimlik doğrulama/Contact kaydı, YZ ilk karşılama ve cevaplanan
  202 kanalına aktarım gösterilir. Yerelde telefon bacağı LAN içinde kalır;
  bulutta telefonun SIP ve RTP’si router/NAT üzerinden geçer. Bu model mevcut
  SIP trunk formunun otomatik sunduğu bir özellik değildir; ayrı kayıt/dahili
  yönetimi gerekir ve bu koşul senaryoda açıkça belirtilir.
- **Doğrudan SIP:** telefon mevcut sağlayıcıda kayıtlı kalır. Sağlayıcı ana
  numaranın çağrısını Verasist’e teslim eder; personel için ayrı desteklenen
  hesap/numara veya SIP hedefi gerekir.
- **Numaraya yönlendirme:** ana numara A’dan Verasist’in B numarasına yönlenir;
  geri aktarım ayrı, yönlendirilmemiş personel hedefini kullanır. Mevcut ilk
  telefon ve sonraki Verasist karşılama öyküsü korunur.

Yerel Verasist seçimi sağlayıcıdan kurum router’ına ve LAN’daki sunucuya teslim
edilen SIP/ses yolunu ayrıca gösterir; yerel sunucu olması operatör erişimini
kendiliğinden çözmez. Ağ kurulum adımı WAN/NAT/CGNAT koşullarını açıklar.
Tüm modellerde kurum PBX cihazı çizilmez; telefonlar ve kayıt hizmetinin sahibi
ayrı gösterilir. Mermaid aynı adım ve ses verilerinden üretilir.

```bash
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-phone-models.mjs
```

## FXO analog hat ve VPN senaryosu

PBX bölümündeki model seçimi yalnız **Senaryo ayarları** panelindedir; sahnede
seçili modelin başlığı gösterilir. Sabit/mobil hat bölümünde **FXO ağ geçidi**
seçeneği mevcut analog hattı RJ11 üzerinden FXO’ya bağlar. Yeni operatör SIP
hesabı veya numara alınmaz. FXO gelen çağrıyı SIP’e, analog sesi RTP’ye dönüştürür.

`fxoScenario.js` WireGuard örneğiyle kurumdan başlatılan tüneli, anahtar eşlemesini,
endpoint/portu, özel adresleri, iki yönde AllowedIPs/return routes ve firewall
izinlerini gösterir. NAT arkasında gerektiğinde PersistentKeepalive=25 örneği
kullanılır. SIP/RTP özel tüneldedir; genel SIP/RTP port yönlendirmesi yapılmaz.
Bu örnek VPN seçer; uygun yerel/başka ağ kurulumlarında VPN her zaman zorunlu değildir.

Gelen analog çalma, FXO SIP INVITE, cevap üzerine off-hook, iki yönlü YZ sesi,
birleşik ağ geçidindeki seçili 301/302/303 analog dahilisine aktarım ve SIP/analog kapanışı
ayrı adımlardır. Tek analog hattın meşgulken ikinci dış arama yapamayacağı açıkça
belirtilir. Aktarım aynı numarayı yeniden aramaz; yerel kayıtlı hedefi kullanır.
Analog kablolarda dalga, IP/VPN tarafında paket gösterimi kullanılır.

Kaynaklar: [FXO/SIP dönüşümü](https://documentation.grandstream.com/knowledge-base/gxw410x-user-manual/),
[WireGuard yapılandırma ve NAT keepalive](https://www.wireguard.com/quickstart/).

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-fxo.mjs
```

## Verasist LAB adresleri

Kanonik animasyon adresleri:

- `/verasistLAB/how-verasist-works`
- `/verasistLAB/landline-mobile`
- `/verasistLAB/pbx`
- `/verasistLAB/ip-phone`

`/verasistLAB` varsayılan PBX animasyonuna açılır. Sekme geçişi path tabanlıdır;
`senaryo` veya `ders` parametresi artık üretilmez. Eski
`/ogren/telefon-santrali?senaryo=...` ve `?ders=...` bağlantıları istemci tarafında
kanonik adrese `replace` ile taşınır; dil, tema, embed, hash ve diğer parametreler
korunur. Eski kayıt/IVR/dahili sayfaları PBX’e açılır.

Menü ve iframe yeni adresi kullanır. Eski kayıtlı dokümanlardaki aynı origin LAB
bağlantılarının href’leri render sırasında normalleştirilir; veritabanı içeriği
silinmez/değiştirilmez. Kaynak MDX ve yayın override bağlantıları yeni adrestedir.
Eski adres alias’ı uyumluluk için korunur; bu sürümden önceki imaja tam geri dönüşte
yeni URL’leri kullanan istemciler için ayrıca yeni yol alias’larının korunması gerekir.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-lab-routes.mjs
```

## FXO şemasında üç analog telefon

FXO sahnesi tek bir birleşik **en az 1 FXO + 3 FXS** ağ geçidi ve modem/router
kullanır. Ayrı switch, IP telefon ve ATA nesneleri bu sahnede gösterilmez.
Mevcut analog hat FXO girişine; 301/302/303 analog telefonları ayrı FXS 1/2/3
çıkışlarına RJ11 ile bağlanır. Ethernet portu doğrudan router’a gider.
Ağ geçidi üç ayrı SIP hesap/port eşlemesini yönetir; ahizelerin IP adresi yoktur.
Seçili dahiliye giden SIP çağrısı aynı cihazda ilgili FXS portunu çaldırır.
Ana hat ve dahili SIP bacakları farklı RTP portlarıyla örneklenir.
VPN, ilk karşılama, iki yönlü medya ve tek analog hat kapasitesi açıklamaları korunur.

```bash
PLAYWRIGHT_MODULE=/root/verasist/submodules/verasist-sim/node_modules/@playwright/test/index.mjs node frontend/scripts/test-fxo-three-phones.mjs
```
