// infrastructure/adapters/PostgresSubscriptionRepository.ts
import { Pool } from 'pg';
import { ISubscriptionRepository } from '../../domain/ports/ISubscriptionRepository';
import { Subscription } from '../../domain/models/Subscription';
import defaultPool from '../database/db';

export class PostgresSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const query = 'SELECT id, user_id, base_price, expires_at FROM subscriptions WHERE user_id = $1 LIMIT 1';
    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      base_price: parseFloat(row.base_price),
      expires_at: new Date(row.expires_at)
    };
  }

  async updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void> {
    const query = 'UPDATE subscriptions SET expires_at = $1 WHERE id = $2';
    await this.db.query(query, [newExpiry, subscriptionId]);
  }
}
