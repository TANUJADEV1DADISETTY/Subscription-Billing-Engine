// infrastructure/api/app.ts
import express, { Express, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { SubscriptionController } from './controllers/SubscriptionController';
import pool from '../database/db';

export function createApp(controller?: SubscriptionController): Express {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const subscriptionController = controller || new SubscriptionController();

  // Core API Endpoint required by specification
  app.post('/api/renew', (req: Request, res: Response) => {
    subscriptionController.renew(req, res);
  });

  // Health and Data Inspection Endpoints for UI / Diagnostics
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({ status: 'unhealthy', database: err.message });
    }
  });

  app.get('/api/data', async (_req: Request, res: Response) => {
    try {
      const usersResult = await pool.query('SELECT * FROM users ORDER BY id ASC');
      const subsResult = await pool.query('SELECT * FROM subscriptions ORDER BY user_id ASC');
      res.json({
        users: usersResult.rows,
        subscriptions: subsResult.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/reset', async (_req: Request, res: Response) => {
    try {
      await pool.query(`
        INSERT INTO users (id, stripe_customer_id)
        VALUES 
          ('user-expired-001', 'cus_stripe_expired_001'),
          ('user-unexpired-002', 'cus_stripe_unexpired_002'),
          ('user-december-discount-003', 'cus_stripe_discount_003')
        ON CONFLICT (id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;

        INSERT INTO subscriptions (id, user_id, base_price, expires_at)
        VALUES 
          ('sub-expired-001', 'user-expired-001', 100.00, '2023-01-01 00:00:00+00'),
          ('sub-unexpired-002', 'user-unexpired-002', 150.00, '2099-12-31 23:59:59+00'),
          ('sub-discount-003', 'user-december-discount-003', 200.00, '2022-12-01 00:00:00+00')
        ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, base_price = EXCLUDED.base_price, expires_at = EXCLUDED.expires_at;
      `);
      res.json({ success: true, message: 'Database reset to initial seed state' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Browser UI Dashboard
  app.get('/', (_req: Request, res: Response) => {
    const htmlCandidates = [
      path.join(__dirname, 'public/index.html'),
      path.join(__dirname, '../public/index.html'),
      path.join(process.cwd(), 'src/infrastructure/api/public/index.html')
    ];

    for (const file of htmlCandidates) {
      if (fs.existsSync(file)) {
        res.sendFile(file);
        return;
      }
    }

    res.send('<h1>Subscription Billing Engine</h1><p>API Ready at /api/renew</p>');
  });

  return app;
}
