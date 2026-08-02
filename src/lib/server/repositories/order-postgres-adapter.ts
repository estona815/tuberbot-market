import { getDatabase } from "../db";
import type {
  OrderSqlExecutor,
  OrderSqlResult,
  OrderTransactionalDatabase,
} from "./order-collaboration-repository";

interface PostgresExecutorLike {
  unsafe(
    statement: string,
    parameters: readonly unknown[],
  ): Promise<readonly Record<string, unknown>[]>;
}

interface PostgresClientLike extends PostgresExecutorLike {
  begin<Result>(
    callback: (transaction: PostgresExecutorLike) => Promise<Result>,
  ): Promise<Result>;
}

function postgresExecutor(client: PostgresExecutorLike): OrderSqlExecutor {
  return {
    async query<Row extends Record<string, unknown>>(
      statement: string,
      parameters: readonly unknown[] = [],
    ): Promise<OrderSqlResult<Row>> {
      const rows = await client.unsafe(statement, parameters);
      return { rows: rows as readonly Row[] };
    },
  };
}

export function createProductionOrderDatabase(): OrderTransactionalDatabase {
  const client = getDatabase().queryClient as unknown as PostgresClientLike;
  return {
    ...postgresExecutor(client),
    transaction<Result>(
      callback: (transaction: OrderSqlExecutor) => Promise<Result>,
    ): Promise<Result> {
      return client.begin((transaction) => callback(postgresExecutor(transaction)));
    },
  };
}
