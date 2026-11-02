/* Got UR Job – shared script (menu, header, chat assistant, voice guide) */
(function(){var mb=document.querySelector('.mb'),nv=document.querySelector('header nav');if(mb){mb.onclick=function(){var o=nv.classList.toggle('open');mb.setAttribute('aria-expanded',o)};nv.addEventListener('click',function(e){if(e.target.tagName==='A'){nv.classList.remove('open');mb.setAttribute('aria-expanded','false')}})}})();
(function(){
var w=document.getElementById('rw'),L=['Recruitment','Staffing','HR Solutions','Bulk Hiring','Executive Search'],n=0;
if(w&&!window.matchMedia('(prefers-reduced-motion:reduce)').matches){setInterval(function(){w.classList.add('out');setTimeout(function(){n=(n+1)%L.length;w.textContent=L[n];w.classList.remove('out')},350)},2400)}
var hd=document.querySelector('header');if(hd){var f=function(){hd.classList.toggle('sm',window.scrollY>60)};window.addEventListener('scroll',f,{passive:true});f()}
})();

(function(){var API='/.netlify/functions/chat',btn=document.getElementById('cbt'),pn=document.getElementById('cpn'),ms=document.getElementById('cms'),qs=document.getElementById('cqs'),inp=document.getElementById('ci'),hist=[],started=false;
var WA='https://wa.me/919991120155';
function go(a){var M={jobs:'jobs.html',cand:'apply.html#job',emp:'apply.html#hire',prem:'premium.html',terms:'employers.html#terms'};
if(a==='wa'){window.open(WA,'_blank');return}
if(M[a]){var here=location.pathname.split('/').pop()||'index.html',t=M[a].split('#')[0];if(here===t||(here===''&&t==='index.html')||(here.replace('.html','')===t.replace('.html','')))pn.hidden=true;location.href=M[a]}}
var AC={prem:'See Premium',jobs:'Browse jobs',cand:'Upload resume',emp:'Post a requirement',terms:'See our fees',wa:'Chat on WhatsApp'};
function add(t,who,acts){var d=document.createElement('div');d.className='cm '+who;d.textContent=t;if(acts&&acts.length){var c=document.createElement('div');c.className='cac';acts.forEach(function(a){var b=document.createElement('button');b.type='button';b.textContent=AC[a];b.onclick=function(){go(a)};c.appendChild(b)});d.appendChild(c)}ms.appendChild(d);ms.scrollTop=ms.scrollHeight;return d}
function local(t){t=t.toLowerCase();var m=function(r){return r.test(t)};
if(m(/^(hi|hello|hey|namaste)/))return["Hello! I can help with jobs, hiring, fees and contact details. What do you need?",['jobs','emp']];
if(m(/premium|membership|99/))return["Premium is an optional one-time ₹99 membership. Tell us what job you want and we help you reach the HR and try to get you interviews. No job guarantee. If we cannot send you to even one interview within 1.5 months, we refund ₹99.",['prem']];
if(m(/fee|charge|cost|price|free|registration|pay/)&&m(/candidate|seeker|do i|i have to|i pay|registration|free|apply|job|resume/))return["Searching and applying is free for candidates. Our placement fee is charged only to hiring companies. Premium membership (₹99, optional) means we find jobs for you.",['jobs','prem']];
if(m(/fee|charge|commission|cost|price|percent|ctc|rate/))return["Candidates do not pay a placement fee. Our fee is charged only to hiring companies, as a percentage of the candidate’s annual CTC, invoiced on successful joining:\n• Up to ₹10 LPA: 8.33%\n• ₹10.01–20 LPA: 10%\n• ₹20.01–30 LPA: 12.5%\n• ₹30.01 LPA and above: 15%\n\nTelecaller hiring: domestic ₹3,000–5,000, international ₹5,000–10,000, DRA certified ₹5,000 per joining.",['terms','emp']];
if(m(/contact|phone|call|number|email|mail|address|office|where|location|mohali/))return["Phone / WhatsApp: +91 99911 20155\nEmail: kuldeep.singh@goturjob.in\nAddress: 520, Mattaur Rd, Sector 71, SAS Nagar, Punjab 160071 (Pan India services)",['wa']];
if(m(/resume|cv|upload/))return["You can upload your resume (PDF or Word) in the candidate form. We will match you with suitable openings.",['cand']];
if(m(/hire|hiring|employer|vacanc|requirement|vendor|empanel|staff|recruit(?!ment process)/)&&!m(/job|opening/))return["We hire for permanent, contract and bulk roles across India. Share your requirement and we will send pre-screened profiles.",['emp','terms']];
if(m(/service|offer|do you do|what do you/))return["We offer permanent recruitment, contract staffing, bulk hiring, executive search, startup hiring, IT and non-IT hiring, BPO (domestic and international), healthcare, manufacturing, sales and marketing, logistics and warehouse, and NGO hiring.",['emp']];
if(m(/industr|sector/))return["We serve IT, banking and financial services, healthcare and hospitality, manufacturing, logistics, retail and e-commerce, BPO and telecom, startups, sales and marketing, real estate and FMCG, and NGOs."];
if(m(/process|how (does|do)|steps|work/))return["Our process: 1) requirement analysis, 2) candidate sourcing, 3) resume screening, 4) initial interview, 5) client interview coordination, 6) offer management, 7) joining support, 8) post-placement follow-up."];
if(m(/job|opening|vacanc|apply|work|fresher|salary/)){var f='';if(typeof JOBS!=='undefined'){var hit=JOBS.filter(function(j){return t.split(/\W+/).some(function(w){return w.length>3&&(j.t+' '+j.k).toLowerCase().indexOf(w)>-1})});if(hit.length)f='I found '+hit.length+' related opening'+(hit.length>1?'s':'')+' on the page. '}return[f+"You can search current openings, or send your profile and we will contact you when a role fits.",['jobs','cand']]}
return["I am not sure about that one. For a quick answer, please message us on WhatsApp.",['wa']]}
function typing(){return add('…','bot')}
function reply(t){hist.push({role:'user',content:t});var tp=typing(),done=false;
function fb(){if(done)return;done=true;var r=local(t);tp.remove();add(r[0],'bot',r[1]);hist.push({role:'assistant',content:r[0]})}
try{var ac=new AbortController(),to=setTimeout(function(){ac.abort()},15000);
fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hist.slice(-10)}),signal:ac.signal}).then(function(r){clearTimeout(to);if(!r.ok)throw 0;return r.json()}).then(function(d){if(done)return;if(!d||!d.reply)throw 0;done=true;tp.remove();add(d.reply,'bot',/job|opening/i.test(t)?['jobs']:null);hist.push({role:'assistant',content:d.reply})}).catch(fb)}catch(e){fb()}}
function send(t){t=(t||inp.value).trim();if(!t)return;inp.value='';add(t,'me');reply(t)}
function open(){pn.hidden=false;btn.setAttribute('aria-expanded','true');if(!started){started=true;add('Hi! I am the Got UR Job assistant. Ask me about jobs, hiring, fees or contact details.','bot');['Find a job','Hire staff','Your fees','Contact'].forEach(function(q){var b=document.createElement('button');b.type='button';b.textContent=q;b.onclick=function(){send(q==='Find a job'?'I want a job':q==='Hire staff'?'I want to hire staff':q==='Your fees'?'What are your fees':'How can I contact you')};qs.appendChild(b)})}setTimeout(function(){inp.focus()},50)}
btn.onclick=function(){if(pn.hidden)open();else{pn.hidden=true;btn.setAttribute('aria-expanded','false')}};
document.getElementById('cx').onclick=function(){pn.hidden=true;btn.setAttribute('aria-expanded','false')};
document.getElementById('cs').onclick=function(){send()};inp.addEventListener('keydown',function(e){if(e.key==='Enter')send()});
})();

(function(){
var ss=window.speechSynthesis;if(!ss||!window.SpeechSynthesisUtterance){return}
var btn=document.getElementById('vgb'),ico=document.getElementById('vgi'),lab=document.getElementById('vgl'),tip=document.getElementById('vgt');
var on=true;try{on=localStorage.getItem('vg_off')!=='1'}catch(e){}
var greeted=false,voice=null,tt=0;
var LANG='en';try{LANG=localStorage.getItem('vg_lang')==='hi'?'hi':'en'}catch(e){}
var MSGS={
en:{
welcome:'Welcome to Got UR Job website. If you are a recruiter, please click I want to hire, and enter your details below. If you are looking for a job, click I want a job. If you want assistance in Hindi, just click the Hindi button.',
hire:'Please enter your details. For help with what to fill in, you can also contact our consultants.',
job:'Enter your name, phone number and upload your resume to apply. Searching and applying for jobs is completely free.'},
hi:{
welcome:'गॉट यूअर जॉब वेबसाइट में आपका स्वागत है। अगर आप रिक्रूटर हैं, तो आई वॉन्ट टू हायर पर क्लिक करें, और नीचे अपनी डिटेल डाल दीजिए। अगर आप नौकरी ढूँढ रहे हैं, तो आई वॉन्ट अ जॉब पर क्लिक करें। अगर आपको इंग्लिश में सहायता चाहिए, तो इंग्लिश बटन पर क्लिक करें।',
hire:'कृपया अपनी डिटेल डाल दीजिए। इसमें आपको जो डिटेल डालनी है, उसके लिए आप हमारे कंसल्टेंट से संपर्क भी कर सकते हैं।',
job:'अपना नाम, फोन नंबर और रिज़्यूमे डालकर अप्लाई कीजिए। नौकरी ढूँढना और अप्लाई करना बिल्कुल मुफ़्त है।'},
hr:{
welcome:'Got UR Job website mein aapka swagat hai. Agar aap recruiter hain, to I want to hire par click karein, aur neeche apni details daal dijiye. Agar aap naukri dhoondh rahe hain, to I want a job par click karein. Agar aapko English mein sahayata chahiye, to English button par click karein.',
hire:'Kripya apni details daal dijiye. Isme aapko jo details daalni hain, uske liye aap hamare consultant se sampark bhi kar sakte hain.',
job:'Apna naam, phone number aur resume daalkar apply kijiye. Naukri dhoondhna aur apply karna bilkul muft hai.'}
};
var LC={en:'en-IN',hi:'hi-IN'};
function pick(){}
if(ss.onvoiceschanged!==undefined)ss.onvoiceschanged=pick;
var st=0,wd=0,au=null,AUOK={};
/* Prefer the most natural voice on the device: "Natural/Neural/Online" voices first, then Google, then the rest */
function score(v){var n=v.name||'',s=0;if(/natural|neural|online|enhanced|premium/i.test(n))s+=30;if(/google/i.test(n))s+=20;if(/microsoft|apple|siri|veena|rishi|neerja|prabhat|heera|ravi|swara|madhur/i.test(n))s+=10;if(/compact|espeak/i.test(n))s-=20;if(v.localService===false)s+=3;return s}
function findVoice(l){var v=(ss.getVoices()||[]).slice(),c=v.filter(function(x){return(l==='hi'?/^hi/i:/^en[-_]IN/i).test(x.lang)});
if(!c.length&&l==='hi')c=v.filter(function(x){return/hindi|हिन्दी|हिंदी/i.test(x.name)});
if(!c.length&&l==='en')c=v.filter(function(x){return/^en/i.test(x.lang)});
if(!c.length)return null;c.sort(function(a,b){return score(b)-score(a)});return c[0]}
function ui(){btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',on);ico.textContent=on?'🔊':'🔇';lab.textContent=on?'Voice guide':'Voice off'}
function shownFor(k){return(LANG==='hi'?MSGS.hi:MSGS.en)[k]}
function hideTip(ms){clearTimeout(tt);tt=setTimeout(function(){tip.classList.remove('show')},ms==null?2500:ms)}
function stopAll(){try{ss.cancel()}catch(e){}if(au){try{au.pause()}catch(e){}au=null}}
/* 1) A recorded human voice file (voice/en_welcome.mp3 etc.) is played if it exists. 2) Otherwise the device voice speaks, slowly and at a lower pitch, one sentence at a time. */
function say(k,fb){if(!on)return;stopAll();clearTimeout(st);clearTimeout(wd);
var key=LANG+'_'+k;
if(!fb&&AUOK[key]!==false){try{var a=new Audio('voice/'+key+'.mp3');au=a;
a.onplaying=function(){AUOK[key]=true;tip.textContent=shownFor(k);tip.classList.add('show');clearTimeout(tt)};
a.onended=function(){hideTip()};
a.onerror=function(){if(au===a){au=null;AUOK[key]=false;speak(k,false)}};
var pr=a.play();if(pr&&pr.catch)pr.catch(function(err){if(au!==a)return;au=null;if(err&&err.name==='NotAllowedError')return;AUOK[key]=false;speak(k,false)});
return}catch(e){}}
speak(k,fb)}
function speak(k,fb){
var hv=(LANG==='hi'&&!fb)?findVoice('hi'):null,useHi=LANG==='hi'&&!!hv,txt,lang,vo,rate,pitch;
if(LANG==='en'){txt=MSGS.en[k];lang='en-IN';vo=findVoice('en');rate=.9;pitch=.82}
else if(useHi){txt=MSGS.hi[k];lang='hi-IN';vo=hv;rate=.9;pitch=.88}
else{txt=MSGS.hr[k];lang='en-IN';vo=findVoice('en');rate=.88;pitch=.82}
if(!txt)return;var shown=shownFor(k);
st=setTimeout(function(){
var parts=(txt.match(/[^.!?।]+[.!?।]*/g)||[txt]).map(function(s){return s.trim()}).filter(Boolean),bad=false;
parts.forEach(function(s,i){var u=new SpeechSynthesisUtterance(s);u.lang=lang;if(vo)u.voice=vo;u.rate=rate;u.pitch=pitch;u.volume=1;
if(i===0)u.onstart=function(){clearTimeout(wd);tip.textContent=shown;tip.classList.add('show');clearTimeout(tt)};
if(i===parts.length-1)u.onend=function(){clearTimeout(wd);hideTip()};
u.onerror=function(e){var er=e&&e.error;if(er==='canceled'||er==='interrupted'||bad)return;bad=true;clearTimeout(wd);if(useHi){say(k,true);return}hideTip(1500)};
try{ss.resume()}catch(x){}
ss.speak(u)});
if(useHi){wd=setTimeout(function(){try{ss.cancel()}catch(e){}say(k,true)},3500)}
},90)}
var PG=document.body.getAttribute('data-page')||'',SEEN=false;try{SEEN=sessionStorage.getItem('vg_seen')==='1'}catch(e){}
function initKey(){if(PG==='home')return 'welcome';if(PG==='apply')return location.hash==='#hire'?'hire':'job';return null}
function greet(){if(greeted)return;greeted=true;var k=initKey();if(!k)return;if(k==='welcome'){if(SEEN)return;try{sessionStorage.setItem('vg_seen','1')}catch(e){}}say(k)}
/* Browsers allow sound only after the visitor touches the page, so greet on the first tap, key press or scroll */
['pointerdown','keydown','touchstart','wheel'].forEach(function(ev){window.addEventListener(ev,function f(e){if(e.isTrusted===false)return;greet();window.removeEventListener(ev,f,true)},{capture:true,passive:true})});
/* a real scroll counts too, but only after the visitor has actually moved (ignore the scroll restore at page load) */
var sy0=null;window.addEventListener('scroll',function s(){if(sy0===null){sy0=window.scrollY;return}if(Math.abs(window.scrollY-sy0)>40){greet();window.removeEventListener('scroll',s)}},{passive:true});
setTimeout(function(){sy0=window.scrollY},800);
btn.addEventListener('click',function(e){e.stopPropagation();on=!on;try{localStorage.setItem('vg_off',on?'0':'1')}catch(x){}ui();if(on){greeted=true;say('welcome')}else{stopAll();tip.classList.remove('show')}});
window.addEventListener('gu-tab',function(e){greeted=true;say(e.detail)});
['t-job','t-hire'].forEach(function(id){var b=document.getElementById(id);if(b)b.addEventListener('click',function(){greeted=true;say(id==='t-hire'?'hire':'job')})});
ui();
var lb=document.getElementById('vglang');
function lui(){lb.textContent=LANG==='en'?'हिंदी':'English'}
lb.addEventListener('click',function(e){e.stopPropagation();LANG=LANG==='en'?'hi':'en';try{localStorage.setItem('vg_lang',LANG)}catch(x){}pick();lui();greeted=true;if(!on){on=true;try{localStorage.setItem('vg_off','0')}catch(x){}ui()}say('welcome')});
lui();
})();

