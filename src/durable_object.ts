// HturnalDurableObject - SQLite-backed Durable Object for persistent storage
// Implements IStorage interface via RPC

export class HturnalDurableObject {
  private initialized = false;

  constructor(private ctx: DurableObjectState, private env: any) {}

  // Initialize SQLite tables if not exists
  private async init() {
    if (this.initialized) return;
    
    const db = this.ctx.storage.sql;
    
    // Create STUN sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stun_sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Create TURN allocations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS turn_allocations (
        relay_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Create streams table
    db.exec(`
      CREATE TABLE IF NOT EXISTS streams (
        stream_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.initialized = true;
  }

  // RPC methods for IStorage interface

  async saveSTUNSession(id: string, session: any): Promise<void> {
    await this.init();
    const data = JSON.stringify(session);
    const expires_at = session.expires_at || Date.now() + 5 * 60 * 1000;
    
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO stun_sessions (id, data, expires_at) VALUES (?, ?, ?)`,
      id, data, expires_at
    );
  }

  async getSTUNSession(id: string): Promise<any | null> {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM stun_sessions WHERE id = ?`,
      id
    )];
    
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    if (Date.now() > row.expires_at) {
      // Expired, delete it
      this.ctx.storage.sql.exec(`DELETE FROM stun_sessions WHERE id = ?`, id);
      return null;
    }
    
    return JSON.parse(row.data);
  }

  async saveAllocation(relayID: string, alloc: any): Promise<void> {
    await this.init();
    const data = JSON.stringify(alloc);
    const expires_at = alloc.expires_at || Date.now() + 10 * 60 * 1000;
    
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO turn_allocations (relay_id, data, expires_at) VALUES (?, ?, ?)`,
      relayID, data, expires_at
    );
  }

  async getAllocation(relayID: string): Promise<any | null> {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM turn_allocations WHERE relay_id = ?`,
      relayID
    )];
    
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    if (Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec(`DELETE FROM turn_allocations WHERE relay_id = ?`, relayID);
      return null;
    }
    
    return JSON.parse(row.data);
  }

  async deleteAllocation(relayID: string): Promise<void> {
    await this.init();
    this.ctx.storage.sql.exec(`DELETE FROM turn_allocations WHERE relay_id = ?`, relayID);
  }

  async saveStream(streamID: string, stream: any): Promise<void> {
    await this.init();
    const data = JSON.stringify(stream);
    const expires_at = stream.expires_at || Date.now() + 5 * 60 * 1000;
    
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO streams (stream_id, data, expires_at) VALUES (?, ?, ?)`,
      streamID, data, expires_at
    );
  }

  async getStream(streamID: string): Promise<any | null> {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM streams WHERE stream_id = ?`,
      streamID
    )];
    
    if (rows.length === 0) return null;
    
    const row = rows[0] as any;
    if (Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec(`DELETE FROM streams WHERE stream_id = ?`, streamID);
      return null;
    }
    
    return JSON.parse(row.data);
  }

  async deleteStream(streamID: string): Promise<void> {
    await this.init();
    this.ctx.storage.sql.exec(`DELETE FROM streams WHERE stream_id = ?`, streamID);
  }

  // Cleanup expired entries (called by cron trigger)
  async cleanupExpired(): Promise<number> {
    await this.init();
    const now = Date.now();
    let deleted = 0;

    // Clean STUN sessions
    const stunResult = this.ctx.storage.sql.exec(
      `DELETE FROM stun_sessions WHERE expires_at < ?`,
      now
    );
    deleted += (stunResult as any).count || 0;

    // Clean TURN allocations
    const turnResult = this.ctx.storage.sql.exec(
      `DELETE FROM turn_allocations WHERE expires_at < ?`,
      now
    );
    deleted += (turnResult as any).count || 0;

    // Clean streams
    const streamResult = this.ctx.storage.sql.exec(
      `DELETE FROM streams WHERE expires_at < ?`,
      now
    );
    deleted += (streamResult as any).count || 0;

    return deleted;
  }

  // Alarm handler for periodic cleanup (alternative to cron)
  async alarm() {
    await this.cleanupExpired();
  }
}
