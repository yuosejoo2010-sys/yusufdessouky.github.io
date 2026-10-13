import { hasAdminSession, json, readJson, sameOrigin } from '../../_lib/security.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ message: 'الطلب غير مسموح.' }, 403);
  if (!await hasAdminSession(request, env)) return json({ message: 'انتهت الجلسة. سجّل الدخول مجددًا.' }, 401);
  if (!env.DB) return json({ message: 'قاعدة الرسائل غير مهيأة.' }, 503);

  const parsed = await readJson(request, 1024);
  if (parsed.error) return json({ message: parsed.error }, parsed.status);
  const { id, action } = parsed.value;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    return json({ message: 'معرّف الرسالة غير صحيح.' }, 400);
  }

  try {
    if (action === 'approve' || action === 'reject') {
      const status = action === 'approve' ? 'approved' : 'rejected';
      const result = await env.DB.prepare(`
        UPDATE reviews SET status = ?, reviewed_at = ? WHERE id = ?
      `).bind(status, new Date().toISOString(), id).run();
      if (!result.meta?.changes) return json({ message: 'لم يتم العثور على الرسالة.' }, 404);
      return json({ ok: true, status });
    }

    if (action === 'delete') {
      const result = await env.DB.prepare(`
        DELETE FROM reviews WHERE id = ? AND status = 'rejected'
      `).bind(id).run();
      if (!result.meta?.changes) return json({ message: 'احفظ الرسالة كمرفوضة قبل حذفها.' }, 400);
      return json({ ok: true, deleted: true });
    }
    return json({ message: 'الإجراء غير صحيح.' }, 400);
  } catch {
    return json({ message: 'تعذر تحديث الرسالة الآن.' }, 503);
  }
}
