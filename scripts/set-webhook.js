// scripts/set-webhook.js
// اجرا بعد از دیپلوی برای معرفی آدرس سرورلس به تلگرام:
//   TELEGRAM_BOT_TOKEN=xxx PUBLIC_URL=https://your-project.vercel.app node scripts/set-webhook.js

const { setWebhook } = require("../lib/telegram");

async function main() {
  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) {
    console.error("لطفاً متغیر PUBLIC_URL را تنظیم کنید (آدرس دیپلوی‌شده در Vercel).");
    process.exit(1);
  }

  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/api/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const result = await setWebhook(webhookUrl, secret);
  console.log("نتیجه ثبت وبهوک:", result);
}

main();
