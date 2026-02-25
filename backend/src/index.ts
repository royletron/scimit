import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './config/database.js';
import { authenticateToken } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import scimRoutes from './routes/scim.routes.js';
import adminRoutes from './routes/admin.routes.js';
import logsRoutes from './routes/logs.routes.js';
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

// SCIM routes (require authentication) — only SCIM requests are logged
app.use('/scim/v2', requestLogger, authenticateToken, scimRoutes);

// Serve built frontend (production) — skipped transparently in dev
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicPath, 'index.html'))) {
  app.use(express.static(publicPath));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(publicPath, 'index.html')));
}

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logStartup(Number(PORT), process.env.DATABASE_PATH ?? path.join(__dirname, '../../scim-watch.db'));
});

export default app;
