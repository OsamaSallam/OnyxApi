import crypto from 'node:crypto';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(input, secret) {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

export default async (req) => {
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const configuredPassword = process.env.DOCS_EDITOR_PASSWORD || '';
  const authSecret = process.env.DOCS_AUTH_SECRET || '';
  const editorName = process.env.DOCS_EDITOR_NAME || 'Person 1';

  if (!configuredPassword || !authSecret) {
    return json({ message: 'Server authentication is not configured yet.' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ message: 'Invalid JSON body.' }, 400);
  }

  const supplied = String(body?.password || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(configuredPassword);
  const passwordOk = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!passwordOk) return json({ message: 'Incorrect password.' }, 401);

  const payload = {
    sub: editorName,
    role: 'editor',
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  };
  const encoded = base64url(JSON.stringify(payload));
  const token = `${encoded}.${sign(encoded, authSecret)}`;

  return json({ token, name: editorName, expiresAt: payload.exp });
};
