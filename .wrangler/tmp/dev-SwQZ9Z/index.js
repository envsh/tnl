var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-SeHWTG/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/durable_object.ts
var HturnalDurableObject = class {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
  initialized = false;
  // Initialize SQLite tables if not exists
  async init() {
    if (this.initialized)
      return;
    const db = this.ctx.storage.sql;
    db.exec(`
      CREATE TABLE IF NOT EXISTS stun_sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS turn_allocations (
        relay_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
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
  async saveSTUNSession(id, session) {
    await this.init();
    const data = JSON.stringify(session);
    const expires_at = session.expires_at || Date.now() + 5 * 60 * 1e3;
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO stun_sessions (id, data, expires_at) VALUES (?, ?, ?)`,
      id,
      data,
      expires_at
    );
  }
  async getSTUNSession(id) {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM stun_sessions WHERE id = ?`,
      id
    )];
    if (rows.length === 0)
      return null;
    const row = rows[0];
    if (Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec(`DELETE FROM stun_sessions WHERE id = ?`, id);
      return null;
    }
    return JSON.parse(row.data);
  }
  async saveAllocation(relayID, alloc) {
    await this.init();
    const data = JSON.stringify(alloc);
    const expires_at = alloc.expires_at || Date.now() + 10 * 60 * 1e3;
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO turn_allocations (relay_id, data, expires_at) VALUES (?, ?, ?)`,
      relayID,
      data,
      expires_at
    );
  }
  async getAllocation(relayID) {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM turn_allocations WHERE relay_id = ?`,
      relayID
    )];
    if (rows.length === 0)
      return null;
    const row = rows[0];
    if (Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec(`DELETE FROM turn_allocations WHERE relay_id = ?`, relayID);
      return null;
    }
    return JSON.parse(row.data);
  }
  async deleteAllocation(relayID) {
    await this.init();
    this.ctx.storage.sql.exec(`DELETE FROM turn_allocations WHERE relay_id = ?`, relayID);
  }
  async saveStream(streamID, stream) {
    await this.init();
    const data = JSON.stringify(stream);
    const expires_at = stream.expires_at || Date.now() + 5 * 60 * 1e3;
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO streams (stream_id, data, expires_at) VALUES (?, ?, ?)`,
      streamID,
      data,
      expires_at
    );
  }
  async getStream(streamID) {
    await this.init();
    const rows = [...this.ctx.storage.sql.exec(
      `SELECT data, expires_at FROM streams WHERE stream_id = ?`,
      streamID
    )];
    if (rows.length === 0)
      return null;
    const row = rows[0];
    if (Date.now() > row.expires_at) {
      this.ctx.storage.sql.exec(`DELETE FROM streams WHERE stream_id = ?`, streamID);
      return null;
    }
    return JSON.parse(row.data);
  }
  async deleteStream(streamID) {
    await this.init();
    this.ctx.storage.sql.exec(`DELETE FROM streams WHERE stream_id = ?`, streamID);
  }
  // Cleanup expired entries (called by cron trigger)
  async cleanupExpired() {
    await this.init();
    const now = Date.now();
    let deleted = 0;
    const stunResult = this.ctx.storage.sql.exec(
      `DELETE FROM stun_sessions WHERE expires_at < ?`,
      now
    );
    deleted += stunResult.count || 0;
    const turnResult = this.ctx.storage.sql.exec(
      `DELETE FROM turn_allocations WHERE expires_at < ?`,
      now
    );
    deleted += turnResult.count || 0;
    const streamResult = this.ctx.storage.sql.exec(
      `DELETE FROM streams WHERE expires_at < ?`,
      now
    );
    deleted += streamResult.count || 0;
    return deleted;
  }
  // Alarm handler for periodic cleanup (alternative to cron)
  async alarm() {
    await this.cleanupExpired();
  }
};
__name(HturnalDurableObject, "HturnalDurableObject");

// src/storage.ts
var MemoryStorage = class {
  stunSessions = /* @__PURE__ */ new Map();
  turnAllocations = /* @__PURE__ */ new Map();
  streams = /* @__PURE__ */ new Map();
  saveSTUNSession(id, session) {
    this.stunSessions.set(id, session);
  }
  getSTUNSession(id) {
    return this.stunSessions.get(id) || null;
  }
  saveAllocation(relayID, alloc) {
    this.turnAllocations.set(relayID, alloc);
  }
  getAllocation(relayID) {
    return this.turnAllocations.get(relayID) || null;
  }
  deleteAllocation(relayID) {
    this.turnAllocations.delete(relayID);
  }
  saveStream(streamID, stream) {
    this.streams.set(streamID, stream);
  }
  getStream(streamID) {
    return this.streams.get(streamID) || null;
  }
  deleteStream(streamID) {
    this.streams.delete(streamID);
  }
  cleanupExpired() {
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
};
__name(MemoryStorage, "MemoryStorage");
var DurableObjectStorage = class {
  stub;
  constructor(env) {
    const id = env.HTURNAL_DO.idFromName("hturnal-storage");
    this.stub = env.HTURNAL_DO.get(id);
  }
  async saveSTUNSession(id, session) {
    await this.stub.saveSTUNSession(id, session);
  }
  async getSTUNSession(id) {
    return await this.stub.getSTUNSession(id);
  }
  async saveAllocation(relayID, alloc) {
    await this.stub.saveAllocation(relayID, alloc);
  }
  async getAllocation(relayID) {
    return await this.stub.getAllocation(relayID);
  }
  async deleteAllocation(relayID) {
    await this.stub.deleteAllocation(relayID);
  }
  async saveStream(streamID, stream) {
    await this.stub.saveStream(streamID, stream);
  }
  async getStream(streamID) {
    return await this.stub.getStream(streamID);
  }
  async deleteStream(streamID) {
    await this.stub.deleteStream(streamID);
  }
  async cleanupExpired() {
    return await this.stub.cleanupExpired();
  }
};
__name(DurableObjectStorage, "DurableObjectStorage");
function createStorage(env) {
  const backend = env.STORAGE_BACKEND || "memory";
  if (backend === "durable_object" && env.HTURNAL_DO) {
    return new DurableObjectStorage(env);
  }
  return new MemoryStorage();
}
__name(createStorage, "createStorage");

// src/utils.ts
function generateID(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateID, "generateID");
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}
__name(getClientIP, "getClientIP");
function getClientPort(request) {
  return request.headers.get("CF-Connecting-Port") || "0";
}
__name(getClientPort, "getClientPort");

// src/stun.ts
async function handleSTUNBinding(request, storage) {
  const req = await request.json();
  const clientIP = getClientIP(request);
  const port = getClientPort(request);
  const addr = `${clientIP}:${port}`;
  const session = {
    client_id: req.client_id,
    public_ip: clientIP,
    public_port: 0,
    expires_at: Date.now() + 5 * 60 * 1e3
  };
  storage.saveSTUNSession(req.client_id, session);
  const resp = {
    mapped_address: addr,
    xored: false,
    source: "http-stun"
  };
  console.log(`POST /stun/binding ${Date.now()}`);
  return new Response(JSON.stringify(resp), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleSTUNBinding, "handleSTUNBinding");
async function handleNATCheck(request, storage) {
  const req = await request.json();
  const clientIP = getClientIP(request);
  const resp = {
    nat_type: "Unknown (single IP)",
    public_ip: clientIP,
    details: { note: "Full NAT detection requires multi-IP server" }
  };
  return new Response(JSON.stringify(resp), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleNATCheck, "handleNATCheck");

// src/turn.ts
async function handleTURNAllocate(request, storage) {
  const req = await request.json();
  const relayID = generateID("relay");
  const alloc = {
    relay_id: relayID,
    client_id: req.client_id,
    permissions: {},
    pending_data: {},
    lifetime: 10 * 60 * 1e3,
    expires_at: Date.now() + 10 * 60 * 1e3
  };
  storage.saveAllocation(relayID, alloc);
  const resp = {
    relay_id: relayID,
    relay_address: new URL(request.url).host,
    lifetime: 10 * 60
  };
  return new Response(JSON.stringify(resp), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNAllocate, "handleTURNAllocate");
async function handleTURNPermission(request, storage) {
  const req = await request.json();
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc)
    return new Response(JSON.stringify({ error: "Relay not found" }), { status: 404 });
  alloc.permissions[req.peer_id] = Date.now() + 10 * 60 * 1e3;
  storage.saveAllocation(req.relay_id, alloc);
  return new Response(JSON.stringify({ status: "permission granted", peer_id: req.peer_id }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNPermission, "handleTURNPermission");
async function handleTURNSend(request, storage) {
  const req = await request.json();
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc)
    return new Response(JSON.stringify({ error: "Relay not found" }), { status: 404 });
  const permExpiry = alloc.permissions[req.peer_id];
  if (!permExpiry || Date.now() > permExpiry) {
    delete alloc.permissions[req.peer_id];
    storage.saveAllocation(req.relay_id, alloc);
    return new Response(JSON.stringify({ error: "No permission or permission expired" }), { status: 403 });
  }
  const msg = {
    from: alloc.client_id,
    data: req.data,
    timestamp: Date.now()
  };
  if (!alloc.pending_data[req.peer_id])
    alloc.pending_data[req.peer_id] = [];
  alloc.pending_data[req.peer_id].push(msg);
  storage.saveAllocation(req.relay_id, alloc);
  return new Response(JSON.stringify({ status: "sent" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNSend, "handleTURNSend");
async function handleTURNReceive(request, storage) {
  const url = new URL(request.url);
  const relayID = url.searchParams.get("relay_id") || "";
  const timeout = Math.min(parseInt(url.searchParams.get("timeout") || "30"), 10) * 1e3;
  const alloc = storage.getAllocation(relayID);
  if (!alloc)
    return new Response(JSON.stringify({ error: "Relay not found" }), { status: 404 });
  const deadline = Date.now() + timeout;
  const clientID = alloc.client_id;
  while (Date.now() < deadline) {
    const messages = alloc.pending_data[clientID];
    if (messages && messages.length > 0) {
      const respMessages = messages.map((msg) => ({
        from: msg.from,
        data: msg.data,
        timestamp: msg.timestamp
      }));
      alloc.pending_data[clientID] = [];
      storage.saveAllocation(relayID, alloc);
      return new Response(JSON.stringify({ messages: respMessages }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return new Response(JSON.stringify({ messages: [] }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNReceive, "handleTURNReceive");
async function handleTURNRefresh(request, storage) {
  const req = await request.json();
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc)
    return new Response(JSON.stringify({ error: "Relay not found" }), { status: 404 });
  const lifetime = (req.lifetime || 10 * 60) * 1e3;
  alloc.lifetime = lifetime;
  alloc.expires_at = Date.now() + lifetime;
  storage.saveAllocation(req.relay_id, alloc);
  return new Response(JSON.stringify({ status: "refreshed", lifetime: lifetime / 1e3 }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNRefresh, "handleTURNRefresh");
async function handleTURNDeallocate(request, storage) {
  const req = await request.json();
  const alloc = storage.getAllocation(req.relay_id);
  if (!alloc)
    return new Response(JSON.stringify({ error: "Relay not found" }), { status: 404 });
  storage.deleteAllocation(req.relay_id);
  return new Response(JSON.stringify({ status: "deallocated" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleTURNDeallocate, "handleTURNDeallocate");
async function handleStreamStart(request, storage) {
  const req = await request.json();
  const streamID = generateID("stream");
  const stream = {
    stream_id: streamID,
    relay_id: req.relay_id,
    peer_id: req.peer_id,
    chunks: {},
    max_seq: -1,
    expires_at: Date.now() + 5 * 60 * 1e3
  };
  storage.saveStream(streamID, stream);
  return new Response(JSON.stringify({
    stream_id: streamID,
    chunk_size: 16384,
    ttl: 5 * 60
  }), { headers: { "Content-Type": "application/json" } });
}
__name(handleStreamStart, "handleStreamStart");
async function handleStreamSend(request, storage) {
  const req = await request.json();
  const stream = storage.getStream(req.stream_id);
  if (!stream)
    return new Response(JSON.stringify({ error: "Stream not found" }), { status: 404 });
  stream.chunks[req.chunk_seq] = req.data;
  if (req.chunk_seq > stream.max_seq)
    stream.max_seq = req.chunk_seq;
  storage.saveStream(req.stream_id, stream);
  return new Response(JSON.stringify({
    status: "chunk received",
    next_seq: req.chunk_seq + 1
  }), { headers: { "Content-Type": "application/json" } });
}
__name(handleStreamSend, "handleStreamSend");
async function handleStreamReceive(request, storage) {
  const url = new URL(request.url);
  const streamID = url.searchParams.get("stream_id") || "";
  const timeout = Math.min(parseInt(url.searchParams.get("timeout") || "30"), 10) * 1e3;
  const stream = storage.getStream(streamID);
  if (!stream)
    return new Response(JSON.stringify({ error: "Stream not found" }), { status: 404 });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const chunkCount = Object.keys(stream.chunks).length;
    if (chunkCount > 0) {
      const chunks = Object.entries(stream.chunks).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([seq, data]) => ({
        seq: parseInt(seq),
        data
      }));
      stream.chunks = {};
      storage.saveStream(streamID, stream);
      return new Response(JSON.stringify({
        chunks,
        stream_complete: false
      }), { headers: { "Content-Type": "application/json" } });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return new Response(JSON.stringify({
    chunks: [],
    stream_complete: false
  }), { headers: { "Content-Type": "application/json" } });
}
__name(handleStreamReceive, "handleStreamReceive");
async function handleStreamEnd(request, storage) {
  const req = await request.json();
  const stream = storage.getStream(req.stream_id);
  if (!stream)
    return new Response(JSON.stringify({ error: "Stream not found" }), { status: 404 });
  storage.deleteStream(req.stream_id);
  return new Response(JSON.stringify({ status: "stream ended" }), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleStreamEnd, "handleStreamEnd");

// src/discovery.ts
function handleDiscovery(request) {
  const host = new URL(request.url).host;
  const resp = {
    stun_servers: [{
      type: "http",
      url: `http://${host}/stun/binding`,
      nat_check_url: `http://${host}/stun/nat-check`
    }],
    turn_servers: [{
      type: "http",
      allocate_url: `http://${host}/turn/allocate`,
      send_url: `http://${host}/turn/send`,
      receive_url: `http://${host}/turn/receive`
    }],
    http_only: true
  };
  return new Response(JSON.stringify(resp), {
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleDiscovery, "handleDiscovery");

// src/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function withCORS(response) {
  const newResp = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResp.headers.set(key, value);
  });
  return newResp;
}
__name(withCORS, "withCORS");
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const storage = createStorage(env);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 200 });
    }
    try {
      if (path === "/stun/binding" && request.method === "POST") {
        return withCORS(await handleSTUNBinding(request, storage));
      }
      if (path === "/stun/nat-check" && request.method === "POST") {
        return withCORS(await handleNATCheck(request, storage));
      }
      if (path === "/turn/allocate" && request.method === "POST") {
        return withCORS(await handleTURNAllocate(request, storage));
      }
      if (path === "/turn/permission" && request.method === "POST") {
        return withCORS(await handleTURNPermission(request, storage));
      }
      if (path === "/turn/send" && request.method === "POST") {
        return withCORS(await handleTURNSend(request, storage));
      }
      if (path === "/turn/receive" && request.method === "GET") {
        return withCORS(await handleTURNReceive(request, storage));
      }
      if (path === "/turn/refresh" && request.method === "POST") {
        return withCORS(await handleTURNRefresh(request, storage));
      }
      if (path === "/turn/deallocate" && request.method === "POST") {
        return withCORS(await handleTURNDeallocate(request, storage));
      }
      if (path === "/turn/stream/start" && request.method === "POST") {
        return withCORS(await handleStreamStart(request, storage));
      }
      if (path === "/turn/stream/send" && request.method === "POST") {
        return withCORS(await handleStreamSend(request, storage));
      }
      if (path === "/turn/stream/receive" && request.method === "GET") {
        return withCORS(await handleStreamReceive(request, storage));
      }
      if (path === "/turn/stream/end" && request.method === "POST") {
        return withCORS(await handleStreamEnd(request, storage));
      }
      if (path === "/discovery/servers" && request.method === "GET") {
        return withCORS(handleDiscovery(request));
      }
      return withCORS(new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }));
    } catch (error) {
      console.error("Error:", error);
      return withCORS(new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
    }
  },
  async scheduled(event, env, ctx) {
    console.log("Running scheduled cleanup...");
    const storage = createStorage(env);
    if (storage.cleanupExpired) {
      const deleted = await storage.cleanupExpired();
      console.log(`Cleaned up ${deleted} expired entries`);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-SeHWTG/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-SeHWTG/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  HturnalDurableObject,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
