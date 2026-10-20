// infrastructure/adapters/PostgresUserRepository.ts
import { Pool } from 'pg';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/models/User';
import defaultPool from '../database/db';

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async getUserById(userId: string): Promise<User | null> {
    const query = 'SELECT id, stripe_customer_id FROM users WHERE id = $1';
    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      stripe_customer_id: row.stripe_customer_id
    };
  }
}
