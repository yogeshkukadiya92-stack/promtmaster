const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const authMode = import.meta.env.VITE_AUTH_MODE === "mongodb" ? "mongodb" : "supabase";
const mongoAuth = authMode === "mongodb";
const mongoTokenKey = "intentos.mongodb.session.v1";
const listeners = new Set();
const clearWorkspaceCache = () => Object.keys(window.localStorage).filter((key) => key.startsWith("intentos.") || key.startsWith("intentos-")).forEach((key) => window.localStorage.removeItem(key));

export const authConfigured = mongoAuth || Boolean(url && publishableKey);
let clientPromise;

async function getSupabase() {
  if (!authConfigured) return null;
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }));
  }
  return clientPromise;
}

export async function getInitialSession() {
  if (mongoAuth) {
    const token = window.localStorage.getItem(mongoTokenKey) || "";
    if (!token) return null;
    const response = await fetch("/api/auth/session", { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) { clearWorkspaceCache(); return null; }
    const { session } = await response.json();
    window.localStorage.setItem(mongoTokenKey, session.access_token);
    return session;
  }
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

const mongoCredentials = async (path, input) => {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Authentication could not be completed.");
  window.localStorage.setItem(mongoTokenKey, payload.session.access_token);
  listeners.forEach(callback => callback(payload.session));
  return payload.session;
};

export async function signInWithPassword(email, password) {
  if (!mongoAuth) throw new Error("Password sign-in is available on the MongoDB deployment.");
  return mongoCredentials("/api/auth/login", { email, password });
}

export async function registerWithPassword(name, email, password) {
  if (!mongoAuth) throw new Error("Account registration is available on the MongoDB deployment.");
  return mongoCredentials("/api/auth/register", { name, email, password });
}

export async function subscribeToSession(callback) {
  if (mongoAuth) { listeners.add(callback); return () => listeners.delete(callback); }
  const supabase = await getSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  if (mongoAuth) throw new Error("This Railway deployment uses a private device workspace; email magic links require an external email-auth provider.");
  const supabase = await getSupabase();
  if (!supabase) throw new Error("Cloud authentication is not configured.");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  if (mongoAuth) { clearWorkspaceCache(); listeners.forEach(callback => callback(null)); return; }
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
