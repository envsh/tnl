// 存储接口
export interface IStorage {
  saveSTUNSession(id: string, session: any): void;
  getSTUNSession(id: string): any | null;
  saveAllocation(relayID: string, alloc: any): void;
  getAllocation(relayID: string): any | null;
  deleteAllocation(relayID: string): void;
  saveStream(streamID: string, stream: any): void;
  getStream(streamID: string): any | null;
  deleteStream(streamID: string): void;
  cleanupExpired?(): Promise<number>;
}

// 内存存储实现
export class MemoryStorage implements IStorage {
  private stunSessions = new Map<string, any>();
  private turnAllocations = new Map<string, any>();
  private streams = new Map<string, any>();

  saveSTUNSession(id: string, session: any): void {
    this.stunSessions.set(id, session);
  }

  getSTUNSession(id: string): any | null {
    return this.stunSessions.get(id) || null;
  }

  saveAllocation(relayID: string, alloc: any): void {
    this.turnAllocations.set(relayID, alloc);
  }

  getAllocation(relayID: string): any | null {
    return this.turnAllocations.get(relayID) || null;
  }

  deleteAllocation(relayID: string): void {
    this.turnAllocations.delete(relayID);
  }

  saveStream(streamID: string, stream: any): void {
    this.streams.set(streamID, stream);
  }

  getStream(streamID: string): any | null {
    return this.streams.get(streamID) || null;
  }

  deleteStream(streamID: string): void {
    this.streams.delete(streamID);
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let deleted = 0;

    for (const [id, session] of this.stunSessions) {
      if (now > session.expires_at) {
        this.stunSessions.delete(id);
        deleted++;
      }
    }

    for (const [id, alloc] of this.turnAllocations) {
      if (now > alloc.expires_at) {
        this.turnAllocations.delete(id);
        deleted++;
      }
    }

    for (const [id, stream] of this.streams) {
      if (now > stream.expires_at) {
        this.streams.delete(id);
        deleted++;
      }
    }

    return deleted;
  }
}

// Durable Object Storage
export class DurableObjectStorage implements IStorage {
  private stub: any;

  constructor(env: any) {
    const id = env.HTURNAL_DO.idFromName("hturnal-storage");
    this.stub = env.HTURNAL_DO.get(id);
  }

  async saveSTUNSession(id: string, session: any): Promise<void> {
    await this.stub.saveSTUNSession(id, session);
  }

  async getSTUNSession(id: string): Promise<any | null> {
    return await this.stub.getSTUNSession(id);
  }

  async saveAllocation(relayID: string, alloc: any): Promise<void> {
    await this.stub.saveAllocation(relayID, alloc);
  }

  async getAllocation(relayID: string): Promise<any | null> {
    return await this.stub.getAllocation(relayID);
  }

  async deleteAllocation(relayID: string): Promise<void> {
    await this.stub.deleteAllocation(relayID);
  }

  async saveStream(streamID: string, stream: any): Promise<void> {
    await this.stub.saveStream(streamID, stream);
  }

  async getStream(streamID: string): Promise<any | null> {
    return await this.stub.getStream(streamID);
  }

  async deleteStream(streamID: string): Promise<void> {
    await this.stub.deleteStream(streamID);
  }

  async cleanupExpired(): Promise<number> {
    return await this.stub.cleanupExpired();
  }
}

export function createStorage(env: any): IStorage {
  const backend = env.STORAGE_BACKEND || 'memory';
  if (backend === 'durable_object' && env.HTURNAL_DO) {
    return new DurableObjectStorage(env);
  }
  return new MemoryStorage();
}
