import React from 'react';

export type UserProfile = {
  nickname: string;
  email: string;
  role: string;
  uid: number;
  hwid: string | null;
  till: number | null;
  ram: string | null;
};

export type MarketItem = {
  productId: number;
  productName: string;
  productPrice: number;
  productOldPrice: number | null;
  productDir: string | null;
};

export type PublicInfo = {
  totalUsers: number;
};

export type AuthResponse = {
  status: string;
  token: string;
  session: string;
  email: string;
  role: string;
};

export type RegisterResponse = {
  status: string;
};

export type KeyGenerateResponse = {
  status: boolean;
  key: string;
};

export type KeyActivateResponse = {
  status: string;
  message: string;
};

export type VersionResponse = {
  version: string;
};

export type MarketResponse = {
  items: MarketItem[];
};

export type ErrorResponse = {
  error: string;
  status?: number;
};

export type SexyGuardClientOptions = {
  baseUrl?: string;
  getToken?: () => string | null | undefined;
  setToken?: (token: string | null) => void;
  tokenStorageKey?: string;
  tokenStorage?: TokenStorage;
};

export type TokenStorage = {
  get: () => string | null | undefined;
  set: (token: string | null) => void;
  clear: () => void;
};

export type TokenStorageFactoryOptions = {
  type?: 'localStorage' | 'cookie' | 'memory';
  key?: string;
  cookie?: { path?: string; maxAge?: number };
};

export function createTokenStorage(opts?: TokenStorageFactoryOptions): TokenStorage;

export class SexyGuardError extends Error {
  status: number | null;
  data: any;
  constructor(message: string, status?: number | null, data?: any);
}

export function normalizeError(err: any): SexyGuardError;

export class SexyGuardClient {
  constructor(options?: SexyGuardClientOptions);
  getToken(): string | null | undefined;
  setToken(token: string | null): void;
  request(path: string, options?: { method?: string; body?: any; auth?: boolean }): Promise<any>;
  requestCached(key: string, fn: () => Promise<any>, ttlMs?: number): Promise<any>;

  login(login: string, password: string): Promise<AuthResponse | ErrorResponse>;
  register(login: string, email: string, password: string): Promise<RegisterResponse | ErrorResponse>;

  getProfile(): Promise<UserProfile | ErrorResponse>;
  changePassword(password: string): Promise<{ status: string; message: string } | ErrorResponse>;
  setMemory(memory: string | number): Promise<{ status: string; message: string } | ErrorResponse>;

  generateKey(params: { plus_subday: number; value_of_activate: number; delete_time: string }): Promise<KeyGenerateResponse | ErrorResponse>;
  activateKey(key: string): Promise<KeyActivateResponse | ErrorResponse>;

  getInfo(): Promise<PublicInfo | ErrorResponse>;
  getMarket(): Promise<MarketResponse | ErrorResponse>;
  getVersion(): Promise<VersionResponse | ErrorResponse>;
  health(): Promise<any>;
}

export type SupabaseProviderProps = {
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseOptions?: any;
  supabaseClient?: any;
};

export function createSupabaseClient(params: { supabaseUrl: string; supabaseKey: string; options?: any }): Promise<any>;

export function SexyGuardProvider(props: {
  baseUrl?: string;
  client?: SexyGuardClient;
  tokenStorageKey?: string;
  tokenStorage?: TokenStorage;
  supabaseUrl?: string;
  supabaseKey?: string;
  supabaseOptions?: any;
  supabaseClient?: any;
  children: React.ReactNode;
}): JSX.Element;

export function useSexyGuard(): {
  client: SexyGuardClient;
  token: string | null;
  setToken: (t: string | null) => void;
  supabase: any;
  supabaseReady: boolean;
  supabaseError: any;
};

export function useAuth(): {
  token: string | null;
  login: (login: string, password: string) => Promise<AuthResponse | ErrorResponse>;
  register: (login: string, email: string, password: string) => Promise<RegisterResponse | ErrorResponse>;
  logout: () => void;
};

export function useSupabaseAuth(autoLoad?: boolean): {
  supabase: any;
  supabaseReady: boolean;
  supabaseError: any;
  session: any;
  user: any;
  loading: boolean;
  error: any;
  refresh: () => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, options?: any) => Promise<any>;
  signOut: () => Promise<any>;
};

export function useSupabaseTable(table: string, options?: {
  select?: string;
  autoLoad?: boolean;
  filters?: { op: string; column: string; value: any }[];
  query?: (builder: any) => any;
  schema?: string;
  single?: boolean;
}): {
  data: any;
  loading: boolean;
  error: any;
  refresh: () => Promise<any>;
  insert: (payload: any) => Promise<any>;
  update: (payload: any, match?: Record<string, any>) => Promise<any>;
  remove: (match?: Record<string, any>) => Promise<any>;
};

export function useSupabaseRealtime(table: string, options?: {
  event?: string;
  schema?: string;
  filter?: string;
  enabled?: boolean;
  onEvent?: (payload: any) => void;
}): void;

export function useProfile(autoLoad?: boolean): {
  profile: UserProfile | ErrorResponse | null;
  loading: boolean;
  error: any;
  refresh: () => Promise<UserProfile | ErrorResponse | null>;
  changePassword: (password: string) => Promise<{ status: string; message: string } | ErrorResponse>;
  setMemory: (memory: string | number) => Promise<{ status: string; message: string } | ErrorResponse>;
};

export function useMarket(autoLoad?: boolean): {
  items: MarketItem[];
  loading: boolean;
  error: any;
  refresh: () => Promise<MarketResponse | ErrorResponse>;
};

export function useStats(autoLoad?: boolean): {
  info: PublicInfo | ErrorResponse | null;
  loading: boolean;
  error: any;
  refresh: () => Promise<PublicInfo | ErrorResponse | null>;
};

export function useVersion(autoLoad?: boolean): {
  version: string | null;
  loading: boolean;
  error: any;
  refresh: () => Promise<VersionResponse | ErrorResponse | null>;
};
