import { HturnalDurableObject } from './durable_object';
import { createStorage, IStorage } from './storage';
import { handleSTUNBinding, handleNATCheck } from './stun';
import {
  handleTURNAllocate, handleTURNSend, handleTURNReceive,
  handleTURNPermission, handleTURNRefresh, handleTURNDeallocate
} from './turn';
import { handleStreamStart, handleStreamSend, handleStreamReceive, handleStreamEnd } from './turn';
import { handleDiscovery } from './discovery';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function withCORS(response: Response): Response {
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

export { HturnalDurableObject };

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const storage: IStorage = createStorage(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 200 });
    }

    try {
      if (path === '/stun/binding' && request.method === 'POST') {
        return withCORS(await handleSTUNBinding(request, storage));
      }
      if (path === '/stun/nat-check' && request.method === 'POST') {
        return withCORS(await handleNATCheck(request, storage));
      }
      if (path === '/turn/allocate' && request.method === 'POST') {
        return withCORS(await handleTURNAllocate(request, storage));
      }
      if (path === '/turn/permission' && request.method === 'POST') {
        return withCORS(await handleTURNPermission(request, storage));
      }
      if (path === '/turn/send' && request.method === 'POST') {
        return withCORS(await handleTURNSend(request, storage));
      }
      if (path === '/turn/receive' && request.method === 'GET') {
        return withCORS(await handleTURNReceive(request, storage));
      }
      if (path === '/turn/refresh' && request.method === 'POST') {
        return withCORS(await handleTURNRefresh(request, storage));
      }
      if (path === '/turn/deallocate' && request.method === 'POST') {
        return withCORS(await handleTURNDeallocate(request, storage));
      }
      if (path === '/turn/stream/start' && request.method === 'POST') {
        return withCORS(await handleStreamStart(request, storage));
      }
      if (path === '/turn/stream/send' && request.method === 'POST') {
        return withCORS(await handleStreamSend(request, storage));
      }
      if (path === '/turn/stream/receive' && request.method === 'GET') {
        return withCORS(await handleStreamReceive(request, storage));
      }
      if (path === '/turn/stream/end' && request.method === 'POST') {
        return withCORS(await handleStreamEnd(request, storage));
      }
      if (path === '/discovery/servers' && request.method === 'GET') {
        return withCORS(handleDiscovery(request));
      }

      return withCORS(new Response(JSON.stringify({error: 'Not found'}), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (error) {
      console.error('Error:', error);
      return withCORS(new Response(JSON.stringify({error: 'Internal server error'}), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  },

  async scheduled(event: any, env: any, ctx: any) {
    console.log('Running scheduled cleanup...');
    const storage: IStorage = createStorage(env);
    if (storage.cleanupExpired) {
      const deleted = await storage.cleanupExpired();
      console.log(`Cleaned up ${deleted} expired entries`);
    }
  }
};
