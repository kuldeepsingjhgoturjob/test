import { getSupabase, showMessage, cleanPhone, validPhone, setBusy } from './candidate-client.js';

const form = document.getElementById('register-form');
const msg = document.getElementById('register-msg');
const submit = document.getElementById('register-submit');

const fail = text => { showMessage(msg, text, true); };

form.addEventListener('submit', async e => {
  e.preventDefault();
  const v = Object.fromEntries(new FormData(form));
  const fullName = String(v.full_name || '').trim().slice(0, 80);
  const email = String(v.email || '').trim().toLowerCase().slice(0, 120);
  const phone = cleanPhone(v.phone);
  const city = String(v.city || '').trim().slice(0, 80);
  const state = String(v.state || '').trim().slice(0, 80);

  if (!fullName) return fail('Please enter your full name.');
  if (!validPhone(phone)) return fail('Please enter a valid phone number with country code, for example +91 98765 43210.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');
  if (String(v.password || '').length < 8) return fail('Your password must be at least 8 characters.');
  if (v.password !== v.confirm_password) return fail('The two passwords do not match.');

  setBusy(submit, true, 'Create my account');
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password: v.password,
      options: { data: { full_name: fullName, phone, city, state } }
    });
    if (error) {
      const taken = /already/i.test(error.message);
      return fail(taken ? 'An account with this email already exists. Please log in instead.' : 'We could not create your account. Please check the details and try again.');
    }
    if (data.session) {
      window.location.replace('dashboard.html');
      return;
    }
    showMessage(msg, 'Your account has been created. Please log in to continue.', false);
  } catch (err) {
    fail(err.message || 'Something went wrong. Please try again.');
  } finally {
    setBusy(submit, false, 'Create my account');
  }
});
