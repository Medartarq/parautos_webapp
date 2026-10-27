import type { PoolConnection } from "mariadb";
import { technicalLogger } from "../logging/technical-logger.js";

// A cleanup failure must not hide a business error or skip attachment cleanup.
// Failed connections are discarded instead of being silently reused.
export async function releaseConnection(connection: Pick<PoolConnection, "release" | "destroy">): Promise<void> {
  try {
    await connection.release();
  } catch (error) {
    technicalLogger.failure("database_connection_release_failed", error);
    try {
      connection.destroy();
    } catch (destroyError) {
      technicalLogger.failure("database_connection_destroy_failed", destroyError);
    }
  }
}
