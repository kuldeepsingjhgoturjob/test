import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = fetch('/api/config')
      .then(r => r.json().catch(() => null).then(c => ({ ok: r.ok, c })))
      .then(({ ok, c }) => {
        if (!ok || !c || !c.supabaseUrl || !c.supabaseAnonKey) throw new Error('Candidate accounts are not available right now. Please try again later.');
        return createClient(c.supabaseUrl, c.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      })
      .catch(e => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function showMessage(el, text, bad = false) {
  el.textContent = text;
  el.dataset.state = bad ? 'error' : 'ok';
  el.hidden = !text;
}

export function cleanPhone(v) {
  return String(v ?? '').trim().replace(/(?!^\+)[^\d]/g, '');
}

export function validPhone(v) {
  const d = cleanPhone(v).replace(/\D/g, '');
  return d.length >= 10 && d.length <= 13;
}

export function setBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.textContent = busy ? 'Please wait…' : label;
}
