/* SexyGuard React SDK */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';

/**
 * @typedef {Object} UserProfile
 * @property {string} nickname
 * @property {string} email
 * @property {string} role
 * @property {number} uid
 * @property {string|null} hwid
 * @property {number|null} till
 * @property {string|null} ram
 */

/**
 * @typedef {Object} MarketItem
 * @property {number} productId
 * @property {string} productName
 * @property {number} productPrice
 * @property {number|null} productOldPrice
 * @property {string|null} productDir
 */

/**
 * @typedef {Object} PublicInfo
 * @property {number} totalUsers
 */

/**
 * @typedef {Object} AuthResponse
 * @property {string} status
 * @property {string} token
 * @property {string} session
 * @property {string} email
 * @property {string} role
 */

/**
 * @typedef {Object} RegisterResponse
 * @property {string} status
 */

/**
 * @typedef {Object} KeyGenerateResponse
 * @property {boolean} status
 * @property {string} key
 */

/**
 * @typedef {Object} KeyActivateResponse
 * @property {string} status
 * @property {string} message
 */

/**
 * @typedef {Object} VersionResponse
 * @property {string} version
 */

/**
 * @typedef {Object} MarketResponse
 * @property {MarketItem[]} items
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {string} error
 * @property {number} [status]
 */

/**
 * Typed SDK error.
 */
export class SexyGuardError extends Error {
  /**
   * @param {string} message
   * @param {number|null} [status]
   * @param {any} [data]
   */
  constructor(message, status = null, data = null) {
    super(message);
    this.name = 'SexyGuardError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Normalize any error shape into SexyGuardError.
 * @param {any} err
 * @returns {SexyGuardError}
 */
export function normalizeError(err) {
  if (!err) return new SexyGuardError('Unknown error');
  if (err instanceof SexyGuardError) return err;
  if (typeof err === 'string') return new SexyGuardError(err);
  if (err?.error) return new SexyGuardError(err.error, err.status, err);
  if (err?.message) return new SexyGuardError(err.message, err.status || null, err);
  return new SexyGuardError('Unknown error');
}

/**
 * Create token storage (localStorage / cookie / memory).
 * @param {Object} [opts]
 * @param {'localStorage'|'cookie'|'memory'} [opts.type]
 * @param {string} [opts.key]
 * @param {{path?: string, maxAge?: number}} [opts.cookie]
 * @returns {{get: Function, set: Function, clear: Function}}
 */
export function createTokenStorage({
  type = 'localStorage',
  key = 'sexyguard_token',
  cookie = { path: '/', maxAge: 60 * 60 * 24 * 30 }
} = {}) {
  const memory = { value: null };

  const cookieGet = () => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  };
  const cookieSet = (val) => {
    if (typeof document === 'undefined') return;
    const maxAge = cookie?.maxAge ? `; max-age=${cookie.maxAge}` : '';
    const path = cookie?.path ? `; path=${cookie.path}` : '; path=/';
    document.cookie = `${key}=${encodeURIComponent(val || '')}${maxAge}${path}`;
  };
  const cookieClear = () => {
    if (typeof document === 'undefined') return;
    document.cookie = `${key}=; max-age=0; path=/`;
  };

  if (type === 'cookie') {
    return {
      get: cookieGet,
      set: cookieSet,
      clear: cookieClear
    };
  }

  if (type === 'memory') {
    return {
      get: () => memory.value,
      set: (v) => { memory.value = v; },
      clear: () => { memory.value = null; }
    };
  }

  return {
    get: () => {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    },
    set: (v) => {
      if (typeof window === 'undefined') return;
      if (v) window.localStorage.setItem(key, v);
      else window.localStorage.removeItem(key);
    },
    clear: () => {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(key);
    }
  };
}

/**
 * REST client for js-backend.
 */
export class SexyGuardClient {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.baseUrl]
   * @param {Function} [opts.getToken]
   * @param {Function} [opts.setToken]
   * @param {string} [opts.tokenStorageKey]
   * @param {ReturnType<typeof createTokenStorage>} [opts.tokenStorage]
   */
  constructor({ baseUrl, getToken, setToken, tokenStorageKey = 'sexyguard_token', tokenStorage } = {}) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.tokenStorageKey = tokenStorageKey;
    this.storage = tokenStorage || createTokenStorage({ type: 'localStorage', key: tokenStorageKey });
    this._getToken = getToken || (() => this.storage.get());
    this._setToken = setToken || ((token) => {
      if (token) this.storage.set(token);
      else this.storage.clear();
    });
    this.cache = new Map();
  }

  /** @returns {string|null|undefined} */
  getToken() { return this._getToken(); }

  /** @param {string|null} token */
  setToken(token) { this._setToken(token); }

  /**
   * @param {string} key
   * @returns {any|null}
   */
  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs]
   * @returns {any}
   */
  setCached(key, value, ttlMs = 30000) {
    this.cache.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : null });
    return value;
  }

  /**
   * @param {string} path
   * @param {{method?: string, body?: any, auth?: boolean}} [options]
   * @returns {Promise<any|ErrorResponse>}
   */
  async request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = this.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || 'Request failed', status: res.status, ...data };
    }
    return data;
  }

  /**
   * @param {string} key
   * @param {Function} fn
   * @param {number} [ttlMs]
   * @returns {Promise<any>}
   */
  async requestCached(key, fn, ttlMs = 30000) {
    const cached = this.getCached(key);
    if (cached) return cached;
    const result = await fn();
    return this.setCached(key, result, ttlMs);
  }

  /** @returns {Promise<AuthResponse|ErrorResponse>} */
  login(login, password) {
    return this.request('/api/v1/auth/login', { method: 'POST', body: { login, password } });
  }

  /** @returns {Promise<RegisterResponse|ErrorResponse>} */
  register(login, email, password) {
    return this.request('/api/v1/auth/register', { method: 'POST', body: { login, email, password } });
  }

  /** @returns {Promise<UserProfile|ErrorResponse>} */
  getProfile() { return this.request('/api/v1/profile/me', { auth: true }); }

  /** @returns {Promise<{status: string, message: string}|ErrorResponse>} */
  changePassword(password) { return this.request('/api/v1/profile/password', { method: 'POST', auth: true, body: { password } }); }

  /** @returns {Promise<{status: string, message: string}|ErrorResponse>} */
  setMemory(memory) { return this.request('/api/v1/profile/ram', { method: 'POST', auth: true, body: { memory } }); }

  /** @returns {Promise<KeyGenerateResponse|ErrorResponse>} */
  generateKey({ plus_subday, value_of_activate, delete_time }) {
    return this.request('/api/v1/keys/generate', { method: 'POST', auth: true, body: { plus_subday, value_of_activate, delete_time } });
  }

  /** @returns {Promise<KeyActivateResponse|ErrorResponse>} */
  activateKey(key) { return this.request('/api/v1/keys/activate', { method: 'POST', auth: true, body: { key } }); }

  /** @returns {Promise<PublicInfo|ErrorResponse>} */
  getInfo() { return this.request('/api/v1/public/info'); }

  /** @returns {Promise<MarketResponse|ErrorResponse>} */
  getMarket() { return this.request('/api/v1/public/market'); }

  /** @returns {Promise<VersionResponse|ErrorResponse>} */
  getVersion() { return this.request('/api/v1/public/version'); }

  /** @returns {Promise<any>} */
  health() { return this.request('/health'); }
}

/**
 * Lazy create Supabase client.
 * @param {{supabaseUrl: string, supabaseKey: string, options?: any}} params
 * @returns {Promise<any>}
 */
export async function createSupabaseClient({ supabaseUrl, supabaseKey, options } = {}) {
  if (!supabaseUrl || !supabaseKey) throw new Error('supabaseUrl and supabaseKey are required');
  const mod = await import('@supabase/supabase-js');
  return mod.createClient(supabaseUrl, supabaseKey, options);
}

const SexyGuardContext = createContext(null);

/**
 * Main provider for REST + Supabase.
 */
export function SexyGuardProvider({
  baseUrl,
  client,
  tokenStorageKey = 'sexyguard_token',
  tokenStorage,
  supabaseUrl,
  supabaseKey,
  supabaseOptions,
  supabaseClient,
  children
}) {
  const storage = useMemo(() => tokenStorage || createTokenStorage({ key: tokenStorageKey }), [tokenStorage, tokenStorageKey]);

  const [token, setToken] = useState(() => {
    return storage.get();
  });

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const apiClient = useMemo(() => {
    if (client) return client;
    return new SexyGuardClient({
      baseUrl,
      tokenStorageKey,
      tokenStorage: storage,
      getToken: () => tokenRef.current,
      setToken: (t) => {
        setToken(t || null);
        if (t) storage.set(t);
        else storage.clear();
      }
    });
  }, [baseUrl, client, tokenStorageKey, storage]);

  const [supabase, setSupabase] = useState(supabaseClient || null);
  const [supabaseError, setSupabaseError] = useState(null);
  const [supabaseReady, setSupabaseReady] = useState(Boolean(supabaseClient));

  useEffect(() => {
    if (supabaseClient) {
      setSupabase(supabaseClient);
      setSupabaseReady(true);
      return;
    }
    if (!supabaseUrl || !supabaseKey) return;

    let active = true;
    import('@supabase/supabase-js')
      .then(({ createClient }) => {
        if (!active) return;
        const sb = createClient(supabaseUrl, supabaseKey, supabaseOptions);
        setSupabase(sb);
        setSupabaseReady(true);
      })
      .catch((err) => {
        if (!active) return;
        setSupabaseError(err);
        setSupabaseReady(false);
      });

    return () => { active = false; };
  }, [supabaseUrl, supabaseKey, supabaseOptions, supabaseClient]);

  const value = useMemo(() => ({
    client: apiClient,
    token,
    setToken,
    supabase,
    supabaseReady,
    supabaseError
  }), [apiClient, token, supabase, supabaseReady, supabaseError]);

  return React.createElement(SexyGuardContext.Provider, { value }, children);
}

/** @returns {{client: SexyGuardClient, token: string|null, setToken: Function, supabase: any, supabaseReady: boolean, supabaseError: any}} */
export function useSexyGuard() {
  const ctx = useContext(SexyGuardContext);
  if (!ctx) throw new Error('useSexyGuard must be used inside SexyGuardProvider');
  return ctx;
}

/**
 * REST auth hook.
 */
export function useAuth() {
  const { client, token, setToken } = useSexyGuard();

  const login = useCallback(async (login, password) => {
    const res = await client.login(login, password);
    if (res.token) client.setToken(res.token);
    if (res.token) setToken(res.token);
    return res;
  }, [client, setToken]);

  const register = useCallback(async (login, email, password) => {
    return client.register(login, email, password);
  }, [client]);

  const logout = useCallback(() => {
    client.setToken(null);
    setToken(null);
  }, [client, setToken]);

  return { token, login, register, logout };
}

/**
 * Supabase auth hook.
 * @param {boolean} [autoLoad]
 */
export function useSupabaseAuth(autoLoad = true) {
  const { supabase, supabaseReady, supabaseError } = useSexyGuard();
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSession = useCallback(async () => {
    if (!supabase) return null;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.getSession();
    if (error) setError(error);
    setSession(data?.session || null);
    setUser(data?.session?.user || null);
    setLoading(false);
    return data?.session || null;
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !autoLoad) return;
    loadSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user || null);
    });
    return () => { sub?.subscription?.unsubscribe(); };
  }, [supabase, autoLoad, loadSession]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Supabase not initialized' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error);
    if (data?.session) {
      setSession(data.session);
      setUser(data.session.user || null);
    }
    return { data, error };
  }, [supabase]);

  const signUp = useCallback(async (email, password, options) => {
    if (!supabase) return { error: 'Supabase not initialized' };
    const { data, error } = await supabase.auth.signUp({ email, password, options });
    if (error) setError(error);
    return { data, error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not initialized' };
    const { error } = await supabase.auth.signOut();
    if (error) setError(error);
    setSession(null);
    setUser(null);
    return { error };
  }, [supabase]);

  return {
    supabase,
    supabaseReady,
    supabaseError,
    session,
    user,
    loading,
    error,
    refresh: loadSession,
    signIn,
    signUp,
    signOut
  };
}


/**
 * Supabase table CRUD hook.
 * @param {string} table
 * @param {Object} [options]
 */
export function useSupabaseTable(table, {
  select = '*',
  autoLoad = true,
  filters = [],
  query,
  schema = 'public',
  single = false
} = {}) {
  const { supabase } = useSexyGuard();
  const [data, setData] = useState(single ? null : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const applyFilters = (builder) => {
    let q = builder;
    filters.forEach((f) => {
      if (!f || !f.op) return;
      if (typeof q[f.op] === 'function') {
        q = q[f.op](f.column, f.value);
      }
    });
    return q;
  };

  const load = useCallback(async () => {
    if (!supabase || !table) return null;
    setLoading(true);
    setError(null);
    let builder = supabase.schema(schema).from(table).select(select);
    builder = applyFilters(builder);
    if (query) builder = query(builder) || builder;
    if (single) builder = builder.single();
    const { data, error } = await builder;
    if (error) setError(error);
    else setData(data || (single ? null : []));
    setLoading(false);
    return data;
  }, [supabase, table, select, filters, query, single, schema]);

  useEffect(() => { if (autoLoad) load(); }, [autoLoad, load]);

  const insert = useCallback(async (payload) => {
    if (!supabase) return { error: 'Supabase not initialized' };
    return supabase.schema(schema).from(table).insert(payload).select();
  }, [supabase, table, schema]);

  const update = useCallback(async (payload, match) => {
    if (!supabase) return { error: 'Supabase not initialized' };
    let builder = supabase.schema(schema).from(table).update(payload);
    if (match) {
      Object.entries(match).forEach(([k, v]) => { builder = builder.eq(k, v); });
    }
    return builder.select();
  }, [supabase, table, schema]);

  const remove = useCallback(async (match) => {
    if (!supabase) return { error: 'Supabase not initialized' };
    let builder = supabase.schema(schema).from(table).delete();
    if (match) {
      Object.entries(match).forEach(([k, v]) => { builder = builder.eq(k, v); });
    }
    return builder;
  }, [supabase, table, schema]);

  return { data, loading, error, refresh: load, insert, update, remove };
}


/**
 * Supabase realtime subscription.
 * @param {string} table
 * @param {Object} [options]
 */
export function useSupabaseRealtime(table, {
  event = '*',
  schema = 'public',
  filter,
  enabled = true,
  onEvent
} = {}) {
  const { supabase } = useSexyGuard();

  useEffect(() => {
    if (!supabase || !enabled || !table) return;
    const channel = supabase
      .channel(`realtime:${schema}:${table}`)
      .on('postgres_changes', { event, schema, table, filter }, (payload) => {
        if (onEvent) onEvent(payload);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, table, event, schema, filter, enabled, onEvent]);
}


/**
 * Load REST profile.
 * @param {boolean} [autoLoad]
 */
export function useProfile(autoLoad = true) {
  const { client, token } = useSexyGuard();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!token) return null;
    setLoading(true);
    setError(null);
    const res = await client.getProfile();
    if (res.error) setError(res.error);
    else setProfile(res);
    setLoading(false);
    return res;
  }, [client, token]);

  useEffect(() => {
    if (autoLoad && token) loadProfile();
  }, [autoLoad, token, loadProfile]);

  const changePassword = useCallback((password) => client.changePassword(password), [client]);
  const setMemory = useCallback((memory) => client.setMemory(memory), [client]);

  return { profile, loading, error, refresh: loadProfile, changePassword, setMemory };
}

/**
 * Load REST market.
 * @param {boolean} [autoLoad]
 */
export function useMarket(autoLoad = true) {
  const { client } = useSexyGuard();
  const [items, setItems] = useState(/** @type {MarketItem[]} */([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMarket = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await client.getMarket();
    if (res.error) setError(res.error);
    else setItems(res.items || []);
    setLoading(false);
    return res;
  }, [client]);

  useEffect(() => { if (autoLoad) loadMarket(); }, [autoLoad, loadMarket]);

  return { items, loading, error, refresh: loadMarket };
}


/**
 * Load REST stats.
 * @param {boolean} [autoLoad]
 */
export function useStats(autoLoad = true) {
  const { client } = useSexyGuard();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await client.getInfo();
    if (res.error) setError(res.error);
    else setInfo(res);
    setLoading(false);
    return res;
  }, [client]);

  useEffect(() => { if (autoLoad) loadStats(); }, [autoLoad, loadStats]);

  return { info, loading, error, refresh: loadStats };
}

/**
 * Load REST version.
 * @param {boolean} [autoLoad]
 */
export function useVersion(autoLoad = true) {
  const { client } = useSexyGuard();
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadVersion = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await client.getVersion();
    if (res.error) setError(res.error);
    else setVersion(res.version || null);
    setLoading(false);
    return res;
  }, [client]);

  useEffect(() => { if (autoLoad) loadVersion(); }, [autoLoad, loadVersion]);

  return { version, loading, error, refresh: loadVersion };
}
