import express, { Router, Request, Response, NextFunction } from 'express';
import { SamlApps, appUrls, baseUrl, completeSignIn, getIdpInfo, getSignIn, metadataFor, startSignIn } from '../services/saml.service.js';

const wrap = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

// ─── What SPs talk to: /saml ──────────────────────────────────────────────────

export const samlPublic = Router();
samlPublic.use(express.urlencoded({ extended: false })); // HTTP-POST binding

const unknownApp = (res: Response) =>
  res.status(404).type('text/plain').send('SCIMit has no SAML app with this ID. Check the SSO URL in your SP settings.');

// IdP metadata. /metadata.xml is the advertised URL (some SPs insist on .xml); ?download=1 gives a file to upload.
samlPublic.get(['/apps/:id/metadata', '/apps/:id/metadata.xml'], wrap(async (req, res) => {
  const app = SamlApps.get(req.params.id as string);
  if (!app) return unknownApp(res);
  if (req.query.download !== undefined) {
    const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
    res.attachment(`scimit-${slug}-metadata.xml`);
  }
  res.type('application/samlmetadata+xml').send(await metadataFor(baseUrl(req), app));
}));

// SP-initiated (with a SAMLRequest, either binding) or IdP-initiated (without): hand over to the sign-in page
samlPublic.all('/apps/:id/sso', (req, res) => {
  const app = SamlApps.get(req.params.id as string);
  if (!app) return unknownApp(res);
  const src = req.method === 'POST' ? req.body : req.query;
  const p = startSignIn(req, app, src?.SAMLRequest, src?.RelayState);
  res.redirect(302, `/sso/${p.id}`);
});

// ─── What the dashboard talks to: /api/saml ───────────────────────────────────

export const samlApi = Router();

samlApi.get('/idp', wrap(async (_req, res) => res.json(await getIdpInfo())));

samlApi.get('/apps', (req, res) => {
  const base = baseUrl(req);
  res.json(SamlApps.all().map((a) => ({ ...a, idp: appUrls(base, a.id) })));
});
samlApi.post('/apps', (req, res) => res.status(201).json(SamlApps.create(req.body)));
samlApi.put('/apps/:id', (req, res) => {
  const app = SamlApps.update(req.params.id as string, req.body);
  app ? res.json(app) : res.status(404).json({ detail: 'App not found' });
});
samlApi.delete('/apps/:id', (req, res) => {
  SamlApps.remove(req.params.id as string);
  res.status(204).end();
});

// The sign-in page reads the request (SP- or IdP-initiated), then completes it with the chosen user
samlApi.get('/signins/:id', (req, res) => {
  const p = getSignIn(req.params.id as string);
  const app = p && SamlApps.get(p.appId);
  if (!p || !app) return res.status(404).json({ detail: 'This sign-in request has expired or was already used.' });
  res.json({ app: { id: app.id, name: app.name, spEntityId: app.sp_entity_id }, issuer: p.issuer, spInitiated: Boolean(p.requestId), warnings: p.warnings });
});
samlApi.post('/signins/:id/complete', wrap(async (req, res) => {
  const p = getSignIn(req.params.id as string);
  const app = p && SamlApps.get(p.appId);
  if (!p || !app) return res.status(404).json({ detail: 'This sign-in request has expired or was already used. Start again from the app.' });
  res.json(await completeSignIn(app, req.body.userId, p.base, p));
}));
