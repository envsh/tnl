export function handleDiscovery(request: Request): Response {
  const host = new URL(request.url).host;
  const resp = {
    stun_servers: [{
      type: 'http',
      url: `http://${host}/stun/binding`,
      nat_check_url: `http://${host}/stun/nat-check`
    }],
    turn_servers: [{
      type: 'http',
      allocate_url: `http://${host}/turn/allocate`,
      send_url: `http://${host}/turn/send`,
      receive_url: `http://${host}/turn/receive`
    }],
    http_only: true
  };

  return new Response(JSON.stringify(resp), {
    headers: { 'Content-Type': 'application/json' }
  });
}
