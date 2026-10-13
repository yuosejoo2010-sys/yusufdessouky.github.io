import { adminSecretsReady, hasAdminSession, json } from '../../_lib/security.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB || !adminSecretsReady(env)) return json({ message: 'إعداد لوحة الإدارة غير مكتمل.' }, 503);
  if (!await hasAdminSession(request, env)) return json({ message: 'سجّل الدخول للوصول إلى لوحة الإدارة.' }, 401);

  const status = new URL(request.url).searchParams.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return json({ message: 'حالة التصفية غير صحيحة.' }, 400);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT id, name, message, status, created_at, reviewed_at
      FROM reviews
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).bind(status).all();
    return json({ reviews: result.results || [] });
  } catch {
    return json({ message: 'تعذر تحميل الرسائل الآن.' }, 503);
  }
}
