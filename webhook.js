// api/webhook.js
// Entry point سرورلس (Vercel). تلگرام هر آپدیت جدید را با POST به این آدرس ارسال می‌کند.
// آدرس نهایی بعد از دیپلوی چیزی شبیه این خواهد بود:
// https://your-project.vercel.app/api/webhook

const { sendMessage, sendChatAction } = require("../lib/telegram");
const { generateReply } = require("../lib/chat");

module.exports = async function handler(req, res) {
  // فقط درخواست POST از سمت تلگرام پذیرفته می‌شود
  if (req.method !== "POST") {
    res.status(200).json({ ok: true, info: "webhook is alive" });
    return;
  }

  // اعتبارسنجی اختیاری با secret token (اگر هنگام setWebhook تنظیم کرده باشید)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (incomingSecret !== expectedSecret) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }

  try {
    const update = req.body;
    const message = update && update.message;

    // فقط پیام‌های متنی معمولی را پردازش می‌کنیم
    if (message && message.text) {
      const chatId = message.chat.id;
      const text = message.text.trim();

      if (text === "/start") {
        await sendMessage(
          chatId,
          "سلام! 👋 من اینجام تا باهات گپ بزنم و درباره‌ی روزمرگی‌ حرف بزنیم. هر چی دلت خواست بنویس!"
        );
      } else if (text === "/help") {
        await sendMessage(
          chatId,
          "فقط پیام بنویس و باهام گفتگو کن، من هم جواب می‌دم. دستورها:\n/start - شروع دوباره\n/help - راهنما"
        );
      } else {
        // نمایش "در حال تایپ" برای طبیعی‌تر شدن گفتگو
        await sendChatAction(chatId, "typing");
        const reply = await generateReply(chatId, text);
        await sendMessage(chatId, reply);
      }
    }

    // تلگرام باید همیشه پاسخ ۲۰۰ سریع دریافت کند، وگرنه آپدیت را دوباره ارسال می‌کند
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("خطا در پردازش وبهوک:", err);
    // با این حال 200 برمی‌گردانیم تا تلگرام آپدیت را بی‌نهایت بار تکرار نکند
    res.status(200).json({ ok: false, error: "internal error" });
  }
};
