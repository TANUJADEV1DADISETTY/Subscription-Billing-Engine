// infrastructure/api/server.ts
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import pool from '../database/db';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = createApp();

async function initDatabaseIfNeeded(): Promise<void> {
  const initSqlCandidates = [
    path.join(__dirname, '../database/init.sql'),
    path.join(process.cwd(), 'src/infrastructure/database/init.sql')
  ];

  let sqlContent = '';
  for (const candidate of initSqlCandidates) {
    if (fs.existsSync(candidate)) {
      sqlContent = fs.readFileSync(candidate, 'utf-8');
      break;
    }
  }

  if (sqlContent) {
    try {
      await pool.query(sqlContent);
      console.log('Database initialized and seeded successfully.');
    } catch (err: any) {
      console.warn('Database initialization note:', err.message);
    }
  }
}

async function startServer() {
  await initDatabaseIfNeeded();

  app.listen(PORT, () => {
    console.log(`Subscription Billing Engine API listening on port ${PORT}`);
    console.log(`Interactive Web Dashboard available at http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/renew`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
