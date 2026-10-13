"""FX Express chatbot analitikleri için yerel FastAPI servisi.

Çalıştırma (proje ana klasöründen):
    .venv/bin/python3 -m uvicorn analytics_backend.main:app --reload
"""

import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


DATABASE_PATH = Path(__file__).with_name("chatbot_analytics.db")

connection = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
connection.row_factory = sqlite3.Row
connection.execute(
    """
    CREATE TABLE IF NOT EXISTS chatbot_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event TEXT NOT NULL,
        topic TEXT,
        subtopic TEXT,
        step TEXT,
        reason TEXT,
        satisfaction_score INTEGER,
        created_at TEXT NOT NULL
    )
    """
)
connection.commit()


class ChatbotEvent(BaseModel):
    session_id: str
    event: str
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    step: Optional[str] = None
    reason: Optional[str] = None
    satisfaction_score: Optional[int] = Field(default=None, ge=1, le=5)


app = FastAPI(title="FX Express Chatbot Analytics", version="1.0.0")

# Yerel web demosunun bu API'ye erişebilmesi için.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "FX Express chatbot analytics API çalışıyor.",
        "documentation": "/docs",
    }


@app.post("/api/events")
def create_event(event: ChatbotEvent):
    """Chatbot içindeki tek bir kullanıcı hareketini kaydeder."""
    connection.execute(
        """
        INSERT INTO chatbot_events (
            session_id, event, topic, subtopic, step, reason,
            satisfaction_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event.session_id,
            event.event,
            event.topic,
            event.subtopic,
            event.step,
            event.reason,
            event.satisfaction_score,
            datetime.now().isoformat(),
        ),
    )
    connection.commit()
    return {"success": True}


@app.get("/api/reports/topics")
def topic_report():
    """Ana menü konularını en çok seçilenden aza doğru döndürür."""
    rows = connection.execute(
        """
        SELECT topic, COUNT(*) AS selection_count
        FROM chatbot_events
        WHERE event = 'topic_selected' AND topic IS NOT NULL
        GROUP BY topic
        ORDER BY selection_count DESC
        """
    ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/reports/dropoffs")
def dropoff_report():
    """Kullanıcıların sohbeti kapattığı veya zaman aşımına uğradığı adımları verir."""
    rows = connection.execute(
        """
        SELECT topic, step, COUNT(*) AS abandon_count
        FROM chatbot_events
        WHERE event IN ('session_ended', 'session_timeout')
        GROUP BY topic, step
        ORDER BY abandon_count DESC
        """
    ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/reports/satisfaction")
def satisfaction_report():
    """Konu bazında memnuniyet yüzdesini hesaplar."""
    rows = connection.execute(
        """
        SELECT
            topic,
            COUNT(*) AS response_count,
            ROUND(AVG(satisfaction_score) * 100, 2) AS satisfaction_percent
        FROM chatbot_events
        WHERE event = 'satisfaction_submitted'
          AND satisfaction_score IS NOT NULL
        GROUP BY topic
        ORDER BY satisfaction_percent DESC
        """
    ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/reports/durations")
def duration_report():
    """Tüm sohbetlerin ortalama süresini dakika olarak hesaplar."""
    row = connection.execute(
        """
        SELECT ROUND(AVG(duration_minutes), 2) AS average_minutes
        FROM (
            SELECT
                session_id,
                (JULIANDAY(MAX(created_at)) - JULIANDAY(MIN(created_at)))
                    * 24 * 60 AS duration_minutes
            FROM chatbot_events
            GROUP BY session_id
        )
        """
    ).fetchone()
    return dict(row)


@app.get("/api/reports/summary")
def summary_report(period: Literal["daily", "weekly"] = "daily"):
    """Bugün veya son 7 gün için yönetim paneli özetini döndürür.

    Ayrı ayrı session satırları döndürmek yerine toplamları ve
    ortalamaları hesaplar.
    """
    now = datetime.now()
    start = (
        now.replace(hour=0, minute=0, second=0, microsecond=0)
        if period == "daily"
        else now - timedelta(days=7)
    )
    start_text = start.isoformat()

    opened = connection.execute(
        """
        SELECT COUNT(DISTINCT session_id) AS count
        FROM chatbot_events
        WHERE event = 'session_started' AND created_at >= ?
        """,
        (start_text,),
    ).fetchone()["count"]

    handoff_requests = connection.execute(
        """
        SELECT COUNT(*) AS count
        FROM chatbot_events
        WHERE event = 'handoff_requested' AND created_at >= ?
        """,
        (start_text,),
    ).fetchone()["count"]

    # Yalnızca kapanış olayı bulunan görüşmeler süre ortalamasına girer.
    duration = connection.execute(
        """
        SELECT ROUND(AVG(duration_seconds), 1) AS average_seconds
        FROM (
            SELECT
                session_id,
                (JULIANDAY(MAX(created_at)) - JULIANDAY(MIN(created_at)))
                    * 86400 AS duration_seconds
            FROM chatbot_events
            WHERE created_at >= ?
            GROUP BY session_id
            HAVING SUM(CASE WHEN event = 'session_ended' THEN 1 ELSE 0 END) > 0
        )
        """,
        (start_text,),
    ).fetchone()["average_seconds"]

    closure_rows = connection.execute(
        """
        SELECT COALESCE(reason, 'unknown') AS reason, COUNT(*) AS count
        FROM chatbot_events
        WHERE event = 'session_ended' AND created_at >= ?
        GROUP BY reason
        ORDER BY count DESC
        """,
        (start_text,),
    ).fetchall()

    topic_rows = connection.execute(
        """
        SELECT topic, COUNT(*) AS count
        FROM chatbot_events
        WHERE event = 'topic_selected'
          AND topic IS NOT NULL
          AND created_at >= ?
        GROUP BY topic
        ORDER BY count DESC
        """,
        (start_text,),
    ).fetchall()

    dropoff_rows = connection.execute(
        """
        SELECT
            COALESCE(topic, 'Konu seçilmedi') AS topic,
            COALESCE(step, 'Bilinmiyor') AS step,
            COUNT(*) AS count
        FROM chatbot_events
        WHERE event = 'session_ended'
          AND reason IN ('user_closed', 'inactivity_timeout', 'error')
          AND created_at >= ?
        GROUP BY topic, step
        ORDER BY count DESC
        """,
        (start_text,),
    ).fetchall()

    satisfaction_rows = connection.execute(
        """
        SELECT topic, COUNT(*) AS response_count,
               ROUND(AVG(satisfaction_score), 2) AS average_score
        FROM chatbot_events
        WHERE event = 'satisfaction_submitted'
          AND satisfaction_score IS NOT NULL
          AND created_at >= ?
        GROUP BY topic
        ORDER BY response_count DESC
        """,
        (start_text,),
    ).fetchall()

    return {
        "period": period,
        "period_start": start_text,
        "opened_sessions": opened,
        "handoff_requests": handoff_requests,
        "average_session_seconds": duration or 0,
        "closures": [dict(row) for row in closure_rows],
        "topics": [dict(row) for row in topic_rows],
        "dropoffs": [dict(row) for row in dropoff_rows],
        "satisfaction": [dict(row) for row in satisfaction_rows],
    }
