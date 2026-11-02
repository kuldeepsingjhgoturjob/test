import { showMessage, esc, setBusy, cleanPhone, validPhone } from './candidate-client.js';

const BUCKET = 'candidate-resumes';
const fmtDate = t => new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' });
const isDuplicate = error => error && error.code === '23505';

export function initJobs({ sb, user }) {
  const search = document.getElementById('job-search');
  const jobList = document.getElementById('job-list');
  const jobMsg = document.getElementById('job-msg');
  const applyPanel = document.getElementById('apply-panel');
  const applyTitle = document.getElementById('apply-title');
  const applyResume = document.getElementById('apply-resume');
  const applySubmit = document.getElementById('apply-submit');
  const applyMsg = document.getElementById('apply-msg');
  const applicationList = document.getElementById('application-list');
  const applicationMsg = document.getElementById('application-msg');
  const savedList = document.getElementById('saved-list');
  const savedMsg = document.getElementById('saved-msg');

  let jobs = [];
  let applied = new Set();
  let saved = new Set();
  let pending = null;

  function renderJobs() {
    const q = search.value.trim().toLowerCase();
    const shown = jobs.filter(j => !q || [j.title, j.company, j.city].some(v => String(v || '').toLowerCase().includes(q)));
    if (!shown.length) {
      jobList.innerHTML = '<li class="mu">No open jobs match your search.</li>';
      return;
    }
    jobList.innerHTML = shown.map(j => {
      const isApplied = applied.has(j.id);
      const isSaved = saved.has(j.id);
      return `<li class="listrow"><div><b>${esc(j.title)}</b><span class="mu">${esc(j.company)} · ${esc(j.city)}${j.exp ? ' · ' + esc(j.exp) : ''}${j.salary ? ' · ' + esc(j.salary) : ''}</span></div><div class="rowbtns">${isApplied ? '<span class="pill">Applied</span>' : `<button type="button" class="btn small" data-apply="${esc(j.id)}">Apply</button>`}<button type="button" class="linkbtn" data-save="${esc(j.id)}" data-saved="${isSaved ? '1' : '0'}">${isSaved ? 'Saved' : 'Save'}</button></div></li>`;
    }).join('');
  }

  async function loadJobs() {
    showMessage(jobMsg, '', false);
    try {
      const [jobsRes, appsRes, savedRes] = await Promise.all([
        fetch('/api/jobs').then(r => r.json().then(d => ({ ok: r.ok, d }))),
        sb.from('candidate_applications').select('job_ref'),
        sb.from('saved_jobs').select('job_ref')
      ]);
      if (!jobsRes.ok || !Array.isArray(jobsRes.d.jobs)) throw new Error('Jobs could not be loaded right now.');
      if (appsRes.error || savedRes.error) throw new Error('Your applications could not be loaded.');
      jobs = jobsRes.d.jobs;
      applied = new Set(appsRes.data.map(r => r.job_ref));
      saved = new Set(savedRes.data.map(r => r.job_ref));
      renderJobs();
    } catch (err) {
      jobList.innerHTML = '';
      showMessage(jobMsg, err.message, true);
    }
  }

  function closeApply() {
    pending = null;
    applyPanel.hidden = true;
    showMessage(applyMsg, '', false);
  }

  async function openApply(job) {
    showMessage(applyMsg, '', false);
    const { data, error } = await sb.from('candidate_resumes').select('id, file_name, storage_path').order('uploaded_at', { ascending: false });
    if (error) return showMessage(jobMsg, 'Your resumes could not be loaded. Please try again.', true);
    if (!data.length) return showMessage(jobMsg, 'Please upload a resume in the Resume tab before you apply.', true);
    pending = { job, resumes: data };
    applyTitle.textContent = `Apply for ${job.title} at ${job.company}`;
    applyResume.innerHTML = data.map(r => `<option value="${esc(r.id)}">${esc(r.file_name)}</option>`).join('');
    applyPanel.hidden = false;
    applyPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submitApplication() {
    if (!pending) return;
    const { job, resumes } = pending;
    const resumeRow = resumes.find(r => r.id === applyResume.value);
    if (!resumeRow) return showMessage(applyMsg, 'Please choose a resume.', true);

    const profileRes = await sb.from('candidate_profiles').select('full_name, phone').eq('user_id', user.id).maybeSingle();
    if (profileRes.error || !profileRes.data) return showMessage(applyMsg, 'Your profile could not be loaded. Please try again.', true);
    const { full_name: fullName, phone } = profileRes.data;
    if (!fullName || !validPhone(phone)) return showMessage(applyMsg, 'Please complete your name and phone number in the Profile tab before applying.', true);

    setBusy(applySubmit, true, 'Submit application');
    try {
      const download = await sb.storage.from(BUCKET).download(resumeRow.storage_path);
      if (download.error || !download.data) return showMessage(applyMsg, 'Your resume could not be opened. Please try again.', true);
      const file = new File([download.data], resumeRow.file_name, { type: download.data.type || 'application/octet-stream' });

      const fd = new FormData();
      fd.append('jobId', job.id);
      fd.append('name', fullName);
      fd.append('phone', cleanPhone(phone));
      fd.append('email', user.email || '');
      fd.append('resume', file);
      const res = await fetch('/api/apply', { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || !body.ok) return showMessage(applyMsg, body?.error || 'Your application could not be sent. Please try again.', true);

      const record = await sb.from('candidate_applications').insert({
        job_ref: job.id,
        job_title: String(job.title || '').slice(0, 120),
        company: String(job.company || '').slice(0, 120),
        blob_application_id: String(body.id || ''),
        resume_id: resumeRow.id
      });
      if (record.error && !isDuplicate(record.error)) {
        return showMessage(applyMsg, 'Your application was sent, but it could not be added to your account list. Please contact us on WhatsApp.', true);
      }
      applied.add(job.id);
      closeApply();
      renderJobs();
      showMessage(jobMsg, `Application sent for ${job.title}.`, false);
    } finally {
      setBusy(applySubmit, false, 'Submit application');
    }
  }

  async function toggleSave(id, isSaved) {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    if (isSaved) {
      const { error } = await sb.from('saved_jobs').delete().eq('user_id', user.id).eq('job_ref', id);
      if (error) return showMessage(jobMsg, 'The job could not be removed from your saved list.', true);
      saved.delete(id);
    } else {
      const { error } = await sb.from('saved_jobs').insert({ job_ref: id, job_title: String(job.title || '').slice(0, 120), company: String(job.company || '').slice(0, 120) });
      if (error && !isDuplicate(error)) return showMessage(jobMsg, 'The job could not be saved. Please try again.', true);
      saved.add(id);
    }
    renderJobs();
  }

  jobList.addEventListener('click', e => {
    const applyBtn = e.target.closest('[data-apply]');
    if (applyBtn) {
      const job = jobs.find(j => j.id === applyBtn.dataset.apply);
      if (job) openApply(job);
      return;
    }
    const saveBtn = e.target.closest('[data-save]');
    if (saveBtn) toggleSave(saveBtn.dataset.save, saveBtn.dataset.saved === '1');
  });

  search.addEventListener('input', renderJobs);
  document.getElementById('apply-cancel').addEventListener('click', closeApply);
  document.getElementById('apply-form').addEventListener('submit', e => {
    e.preventDefault();
    submitApplication();
  });

  async function loadApplications() {
    const { data, error } = await sb.from('candidate_applications').select('job_title, company, status, applied_at').order('applied_at', { ascending: false });
    if (error) return showMessage(applicationMsg, 'Your applications could not be loaded.', true);
    applicationList.innerHTML = data.length
      ? data.map(a => `<li class="listrow"><div><b>${esc(a.job_title)}</b><span class="mu">${esc(a.company)} · applied ${fmtDate(a.applied_at)}</span></div><span class="pill">${esc(a.status)}</span></li>`).join('')
      : '<li class="mu">You have not applied for any jobs yet.</li>';
  }

  async function loadSaved() {
    const { data, error } = await sb.from('saved_jobs').select('job_ref, job_title, company, created_at').order('created_at', { ascending: false });
    if (error) return showMessage(savedMsg, 'Your saved jobs could not be loaded.', true);
    savedList.innerHTML = data.length
      ? data.map(s => `<li class="listrow"><div><b>${esc(s.job_title)}</b><span class="mu">${esc(s.company)} · saved ${fmtDate(s.created_at)}</span></div><button type="button" class="linkbtn danger" data-unsave="${esc(s.job_ref)}">Remove</button></li>`).join('')
      : '<li class="mu">No saved jobs yet. Use Save on the Find jobs tab.</li>';
  }

  savedList.addEventListener('click', async e => {
    const btn = e.target.closest('[data-unsave]');
    if (!btn) return;
    const { error } = await sb.from('saved_jobs').delete().eq('user_id', user.id).eq('job_ref', btn.dataset.unsave);
    if (error) return showMessage(savedMsg, 'The job could not be removed. Please try again.', true);
    saved.delete(btn.dataset.unsave);
    await loadSaved();
  });

  return { loadJobs, loadApplications, loadSaved };
}
