const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const authMode = import.meta.env.VITE_AUTH_MODE === "mongodb" ? "mongodb" : "supabase";
const mongoAuth = authMode === "mongodb";
const mongoTokenKey = "intentos.mongodb.session.v1";
const listeners = new Set();

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
    const response = await fetch("/api/auth/session", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!response.ok) return null;
    const { session } = await response.json();
    window.localStorage.setItem(mongoTokenKey, session.access_token);
    return session;
  }
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
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
  if (mongoAuth) { window.localStorage.removeItem(mongoTokenKey); listeners.forEach(callback => callback(null)); return; }
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
