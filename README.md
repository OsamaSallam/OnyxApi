# Onyx API Docs — simplified M.D + Netlify Blobs

This build keeps the OpenAPI contract read-only and stores Arabic documentation separately.

## M.D identity

The portable M.D file does **not** contain `apiFingerprint`, SHA-256 hashes, or `activeProjectId`.
The project is associated with the API by `info.title` + `info.version`.

## Netlify

Set these environment variables in Netlify:

- `DOCS_EDITOR_PASSWORD`
- `DOCS_AUTH_SECRET`

Deploy the repository with `netlify.toml` unchanged.

## Files

- `public/index.html` — UI, OpenAPI import, M.D import/export, editor, publish, cloud sync.
- `netlify/functions/auth.mjs` — editor authentication.
- `netlify/functions/translation.mjs` — Netlify Blobs storage with ETag conflict protection.
- `netlify.toml` — redirects for `/api/auth` and `/api/translation`.
- `package.json` — Netlify Blobs dependencies and syntax check.

## Compatibility

The browser can read older local M.D/project formats and converts them to the simplified format. Older exported M.D files containing a fingerprint are accepted; the fingerprint is ignored and the translation is re-associated using API title/version.
