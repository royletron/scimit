import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import db, { initializeDatabase } from './config/database.js';
import { authenticateToken } from './middleware/auth.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import scimRoutes from './routes/scim.routes.js';
import adminRoutes from './routes/admin.routes.js';
import logsRoutes from './routes/logs.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json({ type: ['application/json', 'application/scim+json'] }));
app.use(morgan('dev'));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (no auth required for frontend)
app.use('/api/admin', adminRoutes);
app.use('/api/logs', logsRoutes);

// SCIM routes (require authentication) — only SCIM requests are logged
app.use('/scim/v2', requestLogger, authenticateToken, scimRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`SCIM Watch Service running on http://localhost:${PORT}`);
  console.log(`SCIM endpoint: http://localhost:${PORT}/scim/v2`);
  console.log(`Admin API: http://localhost:${PORT}/api`);
});

export default app;
