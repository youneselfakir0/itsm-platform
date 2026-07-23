import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgres://itsm:itsm_dev_pw@localhost:5433/itsm',
  });

  query(text: string, params?: unknown[]) {
    return this.pool.query(text, params);
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
