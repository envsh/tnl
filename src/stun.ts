import { IStorage } from './storage';
import { getClientIP, getClientPort } from './utils';

// STUN Binding handler
export async function handleSTUNBinding(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const clientIP = getClientIP(request);
  const port = getClientPort(request);
  const addr = `${clientIP}:${port}`;

  const session = {
    client_id: req.client_id,
    public_ip: clientIP,
    public_port: 0,
    expires_at: Date.now() + 5 * 60 * 1000
  };
  storage.saveSTUNSession(req.client_id, session);

  const resp = {
    mapped_address: addr,
    xored: false,
    source: 'http-stun'
  };

  console.log(`POST /stun/binding ${Date.now()}`);
  return new Response(JSON.stringify(resp), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// STUN NAT Check handler（简化版，单 IP）
export async function handleNATCheck(request: Request, storage: IStorage): Promise<Response> {
  const req = await request.json() as any;
  const clientIP = getClientIP(request);

  const resp = {
    nat_type: 'Unknown (single IP)',
    public_ip: clientIP,
    details: { note: 'Full NAT detection requires multi-IP server' }
  };

  return new Response(JSON.stringify(resp), {
    headers: { 'Content-Type': 'application/json' }
  });
}
