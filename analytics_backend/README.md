# Yerel analitik API

Bu küçük FastAPI servisi chatbot olaylarını SQLite'a kaydeder ve dashboard'un günlük/haftalık toplamlarını sunar.

Proje kök dizininde ikinci bir Terminal açın:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r analytics_backend/requirements.txt
python -m uvicorn analytics_backend.main:app --reload
```

API: `http://127.0.0.1:8000`  
Swagger deneme ekranı: `http://127.0.0.1:8000/docs`  
Chatbot ve panel için ayrı Terminal'de `npm run dev` çalıştırın.

Olaylar `analytics_backend/chatbot_analytics.db` içine kaydedilir; veritabanı Git'e eklenmez. Bu demo için kişisel veya hassas müşteri verisi göndermeyin.
