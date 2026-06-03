export interface RequestItem {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  url: string;
  headers: HeaderParamPair[];
  params: HeaderParamPair[];
  bodyType: "none" | "json" | "text" | "form-data";
  body: string;
}

export interface HeaderParamPair {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Collection {
  id: string;
  name: string;
  requests: RequestItem[];
}

export type ProjectRole = "owner" | "editor" | "viewer";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface ProjectMember extends UserProfile {
  role: ProjectRole;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  ownerId: string;
  members: ProjectMember[];
  collections: Collection[];
  environments: Environment[];
  activeEnvId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  responseTimeMs: number;
  success: boolean;
  requestDetails: RequestItem; // Storing snapshot of the request
}

export interface ResponseState {
  success: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTimeMs: number;
  size: number;
  error?: string;
}
