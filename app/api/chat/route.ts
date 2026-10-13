import { NextRequest, NextResponse } from "next/server";

const KNOWLEDGE = [
  { title: "Teslimat süreleri", text: "Standart gönderiler aynı şehirde genellikle 1 iş günü, yakın bölgelerde 1-2 iş günü, uzak bölgelerde 2-3 iş günü içinde teslim edilir. Süreler taahhüt değil hedeftir." },
  { title: "Desi ve ağırlık", text: "Desi, santimetre cinsinden uzunluk, genişlik ve yüksekliğin çarpımının 3000'e bölünmesiyle hesaplanır. Ücretlendirmede desi ile gerçek ağırlıktan büyük olan değer kullanılır." },
  { title: "Hasarlı gönderi", text: "Hasarlı teslimatta dış ambalajı ve ürünü fotoğraflayın, mümkünse kurye yanında hasar tutanağı hazırlatın ve destek talebi oluşturun. Ambalajı inceleme tamamlanana kadar saklayın." },
  { title: "Kayıp gönderi", text: "Takip hareketi 3 iş günü boyunca değişmeyen gönderiler için kayıp araştırma talebi açılabilir. Takip numarası ve gönderici bilgileri gereklidir." },
  { title: "Adresten alım", text: "Adresten alım talepleri uygun zaman aralığı seçilerek oluşturulur. Kurye gelmeden önce paket kapalı, sağlam ve barkod yapıştırmaya uygun olmalıdır." },
  { title: "Yasaklı ürünler", text: "Yanıcı, patlayıcı, aşındırıcı ve basınçlı maddeler; ruhsatsız silahlar, canlı hayvanlar, nakit para ve mevzuata aykırı ürünler taşınmaz." },
  { title: "İade gönderisi", text: "Anlaşmalı mağazanın verdiği iade kodu kullanılarak şubeden veya adresten alım ile iade yapılabilir. Kodun geçerlilik süresi mağazaya göre değişir." },
  { title: "Paketleme", text: "Kutu ürün boyutuna uygun olmalı, iç boşluklar dolgu malzemesiyle kapatılmalı, kırılabilir ürünler ayrı sarılmalı ve eski barkodlar kapatılmalıdır." },
];
const SYNONYMS: Record<string, string[]> = { hasar:["kırık","ezik","bozuk","zarar"], kayıp:["bulunamadı","yok","ulaşmadı"], teslimat:["teslim","ne zaman","süre","kaç gün"], desi:["hacim","ölçü","boyut"], yasaklı:["gönderemem","taşınmaz","yasak"], iade:["geri gönder","değişim"], paketleme:["kutu","ambalaj","paket"], alım:["kurye","adresimden","evden"] };

function localKnowledgeSearch(question: string) {
  const normalized = question.toLocaleLowerCase("tr-TR"); const expanded = new Set(normalized.split(/[^a-zçğıöşü0-9]+/).filter(Boolean));
  for (const [key, values] of Object.entries(SYNONYMS)) if (values.some((value) => normalized.includes(value)) || normalized.includes(key)) { expanded.add(key); values.forEach((value) => expanded.add(value)); }
  const ranked = KNOWLEDGE.map((article) => { const haystack = `${article.title} ${article.text}`.toLocaleLowerCase("tr-TR"); const score = [...expanded].reduce((total, token) => total + (token.length > 2 && haystack.includes(token) ? 1 : 0), 0); return { ...article, score }; }).sort((a,b) => b.score-a.score);
  const bestScore = ranked[0]?.score ?? 0;
  const selected = ranked.filter((item) => item.score > 0 && item.score >= Math.max(1, bestScore * 0.7)).slice(0,2);
  if (!selected.length) return { answer:"Bu soruya doğrulanmış bilgi bankamda yeterli bir yanıt bulamadım. Yanlış yönlendirmemek için destek talebi oluşturmanızı öneririm.", sources:[] };
  return { answer:selected.map((item) => item.text).join(" "), sources:selected.map((item) => `FX Express Bilgi Bankası · ${item.title}`) };
}

export async function POST(request: NextRequest) {
  let question: unknown;
  try { question = (await request.json()).question; }
  catch { return NextResponse.json({ error:"İstek gövdesi geçerli JSON olmalıdır." }, { status:400 }); }
  if (!question || typeof question !== "string" || question.trim().length > 1200) return NextResponse.json({ error:"1.200 karakteri aşmayan bir soru gerekli." }, { status:400 });
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID; const modelArn = process.env.BEDROCK_MODEL_ARN;
  if (knowledgeBaseId && modelArn && process.env.AWS_REGION) {
    try {
      const { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } = await import("@aws-sdk/client-bedrock-agent-runtime");
      const client = new BedrockAgentRuntimeClient({ region:process.env.AWS_REGION });
      const result = await client.send(new RetrieveAndGenerateCommand({ input:{ text:question }, retrieveAndGenerateConfiguration:{ type:"KNOWLEDGE_BASE", knowledgeBaseConfiguration:{ knowledgeBaseId, modelArn } } }));
      return NextResponse.json({ answer:result.output?.text ?? "Yanıt üretilemedi.", sources:result.citations?.flatMap((citation) => citation.retrievedReferences?.map((reference) => reference.location?.s3Location?.uri ?? "AWS Knowledge Base") ?? []).slice(0,3), mode:"aws-bedrock-rag" });
    } catch (error) { console.error("Bedrock RAG fallback:", error); }
  }
  return NextResponse.json({ ...localKnowledgeSearch(question.trim()), mode:"local-retrieval-demo" });
}
