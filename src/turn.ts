import { IStorage } from './storage';
import { generateID } from './utils';

// TURN Allocate
export async function handleTURNAllocate(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const relayID = generateID('relay');
  const alloc = {
    relay_id: relayID,
    client_id: req.client_id,
    permissions: {} as Record<string, number>,
    pending_data: {} as Record<string, any[]>,
    lifetime: 10 * 60 * 1000,
    expires_at: Date.now() + 10 * 60 * 1000
  };
  storage.saveAllocation(relayID, alloc);

  const resp = {
    relay_id: relayID,
    relay_address: new URL(request.url).host,
    lifetime: 10 * 60
  };

  return new Response(JSON.stringify(resp), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TURN Permission - 添加权限
export async function handleTURNPermission(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc) return new Response(JSON.stringify({error: 'Relay not found'}), { status: 404 });

  alloc.permissions[req.peer_id] = Date.now() + 10 * 60 * 1000; // 10分钟权限
  storage.saveAllocation(req.relay_id, alloc);

  return new Response(JSON.stringify({status: 'permission granted', peer_id: req.peer_id}), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TURN Send（中继消息）
export async function handleTURNSend(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc) return new Response(JSON.stringify({error: 'Relay not found'}), { status: 404 });

  // 检查权限（带过期检查）
  const permExpiry = alloc.permissions[req.peer_id];
  if (!permExpiry || Date.now() > permExpiry) {
    delete alloc.permissions[req.peer_id];
    storage.saveAllocation(req.relay_id, alloc);
    return new Response(JSON.stringify({error: 'No permission or permission expired'}), { status: 403 });
  }

  // 存储消息给 peer
  const msg = {
    from: alloc.client_id,
    data: req.data,
    timestamp: Date.now()
  };
  if (!alloc.pending_data[req.peer_id]) alloc.pending_data[req.peer_id] = [];
  alloc.pending_data[req.peer_id].push(msg);
  storage.saveAllocation(req.relay_id, alloc);

  return new Response(JSON.stringify({status: 'sent'}), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TURN Receive（长轮询，最多 10 秒）
export async function handleTURNReceive(request: Request, storage: IStorage): Promise<Response> {
  const url = new URL(request.url);
  const relayID = url.searchParams.get('relay_id') || '';
  const timeout = Math.min(parseInt(url.searchParams.get('timeout') || '30'), 10) * 1000;
  const alloc = storage.getAllocation(relayID);
  if (!alloc) return new Response(JSON.stringify({error: 'Relay not found'}), { status: 404 });

  const deadline = Date.now() + timeout;
  const clientID = alloc.client_id;

  while (Date.now() < deadline) {
    const messages = alloc.pending_data[clientID];
    if (messages && messages.length > 0) {
      const respMessages = messages.map((msg: any) => ({
        from: msg.from,
        data: msg.data,
        timestamp: msg.timestamp
      }));
      alloc.pending_data[clientID] = [];
      storage.saveAllocation(relayID, alloc);

      return new Response(JSON.stringify({ messages: respMessages }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return new Response(JSON.stringify({ messages: [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TURN Refresh - 刷新分配生存期
export async function handleTURNRefresh(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc) return new Response(JSON.stringify({error: 'Relay not found'}), { status: 404 });

  const lifetime = (req.lifetime || 10 * 60) * 1000;
  alloc.lifetime = lifetime;
  alloc.expires_at = Date.now() + lifetime;
  storage.saveAllocation(req.relay_id, alloc);

  return new Response(JSON.stringify({status: 'refreshed', lifetime: lifetime / 1000}), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// TURN Deallocate - 释放中继
export async function handleTURNDeallocate(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc) return new Response(JSON.stringify({error: 'Relay not found'}), { status: 404 });

  storage.deleteAllocation(req.relay_id);

  return new Response(JSON.stringify({status: 'deallocated'}), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ==================== Stream 相关 ====================

export async function handleStreamStart(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const streamID = generateID('stream');
  const stream = {
    stream_id: streamID,
    relay_id: req.relay_id,
    peer_id: req.peer_id,
    chunks: {} as Record<number, string>,
    max_seq: -1,
    expires_at: Date.now() + 5 * 60 * 1000
  };
  storage.saveStream(streamID, stream);

  return new Response(JSON.stringify({
    stream_id: streamID,
    chunk_size: 16384,
    ttl: 5 * 60
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Stream Send Chunk
export async function handleStreamSend(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const stream = storage.getStream(req.stream_id);
  if (!stream) return new Response(JSON.stringify({error: 'Stream not found'}), { status: 404 });

  stream.chunks[req.chunk_seq] = req.data;
  if (req.chunk_seq > stream.max_seq) stream.max_seq = req.chunk_seq;
  storage.saveStream(req.stream_id, stream);

  return new Response(JSON.stringify({
    status: 'chunk received',
    next_seq: req.chunk_seq + 1
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Stream Receive Chunks（长轮询）
export async function handleStreamReceive(request: Request, storage: IStorage): Promise<Response> {
  const url = new URL(request.url);
  const streamID = url.searchParams.get('stream_id') || '';
  const timeout = Math.min(parseInt(url.searchParams.get('timeout') || '30'), 10) * 1000;
  const stream = storage.getStream(streamID);
  if (!stream) return new Response(JSON.stringify({error: 'Stream not found'}), { status: 404 });

  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const chunkCount = Object.keys(stream.chunks).length;
    if (chunkCount > 0) {
      const chunks: any[] = Object.entries(stream.chunks)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([seq, data]) => ({
          seq: parseInt(seq),
          data: data
        }));
      stream.chunks = {};
      storage.saveStream(streamID, stream);

      return new Response(JSON.stringify({
        chunks,
        stream_complete: false
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return new Response(JSON.stringify({
    chunks: [],
    stream_complete: false
  }), { headers: { 'Content-Type': 'application/json' } });
}

// Stream End - 结束流
export async function handleStreamEnd(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const stream = storage.getStream(req.stream_id);
  if (!stream) return new Response(JSON.stringify({error: 'Stream not found'}), { status: 404 });

  storage.deleteStream(req.stream_id);

  return new Response(JSON.stringify({status: 'stream ended'}), {
    headers: { 'Content-Type': 'application/json' }
  });
}
