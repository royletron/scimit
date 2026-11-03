export interface User {
  id: string;
  userName: string;
  emailPrimary: string;
  active: boolean;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  rawData: any;
}

export interface Group {
  id: string;
  displayName: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  members: GroupMember[];
  rawData: any;
}

export interface GroupMember {
  memberId: string;
  memberType: string;
  displayName?: string;
}

export interface RequestLog {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  headers: Record<string, any>;
  query_params: Record<string, any>;
  request_body?: any;
  response_body?: any;
  response_headers: Record<string, any>;
  duration_ms: number;
  ip_address?: string;
  user_agent?: string;
  direction?: 'inbound' | 'outbound';
  target_id?: number | null;
  user_id?: string | null;
  group_id?: string | null;
  /** Client-only: arrived over the live stream while the page was open */
  _live?: boolean;
}

export interface PlaybackTarget {
  id: number;
  name: string;
  url: string;
  token?: string;
  created_at: string;
}

export interface PlaybackIdMapping {
  id: number;
  target_id: number;
  scimit_id: string;
  target_id_value: string;
  entity_type: string;
  created_at: string;
  version?: string | null;
}

export interface SyncResult {
  entityType: 'User' | 'Group';
  id: string;
  name: string;
  status: number;
  action: 'create' | 'update' | 'delete' | 'unchanged';
  warnings: string[];
}
