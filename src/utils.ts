// 生成唯一 ID（对应 Go 的 generateID）
export function generateID(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取客户端 IP（Worker 中用 CF-Connecting-IP 头）
export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || '0.0.0.0';
}

// 获取客户端端口（模拟，Worker 无直接端口信息）
export function getClientPort(request: Request): string {
  return request.headers.get('CF-Connecting-Port') || '0';
}
