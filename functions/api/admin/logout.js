import { expiredSessionCookie, hasAdminSession, json, sameOrigin } from '../../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ message: 'الطلب غير مسموح.' }, 403);
  if (!await hasAdminSession(request, env)) return json({ message: 'انتهت الجلسة. سجّل الدخول مجددًا.' }, 401);
  return json({ ok: true }, 200, { 'Set-Cookie': expiredSessionCookie() });
}
