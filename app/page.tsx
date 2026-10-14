"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Role = "assistant" | "user";
type Message = { id: string; role: Role; text: string; meta?: string; sources?: string[] };
type Step = "menu" | "tracking" | "originCity" | "originDistrict" | "destinationCity" | "destinationDistrict" | "parcel" | "services" | "pickup" | "faq" | "support" | "supportText" | "complete";
type TopicEvent = { session_id: string; event: string; topic?: string; subtopic?: string; step?: string; reason?: string; satisfaction_score?: number };

const LOCATIONS: Record<string, string[]> = {
  İstanbul: ["Ataşehir", "Bağcılar", "Bahçelievler", "Bakırköy", "Beşiktaş", "Kadıköy", "Şişli", "Üsküdar"],
  Ankara: ["Çankaya", "Etimesgut", "Keçiören", "Mamak", "Sincan", "Yenimahalle"],
  İzmir: ["Bayraklı", "Bornova", "Buca", "Karşıyaka", "Konak", "Torbalı"],
  Bursa: ["Gemlik", "İnegöl", "Nilüfer", "Osmangazi", "Yıldırım"],
  Antalya: ["Alanya", "Kepez", "Konyaaltı", "Manavgat", "Muratpaşa"],
  Adana: ["Çukurova", "Sarıçam", "Seyhan", "Yüreğir"],
  Kocaeli: ["Başiskele", "Gebze", "Gölcük", "İzmit", "Kartepe"],
  Konya: ["Karatay", "Meram", "Selçuklu"],
  Samsun: ["Atakum", "Bafra", "Canik", "İlkadım"],
  Trabzon: ["Akçaabat", "Ortahisar", "Sürmene", "Yomra"],
};

const REGION: Record<string, string> = {
  İstanbul: "Marmara", Bursa: "Marmara", Kocaeli: "Marmara", Ankara: "İç Anadolu", Konya: "İç Anadolu",
  İzmir: "Ege", Antalya: "Akdeniz", Adana: "Akdeniz", Samsun: "Karadeniz", Trabzon: "Karadeniz",
};

const SERVICE_INFO: Record<string, string> = {
  "Standart Teslimat": "Türkiye genelinde 1–3 iş günü hedefli ekonomik teslimat seçeneğidir. Gönderi hareketleri anlık takip edilir.",
  "Ertesi Gün Teslimat": "Uygun il ve ilçelerde, iş günü içinde kabul edilen gönderiler bir sonraki iş günü teslimat hedefiyle taşınır.",
  "Aynı Gün Şehir İçi": "İstanbul, Ankara ve İzmir'in seçili ilçelerinde saat 11.00'e kadar alınan gönderiler için aynı gün teslimat seçeneğidir.",
  "İade Gönderisi": "Anlaşmalı mağazanın iade koduyla şubeden veya adresten alım yoluyla iade gönderisi oluşturabilirsiniz.",
  "Paketleme Rehberi": "Ürün kutu içinde hareket etmemeli, boşluklar dolgu malzemesiyle desteklenmeli ve eski barkodlar kapatılmalıdır.",
  "Taşınması Yasak Ürünler": "Yanıcı, patlayıcı ve aşındırıcı maddeler; ruhsatsız silahlar, canlı hayvanlar ve mevzuata aykırı ürünler taşınmaz.",
};

const normalize = (value: string) => value
  .toLocaleLowerCase("tr-TR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

type Intent = "tracking" | "pricing" | "pickup" | "services" | "support" | "question";
const INTENT_LABEL: Record<Intent, string> = {
  tracking: "Kargom Nerede?", pricing: "Ücret Hesapla & Gönder", pickup: "Adresten Alım",
  services: "Ürün ve Hizmetler", support: "Destek Talebi", question: "Akıllı Soru-Cevap",
};
const INTENT_PHRASES: Record<Intent, string[]> = {
  tracking: ["kargom nerede", "kargo nerede", "paketim nerede", "gonderim nerede", "kargo takip", "kargoyu takip", "takip numarasi", "siparisim nerede", "kargom gelmedi", "gonderi durumu"],
  pricing: ["ucret hesapla", "ucretini hesapla", "fiyat hesapla", "fiyatini hesapla", "kargo hesapla", "kargo ucreti", "kargo fiyati", "kargo kac tl", "ucret ne kadar", "desi hesapla", "gonderi ucreti", "fiyat ogren"],
  pickup: ["adresten alim", "evden alim", "kurye gelsin", "kargoyu al", "paketimi al", "kurye cagir", "adresimden al"],
  services: ["urun ve hizmet", "hizmetler", "teslimat suresi", "ertesi gun", "iade", "paketleme", "yasakli urun", "yurt disi"],
  support: ["sikayet", "hasar", "kirik geldi", "kayip kargo", "kayboldu", "gecikti", "gec kaldi", "teslim edilmedi", "memnun degilim", "oneri", "destek talebi", "kurye davranisi"],
  question: [],
};

function detectIntent(text: string): Intent {
  const normalized = ` ${normalize(text)} `;
  const has = (phrases: string[]) => phrases.some((phrase) => normalized.includes(` ${normalize(phrase)} `));
  // Issue reports outrank tracking and services so complaints reach support.
  if (has(INTENT_PHRASES.support)) return "support";
  if (has(INTENT_PHRASES.tracking) || TRACKING_NUMBER_IN_TEXT_REGEX.test(text)) return "tracking";
  if (has(INTENT_PHRASES.pricing)) return "pricing";
  if (has(INTENT_PHRASES.pickup)) return "pickup";
  if (has(INTENT_PHRASES.services)) return "services";
  return "question";
}

function findOption(text: string, labels: string[]): string | undefined {
  const query = normalize(text);
  return labels.find((label) => normalize(label) === query)
    ?? labels.find((label) => query.includes(normalize(label)) || normalize(label).includes(query));
}

const time = () => new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const demoTicketNumber = () => Math.floor(100000 + Math.random() * 900000);
const ANALYTICS_URL = "http://127.0.0.1:8000/api/events";
const DIGITS_ONLY_REGEX = /^\d+$/;
const CONTAINS_DIGIT_REGEX = /\d/;
const TRACKING_NUMBER_REGEX = /^\d{10}(?:\d{2})?$/;
const TRACKING_NUMBER_IN_TEXT_REGEX = /(?:^|[^A-Za-z0-9])(\d{10}|\d{12})(?![A-Za-z0-9])/;

export default function Home() {
  const [step, setStep] = useState<Step>("menu");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome-1", role: "assistant", text: "Merhaba, ben FX Express Dijital Asistanı. Gönderi işlemleriniz ve sorularınız için buradayım." },
    { id: "welcome-2", role: "assistant", text: "Size nasıl yardımcı olabilirim?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [showRecoveryActions, setShowRecoveryActions] = useState(false);
  const [offerAgentTransfer, setOfferAgentTransfer] = useState(false);
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [originCity, setOriginCity] = useState("");
  const [originDistrict, setOriginDistrict] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationDistrict, setDestinationDistrict] = useState("");
  const [supportType, setSupportType] = useState("");
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "", weight: "" });
  const endRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(id());
  const activeTopic = useRef("Genel");
  const failedAttempts = useRef<Record<string, number>>({});

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, step, loading]);

  useEffect(() => {
    fetch(ANALYTICS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId.current, event: "session_started", step: "Ana menü" } satisfies TopicEvent) }).catch(() => undefined);
  }, []);

  const track = (event: string, topic?: string, subtopic?: string, nextStep?: string, reason?: string) => {
    const payload: TopicEvent = { session_id: sessionId.current, event, topic: topic ?? activeTopic.current, subtopic, step: nextStep, reason };
    fetch(ANALYTICS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
  };

  const add = (role: Role, text: string, sources?: string[]) => setMessages((current) => [...current, { id: id(), role, text, meta: time(), sources }]);
  const recordUnavailableAnswer = () => {
    const topic = activeTopic.current;
    const attempts = (failedAttempts.current[topic] ?? 0) + 1;
    failedAttempts.current[topic] = attempts;
    if (attempts >= 3) {
      setShowRecoveryActions(true);
      add("assistant", `“${topic}” konusunda üç denemede doğrulanmış bilgiye ulaşamadım. Ana menüye dönebilir veya görüşmeyi bitirebilirsiniz.`);
    }
  };
  const ask = (next: Step, userText: string, assistantText: string) => { add("user", userText); add("assistant", assistantText); track("step_viewed", undefined, undefined, next); setStep(next); };
  const backMenu = () => { setShowRecoveryActions(false); add("assistant", "Başka hangi konuda yardımcı olabilirim?"); setStep("menu"); };
  const closeSession = () => {
    if (sessionClosed) return;
    track("session_ended", activeTopic.current, undefined, step, "user_closed");
    setSessionClosed(true);
    add("assistant", "Görüşmeniz tamamlandı. Deneyiminizi puanlayarak hizmeti iyileştirmemize yardımcı olabilirsiniz.");
  };
  const submitRating = (score: number) => {
    fetch(ANALYTICS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId.current, event: "satisfaction_submitted", topic: activeTopic.current, step: "Görüşme sonu", satisfaction_score: score } satisfies TopicEvent), keepalive: true }).catch(() => undefined);
    setRatingSubmitted(true);
    add("assistant", "Geri bildiriminiz için teşekkür ederim.");
    if (score <= 3) {
      setOfferAgentTransfer(true);
      add("assistant", "Düşük puanınız için üzgünüm. İsterseniz canlı müşteri temsilcisine aktarım isteği oluşturabilirsiniz.");
    }
  };
  const requestAgentTransfer = () => {
    if (handoffRequested) return;
    track("handoff_requested", activeTopic.current, undefined, "Görüşme sonu", "low_csat");
    setHandoffRequested(true);
    add("assistant", "Aktarım isteğiniz demo ekranında kaydedildi. Bu portfolyo demosu canlı temsilci kuyruğuna bağlı değildir; gerçek ortamda bu adım çağrı merkezi/agent queue entegrasyonuna gönderilir.");
  };
  const newSession = () => {
    sessionId.current = id(); activeTopic.current = "Genel"; failedAttempts.current = {}; setSessionClosed(false); setRatingSubmitted(false); setShowRecoveryActions(false); setOfferAgentTransfer(false); setHandoffRequested(false); setStep("menu");
    setMessages([{ id: id(), role: "assistant", text: "Yeni görüşme başladı. Size nasıl yardımcı olabilirim?", meta: time() }]);
    track("session_started", "Genel", undefined, "Ana menü");
  };

  const inputEnabled = !loading && !sessionClosed;
  const placeholder = step === "tracking" ? "10 veya 12 rakamlı takip numaranızı yazın…"
    : step === "supportText" ? "Talebinizi yazın…"
    : step === "menu" || step === "complete" ? "Bir konu yazın ya da menüden seçin…"
    : "Mesajınızı yazın veya menüden bir seçenek belirleyin…";

  const options = useMemo(() => {
    if (step === "menu") return [
      ["📦", "Kargom Nerede?", "Takip numarasıyla sorgula"], ["₺", "Ücret Hesapla & Gönder", "Desi, kilo ve rotaya göre hesapla"],
      ["⌂", "Adresten Alım", "Kurye talebi oluştur"], ["◇", "Ürün ve Hizmetler", "Teslimat seçeneklerini incele"],
      ["✦", "Akıllı Soru-Cevap", "Bilgi bankasına sor"], ["!", "Destek Talebi", "Sorun veya öneri ilet"],
    ];
    if (step === "originCity" || step === "destinationCity") return Object.keys(LOCATIONS)
      .filter((city) => !input.trim() || normalize(city).includes(normalize(input)))
      .map((city) => ["⌖", city, REGION[city]]);
    if (step === "originDistrict") return (LOCATIONS[originCity] ?? [])
      .filter((district) => !input.trim() || normalize(district).includes(normalize(input)))
      .map((district) => ["·", district, originCity]);
    if (step === "destinationDistrict") return (LOCATIONS[destinationCity] ?? [])
      .filter((district) => !input.trim() || normalize(district).includes(normalize(input)))
      .map((district) => ["·", district, destinationCity]);
    if (step === "services") return Object.keys(SERVICE_INFO).map((service) => ["›", service, "Bilgi al"]);
    if (step === "pickup") return [["1", "Bugün 15.00–18.00", "Uygunluk kontrolü"], ["2", "Yarın 09.00–13.00", "Önerilen"], ["3", "Yarın 13.00–18.00", "Uygun"]];
    if (step === "support") return [["›", "Teslimat gecikmesi", "Operasyon"], ["›", "Kayıp / hasar", "İnceleme"], ["›", "Ücretlendirme", "Finans"], ["›", "Personel / kurye", "Geri bildirim"], ["›", "Görüş ve öneri", "Müşteri deneyimi"]];
    return [];
  }, [step, originCity, destinationCity, input]);

  const choose = (label: string, displayText = label) => {
    if (step === "menu") {
      activeTopic.current = label;
      track("topic_selected", label, displayText === label ? "menu" : "typed", label);
      setShowRecoveryActions(false);
      if (label === "Kargom Nerede?") ask("tracking", displayText, "Takip numaranızı yalnızca rakamlarla, 10 veya 12 haneli olarak yazın.");
      if (label === "Ücret Hesapla & Gönder") ask("originCity", displayText, "Gönderinin çıkacağı ili seçin.");
      if (label === "Adresten Alım") ask("pickup", displayText, "Kurye alımı için uygun zaman aralığını seçin.");
      if (label === "Ürün ve Hizmetler") ask("services", displayText, "Bilgi almak istediğiniz hizmeti seçin.");
      if (label === "Akıllı Soru-Cevap") ask("faq", displayText, "Sorunuzu doğal bir cümleyle yazın. Bilgi bankasında ilgili içerikleri arıyorum.");
      if (label === "Destek Talebi") ask("support", displayText, "Talebinizin konusunu seçin.");
      return;
    }
    if (step === "originCity") { setOriginCity(label); ask("originDistrict", displayText, `${label} için çıkış ilçesini seçin.`); return; }
    if (step === "originDistrict") { setOriginDistrict(label); ask("destinationCity", displayText, "Gönderinin ulaşacağı ili seçin."); return; }
    if (step === "destinationCity") { setDestinationCity(label); ask("destinationDistrict", displayText, `${label} için varış ilçesini seçin.`); return; }
    if (step === "destinationDistrict") { setDestinationDistrict(label); ask("parcel", displayText, "Son olarak kutunun ölçülerini santimetre, ağırlığını kilogram olarak girin."); return; }
    if (step === "services") { add("user", displayText); add("assistant", SERVICE_INFO[label] ?? "Bu hizmetle ilgili ayrıntı bulamadım. Başka bir hizmet seçebilir veya soru yazabilirsiniz."); setStep("complete"); return; }
    if (step === "pickup") { add("user", displayText); add("assistant", `${label} zaman aralığı için ön talebinizi oluşturdum. Gerçek uygulamada adres ve iletişim bilgileri doğrulandıktan sonra kurye talebi kesinleşir. Demo talep no: PK-${demoTicketNumber()}`); setStep("complete"); return; }
    if (step === "support") { setSupportType(label); ask("supportText", displayText, `${label} konusundaki talebinizi kısaca anlatın. Kişisel veya finansal bilgi paylaşmayın.`); }
  };

  const answerFromKnowledge = async (question: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await response.json();
      if (!data.sources?.length) {
        track("fallback_used", activeTopic.current, "no_retrieval_match", "faq");
        add("assistant", data.answer ?? "Yanıt üretilemedi. Lütfen yeniden deneyin.", data.sources);
        recordUnavailableAnswer();
      } else {
        failedAttempts.current[activeTopic.current] = 0;
        setShowRecoveryActions(false);
        add("assistant", data.answer ?? "Yanıt üretilemedi. Lütfen yeniden deneyin.", data.sources);
      }
    } catch {
      track("fallback_used", activeTopic.current, "knowledge_api_error", "faq", "error");
      add("assistant", "Bilgi bankasına şu anda erişemiyorum. İsterseniz aşağıdaki konu başlıklarından seçebilirsiniz.");
      recordUnavailableAnswer();
    } finally {
      setLoading(false);
      setStep("complete");
    }
  };

  const answerShipmentStatus = async (trackingNumber: string) => {
    setOfferAgentTransfer(false);
    setLoading(true);
    try {
      const response = await fetch(`/api/shipment?trackingNumber=${encodeURIComponent(trackingNumber)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        add("assistant", data.error ?? "Gönderi kaydına ulaşılamadı. Takip numarasını kontrol edin.");
        setStep("tracking");
        return;
      }
      const etaText = data.eta ? ` Tahmini teslimat: ${data.eta}.` : " Teslimat zamanı adres teyidinden sonra güncellenecek.";
      const exceptionText = data.exception ? ` İstisna: ${data.exception}` : "";
      add("assistant", `${data.status}. ${data.latestEvent}${etaText}${exceptionText}`, data.sources);
      if (data.handoffRecommended) {
        setOfferAgentTransfer(true);
        track("shipment_exception_detected", activeTopic.current, data.statusCode, "tracking", data.statusCode);
        add("assistant", "Bu istisnanın çözümü için isterseniz canlı temsilciye aktarım isteği oluşturabilirsiniz.");
      }
      setStep("complete");
    } catch {
      add("assistant", "Demo gönderi kayıtlarına şu anda erişemiyorum. Biraz sonra tekrar deneyin.");
      setStep("tracking");
    } finally {
      setLoading(false);
    }
  };

  const routeNaturalMessage = async (text: string) => {
    const intent = detectIntent(text);
    activeTopic.current = INTENT_LABEL[intent];
    track("intent_detected", intent, "typed", step);
    track("topic_selected", activeTopic.current, "typed", step);
    if (intent === "tracking") {
      add("user", text);
      const trackingNumber = text.match(TRACKING_NUMBER_IN_TEXT_REGEX)?.[1];
      if (trackingNumber) {
        failedAttempts.current[activeTopic.current] = 0;
        setShowRecoveryActions(false);
        await answerShipmentStatus(trackingNumber);
      } else {
        add("assistant", "Takip numarası yalnızca rakamlardan oluşmalı ve 10 ya da 12 hane olmalıdır. Lütfen numaranızı kontrol edip yeniden yazın.");
        setStep("tracking");
      }
      return;
    }
    if (intent === "pricing") {
      ask("originCity", text, "Ücret hesabı için önce çıkış ilini seçelim.");
      return;
    }
    if (intent === "pickup") {
      ask("pickup", text, "Adresten alım için uygun zaman aralığını seçin.");
      return;
    }
    if (intent === "support") {
      const normalized = normalize(text);
      const category = normalized.includes("hasar") || normalized.includes("kirik") ? "Kayıp / hasar"
        : normalized.includes("kayip") || normalized.includes("kaybol") ? "Kayıp / hasar"
        : normalized.includes("ucret") || normalized.includes("fiyat") ? "Ücretlendirme"
        : normalized.includes("kurye") || normalized.includes("personel") ? "Personel / kurye"
        : normalized.includes("oneri") ? "Görüş ve öneri" : "Teslimat gecikmesi";
      add("user", text);
      setSupportType(category);
      add("assistant", `${category} konusunu anladım. Talebinizi bir cümle daha açıklayın; demo kayıt numarası oluşturacağım.`);
      setStep("supportText");
      return;
    }
    if (intent === "services") {
      const query = normalize(text);
      const serviceAliases: Record<string, string[]> = {
        "Standart Teslimat": ["standart", "ekonomik"],
        "Ertesi Gün Teslimat": ["ertesi gun", "yarin teslim"],
        "Aynı Gün Şehir İçi": ["ayni gun", "bugun teslim"],
        "İade Gönderisi": ["iade", "geri gonder"],
        "Paketleme Rehberi": ["paketleme", "kutu", "ambalaj"],
        "Taşınması Yasak Ürünler": ["yasakli", "yasak urun", "gonderemem"],
      };
      const service = Object.entries(serviceAliases).find(([name, aliases]) =>
        query.includes(normalize(name)) || aliases.some((alias) => query.includes(normalize(alias)))
      )?.[0];
      if (service) {
        add("user", text); add("assistant", SERVICE_INFO[service]); setStep("complete");
      } else {
        ask("services", text, "Hangi hizmet hakkında bilgi istersiniz? Seçenekleri aşağıda listeledim.");
      }
      return;
    }
    add("user", text);
    setStep("faq");
    await answerFromKnowledge(text);
  };

  const calculate = (event: FormEvent) => {
    event.preventDefault();
    const length = Number(dimensions.length.replace(",", ".")), width = Number(dimensions.width.replace(",", ".")), height = Number(dimensions.height.replace(",", ".")), weight = Number(dimensions.weight.replace(",", "."));
    if ([length, width, height, weight].some((value) => !Number.isFinite(value) || value <= 0)) return;
    const desi = Math.max(1, Math.ceil((length * width * height) / 3000));
    const chargeable = Math.ceil(Math.max(desi, weight));
    const routeFactor = originCity === destinationCity ? 1 : REGION[originCity] === REGION[destinationCity] ? 1.18 : 1.38;
    const remoteDistricts = ["Alanya", "Manavgat", "Bafra", "Sürmene", "Torbalı", "İnegöl"];
    const remoteFee = remoteDistricts.includes(originDistrict) || remoteDistricts.includes(destinationDistrict) ? 24 : 0;
    const price = Math.round((64 + chargeable * 17) * routeFactor + remoteFee);
    add("user", `${length} × ${width} × ${height} cm · ${weight} kg`);
    add("assistant", `${originCity}/${originDistrict} → ${destinationCity}/${destinationDistrict} rotası için tahmini Standart teslimat ücreti ${price} TL'dir. Hacimsel ağırlık ${desi} desi, gerçek ağırlık ${weight} kg; ücrete esas ağırlık ${chargeable} kg/desi olarak hesaplandı. Tutar KDV dahil demo fiyatıdır ve şubede yapılacak ölçümle değişebilir.`);
    setStep("complete");
  };

  const updateDimension = (field: keyof typeof dimensions, value: string) => {
    // Keep digits and one decimal separator only, including when the user pastes text.
    const numeric = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
    const separator = numeric.indexOf(".");
    const sanitized = separator < 0
      ? numeric
      : `${numeric.slice(0, separator + 1)}${numeric.slice(separator + 1).replace(/\./g, "")}`;
    setDimensions((current) => ({ ...current, [field]: sanitized }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); const value = input.trim(); if (!value || loading) return;
    setInput("");
    if (step === "tracking") {
      if (!TRACKING_NUMBER_REGEX.test(value)) {
        const detectedIntent = detectIntent(value);
        const isAnotherTopic = detectedIntent !== "question" && detectedIntent !== "tracking";
        const isTrackingQuestionWithoutANumber = detectedIntent === "tracking" && !CONTAINS_DIGIT_REGEX.test(value);
        if (isAnotherTopic || isTrackingQuestionWithoutANumber) { await routeNaturalMessage(value); return; }
        add("user", value);
        const validationMessage = DIGITS_ONLY_REGEX.test(value)
          ? "Takip numarası 10 ya da 12 rakam olmalıdır. Lütfen numaranızı kontrol edip yeniden yazın."
          : "Takip numarası yalnızca rakamlardan oluşmalıdır. Harf, boşluk veya sembol kullanmadan yeniden deneyin.";
        add("assistant", validationMessage);
        recordUnavailableAnswer();
        return;
      }
      add("user", value);
      failedAttempts.current[activeTopic.current] = 0;
      setShowRecoveryActions(false);
      await answerShipmentStatus(value); return;
    }
    if (step === "supportText") { add("user", value); add("assistant", `${supportType} bildiriminiz demo ortamında alındı. Örnek kayıt numarası: PKD-${demoTicketNumber()}. Canlı ortamda kayıt, müşteri ve operasyon sistemlerine entegre edilmelidir.`); setStep("complete"); return; }

    if (["originCity", "originDistrict", "destinationCity", "destinationDistrict", "services", "pickup", "support"].includes(step)) {
      const labels = options.map(([, label]) => label);
      if (["originCity", "originDistrict", "destinationCity", "destinationDistrict"].includes(step)) {
        const exactMatch = labels.find((label) => normalize(label) === normalize(value));
        if (exactMatch) { choose(exactMatch, value); return; }
        const placeType = step.endsWith("City") ? "il" : "ilçe";
        add("user", value);
        add("assistant", `“${value}” listede bulunamadı. ${placeType} adını doğru yazıp yeniden deneyin veya aşağıdaki listeden seçin.`);
        return;
      }
      const match = findOption(value, labels);
      if (match) { choose(match, value); return; }
      if (step === "services" || step === "support") { await routeNaturalMessage(value); return; }
      add("assistant", "Bu adım için lütfen seçeneklerden birini seçin veya il/ilçe adını listede göründüğü şekilde yazın.");
      return;
    }

    await routeNaturalMessage(value);
  };

  return <main className="assistantPage">
    <section className="chatShell" aria-label="FX Express Dijital Asistan">
      <header className="chatHeader"><div className="brandMark"><span>FX</span></div><div className="brandCopy"><strong>FX Express</strong><span><i /> Dijital Asistan · Çevrimiçi</span></div><div className="aiBadge"><b>AI</b><span>AWS RAG opsiyonel<br/>yerel arama aktif</span></div></header>
      <div className="messages"><div className="dateChip">BUGÜN</div>
        {messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.role === "assistant" && <div className="botAvatar">FX</div>}<div className="bubbleWrap"><div className="bubble">{message.text}</div>{message.sources && message.sources.length > 0 && <div className="sources"><b>Kaynaklar</b>{message.sources.map((source) => <span key={source}>↗ {source}</span>)}</div>}<small>{message.meta}</small></div></div>)}
        {loading && <div className="message assistant"><div className="botAvatar">FX</div><div className="typing"><span/><span/><span/></div></div>}
        {options.length > 0 && <div className={`optionGrid ${step === "menu" ? "mainOptions" : ""} ${["originCity", "originDistrict", "destinationCity", "destinationDistrict"].includes(step) ? "locationList" : ""}`}>{options.map(([icon, label, hint]) => <button key={label} onClick={() => choose(label)}><span className="optionIcon">{icon}</span><span><b>{label}</b><small>{hint}</small></span><em>›</em></button>)}</div>}
        {options.length === 0 && ["originCity", "originDistrict", "destinationCity", "destinationDistrict"].includes(step) && <p className="emptyLocationList">Eşleşen il veya ilçe bulunamadı. Adı kontrol edip tekrar yazın.</p>}
        {step === "parcel" && <form className="parcelForm" onSubmit={calculate}><div className="routeSummary"><span>{originCity}<small>{originDistrict}</small></span><b>→</b><span>{destinationCity}<small>{destinationDistrict}</small></span></div><div className="fieldGrid">
          <label>Uzunluk <span><input inputMode="decimal" value={dimensions.length} onChange={(e) => updateDimension("length", e.target.value)} placeholder="30"/> cm</span></label>
          <label>Genişlik <span><input inputMode="decimal" value={dimensions.width} onChange={(e) => updateDimension("width", e.target.value)} placeholder="20"/> cm</span></label>
          <label>Yükseklik <span><input inputMode="decimal" value={dimensions.height} onChange={(e) => updateDimension("height", e.target.value)} placeholder="15"/> cm</span></label>
          <label>Ağırlık <span><input inputMode="decimal" value={dimensions.weight} onChange={(e) => updateDimension("weight", e.target.value)} placeholder="2.5"/> kg</span></label>
        </div><p>Desi = Uzunluk × Genişlik × Yükseklik / 3000</p><button type="submit">Yaklaşık fiyatı hesapla <span>→</span></button></form>}
        {step === "complete" && !sessionClosed && <div className="completionActions">{showRecoveryActions ? <><button onClick={backMenu}>Ana menüye dön</button><button onClick={closeSession}>Görüşmeyi bitir</button></> : <><button onClick={backMenu}>Ana menüye dön</button><button onClick={() => { setStep("faq"); add("assistant", "Başka bir sorunuz varsa yazabilirsiniz."); }}>Başka bir soru sor</button><button onClick={closeSession}>Görüşmeyi bitir</button></>}</div>}
        {offerAgentTransfer && !sessionClosed && !handoffRequested && <div className="completionActions"><button onClick={requestAgentTransfer}>Canlı temsilciye aktarım iste</button></div>}
        {sessionClosed && <div className="feedbackCard"><b>Görüşme deneyiminiz nasıldı?</b>{ratingSubmitted ? <span>Teşekkürler, değerlendirmeniz kaydedildi.</span> : <div>{[1, 2, 3, 4, 5].map((score) => <button key={score} onClick={() => submitRating(score)} aria-label={`${score} puan`}>{score}</button>)}</div>}{offerAgentTransfer && !handoffRequested && <button type="button" onClick={requestAgentTransfer} style={{ alignSelf:"flex-start", padding:"8px 10px", border:0, borderRadius:7, background:"#2866e8", color:"#fff", fontSize:8, fontWeight:700, cursor:"pointer" }}>Canlı temsilciye aktarım iste</button>}{handoffRequested && <span>Demo aktarım isteği kaydedildi; canlı kuyruk bağlı değildir.</span>}<button className="newSessionButton" onClick={newSession}>Yeni sohbet başlat</button></div>}
        {!(["menu", "complete", "faq", "tracking", "supportText", "parcel"] as Step[]).includes(step) && <button className="backButton" onClick={backMenu}>← Ana menü</button>}<div ref={endRef}/>
        {showRecoveryActions && step !== "complete" && !sessionClosed && <div className="completionActions"><button onClick={closeSession}>Görüşmeyi bitir</button></div>}
      </div>
      <form className="composer" onSubmit={submit}>{["faq", "tracking", "supportText", "parcel"].includes(step) && <button type="button" onClick={backMenu} style={{ display:"block", margin:"0 0 7px", padding:0, border:0, background:"transparent", color:"#315c9c", fontSize:8, fontWeight:700, cursor:"pointer" }}>← Ana menüye dön</button>}<div className="semanticPill"><span>✦</span> Bilgi bankasında arama</div><div className="inputRow"><input value={input} onChange={(e) => setInput(e.target.value)} disabled={!inputEnabled || loading} placeholder={inputEnabled ? placeholder : "Yukarıdaki seçeneklerden ilerleyin"}/><button disabled={!inputEnabled || !input.trim() || loading} aria-label="Gönder">↑</button></div><p>Yanıtlar demo bilgi bankasından üretilir. Kritik işlemler için müşteri hizmetlerine danışın.</p></form>
    </section>
    <div className="architectureNote"><span>DEMO MİMARİSİ</span><b>Intent eşleme</b><i>→</i><b>Bilgi bankası</b><i>→</i><b>AWS Bedrock (opsiyonel)</b></div>
  </main>;
}
