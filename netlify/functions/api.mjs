// Got UR Job backend: jobs, applications (with resumes), premium members, admin and sub-users.
// Data is kept in Netlify Blobs. Needs env vars: ADMIN_PASS (required), ADMIN_USER, SESSION_SECRET.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const st = () => getStore('goturjob');
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const E = (m, s = 400) => J({ error: m }, s);
const rd = async (k, d) => { try { return (await st().get(k, { type: 'json' })) ?? d; } catch { return d; } };
const wr = (k, v) => st().setJSON(k, v);
const S = (v, n = 200) => String(v ?? '').trim().slice(0, n);
const H = s => crypto.createHash('sha256').update(String(s)).digest();
const eq = (a, b) => crypto.timingSafeEqual(H(a), H(b));
const secret = () => process.env.SESSION_SECRET || ('k:' + (process.env.ADMIN_PASS || ''));
const mac = b => crypto.createHmac('sha256', secret()).update(b).digest('base64url');
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + mac(b); };
const verify = t => { try { const [b, s] = String(t).split('.'); if (!b || !s || !eq(s, mac(b))) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; } };
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const PERMS = ['add', 'editOwn', 'editAll', 'delete', 'viewApps'];
const ALL = Object.fromEntries(PERMS.map(k => [k, true]));
const cleanPerms = p => Object.fromEntries(PERMS.map(k => [k, !!(p && p[k])]));
const configured = () => !!(process.env.ADMIN_PASS || process.env.SESSION_SECRET);
const okResume = f => f && typeof f === 'object' && f.size > 0 && f.size <= 4 * 1024 * 1024 && /\.(pdf|docx?)$/i.test(f.name || '');
const digits = v => S(v, 20).replace(/[^\d+]/g, '');
const pickJob = b => ({ title: S(b.title, 120), company: S(b.company, 120), city: S(b.city, 80), exp: S(b.exp, 60), salary: S(b.salary, 60), age: S(b.age, 40), education: S(b.education, 80), address: S(b.address, 300), phone: digits(b.phone), pf: !!b.pf, esi: !!b.esi, insurance: !!b.insurance, active: b.active !== false });
const PREMIUM_PAISE = 9900; // Rs 99 in paise. Amount is fixed on the server, never taken from the browser.
const rzpBasic = () => 'Basic ' + Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
const rzpOn = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const markPaid = (rec, paymentId) => { rec.paid = true; rec.paymentId = S(paymentId, 60); rec.txn = rec.paymentId; if (rec.status === 'unpaid') { rec.status = 'active'; rec.activatedTs = Date.now(); } };
const PUB = ['id', 'title', 'company', 'city', 'exp', 'salary', 'age', 'education', 'address', 'phone', 'pf', 'esi', 'insurance', 'ts'];

async function auth(req) {
  if (!configured()) return null;
  const p = verify((req.headers.get('authorization') || '').replace('Bearer ', ''));
  if (!p) return null;
  if (p.role === 'admin') return { username: p.u, name: 'Admin', role: 'admin', perms: ALL };
  const u = (await rd('users', [])).find(x => x.username === p.u && x.active);
  return u ? { username: u.username, name: u.name, role: 'sub', perms: u.perms } : null;
}

export default async (req) => {
  const m = req.method;
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const [a, b, c] = route.split('/');
  try {
    // ---------- public ----------
    if (route === 'config' && m === 'GET') return J({ supabaseUrl: process.env.SUPABASE_URL || '', supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '' });
    if (route === 'jobs' && m === 'GET') {
      const jobs = (await rd('jobs', [])).filter(j => j.active).sort((x, y) => y.ts - x.ts);
      return J({ jobs: jobs.map(j => Object.fromEntries(PUB.map(k => [k, j[k]]))) });
    }
    if (route === 'apply' && m === 'POST') {
      const fd = await req.formData().catch(() => null);
      if (!fd) return E('Invalid form');
      const job = (await rd('jobs', [])).find(j => j.id === fd.get('jobId') && j.active);
      if (!job) return E('This job is no longer open');
      const name = S(fd.get('name'), 80), phone = digits(fd.get('phone')), email = S(fd.get('email'), 120), f = fd.get('resume');
      if (!name || phone.replace(/\D/g, '').length < 10) return E('Please enter your name and a valid phone number');
      if (!okResume(f)) return E('Please upload a PDF or Word resume up to 4 MB');
      const apps = await rd('apps', []);
      if (apps.some(x => x.jobId === job.id && x.phone === phone)) return E('You have already applied for this job');
      const id = crypto.randomUUID();
      await st().set('resume/' + id, await f.arrayBuffer(), { metadata: { name: S(f.name, 120), type: f.type || 'application/octet-stream' } });
      apps.push({ id, jobId: job.id, name, phone, email, ts: Date.now(), file: S(f.name, 120) });
      await wr('apps', apps);
      return J({ ok: true, id });
    }
    if (route === 'premium' && m === 'POST') {
      if (rzpOn()) return E('Please use the Pay option on the Premium form');
      const fd = await req.formData().catch(() => null);
      if (!fd) return E('Invalid form');
      const name = S(fd.get('name'), 80), phone = digits(fd.get('phone')), s = fd.get('screenshot');
      if (!name || phone.replace(/\D/g, '').length < 10) return E('Please enter your name and a valid phone number');
      if (!S(fd.get('requirement'), 600)) return E('Please tell us what job you are looking for');
      const id = crypto.randomUUID();
      let hasShot = false;
      if (s && typeof s === 'object' && s.size > 0) {
        if (s.size > 3 * 1024 * 1024 || !/^image\//.test(s.type || '')) return E('Screenshot must be an image up to 3 MB');
        await st().set('shot/' + id, await s.arrayBuffer(), { metadata: { type: s.type } });
        hasShot = true;
      }
      const list = await rd('premium', []);
      list.push({ id, name, phone, email: S(fd.get('email'), 120), requirement: S(fd.get('requirement'), 600), txn: S(fd.get('txn'), 60), ts: Date.now(), status: 'pending', interviewSent: false, hasShot });
      await wr('premium', list);
      return J({ ok: true });
    }
    // ---------- Razorpay (Premium Rs 99) ----------
    if (route === 'premium/config' && m === 'GET') return J({ razorpay: rzpOn(), amount: PREMIUM_PAISE / 100 });
    if (route === 'premium/order' && m === 'POST') {
      if (!rzpOn()) return E('Online payment is not set up yet', 503);
      const fd = await req.formData().catch(() => null);
      if (!fd) return E('Invalid form');
      const name = S(fd.get('name'), 80), phone = digits(fd.get('phone')), requirement = S(fd.get('requirement'), 600), f = fd.get('resume');
      if (!name || phone.replace(/\D/g, '').length < 10) return E('Please enter your name and a valid phone number');
      if (!requirement) return E('Please tell us what job you are looking for');
      if (!okResume(f)) return E('Please upload your resume (PDF or Word, up to 4 MB)');
      const id = crypto.randomUUID();
      const r = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: rzpBasic() },
        body: JSON.stringify({ amount: PREMIUM_PAISE, currency: 'INR', receipt: 'prem_' + id.slice(0, 30), notes: { name, phone } })
      });
      if (!r.ok) return E('Could not start the payment. Please try again.', 502);
      const order = await r.json();
      await st().set('resume/' + id, await f.arrayBuffer(), { metadata: { name: S(f.name, 120), type: f.type || 'application/octet-stream' } });
      const list = await rd('premium', []);
      list.push({ id, name, phone, email: S(fd.get('email'), 120), requirement, txn: '', ts: Date.now(), status: 'unpaid', interviewSent: false, hasShot: false, hasResume: true, resumeName: S(f.name, 120), orderId: order.id, paid: false, consultantCall: false });
      await wr('premium', list);
      return J({ orderId: order.id, amount: PREMIUM_PAISE, keyId: process.env.RAZORPAY_KEY_ID });
    }
    if (route === 'premium/verify' && m === 'POST') {
      if (!rzpOn()) return E('Online payment is not set up yet', 503);
      const body = await req.json().catch(() => ({}));
      const orderId = S(body.orderId, 80), paymentId = S(body.paymentId, 80), signature = S(body.signature, 200);
      const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(orderId + '|' + paymentId).digest('hex');
      if (!orderId || !paymentId || !eq(signature, expected)) return E('Payment could not be verified', 400);
      const list = await rd('premium', []);
      const i = list.findIndex(x => x.orderId === orderId);
      if (i < 0) return E('Order not found', 404);
      markPaid(list[i], paymentId);
      await wr('premium', list);
      return J({ ok: true });
    }
    if (route === 'premium/consultant' && m === 'POST') {
      const body = await req.json().catch(() => ({}));
      const orderId = S(body.orderId, 80), paymentId = S(body.paymentId, 80);
      const list = await rd('premium', []);
      const i = list.findIndex(x => x.orderId === orderId && x.paid && x.paymentId === paymentId);
      if (i < 0) return E('Not found', 404);
      list[i].consultantCall = true; list[i].consultantTs = Date.now();
      await wr('premium', list);
      return J({ ok: true });
    }
    if (route === 'razorpay-webhook' && m === 'POST') {
      // Backup confirmation in case the customer closes the page right after paying.
      const whs = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!whs) return E('Webhook not configured', 503);
      const raw = await req.text();
      const exp = crypto.createHmac('sha256', whs).update(raw).digest('hex');
      if (!eq(req.headers.get('x-razorpay-signature') || '', exp)) return E('Bad signature', 400);
      const ev = JSON.parse(raw), pay = ev?.payload?.payment?.entity;
      if (['payment.captured', 'order.paid'].includes(ev.event) && pay?.order_id && pay.amount === PREMIUM_PAISE) {
        const list = await rd('premium', []);
        const i = list.findIndex(x => x.orderId === pay.order_id);
        if (i >= 0 && !list[i].paid) { markPaid(list[i], pay.id); await wr('premium', list); }
      }
      return J({ ok: true });
    }
    // ---------- login ----------
    if (route === 'login' && m === 'POST') {
      if (!configured()) return E('Server is not set up yet. Add ADMIN_PASS in Netlify.', 503);
      const body = await req.json().catch(() => ({}));
      const username = S(body.username, 60).toLowerCase(), password = String(body.password ?? '');
      await new Promise(r => setTimeout(r, 500));
      const au = (process.env.ADMIN_USER || 'admin').toLowerCase(), ap = process.env.ADMIN_PASS;
      const exp = Date.now() + 12 * 3600e3;
      if (ap && eq(username, au) && eq(password, ap)) return J({ token: sign({ u: au, role: 'admin', exp }), role: 'admin', name: 'Admin', perms: ALL });
      const u = (await rd('users', [])).find(x => x.username === username && x.active);
      if (u && eq(hashPw(password, u.salt), u.hash)) return J({ token: sign({ u: u.username, role: 'sub', exp }), role: 'sub', name: u.name, perms: u.perms });
      return E('Wrong username or password', 401);
    }
    // ---------- admin area ----------
    if (a !== 'admin') return E('Not found', 404);
    const me = await auth(req);
    if (!me) return E('Please log in', 401);
    const isAdmin = me.role === 'admin', P = me.perms;

    if (b === 'jobs') {
      const jobs = await rd('jobs', []);
      if (m === 'GET') {
        const apps = P.viewApps ? await rd('apps', []) : [];
        return J({ jobs: jobs.sort((x, y) => y.ts - x.ts).map(j => ({ ...j, count: P.viewApps ? apps.filter(x => x.jobId === j.id).length : null })) });
      }
      if (m === 'POST') {
        if (!P.add) return E('You do not have permission to add jobs', 403);
        const j = pickJob(await req.json().catch(() => ({})));
        if (!j.title || !j.company || !j.city) return E('Title, company and city are required');
        const job = { ...j, id: crypto.randomUUID(), ts: Date.now(), createdBy: me.username, createdByName: me.name };
        jobs.push(job); await wr('jobs', jobs); return J({ job });
      }
      const i = jobs.findIndex(x => x.id === c);
      if (i < 0) return E('Job not found', 404);
      if (m === 'PUT') {
        if (!(P.editAll || (P.editOwn && jobs[i].createdBy === me.username))) return E('You cannot edit this job', 403);
        const j = pickJob(await req.json().catch(() => ({})));
        if (!j.title || !j.company || !j.city) return E('Title, company and city are required');
        jobs[i] = { ...jobs[i], ...j, updatedBy: me.name, updatedTs: Date.now() };
        await wr('jobs', jobs); return J({ job: jobs[i] });
      }
      if (m === 'DELETE') {
        if (!P.delete) return E('You do not have permission to delete jobs', 403);
        jobs.splice(i, 1); await wr('jobs', jobs); return J({ ok: true });
      }
    }
    if (b === 'apps' && m === 'GET') {
      if (!P.viewApps) return E('No permission', 403);
      return J({ apps: (await rd('apps', [])).filter(x => x.jobId === c).sort((x, y) => y.ts - x.ts) });
    }
    if (b === 'resume' && m === 'GET') {
      if (!P.viewApps && !isAdmin) return E('No permission', 403);
      const r = await st().getWithMetadata('resume/' + c, { type: 'arrayBuffer' });
      if (!r) return E('File not found', 404);
      const nm = String(r.metadata?.name || 'resume').replace(/[^\w.\- ]/g, '_');
      return new Response(r.data, { headers: { 'content-type': r.metadata?.type || 'application/octet-stream', 'content-disposition': `attachment; filename="${nm}"` } });
    }
    if (!isAdmin) return E('Only the admin can do this', 403);

    if (b === 'users') {
      const users = await rd('users', []);
      const view = u => ({ username: u.username, name: u.name, active: u.active, perms: u.perms });
      if (m === 'GET') return J({ users: users.map(view) });
      if (m === 'POST') {
        const body = await req.json().catch(() => ({}));
        const username = S(body.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, ''), name = S(body.name, 60), pw = String(body.password ?? '');
        if (!username || !name) return E('Name and username are required');
        if (pw.length < 8) return E('Password must be at least 8 characters');
        if (username === (process.env.ADMIN_USER || 'admin').toLowerCase() || users.some(u => u.username === username)) return E('This username is already taken');
        const salt = crypto.randomBytes(16).toString('hex');
        users.push({ username, name, salt, hash: hashPw(pw, salt), active: true, perms: cleanPerms(body.perms) });
        await wr('users', users); return J({ ok: true });
      }
      const i = users.findIndex(u => u.username === c);
      if (i < 0) return E('User not found', 404);
      if (m === 'PUT') {
        const body = await req.json().catch(() => ({}));
        if ('active' in body) users[i].active = !!body.active;
        if (body.perms) users[i].perms = cleanPerms(body.perms);
        if (body.password) {
          if (String(body.password).length < 8) return E('Password must be at least 8 characters');
          users[i].salt = crypto.randomBytes(16).toString('hex'); users[i].hash = hashPw(String(body.password), users[i].salt);
        }
        await wr('users', users); return J({ ok: true });
      }
      if (m === 'DELETE') { users.splice(i, 1); await wr('users', users); return J({ ok: true }); }
    }
    if (b === 'premium') {
      const list = await rd('premium', []);
      if (m === 'GET') return J({ list: list.sort((x, y) => y.ts - x.ts) });
      const i = list.findIndex(x => x.id === c);
      if (i < 0) return E('Not found', 404);
      if (m === 'PUT') {
        const body = await req.json().catch(() => ({}));
        if (['pending', 'active', 'placed', 'refunded', 'rejected', 'unpaid'].includes(body.status)) {
          list[i].status = body.status;
          if (body.status === 'active' && !list[i].activatedTs) list[i].activatedTs = Date.now();
        }
        if ('interviewSent' in body) list[i].interviewSent = !!body.interviewSent;
        await wr('premium', list); return J({ ok: true });
      }
    }
    if (b === 'shot' && m === 'GET') {
      const r = await st().getWithMetadata('shot/' + c, { type: 'arrayBuffer' });
      if (!r) return E('File not found', 404);
      return new Response(r.data, { headers: { 'content-type': r.metadata?.type || 'image/jpeg' } });
    }
    return E('Not found', 404);
  } catch (e) {
    return E('Server error', 500);
  }
};

export const config = { path: '/api/*' };
