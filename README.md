# Onyx API Documentation — Netlify Stage 1

This stage keeps the existing UI and OpenAPI import workflow, while moving the editable translation project from browser-only storage to Netlify Functions + Netlify Blobs.

## What changed

- OpenAPI/Swagger remains handled by the existing page and browser local cache.
- The current translation project (`docs.projects[apiFingerprint]`) is stored in Netlify Blobs.
- Public visitors can read the translation from the cloud.
- Editing is unlocked by a server-side password checked by a Netlify Function.
- The editor identity is returned as `Person 1` by default and is written into the existing team/translator fields.
- Cloud saves use the Netlify Blob ETag with `onlyIfMatch`, so an old copy cannot silently overwrite a newer cloud copy.
- LocalStorage is retained as a cache/fallback, so the current behavior is preserved.
- Published standalone HTML still embeds OpenAPI + M.D and remains independent of the cloud store.

## Netlify environment variables

Create these in **Project configuration → Environment variables**:

- `DOCS_EDITOR_PASSWORD` — the password used by Person 1.
- `DOCS_EDITOR_NAME` — set to `Person 1` (or another label you want shown in the translation workflow).
- `DOCS_AUTH_SECRET` — a long random secret used to sign the temporary editor token.

Keep these values out of the repository. Netlify Functions read environment variables at runtime through `process.env`. Environment-variable changes require a new deploy to take effect.

## Deploy with GitHub/GitLab/Bitbucket

1. Create a new repository.
2. Upload the complete contents of this folder.
3. In Netlify choose **Add new project → Import an existing project**.
4. Select the repository.
5. Netlify will read `netlify.toml`.
6. Set the three environment variables above.
7. Deploy.
8. Open the deployed site.
9. Import your OpenAPI JSON as you do today.
10. Open **Edit Doc** and enter the server-side password.
11. The page loads an existing cloud translation for that API fingerprint if one exists.
12. Editing a translation automatically schedules a cloud save; the local cache is also updated.
13. You can also press **☁ Sync** to explicitly load/check the cloud copy.

## Local development

```bash
npm install
npm run check
npm run dev
```

For local Netlify Functions + Blobs behavior, run through Netlify Dev rather than opening `public/index.html` directly.

## Important first-stage limitation

This stage assumes one editor identity (Person 1). Netlify Blobs is key/value storage. The translation blob is keyed by the OpenAPI SHA-256 fingerprint. Writes are protected with ETags, so stale editor data receives HTTP 409 instead of overwriting newer data.

This stage does not add a multi-user account system, roles, audit history, or database. Those can be added later without changing the core translation data shape.
