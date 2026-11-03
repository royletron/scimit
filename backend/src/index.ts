import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { initializeDatabase, APP_VERSION } from './config/database.js';
import { authenticateToken } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import scimRoutes from './routes/scim.routes.js';
import adminRoutes from './routes/admin.routes.js';
import logsRoutes from './routes/logs.routes.js';
import playbackRoutes from './routes/playback.routes.js';
import { logRequest, logStartup } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json({ type: ['application/json', 'application/scim+json'] }));

// Colored request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logRequest(req.method, req.path, res.statusCode, Date.now() - start));
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (no auth required for frontend)
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/playback', playbackRoutes);

// SCIM routes (require authentication) — only SCIM requests are logged
// RFC 7644 §8.1: SCIM responses use application/scim+json (res.json keeps a preset type)
// RFC 7644 §3.14: single-resource responses carry ETag = meta.version
app.use('/scim/v2', (_req, res, next) => {
  res.type('application/scim+json');
  const json = res.json.bind(res);
  res.json = (body: any) => {
    if (body?.meta?.version) res.set('ETag', body.meta.version);
    return json(body);
  };
  next();
}, requestLogger, authenticateToken, scimRoutes);

// Serve built frontend (production) — skipped transparently in dev
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicPath, 'index.html'))) {
  app.use(express.static(publicPath));
  // root option: send() ignores paths with dot-folders (e.g. ~/.npm/_npx/…) unless they sit above `root`
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: publicPath }));
}

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logStartup(Number(PORT), process.env.DATABASE_PATH ?? path.join(os.homedir(), '.scimit', 'data.db'), APP_VERSION);
});

export default app;
