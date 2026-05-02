// ==================== STUN 类型 ====================
export interface STUNBindingRequest {
  client_id: string;
}

export interface STUNBindingResponse {
  mapped_address: string;
  xored: boolean;
  source: string;
}

export interface STUNNATCheckRequest {
  client_id: string;
  test_sequence: string;
}

export interface STUNNATCheckResponse {
  nat_type: string;
  public_ip: string;
  details: Record<string, any>;
}

// ==================== TURN 类型 ====================
export interface TURNAllocateRequest {
  client_id: string;
  username?: string;
  password?: string;
}

export interface TURNAllocateResponse {
  relay_id: string;
  relay_address: string;
  lifetime: number;
}

export interface TURNSendRequest {
  relay_id: string;
  peer_id: string;
  data: string; // base64
  ttl?: number;
}

export interface TURNMessage {
  from: string;
  data: string; // base64
  timestamp: number; // Unix 毫秒
}

export interface TURNReceiveResponse {
  messages: TURNMessage[];
}

export interface TURNPermissionRequest {
  relay_id: string;
  peer_id: string;
}

export interface TURNRefreshRequest {
  relay_id: string;
  lifetime?: number;
}

export interface TURNDeallocateRequest {
  relay_id: string;
}

// ==================== Stream 类型 ====================
export interface StreamStartRequest {
  client_id: string;
  peer_id: string;
  relay_id?: string;
}

export interface StreamStartResponse {
  stream_id: string;
  chunk_size: number;
  ttl: number;
}

export interface StreamChunk {
  stream_id: string;
  chunk_seq: number;
  data: string; // base64
  hash?: string;
}

export interface StreamReceiveResponse {
  chunks: StreamChunk[];
  stream_complete: boolean;
}

export interface StreamEndRequest {
  stream_id: string;
}
