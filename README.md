# FX Express — Logistics Conversational AI Demo

FX Express, kargo müşteri deneyimi için hazırlanmış kurgusal bir dijital asistan ve analitik portfolyo projesidir. Tek sayfalı chatbot arayüzünde müşteriler menülerden ilerleyebilir veya ihtiyaçlarını yazarak ilgili konuya yönlenebilir. Proje gerçek bir kargo şirketine, takip sistemine, CRM/ticket platformuna ya da canlı temsilci kuyruğuna bağlı değildir.

> **Demo notu:** Takip yanıtları, fiyatlar, alım ve destek talebi sonuçları örnek/simüle edilmiş çıktılardır. Gerçek hizmet taahhüdü veya gerçek gönderi bilgisi değildir.

## Öne çıkan özellikler

- **Hibrit chatbot deneyimi:** Kullanıcı ana menüden işlem seçebilir veya “kargom nerede?” gibi doğal bir ifadeyle başlayabilir. Türkçe intent eşleştirme, kargo takibi, ücret hesaplama, adresten alım, ürün/hizmet bilgisi ve destek akışlarına yönlendirir.
- **Gönderi takibi ve istisna tespiti:** `/api/shipment` takip numarasını demo operasyon kayıtlarıyla eşleştirir; normal transfer, hava kaynaklı gecikme, eksik adres, bilinmeyen kayıt ve hatalı numarayı ayırt eder. Yanıtlar olay kaynağını ve ETA'yı gösterir; gecikme/istisnada temsilci aktarımı önerilir. Bu kayıtlar kurgusaldır, canlı taşıyıcı API'si değildir.
- **Ücret hesaplama:** Çıkış/varış ili ve ilçesi ile kutu ölçüleri ve ağırlık alınır. İl/ilçe listesi yazdıkça filtrelenir; tam ad girildiğinde adım ilerler. Ölçü alanları geçersiz karakterleri kabul etmez. Desi `uzunluk × genişlik × yükseklik / 3000` formülüyle hesaplanır; ücret, örnek bölge katsayılarıyla yaklaşık olarak üretilir.
- **Bilgi bankası ve RAG:** AWS Bedrock Knowledge Bases yapılandırılırsa `RetrieveAndGenerate` ile yanıt üretilebilir. AWS ayarları yoksa uygulama, örnek içerik üzerinde anahtar kelime/eş anlamlı sözcük eşleştirmeli yerel arama yapar. Yerel yedek **embedding kullanan vektör veya anlamsal arama değildir**.
- **Yanıtsız kalma kurtarması:** Aynı konuda üç sonuçsuz aramadan sonra ana menüye dönme veya sohbeti bitirme seçeneği gösterilir.
- **Memnuniyet ve aktarım talebi:** Sohbet sonunda 1–5 puan istenir. 1–3 puanda kullanıcı canlı temsilciye aktarım isteği oluşturabilir; demo gerçek bir temsilci kuyruğuna bağlı değildir.
- **Lojistik akış değerlendirmesi:** `examples/shipment-scenarios.json` beş takip, gecikme, istisna ve negatif senaryo içerir. `npm run eval:logistics` durum/reddetme doğruluğu, gecikme tespiti, aktarım önerisi ve kaynak kapsamını ölçer; `npm test` API ve senaryo regresyonlarını çalıştırır.
- **Günlük/haftalık analitik:** Chatbot açılışları, konu seçimleri, kapanış bilgileri, oturum süresi, konu bazında memnuniyet ve temsilci aktarım istekleri SQLite'a olay olarak kaydedilir; `/analytics` ekranında günlük ve son 7 günlük toplamlar sunulur.

## Kullanılan teknolojiler

| Alan | Teknolojiler |
| --- | --- |
| Chatbot arayüzü | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Geliştirme/derleme | vinext, Vite 8, Node.js 22.13+ |
| RAG entegrasyonu (isteğe bağlı) | AWS Bedrock Agent Runtime SDK, Bedrock Knowledge Bases `RetrieveAndGenerate` |
| Analitik API | Python, FastAPI, Pydantic, Uvicorn |
| Analitik veritabanı | SQLite |
| Test/kalite kontrol | Node.js test runner, ESLint, TypeScript derlemesi |

## Konuşma ve bilgi yanıtı akışı

```text
Kullanıcı mesajı veya menü seçimi
              ↓
Intent eşleştirme ve akış doğrulaması
       ↙                       ↘
İşlem akışı                Bilgi sorusu
takip / ücret / destek          ↓
                         /api/chat
                       ↙          ↘
            AWS Bedrock RAG     Yerel örnek arama
            yapılandırılmışsa   (anahtar kelime tabanlı)
                       ↘          ↙
                 Yanıt, kaynak veya fallback
```

Takip ve fiyat hesabı gibi yapılandırılmış işlemler LLM'e bırakılmaz; uygulama adımları ve doğrulamalarla ilerler. Bilgi soruları `/api/chat` uç noktasına gider. AWS entegrasyonu için Bedrock Knowledge Base ve model erişimi AWS hesabında ayrıca yapılandırılmalıdır.

## Yerel ortamda çalıştırma

Gereksinimler: Node.js 22.13 veya üzeri, npm ve Python 3.

### 1. Chatbot ve analitik arayüzü

Proje klasöründe:

```bash
npm install
npm run dev
```

Terminalin gösterdiği yerel adresi açın (genellikle `http://localhost:3000`; bu port doluysa başka bir port seçilebilir). Analitik ekranı `/analytics` yolundadır.

### 2. Analitik API'si

Chatbot olaylarının veritabanına yazılması ve panelin rapor alması için ikinci bir Terminal penceresinde proje klasörüne dönüp çalıştırın:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r analytics_backend/requirements.txt
python -m uvicorn analytics_backend.main:app --reload
```

API sağlık kontrolü: `http://127.0.0.1:8000/`
API dokümantasyonu: `http://127.0.0.1:8000/docs`
Yerel olay veritabanı: `analytics_backend/chatbot_analytics.db` (Git'e eklenmez).

### 3. İsteğe bağlı AWS Bedrock ayarı

`.env.example` dosyasını `.env.local` olarak kopyalayın ve AWS hesabınızda oluşturduğunuz Knowledge Base/model bilgilerini girin:

```dotenv
AWS_REGION=us-east-1
BEDROCK_KNOWLEDGE_BASE_ID=...
BEDROCK_MODEL_ARN=...
```

AWS kimlik bilgilerini yerel AWS profile/credential chain üzerinden sağlayın. Erişim anahtarı veya gizli anahtarı kaynak koda ya da GitHub'a koymayın. `.env.local` Git tarafından yoksayılır. Bedrock değişkenleri yoksa uygulama yerel örnek aramasını kullanır.

## Analitik tanımları ve sınırlar

- **Açılan görüşme:** `session_started` olayıyla sayılır.
- **Konu dağılımı:** Ana menüde seçilen başlıklar `topic_selected` olayıyla sayılır.
- **Ortalama süre:** Kapanış olayı bulunan görüşmeler için ilk ve son analitik olay arasındaki süre hesaplanır.
- **Memnuniyet:** Sohbet sonunda verilen 1–5 puan konuya göre ortalanır.
- **Aktarım isteği:** Düşük puandan sonra kullanıcı aktarım seçeneğine basarsa sayılır; gerçek temsilci bağlantısı yapılmaz.
- **Terk/kapanma:** Mevcut demoda kullanıcı “Görüşmeyi bitir” seçimi analitiğe yazılır. Otomatik hareketsizlik zaman aşımı ve gerçek hata izleme henüz uygulanmamıştır; bu nedenle panelde bu olaylar kendiliğinden oluşmaz.

Bu prototipte müşteri kimliği veya gerçek takip numarası analitik verisine yazılmamalıdır. Üretim kullanımı öncesinde KVKK/gizlilik değerlendirmesi, saklama süresi, erişim yetkileri ve veri minimizasyonu tasarlanmalıdır.

## Üretim ortamı için sonraki adımlar

1. Simüle edilmiş takip ve fiyat çıktısını yetkili lojistik API'leri ve güncel tarife servisiyle değiştirmek.
2. Bedrock Knowledge Base'e onaylı ve sürümlenmiş içerik yüklemek; chunking, embedding ve retrieval ayarlarını test sorularıyla değerlendirmek.
3. Ticket/CRM ve canlı temsilci kuyruğu entegrasyonları eklemek; aktarımda kullanıcı onayı ve bağlam özetini güvenli biçimde iletmek.
4. Gerçek kapanma/terk olayları, süre aşımı, hata, fallback ve yanlış intent değerlendirmesi için güvenilir event şeması ve izleme eklemek.
5. Kimlik doğrulama, rate limiting, hata izleme, erişim kontrolü, KVKK politikaları ve otomatik testleri tamamlamak.

## Proje yapısı

```text
app/
  page.tsx                 Chatbot arayüzü, menü akışları ve demo işlemler
  api/chat/route.ts        Bedrock RAG ve yerel bilgi araması API'si
  api/shipment/route.ts    Kaynaklı sentetik takip ve istisna API'si
  api/shipment/domain.mjs  Örnek gönderi durumları ve alan kuralları
  analytics/page.tsx       Günlük/haftalık analitik paneli
analytics_backend/
  main.py                  FastAPI olay toplama ve rapor uç noktaları
  requirements.txt         Python bağımlılıkları
tests/
  rendered-html.test.mjs   Render ve temel akış kontrolleri
  logistics-evaluation.test.mjs  Gecikme, handoff, kaynak ve negatif testleri
examples/
  shipment-scenarios.json  Lojistik test senaryoları
  evaluate-logistics.mjs  Senaryo metriklerini hesaplar
.env.example              İsteğe bağlı AWS değişkenleri için örnek
```

## Kontrol komutları

```bash
npm run build
npm run lint
npm test
```

`npm test`, üretim derlemesinden sonra Node.js testlerini çalıştırır.
