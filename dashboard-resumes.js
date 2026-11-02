import { showMessage, esc, setBusy } from './candidate-client.js';

const BUCKET = 'candidate-resumes';
const MAX_BYTES = 4 * 1024 * 1024;

const fmtDate = t => new Date(t).toLocaleDateString('en-IN', { dateStyle: 'medium' });
const fmtSize = b => (b / 1024 / 1024 >= 1 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

export function initResumes({ sb, user }) {
  const form = document.getElementById('resume-form');
  const input = document.getElementById('resume-file');
  const submit = document.getElementById('resume-submit');
  const msg = document.getElementById('resume-msg');
  const list = document.getElementById('resume-list');

  async function load() {
    const { data, error } = await sb.from('candidate_resumes')
      .select('id, file_name, size_bytes, uploaded_at, storage_path')
      .order('uploaded_at', { ascending: false });
    if (error) return showMessage(msg, 'We could not load your resumes. Please try again.', true);
    list.innerHTML = data.length
      ? data.map(r => `<li class="listrow"><div><b>${esc(r.file_name)}</b><span class="mu">${fmtSize(r.size_bytes)} · uploaded ${fmtDate(r.uploaded_at)}</span></div><button type="button" class="linkbtn danger" data-id="${esc(r.id)}" data-path="${esc(r.storage_path)}">Delete</button></li>`).join('')
      : '<li class="mu">No resumes yet. Upload one to start applying for jobs.</li>';
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const file = input.files[0];
    if (!file) return showMessage(msg, 'Please choose a file to upload.', true);
    if (!/\.(pdf|docx?)$/i.test(file.name)) return showMessage(msg, 'Please upload a PDF or Word file.', true);
    if (file.size > MAX_BYTES) return showMessage(msg, 'Your resume must be 4 MB or smaller.', true);
    setBusy(submit, true, 'Upload resume');
    try {
      const safeName = file.name.replace(/[^\w.\- ]/g, '_').slice(-100);
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (up.error) return showMessage(msg, 'Your resume could not be uploaded. Please try again.', true);
      const ins = await sb.from('candidate_resumes').insert({
        file_name: file.name.slice(0, 120),
        storage_path: path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size
      });
      if (ins.error) {
        await sb.storage.from(BUCKET).remove([path]);
        return showMessage(msg, 'Your resume could not be saved. Please try again.', true);
      }
      form.reset();
      showMessage(msg, 'Your resume has been uploaded.', false);
      await load();
    } finally {
      setBusy(submit, false, 'Upload resume');
    }
  });

  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-id]');
    if (!btn || !window.confirm('Delete this resume? Applications already sent with it keep their record.')) return;
    const removed = await sb.storage.from(BUCKET).remove([btn.dataset.path]);
    if (removed.error) return showMessage(msg, 'The resume could not be deleted. Please try again.', true);
    const { error } = await sb.from('candidate_resumes').delete().eq('id', btn.dataset.id);
    if (error) return showMessage(msg, 'The resume could not be deleted. Please try again.', true);
    showMessage(msg, 'Resume deleted.', false);
    await load();
  });

  return { load };
}
