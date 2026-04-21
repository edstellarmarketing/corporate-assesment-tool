/**
 * supabase-client.js — Shared Supabase client module
 *
 * Every HTML page includes this after the Supabase CDN script:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="supabase-client.js"></script>
 */

const SETTINGS_KEY = 'edstellar_settings';

// Default Supabase config — anon key is public, safe to hardcode
const DEFAULT_SUPABASE_URL = 'https://supabasekong-dfpiopwrqgdf8iods10d4546.187.127.140.202.sslip.io';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NjI1MjMwMCwiZXhwIjo0OTMxOTI1OTAwLCJyb2xlIjoiYW5vbiJ9.[REDACTED]';
const DEFAULT_SUPABASE_SERVICE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NjI1MjMwMCwiZXhwIjo0OTMxOTI1OTAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.[REDACTED]';

let _supabaseClient = null;
let _currentUser = null;

/**
 * Read Supabase URL + Anon Key from localStorage, falling back to hardcoded defaults.
 */
function _getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      url: saved.supabaseUrl || DEFAULT_SUPABASE_URL,
      anonKey: saved.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY
    };
  } catch {
    return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
  }
}

/**
 * Get a Supabase client using the service role key (for admin operations like auth.admin.createUser).
 * Creates a new instance each call — not cached, since it's only used for privileged one-off operations.
 */
function getAdminClient() {
  const { url } = _getConfig();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })();
  const serviceKey = saved.supabaseServiceKey || DEFAULT_SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.warn('[supabase-client] No service role key configured in Settings.');
    return null;
  }
  return supabase.createClient(url, serviceKey, {
    db: { schema: 'Corporate-Assessment-Tool' },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Get or create the Supabase client (singleton).
 * Uses the anon key only — no service role key in the browser.
 */
function getClient() {
  if (_supabaseClient) return _supabaseClient;

  const { url, anonKey } = _getConfig();
  if (!url || !anonKey) {
    console.warn('[supabase-client] No Supabase config available.');
    return null;
  }

  _supabaseClient = supabase.createClient(url, anonKey, {
    db: { schema: 'Corporate-Assessment-Tool' },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  return _supabaseClient;
}

/**
 * Get the current authenticated user's session + profile from v2-users.
 * Returns { session, user, profile } or null if not authenticated.
 */
async function getCurrentUser() {
  if (_currentUser) return _currentUser;

  const client = getClient();
  if (!client) return null;

  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session) return null;

  const { data: profile, error: profileError } = await client
    .from('v2-users')
    .select('*, "v2-departments"(name)')
    .eq('id', session.user.id)
    .single();

  if (profileError) {
    console.warn('[supabase-client] Could not load user profile:', profileError.message);
  }

  _currentUser = {
    session,
    user: session.user,
    profile: profile || null
  };

  return _currentUser;
}

/**
 * Auth guard — call on every protected page load.
 * Redirects to login.html if no valid session exists.
 */
async function requireAuth() {
  const client = getClient();
  if (!client) return;

  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  return session;
}

/**
 * Admin-only guard — redirects non-admin users to employee_dashboard.html.
 */
async function requireAdmin() {
  const client = getClient();
  if (!client) return null;

  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  const current = await getCurrentUser();
  // Allow through if no profile yet (first-time setup / seed not run)
  if (!current || !current.profile) {
    return current || { session, user: session.user, profile: null };
  }
  if (current.profile.role !== 'admin') {
    window.location.href = 'employee_dashboard.html';
    return null;
  }
  return current;
}

/**
 * Sign out — clears session and redirects to login.
 */
async function signOut() {
  const client = getClient();
  if (client) {
    await client.auth.signOut();
  }
  _currentUser = null;
  _supabaseClient = null;
  window.location.href = 'login.html';
}

/**
 * Listen for auth state changes (session expiry, sign out from another tab, etc.)
 */
function onAuthStateChange(callback) {
  const client = getClient();
  if (!client) return;

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
      _currentUser = null;
    }
    if (event === 'SIGNED_OUT') {
      window.location.href = 'login.html';
      return;
    }
    if (callback) callback(event, session);
  });
}

/**
 * Get the org_id for the current user (used in most queries).
 */
async function getOrgId() {
  const current = await getCurrentUser();
  return current?.profile?.org_id || null;
}

/**
 * Show a toast notification.
 */
function showToast(message, type = 'info') {
  let toast = document.getElementById('sb-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sb-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;font-family:inherit;font-size:12px;font-weight:500;z-index:9999;transition:opacity 0.3s;opacity:0;pointer-events:none;max-width:400px;';
    document.body.appendChild(toast);
  }

  const colors = {
    info: { bg: '#e8eeff', color: '#0a2472', border: '#b8c9f5' },
    success: { bg: '#e3f1e7', color: '#1f6f43', border: '#c5e0ce' },
    error: { bg: '#fbe5df', color: '#a8290c', border: '#e8c0b6' },
    warn: { bg: '#fdf3d8', color: '#8a5a00', border: '#e8d9a0' }
  };
  const c = colors[type] || colors.info;
  toast.style.background = c.bg;
  toast.style.color = c.color;
  toast.style.border = '1px solid ' + c.border;
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.pointerEvents = 'auto';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
  }, 4000);
}

/**
 * Show a loading spinner in a container element.
 */
function showLoading(container) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:#95a0b3;font-size:12px;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:sb-spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Loading...</div>';
  if (!document.getElementById('sb-spin-style')) {
    const style = document.createElement('style');
    style.id = 'sb-spin-style';
    style.textContent = '@keyframes sb-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }
}

/**
 * Show an empty state message in a container.
 */
function showEmpty(container, message) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:#95a0b3;font-size:12px;">' + message + '</div>';
}

/**
 * Show an error message in a container.
 */
function showError(container, message) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:24px;color:#a8290c;background:#fbe5df;border:1px solid #e8c0b6;font-size:12px;margin:8px 0;">' + message + '</div>';
}
