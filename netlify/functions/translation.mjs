import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'onyx-api-translations';
const KEY_PREFIX = 'projects/';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(input, secret) {
  return crypto.createHmac('sha256', secret).update(input).digest('base64url');
}

function verifyToken(token) {
  const secret = process.env.DOCS_AUTH_SECRET || '';
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = sign(encoded, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'editor') return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeFingerprint(value) {
  return String(value || '').trim().toLowerCase();
}

function validFingerprint(value) {
  return /^[a-f0-9]{64}$/.test(normalizeFingerprint(value));
}

function normalizeProject(project, apiFingerprint) {
  const p = project && typeof project === 'object' ? structuredClone(project) : {};
  p.version = 3;
  p.apiFingerprint = apiFingerprint;
  p.apiTitle = String(p.apiTitle || '');
  p.apiVersion = String(p.apiVersion || '');
  p.translations = p.translations && typeof p.translations === 'object' ? p.translations : {};
  p.workflow = p.workflow && typeof p.workflow === 'object' ? p.workflow : {};
  p.team = p.team && typeof p.team === 'object' ? p.team : {};
  for (const bucket of ['parameters', 'fields', 'responses']) {
    p.translations[bucket] = p.translations[bucket] && typeof p.translations[bucket] === 'object' ? p.translations[bucket] : {};
    p.workflow[bucket] = p.workflow[bucket] && typeof p.workflow[bucket] === 'object' ? p.workflow[bucket] : {};
  }
  p.cloudVersion = Number(p.cloudVersion || 0);
  return p;
}

export default async (req) => {
  const url = new URL(req.url);
  const apiFingerprint = normalizeFingerprint(url.searchParams.get('apiFingerprint'));

  if (!validFingerprint(apiFingerprint)) {
    return json({ message: 'A valid 64-character SHA-256 apiFingerprint is required.' }, 400);
  }

  const store = getStore(STORE_NAME);
  const key = `${KEY_PREFIX}${apiFingerprint}/translation.json`;

  if (req.method === 'GET') {
    const entry = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' });
    if (!entry) return json({ exists: false, project: null }, 404);

    const storedFingerprint = normalizeFingerprint(entry.data?.apiFingerprint);
    if (storedFingerprint !== apiFingerprint) {
      return json({
        message: 'Stored cloud translation fingerprint does not match the requested API.',
        conflict: true
      }, 409);
    }

    return json({ exists: true, etag: entry.etag, project: entry.data });
  }

  if (req.method === 'PUT') {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const user = verifyToken(token);
    if (!user) return json({ message: 'Editor authentication required or expired.' }, 401);

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ message: 'Invalid JSON body.' }, 400);
    }

    if (normalizeFingerprint(body?.apiFingerprint) !== apiFingerprint) {
      return json({ message: 'API fingerprint mismatch.' }, 409);
    }

    const incomingProjectFingerprint = normalizeFingerprint(body?.project?.apiFingerprint);
    if (incomingProjectFingerprint && incomingProjectFingerprint !== apiFingerprint) {
      return json({ message: 'Project API fingerprint mismatch.' }, 409);
    }

    const project = normalizeProject(body?.project, apiFingerprint);
    project.team.lastUpdatedBy = user.sub;
    project.team.lastUpdatedAt = new Date().toISOString();
    project.cloudVersion = Number(project.cloudVersion || 0);

    const expectedEtag = String(body?.etag || '');
    let result;
    if (expectedEtag) {
      result = await store.setJSON(key, project, {
        onlyIfMatch: expectedEtag,
        metadata: { editor: user.sub, apiFingerprint },
      });
    } else {
      result = await store.setJSON(key, project, {
        onlyIfNew: true,
        metadata: { editor: user.sub, apiFingerprint },
      });
    }

    if (!result.modified) {
      const current = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' });
      return json({
        message: 'Cloud translation changed since your last load.',
        conflict: true,
        etag: current?.etag || '',
        project: current?.data || null,
      }, 409);
    }

    return json({ ok: true, etag: result.etag, project });
  }

  return json({ message: 'Method not allowed' }, 405);
};
