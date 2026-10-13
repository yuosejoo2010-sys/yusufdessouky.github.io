import {
  adminSecretsReady, checkRateLimit, constantTimeEqual, hmac, json,
  readJson, sameOrigin, sessionCookie, createSessionToken
} from '../../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ message: 'الطلب غير مسموح.' }, 403);
  if (!env.DB || !adminSecretsReady(env)) {
    return json({ message: 'إعداد لوحة الإدارة غير مكتمل.' }, 503);
  }

  const parsed = await readJson(request, 1024);
  if (parsed.error) return json({ message: parsed.error }, parsed.status);
  if (typeof parsed.value.password !== 'string' || !parsed.value.password) {
    return json({ message: 'أدخل كلمة المرور.' }, 400);
  }

  try {
    const rate = await checkRateLimit(env.DB, request, env.SESSION_SECRET, 'admin-login', 8, 900);
    if (!rate.allowed) {
      return json({ message: 'محاولات كثيرة. حاول بعد 15 دقيقة.' }, 429, { 'Retry-After': String(rate.retryAfter) });
    }

    const attempt = await hmac(env.SESSION_SECRET, `password:${parsed.value.password}`);
    const expected = await hmac(env.SESSION_SECRET, `password:${env.ADMIN_PASSWORD}`);
    if (!constantTimeEqual(attempt, expected)) return json({ message: 'كلمة المرور غير صحيحة.' }, 401);

    const token = await createSessionToken(env.SESSION_SECRET);
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
  } catch {
    return json({ message: 'تعذر تسجيل الدخول الآن.' }, 503);
  }
}
