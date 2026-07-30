// lib/chat.js
// منطق تولید پاسخ برای گفتگوی معمولی و روزمره
// اگر ANTHROPIC_API_KEY تنظیم شده باشد از مدل Claude برای پاسخ‌های هوشمند استفاده می‌شود
// در غیر این صورت از یک موتور ساده‌ی قانون-محور (rule-based) فارسی استفاده می‌شود

const SYSTEM_PROMPT = `تو یک دوست صمیمی و گرم فارسی‌زبان هستی که در تلگرام با کاربر گفتگوی روزمره و معمولی می‌کنی.
لحن تو دوستانه، کوتاه و طبیعی است؛ مثل یک چت واقعی با یک دوست، نه یک دستیار رسمی.
پاسخ‌ها را کوتاه نگه دار (معمولاً ۱ تا ۳ جمله)، مگر اینکه کاربر توضیح بیشتری بخواهد.
از ایموجی به‌اندازه و نه زیاد استفاده کن. همیشه به فارسی پاسخ بده مگر کاربر به زبان دیگری بنویسد.`;

// حافظه‌ی خیلی ساده و موقت در حافظه‌ی پردازش (برای هر اجرای serverless ریست می‌شود)
// برای حافظه‌ی واقعی و پایدار بین چت‌ها، از یک دیتابیس مثل Upstash Redis یا Vercel KV استفاده کنید
// (پایین همین فایل یک نمونه‌ی آماده برای اتصال به Upstash کامنت شده وجود دارد)
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
 * پاسخ‌های ساده و از پیش تعریف‌شده برای زمانی که کلید API تنظیم نشده باشد
 */
function ruleBasedReply(text) {
  const t = (text || "").trim();

  const greetings = ["سلام", "درود", "hi", "hello", "سلاام"];
  const howAreYou = ["خوبی", "چطوری", "حالت چطوره", "چه خبر"];
  const thanks = ["ممنون", "مرسی", "متشکرم", "تشکر"];
  const bye = ["خداحافظ", "بای", "فعلا", "می‌رم", "میرم"];

  const has = (list) => list.some((w) => t.includes(w));

  if (has(greetings)) {
    return "سلام! 😊 خوش اومدی، چه خبرا؟";
  }
  if (has(howAreYou)) {
    return "من که خوبم، ممنون که پرسیدی! تو چطوری؟ امروز چه خبر؟";
  }
  if (has(thanks)) {
    return "خواهش می‌کنم، همیشه در خدمتم 🌿";
  }
  if (has(bye)) {
    return "خداحافظ! هر وقت خواستی گپ بزنیم، من اینجام 👋";
  }
  if (t.includes("خسته")) {
    return "اوه، به نظر یه روز پرکار داشتی. یه استراحت کوچیک بهت حال میده، نه؟";
  }
  if (t.includes("هوا") || t.includes("بارون") || t.includes("آفتاب")) {
    return "هوا هم روی حال آدم خیلی تاثیر داره. امروز هوای شما چطوره؟";
  }

  return "جالبه! بیشتر برام تعریف کن 🙂";
}

/**
 * فراخوانی Claude API برای تولید پاسخ هوشمندتر و طبیعی‌تر
 */
async function generateWithClaude(chatId, userText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const history = getHistory(chatId);
  const messages = [...history, { role: "user", content: userText }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Anthropic API error:", res.status, errText);
    throw new Error("خطا در ارتباط با Claude API");
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const reply = textBlock ? textBlock.text.trim() : "ببخشید، نتونستم پاسخ بدم.";

  pushHistory(chatId, "user", userText);
  pushHistory(chatId, "assistant", reply);

  return reply;
}

/**
 * تابع اصلی: تولید پاسخ برای پیام کاربر
 */
async function generateReply(chatId, userText) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await generateWithClaude(chatId, userText);
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
