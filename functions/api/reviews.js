import { checkRateLimit, hmac, json, readJson, sameOrigin } from '../_lib/security.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ message: 'خدمة الآراء غير مهيأة بعد.' }, 503);
  try {
    const result = await env.DB.prepare(`
      SELECT id, name, message, created_at
      FROM reviews
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    return json({ reviews: result.results || [] });
  } catch {
    return json({ message: 'تعذر تحميل الآراء الآن.' }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ message: 'الطلب غير مسموح.' }, 403);
  if (!env.DB) return json({ message: 'خدمة الآراء غير مهيأة بعد.' }, 503);
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return json({ message: 'خدمة الآراء غير مهيأة بعد.' }, 503);
  }

  const parsed = await readJson(request, 4096);
  if (parsed.error) return json({ message: parsed.error }, parsed.status);
  const { name = '', message, website = '' } = parsed.value;
  if (typeof website !== 'string' || website.trim()) {
    return json({ message: 'وصل رأيك وسيظهر بعد المراجعة.' }, 202);
  }
  if (typeof name !== 'string' || typeof message !== 'string') {
    return json({ message: 'تحقق من الاسم والرأي ثم حاول مجددًا.' }, 400);
  }

  const cleanName = name.normalize('NFC').trim();
  const cleanMessage = message.normalize('NFC').replace(/\r\n?/g, '\n').trim();
  const nameLength = Array.from(cleanName).length;
  const messageLength = Array.from(cleanMessage).length;
  if (nameLength > 60 || messageLength < 3 || messageLength > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cleanName + cleanMessage)) {
    return json({ message: 'الاسم حتى 60 حرفًا، والرأي من 3 إلى 1000 حرف.' }, 400);
  }

  try {
    const rate = await checkRateLimit(env.DB, request, env.SESSION_SECRET, 'review-submit', 5, 3600);
    if (!rate.allowed) {
      return json({ message: 'وصلت للحد المؤقت لإرسال الآراء. حاول بعد ساعة.' }, 429, { 'Retry-After': String(rate.retryAfter) });
    }

    await env.DB.prepare(`
      INSERT INTO reviews (id, name, message, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).bind(crypto.randomUUID(), cleanName, cleanMessage, new Date().toISOString()).run();
    return json({ message: 'وصل رأيك، وسيظهر بعد مراجعته والموافقة عليه.' }, 201);
  } catch {
    return json({ message: 'تعذر حفظ الرأي الآن. حاول لاحقًا.' }, 503);
  }
}
