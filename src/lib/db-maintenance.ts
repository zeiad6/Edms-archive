import { sql } from "drizzle-orm";
import { db, dbReady } from "@/db";

export type WalCheckpointMode = "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";

export interface WalCheckpointResult {
  /** True when a reader/writer kept the checkpoint from finishing. */
  busy: boolean;
  /** WAL frames before the checkpoint. */
  logPages: number;
  /** Frames moved back into the database file. */
  checkpointedPages: number;
}

interface WalCheckpointRow {
  busy: number;
  log: number;
  checkpointed: number;
}

/**
 * Fold the write-ahead log back into `edms.db`. `TRUNCATE` also empties the
 * -wal file, which is what a backup wants: the zip then carries one complete
 * database instead of a database plus a log the restore path has to replay.
 *
 * Runs on the app's shared connection on purpose: a throwaway connection has
 * to compete with this process for the same lock, and it cannot truncate a
 * WAL the app is still writing.
 *
 * Never throws: a busy checkpoint is normal while a request is writing, and
 * the backup must still be produced. `null` means the checkpoint could not be
 * attempted at all.
 */
export async function checkpointWal(
  mode: WalCheckpointMode = "TRUNCATE",
): Promise<WalCheckpointResult | null> {
  try {
    await dbReady;
    const [row] = await db.all<WalCheckpointRow>(sql.raw(`PRAGMA wal_checkpoint(${mode})`));
    if (!row) return null;
    return {
      busy: row.busy !== 0,
      logPages: row.log,
      checkpointedPages: row.checkpointed,
    };
  } catch (err) {
    console.error(`[db] wal_checkpoint(${mode}) failed:`, err);
    return null;
  }
}
