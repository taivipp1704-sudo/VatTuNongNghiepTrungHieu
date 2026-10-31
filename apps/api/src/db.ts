import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, PoolClient, types } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

types.setTypeParser(1700, Number);
types.setTypeParser(1082, (value) => value);

@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    options: "-c timezone=Asia/Ho_Chi_Minh",
  });

  async onModuleInit() {
    if (!process.env.DATABASE_URL)
      throw new Error("Thiếu DATABASE_URL. Chạy npm run db:start trước.");
    await this.pool.query(
      readFileSync(join(__dirname, "../schema.sql"), "utf8"),
    );
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async transaction<Result>(
    work: (client: PoolClient) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function audit(
  client: PoolClient | Pool,
  userId: string | null,
  action: string,
  entityId: string | null,
  detail: unknown = {},
) {
  await client.query(
    "INSERT INTO audit_log(id,user_id,action,entity_id,detail) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), userId, action, entityId, JSON.stringify(detail)],
  );
}
