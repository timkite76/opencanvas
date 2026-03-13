import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import { authMiddleware, internalKeyMiddleware } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import providersRoutes from './routes/providers.js';
import modelsRoutes from './routes/models.js';
import functionsRoutes from './routes/functions.js';
import usageRoutes from './routes/usage.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
app.use('/api/auth', authRoutes);

// Admin routes (require authentication)
app.use('/api/admin/users', authMiddleware, usersRoutes);
app.use('/api/admin/models', authMiddleware, modelsRoutes);
app.use('/api/admin/functions', authMiddleware, functionsRoutes);
app.use('/api/admin/usage', authMiddleware, usageRoutes);
app.use('/api/admin/audit', authMiddleware, auditRoutes);
app.use('/api/admin/settings', authMiddleware, settingsRoutes);

// Provider routes - /active endpoint uses internal key, others use auth
app.get('/api/admin/providers/active', internalKeyMiddleware, (req, res, next) => {
  // Handler is in the providers router
  providersRoutes(req, res, next);
});
app.use('/api/admin/providers', authMiddleware, providersRoutes);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize default admin user if no users exist
function initializeDefaultAdmin() {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    if (userCount.count === 0) {
      console.log('No users found. Creating default admin user...');

      const id = uuidv4();
      const email = 'admin@localhost';
      const name = 'Administrator';
      const password = 'admin';
      const passwordHash = bcrypt.hashSync(password, 10);
      const role = 'admin';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `).run(id, email, name, passwordHash, role, now, now);

      console.log('Default admin user created:');
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
      console.log('  Please change this password after first login!');

      // Log audit entry
      const auditId = uuidv4();
      db.prepare(`
        INSERT INTO audit_log (id, action, resource_type, resource_id, details)
        VALUES (?, 'create', 'user', ?, ?)
      `).run(auditId, id, JSON.stringify({ email, name, role, note: 'Default admin user created on startup' }));
    }
  } catch (error) {
    console.error('Failed to initialize default admin user:', error);
  }
}

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   OpenCanvas API Server                        ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  POST /api/auth/login - Login');
  console.log('  GET  /api/auth/me - Get current user');
  console.log('  POST /api/auth/logout - Logout');
  console.log('');
  console.log('  GET  /api/admin/users - List users');
  console.log('  POST /api/admin/users - Create user');
  console.log('  PUT  /api/admin/users/:id - Update user');
  console.log('  DEL  /api/admin/users/:id - Delete user');
  console.log('  POST /api/admin/users/:id/reset-password - Reset password');
  console.log('');
  console.log('  GET  /api/admin/providers - List providers');
  console.log('  GET  /api/admin/providers/active - Get active providers (internal)');
  console.log('  POST /api/admin/providers - Create provider');
  console.log('  PUT  /api/admin/providers/:id - Update provider');
  console.log('  DEL  /api/admin/providers/:id - Delete provider');
  console.log('  POST /api/admin/providers/:id/test - Test provider');
  console.log('');
  console.log('  GET  /api/admin/models - List model configs');
  console.log('  PUT  /api/admin/models/:tier - Update model config');
  console.log('  GET  /api/admin/models/routing-rules - Get routing rules');
  console.log('');
  console.log('  GET  /api/admin/functions - List functions');
  console.log('  PUT  /api/admin/functions/:name - Update function');
  console.log('');
  console.log('  GET  /api/admin/usage - List usage logs');
  console.log('  GET  /api/admin/usage/stats - Usage statistics');
  console.log('  POST /api/admin/usage - Record usage');
  console.log('');
  console.log('  GET  /api/admin/audit - List audit logs');
  console.log('  POST /api/admin/audit - Record audit entry');
  console.log('');
  console.log('  GET  /api/admin/settings - Get settings');
  console.log('  PUT  /api/admin/settings/:key - Update setting');
  console.log('');

  // Initialize default admin user
  initializeDefaultAdmin();

  console.log('Server initialization complete.');
  console.log('');
});

export default app;
