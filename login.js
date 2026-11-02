import { getSupabase, showMessage, setBusy } from './candidate-client.js';

const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('login-msg');
const loginSubmit = document.getElementById('login-submit');
const forgotPanel = document.getElementById('forgot-panel');
const forgotForm = document.getElementById('forgot-form');
const forgotMsg = document.getElementById('forgot-msg');
const resetPanel = document.getElementById('reset-panel');
const resetForm = document.getElementById('reset-form');
const resetMsg = document.getElementById('reset-msg');
const resetSubmit = document.getElementById('reset-submit');
const recoveryLink = window.location.hash.includes('type=recovery');

function showPanel(name) {
  loginForm.hidden = name !== 'login';
  forgotPanel.hidden = name !== 'forgot';
  resetPanel.hidden = name !== 'reset';
}

document.getElementById('show-forgot').addEventListener('click', () => showPanel('forgot'));
document.getElementById('show-login').addEventListener('click', () => showPanel('login'));

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(loginForm));
  const email = String(v.email || '').trim();
  if (!email || !v.password) return showMessage(loginMsg, 'Please enter your email and password.', true);
  setBusy(loginSubmit, true, 'Log in');
  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password: v.password });
    if (error) return showMessage(loginMsg, 'Your email or password is not correct.', true);
    window.location.replace('dashboard.html');
  } catch (err) {
    showMessage(loginMsg, err.message || 'Something went wrong. Please try again.', true);
  } finally {
    setBusy(loginSubmit, false, 'Log in');
  }
});

forgotForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = String(new FormData(forgotForm).get('email') || '').trim();
  if (!email) return showMessage(forgotMsg, 'Please enter your email.', true);
  try {
    const sb = await getSupabase();
    const redirectTo = new URL('login.html', window.location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return showMessage(forgotMsg, 'We could not send the reset link. Please try again shortly.', true);
    showMessage(forgotMsg, 'If an account exists for this email, a reset link has been sent.', false);
  } catch (err) {
    showMessage(forgotMsg, err.message || 'Something went wrong. Please try again.', true);
  }
});

resetForm.addEventListener('submit', async e => {
  e.preventDefault();
  const password = String(new FormData(resetForm).get('password') || '');
  if (password.length < 8) return showMessage(resetMsg, 'Your password must be at least 8 characters.', true);
  setBusy(resetSubmit, true, 'Save new password');
  try {
    const sb = await getSupabase();
    const { error } = await sb.auth.updateUser({ password });
    if (error) return showMessage(resetMsg, 'We could not save your new password. Please request a new reset link.', true);
    window.location.replace('dashboard.html');
  } catch (err) {
    showMessage(resetMsg, err.message || 'Something went wrong. Please try again.', true);
  } finally {
    setBusy(resetSubmit, false, 'Save new password');
  }
});

async function start() {
  try {
    const sb = await getSupabase();
    sb.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') showPanel('reset');
    });
    if (recoveryLink) return showPanel('reset');
    const { data } = await sb.auth.getSession();
    if (data.session) window.location.replace('dashboard.html');
  } catch (err) {
    showMessage(loginMsg, err.message, true);
  }
}

start();
