// lib/telegram.js
// توابع کمکی برای ارتباط با Telegram Bot API با استفاده از fetch بومی
// (نیازی به کتابخانه سنگینی مثل Telegraf نیست، برای اجرای سرورلس سبک‌تر است)

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN تنظیم نشده است.");
  }
  return token;
}

async function callTelegramApi(method, payload) {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.ok === false) {
    console.error(`Telegram API error [${method}]:`, data);
  }

  return data;
}

/**
 * ارسال یک پیام متنی ساده
 */
async function sendMessage(chatId, text, options = {}) {
  // تلگرام محدودیت طول پیام ۴۰۹۶ کاراکتر دارد؛ پیام‌های طولانی را تکه‌تکه می‌کنیم
  const MAX_LEN = 4000;
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LEN) {
    chunks.push(text.slice(i, i + MAX_LEN));
  }
  if (chunks.length === 0) chunks.push(text);

  let lastResult = null;
  for (const chunk of chunks) {
    lastResult = await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: options.parse_mode || undefined,
      reply_markup: options.reply_markup || undefined,
    });
  }
  return lastResult;
}

/**
 * نمایش وضعیت "در حال تایپ..." برای طبیعی‌تر شدن گفتگو
 */
async function sendChatAction(chatId, action = "typing") {
  return callTelegramApi("sendChatAction", {
    chat_id: chatId,
    action,
  });
}

/**
 * ثبت وبهوک روی سرور تلگرام (برای اسکریپت تنظیم اولیه)
 */
async function setWebhook(url, secretToken) {
  return callTelegramApi("setWebhook", {
    url,
    secret_token: secretToken || undefined,
    drop_pending_updates: true,
  });
}

module.exports = {
  sendMessage,
  sendChatAction,
  setWebhook,
};
