import { getSupabase, showMessage, cleanPhone, validPhone, setBusy } from './candidate-client.js';
import { initResumes } from './dashboard-resumes.js';
import { initJobs } from './dashboard-jobs.js';

const pageMsg = document.getElementById('page-msg');
const profileForm = document.getElementById('profile-form');
const profileMsg = document.getElementById('profile-msg');
const profileSubmit = document.getElementById('profile-submit');
const PROFILE_FIELDS = ['full_name', 'phone', 'city', 'state', 'headline', 'skills', 'education', 'experience_years', 'preferred_location', 'expected_salary_inr'];

async function loadOrCreateProfile(sb, user) {
  const { data, error } = await sb.from('candidate_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error('We could not load your profile. Please refresh the page.');
  if (data) return data;
  const m = user.user_metadata || {};
  const { data: created, error: createError } = await sb.from('candidate_profiles')
    .insert({
      user_id: user.id,
      full_name: String(m.full_name || '').slice(0, 80),
      phone: cleanPhone(m.phone || '').slice(0, 20),
      city: String(m.city || '').slice(0, 80),
      state: String(m.state || '').slice(0, 80)
    })
    .select('*')
    .single();
  if (createError) throw new Error('We could not create your profile. Please refresh the page.');
  return created;
}

async function hasResume(sb, user) {
  const { count, error } = await sb.from('candidate_resumes').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if (error) throw new Error('We could not check your resume. Please refresh the page.');
  return count > 0;
}

function fillProfile(p) {
  PROFILE_FIELDS.forEach(k => {
    const el = profileForm.elements[k];
    if (el) el.value = p[k] ?? '';
  });
}

function renderCompletion(p, resumeOnFile) {
  const checks = [
    p.full_name, p.phone, p.city, p.state, p.headline, p.skills, p.education,
    p.experience_years != null, p.preferred_location, p.expected_salary_inr != null, resumeOnFile
  ];
  const done = checks.filter(Boolean).length;
  const pct = Math.round((done / checks.length) * 100);
  document.getElementById('meter-fill').style.width = pct + '%';
  document.getElementById('meter-text').textContent = pct === 100 ? 'Your profile is complete.' : `Your profile is ${pct}% complete. Add the missing details to get better job matches.`;
  document.getElementById('meter').setAttribute('aria-valuenow', String(pct));
}

function readProfileForm() {
  const v = Object.fromEntries(new FormData(profileForm));
  const fullName = String(v.full_name || '').trim().slice(0, 80);
  const phone = cleanPhone(v.phone);
  const exp = String(v.experience_years || '').trim();
  const salary = String(v.expected_salary_inr || '').trim();
  if (!fullName) return { error: 'Please enter your full name.' };
  if (!validPhone(phone)) return { error: 'Please enter a valid phone number with country code, for example +91 98765 43210.' };
  if (exp && !(Number(exp) >= 0 && Number(exp) <= 60)) return { error: 'Experience must be between 0 and 60 years.' };
  if (salary && !(Number.isInteger(Number(salary)) && Number(salary) >= 0 && Number(salary) <= 100000000)) return { error: 'Expected salary must be a whole number in rupees.' };
  return {
    row: {
      full_name: fullName,
      phone,
      city: String(v.city || '').trim().slice(0, 80),
      state: String(v.state || '').trim().slice(0, 80),
      headline: String(v.headline || '').trim().slice(0, 120),
      skills: String(v.skills || '').trim().slice(0, 600),
      education: String(v.education || '').trim().slice(0, 200),
      experience_years: exp === '' ? null : Number(exp),
      preferred_location: String(v.preferred_location || '').trim().slice(0, 200),
      expected_salary_inr: salary === '' ? null : Number(salary),
      updated_at: new Date().toISOString()
    }
  };
}

function wireProfile(ctx) {
  profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    const parsed = readProfileForm();
    if (parsed.error) return showMessage(profileMsg, parsed.error, true);
    setBusy(profileSubmit, true, 'Save profile');
    try {
      const { data, error } = await ctx.sb.from('candidate_profiles').update(parsed.row).eq('user_id', ctx.user.id).select('*').single();
      if (error) return showMessage(profileMsg, 'Your profile could not be saved. Please try again.', true);
      fillProfile(data);
      renderCompletion(data, await hasResume(ctx.sb, ctx.user));
      document.getElementById('welcome').textContent = `Hello, ${data.full_name || 'there'}.`;
      showMessage(profileMsg, 'Your profile has been saved.', false);
    } catch (err) {
      showMessage(profileMsg, err.message, true);
    } finally {
      setBusy(profileSubmit, false, 'Save profile');
    }
  });
}

function wireTabs(handlers) {
  const buttons = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  function show(name) {
    buttons.forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
    if (handlers[name]) handlers[name]();
  }
  buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  return show;
}

async function main() {
  let sb;
  try {
    sb = await getSupabase();
  } catch (err) {
    return showMessage(pageMsg, err.message, true);
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return window.location.replace('login.html');
  const user = session.user;
  const ctx = { sb, user };

  sb.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') window.location.replace('login.html');
  });
  document.getElementById('logout').addEventListener('click', () => { sb.auth.signOut(); });
  document.getElementById('account-email').textContent = user.email || '';

  try {
    const profile = await loadOrCreateProfile(sb, user);
    fillProfile(profile);
    document.getElementById('welcome').textContent = `Hello, ${profile.full_name || 'there'}.`;
    wireProfile(ctx);

    const resumes = initResumes(ctx);
    const jobs = initJobs(ctx);
    const show = wireTabs({
      profile: async () => renderCompletion(await loadOrCreateProfile(sb, user), await hasResume(sb, user)),
      resume: () => resumes.load(),
      jobs: () => jobs.loadJobs(),
      applications: () => jobs.loadApplications(),
      saved: () => jobs.loadSaved()
    });
    show('profile');
  } catch (err) {
    showMessage(pageMsg, err.message, true);
  }
}

main();
