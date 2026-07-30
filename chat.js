// lib/chat.js
// منطق تولید پاسخ برای گفتگوی معمولی و روزمره
// اگر GEMINI_API_KEY تنظیم شده باشد از Google Gemini (رایگان) برای پاسخ‌های هوشمند استفاده می‌شود
// در غیر این صورت از یک موتور ساده‌ی قانون-محور (rule-based) فارسی استفاده می‌شود

const SYSTEM_PROMPT = `تو یک دوست صمیمی و گرم فارسی‌زبان هستی که در تلگرام با کاربر گفتگوی روزمره و معمولی می‌کنی.
لحن تو دوستانه، کوتاه و طبیعی است؛ مثل یک چت واقعی با یک دوست، نه یک دستیار رسمی.
پاسخ‌ها را کوتاه نگه دار (معمولاً ۱ تا ۳ جمله)، مگر اینکه کاربر توضیح بیشتری بخواهد.
از ایموجی به‌اندازه و نه زیاد استفاده کن. همیشه به فارسی پاسخ بده مگر کاربر به زبان دیگری بنویسد.`;

// حافظه‌ی خیلی ساده و موقت در حافظه‌ی پردازش (برای هر اجرای serverless ریست می‌شود)
// برای حافظه‌ی واقعی و پایدار بین چت‌ها، از یک دیتابیس مثل Upstash Redis یا Vercel KV استفاده کنید
const conversationCache = new Map();
const MAX_HISTORY = 6; // تعداد پیام‌های اخیر که برای زمینه نگه داشته می‌شود

function getHistory(chatId) {
  return conversationCache.get(chatId) || [];
}

function pushHistory(chatId, role, content) {
  const history = getHistory(chatId);
  history.push({ role, content });
  while (history.length > MAX_HISTORY) history.shift();
  conversationCache.set(chatId, history);
}

/**
 * پاسخ‌های ساده و از پیش تعریف‌شده برای زمانی که هیچ کلید API تنظیم نشده باشد
 */
function ruleBasedReply(text) {
  const t = (text || "").trim();

  const greetings = ["سلام", "درود", "hi", "hello", "سلاام"];
  const howAreYou = ["خوبی", "چطوری", "حالت چطوره", "چه خبر"];
  const thanks = ["ممنون", "مرسی", "متشکرم", "تشکر"];
  const bye = ["خداحافظ", "بای", "فعلا", "می‌رم", "میرم"];

  const has = (list) => list.some((w) => t.includes(w));

  if (has(greetings)) return "سلام! 😊 خوش اومدی، چه خبرا؟";
  if (has(howAreYou)) return "من که خوبم، ممنون که پرسیدی! تو چطوری؟ امروز چه خبر؟";
  if (has(thanks)) return "خواهش می‌کنم، همیشه در خدمتم 🌿";
  if (has(bye)) return "خداحافظ! هر وقت خواستی گپ بزنیم، من اینجام 👋";
  if (t.includes("خسته")) return "اوه، به نظر یه روز پرکار داشتی. یه استراحت کوچیک بهت حال میده، نه؟";
  if (t.includes("هوا") || t.includes("بارون") || t.includes("آفتاب")) {
    return "هوا هم روی حال آدم خیلی تاثیر داره. امروز هوای شما چطوره؟";
  }

  return "جالبه! بیشتر برام تعریف کن 🙂";
}

/**
 * فراخوانی Google Gemini API (رایگان) برای تولید پاسخ هوشمندتر و طبیعی‌تر
 * برای گرفتن کلید رایگان: aistudio.google.com -> Get API Key
 */
async function generateWithGemini(chatId, userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const history = getHistory(chatId);

  // تبدیل تاریخچه به فرمت مورد نیاز Gemini
  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userText }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Gemini API error:", res.status, errText);
    throw new Error("خطا در ارتباط با Gemini API");
  }

  const data = await res.json();
  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    "ببخشید، نتونستم پاسخ بدم.";

  pushHistory(chatId, "user", userText);
  pushHistory(chatId, "assistant", reply);

  return reply;
}

/**
 * تابع اصلی: تولید پاسخ برای پیام کاربر
 */
async function generateReply(chatId, userText) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithGemini(chatId, userText);
    } catch (err) {
      console.error("برگشت به پاسخ قانون‌محور به دلیل خطا:", err.message);
      return ruleBasedReply(userText);
    }
  }
  return ruleBasedReply(userText);
}

module.exports = {
  generateReply,
};

/*
==========================================================================
نمونه‌ی اتصال به Upstash Redis برای حافظه‌ی پایدار بین درخواست‌های سرورلس
(اختیاری - در صورت نیاز از این کد الگو بگیرید و جایگزین Map بالا کنید)
==========================================================================

const { Redis } = require("@upstash/redis");
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getHistory(chatId) {
  const data = await redis.get(`history:${chatId}`);
  return data || [];
}

async function pushHistory(chatId, role, content) {
  const history = await getHistory(chatId);
  history.push({ role, content });
  while (history.length > MAX_HISTORY) history.shift();
  await redis.set(`history:${chatId}`, history, { ex: 60 * 60 * 24 }); // انقضا بعد از ۲۴ ساعت
}
*/
