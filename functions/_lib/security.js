const encoder = new TextEncoder();

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders
    }
  });
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readJson(request, maxBytes = 4096) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return { error: 'صيغة الطلب غير مدعومة.', status: 415 };
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > maxBytes) return { error: 'حجم الرسالة أكبر من المسموح.', status: 413 };

  const reader = request.body?.getReader();
  const chunks = [];
  let byteLength = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        return { error: 'حجم الرسالة أكبر من المسموح.', status: 413 };
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'بيانات الطلب غير صحيحة.', status: 400 };
    }
    return { value };
  } catch {
    return { error: 'بيانات الطلب غير صحيحة.', status: 400 };
  }
}

export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  let binary = '';
  signature.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function checkRateLimit(db, request, secret, scope, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const rawIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const keyHash = await hmac(secret, `rate:${scope}:${rawIp}`);
  await db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now).run();
  const row = await db.prepare(`
    INSERT INTO rate_limits (key_hash, window_started_at, request_count, expires_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      request_count = CASE
        WHEN ? - rate_limits.window_started_at >= ? THEN 1
        ELSE rate_limits.request_count + 1
      END,
      window_started_at = CASE
        WHEN ? - rate_limits.window_started_at >= ? THEN ?
        ELSE rate_limits.window_started_at
      END,
      expires_at = ?
    RETURNING request_count
  `).bind(keyHash, now, now + 86400, now, windowSeconds, now, windowSeconds, now, now + 86400).first();
  return { allowed: Number(row?.request_count || 0) <= limit, retryAfter: windowSeconds };
}
