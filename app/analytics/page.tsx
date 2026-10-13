"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./analytics.css";

type CountItem = { reason?: string; topic?: string; step?: string; count: number };
type Summary = {
  period: "daily" | "weekly";
  period_start: string;
  opened_sessions: number;
  handoff_requests: number;
  average_session_seconds: number;
  closures: CountItem[];
  topics: CountItem[];
  dropoffs: CountItem[];
  satisfaction: Array<{ topic?: string; response_count: number; average_score: number }>;
};

const API_URL = "http://127.0.0.1:8000/api/reports/summary";
const reasonLabels: Record<string, string> = {
  user_closed: "Kullanıcı kapattı",
  inactivity_timeout: "Süre aşımı",
  error: "Hata nedeniyle",
  completed: "Başarıyla tamamlandı",
  unknown: "Bilinmiyor",
};

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes} dk ${remaining} sn`;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}?period=${period}`)
      .then((response) => {
        if (!response.ok) throw new Error("Rapor alınamadı");
        return response.json();
      })
      .then((report) => { setData(report); setError(""); })
      .catch(() => setError("Analitik API'ye ulaşılamıyor. 8000 portundaki Python servisini kontrol edin."));
  }, [period]);

  return <main className="analyticsPage">
    <header className="analyticsHeader">
      <div><span>FX EXPRESS · DİJİTAL ASİSTAN</span><h1>Analitik Özeti</h1><p>Görüşme davranışı, konu dağılımı ve müşteri geri bildirimi</p></div>
      <Link href="/">← Chatbota dön</Link>
    </header>
    <div className="periodTabs"><button className={period === "daily" ? "active" : ""} onClick={() => setPeriod("daily")}>Bugün</button><button className={period === "weekly" ? "active" : ""} onClick={() => setPeriod("weekly")}>Son 7 Gün</button></div>
    {error && <div className="analyticsError">{error}</div>}
    {data && <>
      <section className="metricGrid">
        <article><small>Açılan chatbot</small><strong>{data.opened_sessions}</strong><span>{period === "daily" ? "bugün" : "son 7 günde"}</span></article>
        <article><small>Ortalama session süresi</small><strong>{duration(data.average_session_seconds)}</strong><span>kapanan görüşmeler</span></article>
        <article><small>Toplam kapanış</small><strong>{data.closures.reduce((sum, item) => sum + item.count, 0)}</strong><span>tüm nedenler</span></article>
        <article><small>Temsilci aktarım isteği</small><strong>{data.handoff_requests}</strong><span>düşük memnuniyet sonrası</span></article>
      </section>
      <section className="reportGrid">
        <article className="reportCard"><h2>Kapanma nedenleri</h2><table><thead><tr><th>Neden</th><th>Adet</th></tr></thead><tbody>{data.closures.map((item) => <tr key={item.reason}><td>{reasonLabels[item.reason || "unknown"] || item.reason}</td><td>{item.count}</td></tr>)}{data.closures.length === 0 && <tr><td colSpan={2}>Henüz veri yok</td></tr>}</tbody></table></article>
        <article className="reportCard"><h2>En çok açılan konular</h2><table><thead><tr><th>Konu</th><th>Seçim</th></tr></thead><tbody>{data.topics.map((item) => <tr key={item.topic}><td>{item.topic}</td><td>{item.count}</td></tr>)}{data.topics.length === 0 && <tr><td colSpan={2}>Henüz veri yok</td></tr>}</tbody></table></article>
        <article className="reportCard wide"><h2>Kullanıcıların en çok ayrıldığı adımlar</h2><table><thead><tr><th>Konu</th><th>Son adım</th><th>Adet</th></tr></thead><tbody>{data.dropoffs.map((item, index) => <tr key={`${item.topic}-${item.step}-${index}`}><td>{item.topic}</td><td>{item.step}</td><td>{item.count}</td></tr>)}{data.dropoffs.length === 0 && <tr><td colSpan={3}>Henüz veri yok</td></tr>}</tbody></table></article>
        <article className="reportCard wide"><h2>Konuya göre sohbet sonu memnuniyeti</h2><table><thead><tr><th>Konu</th><th>Ortalama puan / 5</th><th>Yanıt</th></tr></thead><tbody>{data.satisfaction.map((item) => <tr key={item.topic}><td>{item.topic}</td><td>{item.average_score.toFixed(2)}</td><td>{item.response_count}</td></tr>)}{data.satisfaction.length === 0 && <tr><td colSpan={3}>Henüz değerlendirme yok</td></tr>}</tbody></table></article>
      </section>
    </>}
  </main>;
}
