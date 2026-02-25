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
}
