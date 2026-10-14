export const SHIPMENTS = {
  "1000000001": {
    trackingNumber: "1000000001",
    status: "Aktarma merkezinde",
    statusCode: "IN_TRANSIT",
    eta: "2026-10-16",
    delay: false,
    exception: null,
    latestEvent: "Gönderi İstanbul transfer merkezinden Ankara yönüne sevk edildi.",
    sources: ["FX Express Demo Operasyon Akışı · 14 Ekim 2026 08.42"],
  },
  "1000000002": {
    trackingNumber: "1000000002",
    status: "Gecikme incelemesinde",
    statusCode: "DELAY_WEATHER",
    eta: "2026-10-17",
    delay: true,
    exception: "Yoğun hava koşulları nedeniyle aktarma hattında gecikme tespit edildi.",
    latestEvent: "Operasyon ekibi yeni teslimat tahminini doğruluyor.",
    sources: ["FX Express Demo Operasyon Akışı · 14 Ekim 2026 09.15", "Demo İstisna Kaydı · WX-204"],
  },
  "1000000003": {
    trackingNumber: "1000000003",
    status: "Adres bilgisi gerekli",
    statusCode: "EXCEPTION_ADDRESS",
    eta: null,
    delay: true,
    exception: "Teslimat adresinde eksik bilgi bulundu; dağıtım duraklatıldı.",
    latestEvent: "Adres teyidi için destek ekibine başvurmanız gerekiyor.",
    sources: ["FX Express Demo Operasyon Akışı · 14 Ekim 2026 10.05", "Demo İstisna Kaydı · ADR-118"],
  },
};

export function lookupShipment(value) {
  const trackingNumber = String(value ?? "").trim();
  if (!/^\d{10}(?:\d{2})?$/.test(trackingNumber)) {
    return { found: false, code: "INVALID_TRACKING_NUMBER", handoffRecommended: false };
  }
  const shipment = SHIPMENTS[trackingNumber];
  if (!shipment) return { found: false, code: "NOT_FOUND", handoffRecommended: false };
  return { found: true, ...shipment, handoffRecommended: shipment.delay };
}
