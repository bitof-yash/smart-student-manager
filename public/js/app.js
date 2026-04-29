const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5050/api' : `${window.location.origin}/api`;
const STORAGE_KEYS = {
  subjects: 'ssm_subjects',
  tasks: 'ssm_tasks',
  pomo: 'ssm_pomo',
  achievements: 'ssm_achievements',
  xp: 'ssm_xp',
  streak: 'ssm_streak',
  lastActive: 'ssm_last_active',
  timetable: 'ssm_timetable',
  geminiApiKey: 'ssm_gemini_key',
  freeExtractions: 'ssm_ai_uses',
  heatmap: 'ssm_heatmap',
  token: 'studyos_token',
  user: 'studyos_loggedin'
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

let subjects = readJSON(STORAGE_KEYS.subjects, []);
let tasks = readJSON(STORAGE_KEYS.tasks, []);
let pomodoroSessions = readJSON(STORAGE_KEYS.pomo, []);
let achievements = readJSON(STORAGE_KEYS.achievements, []);
let xp = parseInt(localStorage.getItem(STORAGE_KEYS.xp) || '0', 10);
let streak = parseInt(localStorage.getItem(STORAGE_KEYS.streak) || '0', 10);
let lastActive = localStorage.getItem(STORAGE_KEYS.lastActive) || '';
let currentFilter = 'all';
let timetable = readJSON(STORAGE_KEYS.timetable, []);
let geminiApiKey = localStorage.getItem(STORAGE_KEYS.geminiApiKey) || '';
let uploadedImage = null;
let freeExtractions = parseInt(localStorage.getItem(STORAGE_KEYS.freeExtractions) || '0', 10);
let heatmap = readJSON(STORAGE_KEYS.heatmap, {});
const FREE_LIMIT = 100;
let attChart, taskChart, trendChart;
let pomoTimer = null, pomoSeconds = 25*60, pomoRunning = false, pomoMode = 'focus', pomoToday = 0;
const POMO_DUR = { focus:25*60, short:5*60, long:15*60 };
const SUBJECT_COLORS = ['#2383e2','#e03e3e','#0f7b6c','#dfab01','#9b59b6','#e67e22','#1abc9c','#e74c3c'];
let authToken = localStorage.getItem(STORAGE_KEYS.token) || '';
let authUser = readJSON(STORAGE_KEYS.user, null);
let syncTimer = null;
let initialLoadComplete = false;

function isAuthenticated() {
  return Boolean(authToken);
}

function serializeId(id) {
  return JSON.stringify(String(id));
}

function normalizeCollection(items, prefix) {
  return (items || []).map((item, index) => ({
    ...item,
    id: String(item.id || item._id || `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`)
  }));
}

function captureState() {
  return {
    subjects,
    tasks,
    pomodoroSessions,
    achievements,
    xp,
    streak,
    lastActive,
    timetable,
    geminiApiKey,
    freeExtractions,
    heatmap
  };
}

function persistLocalCache() {
  localStorage.setItem(STORAGE_KEYS.subjects, JSON.stringify(subjects));
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  localStorage.setItem(STORAGE_KEYS.pomo, JSON.stringify(pomodoroSessions));
  localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(achievements));
  localStorage.setItem(STORAGE_KEYS.xp, String(xp));
  localStorage.setItem(STORAGE_KEYS.streak, String(streak));
  localStorage.setItem(STORAGE_KEYS.lastActive, lastActive);
  localStorage.setItem(STORAGE_KEYS.timetable, JSON.stringify(timetable));
  localStorage.setItem(STORAGE_KEYS.geminiApiKey, geminiApiKey);
  localStorage.setItem(STORAGE_KEYS.freeExtractions, String(freeExtractions));
  localStorage.setItem(STORAGE_KEYS.heatmap, JSON.stringify(heatmap));
}

function setState(data = {}) {
  subjects = normalizeCollection(data.subjects || [], 'subject');
  tasks = normalizeCollection(data.tasks || [], 'task');
  pomodoroSessions = data.pomodoroSessions || [];
  achievements = data.achievements || [];
  xp = Number(data.xp) || 0;
  streak = Number(data.streak) || 0;
  lastActive = data.lastActive || '';
  timetable = normalizeCollection(data.timetable || [], 'tt');
  geminiApiKey = data.geminiApiKey || '';
  freeExtractions = Number(data.freeExtractions) || 0;
  heatmap = data.heatmap && typeof data.heatmap === 'object' ? data.heatmap : {};
  persistLocalCache();
}

function hasGuestData() {
  return subjects.length || tasks.length || pomodoroSessions.length || timetable.length || achievements.length || xp > 0 || streak > 0 || Object.keys(heatmap).length;
}

function isWorkspaceEmpty(data = {}) {
  return !(
    (data.subjects || []).length ||
    (data.tasks || []).length ||
    (data.pomodoroSessions || []).length ||
    (data.timetable || []).length ||
    (data.achievements || []).length ||
    Number(data.xp) ||
    Number(data.streak) ||
    Object.keys(data.heatmap || {}).length
  );
}

function updateAuthUI() {
  const status = document.getElementById('authStatus');
  const button = document.getElementById('authActionBtn');
  if (status) status.textContent = isAuthenticated() ? `Signed in as ${authUser?.name || 'Student'}` : 'Guest mode';
  if (button) button.textContent = isAuthenticated() ? 'Logout' : 'Login';
}

function updateSyncStatus(message) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = message;
}

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (isAuthenticated()) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function requestApi(path, options = {}) {
  const headers = getAuthHeaders(options.headers || {});
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function persistRemoteData() {
  if (!isAuthenticated() || !initialLoadComplete) return;
  try {
    updateSyncStatus('Saving...');
    await requestApi('/user-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureState())
    });
    updateSyncStatus('Synced');
  } catch (error) {
    console.error('Sync failed:', error);
    updateSyncStatus('Sync error');
  }
}

function scheduleRemoteSync() {
  persistLocalCache();
  if (!isAuthenticated() || !initialLoadComplete) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => persistRemoteData(), 350);
}

function clearSession() {
  authToken = '';
  authUser = null;
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

function handleAuthAction() {
  if (isAuthenticated()) {
    clearSession();
    updateAuthUI();
    updateSyncStatus('Guest mode');
  }
  window.location.href = 'login.html';
}

async function initializeApp() {
  updateAuthUI();
  updateSyncStatus(isAuthenticated() ? 'Connecting...' : 'Guest mode');

  if (isAuthenticated()) {
    try {
      const response = await requestApi('/user-data');
      authUser = response.user || authUser;
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(authUser));
      if (isWorkspaceEmpty(response.data) && hasGuestData()) {
        await requestApi('/user-data', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(captureState())
        });
      } else {
        setState(response.data);
      }
      updateSyncStatus('Synced');
    } catch (error) {
      console.error('Failed to load cloud data:', error);
      clearSession();
      updateSyncStatus('Guest mode');
    }
  }

  syncSubjectsFromTimetable();
  updateStreak();
  updateXPDisplay();
  renderSubjects();
  renderTasks();
  renderDashboard();
  renderHeatmap();
  renderAchievements();
  updatePomoStats();
  updatePomoDisplay();
  populateTaskSubjectDropdown();
  renderTimetable();
  updateDateDisplay();
  initApiKeyUI();
  updateAuthUI();
  initialLoadComplete = true;
  scheduleRemoteSync();
}

function syncSubjectsFromTimetable() {
  const unique = [...new Set(timetable.map(c => c.subject).filter(Boolean))];
  let added = 0;
  unique.forEach(name => {
    const exists = subjects.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!exists) {
      subjects.push({ id: `subject-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), total: 0, attended: 0, color: SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length] });
      added++;
    }
  });
  if (added > 0) { save('subjects'); }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
});

function updateDateDisplay() {
  const el = document.getElementById('dateDisplay');
  if (el) el.textContent = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}

function showPage(page, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  if (navEl) {
    navEl.classList.add('active');
  } else {
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.getAttribute('onclick') && n.getAttribute('onclick').includes(`'${page}'`)) n.classList.add('active');
    });
  }
  const titles = {dashboard:'Dashboard',attendance:'Attendance',tasks:'Tasks',timetable:'Timetable',pomodoro:'Focus Timer',analytics:'Analytics',achievements:'Achievements'};
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;
  if (page==='analytics') renderAnalytics();
  if (page==='dashboard') renderDashboard();
  if (page==='timetable') { renderTimetable(); initApiKeyUI(); }
  closeSidebar();
}

function addXP(n) { xp+=n; scheduleRemoteSync(); updateXPDisplay(); checkAchievements(); }

function updateXPDisplay() {
  const level=Math.floor(xp/100)+1, cur=xp%100;
  const bar=document.getElementById('xpBar'), text=document.getElementById('xpText'), badge=document.getElementById('levelBadge');
  if(bar) bar.style.width=cur+'%';
  if(text) text.textContent=`${cur} / 100 XP`;
  if(badge) badge.textContent=`LVL ${level}`;
}

function updateStreak() {
  const today=new Date().toDateString(), yesterday=new Date(Date.now()-86400000).toDateString();
  if (lastActive===today) {}
  else if (lastActive===yesterday) { streak++; }
  else { streak=1; }
  lastActive=today;
  scheduleRemoteSync();
  const el=document.getElementById('streakDisplay');
  if(el) el.textContent=`${streak} day streak`;
}

function addSubject() {
  const name=document.getElementById('subjectName').value.trim();
  const total=parseInt(document.getElementById('subjectTotal').value)||0;
  const attended=parseInt(document.getElementById('subjectAttended').value)||0;
  if(!name){showToast('⚠️','Missing Name','Enter a subject name');return;}
  if(attended>total){showToast('⚠️','Invalid','Attended cannot exceed total');return;}
  subjects.push({id:`subject-${Date.now()}`,name,total,attended,color:SUBJECT_COLORS[subjects.length%SUBJECT_COLORS.length]});
  save('subjects');
  document.getElementById('subjectName').value='';
  document.getElementById('subjectTotal').value='';
  document.getElementById('subjectAttended').value='';
  renderSubjects(); renderDashboard(); populateTaskSubjectDropdown(); addXP(10); showToast('📚','Subject Added',name);
}

function markAttendance(id,type) {
  const s=subjects.find(s=>String(s.id)===String(id)); if(!s) return;
  s.total++; if(type==='present') s.attended++;
  save('subjects'); renderSubjects(); renderDashboard();
  addXP(type==='present'?5:1);
  showToast(type==='present'?'✅':'❌',type==='present'?'Present':'Absent',s.name);
}

function deleteSubject(id) {
  if(!confirm('Delete this subject?')) return;
  subjects=subjects.filter(s=>String(s.id)!==String(id)); save('subjects');
  renderSubjects(); renderDashboard(); populateTaskSubjectDropdown();
}

function renderSubjects() {
  const list=document.getElementById('subjectList'), count=document.getElementById('subjectCount');
  if(!list) return;
  if(count) count.textContent=`${subjects.length} subject${subjects.length!==1?'s':''} tracked`;
  if(subjects.length===0){list.innerHTML=`<div class="empty-state"><div class="es-ico">📚</div><p>No subjects added yet.</p></div>`;return;}
  list.innerHTML=subjects.map(s=>{
    const pct=s.total>0?Math.round(s.attended/s.total*100):0;
    const color=pct>=75?'var(--success)':pct>=60?'var(--warning)':'var(--danger)';
    return `<div class="subject-item">
      <div class="sub-color" style="background:${s.color}"></div>
      <div class="sub-info">
        <div class="sub-name">${s.name}</div>
        <div class="sub-stats">${s.attended}/${s.total} classes</div>
        <div class="pct-bar"><div class="pct-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <div class="sub-pct" style="color:${color}">${pct}%</div>
      <div class="att-btns">
        <button class="att-btn present" onclick="markAttendance(${serializeId(s.id)},'present')">✓ Present</button>
        <button class="att-btn absent" onclick="markAttendance(${serializeId(s.id)},'absent')">✗ Absent</button>
      </div>
      <button class="sub-del" onclick="deleteSubject(${serializeId(s.id)})">🗑</button>
    </div>`;
  }).join('');
}

function populateTaskSubjectDropdown() {
  const sel=document.getElementById('taskSubject'); if(!sel) return;
  sel.innerHTML='<option value="">General</option>';
  subjects.forEach(s=>sel.innerHTML+=`<option value="${s.name}">${s.name}</option>`);
}

function addTask() {
  const title=document.getElementById('taskTitle').value.trim();
  const subject=document.getElementById('taskSubject').value;
  const priority=document.getElementById('taskPriority').value;
  const date=document.getElementById('taskDate').value;
  if(!title){showToast('⚠️','Missing Title','Enter a task title');return;}
  tasks.push({id:`task-${Date.now()}`,title,subject,priority,date,completed:false,createdAt:new Date().toISOString()});
  save('tasks');
  document.getElementById('taskTitle').value=''; document.getElementById('taskDate').value='';
  renderTasks(); renderDashboard(); addXP(5); showToast('✅','Task Created',title);
}

function toggleTask(id) {
  const t=tasks.find(t=>String(t.id)===String(id)); if(!t) return;
  t.completed=!t.completed;
  if(t.completed){
    const td=new Date().toDateString(); heatmap[td]=(heatmap[td]||0)+1;
    scheduleRemoteSync();
    addXP(10); showToast('🎉','Task Complete!',t.title); renderHeatmap();
  }
  save('tasks'); renderTasks(); renderDashboard(); checkAchievements();
}

function deleteTask(id) { tasks=tasks.filter(t=>String(t.id)!==String(id)); save('tasks'); renderTasks(); renderDashboard(); }

function filterTasks(filter,btn) {
  currentFilter=filter;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderTasks();
}

function renderTasks(listId='taskList') {
  const list=document.getElementById(listId); if(!list) return;
  const now=new Date(); now.setHours(0,0,0,0);
  let filtered=[...tasks];
  if(currentFilter==='pending')   filtered=filtered.filter(t=>!t.completed);
  if(currentFilter==='completed') filtered=filtered.filter(t=>t.completed);
  if(currentFilter==='overdue')   filtered=filtered.filter(t=>t.date&&!t.completed&&new Date(t.date)<now);
  filtered.sort((a,b)=>{
    if(a.completed!==b.completed) return a.completed?1:-1;
    const p={high:0,medium:1,low:2}; return (p[a.priority]||1)-(p[b.priority]||1);
  });
  if(filtered.length===0){list.innerHTML=`<div class="empty-state"><div class="es-ico">✅</div><p>${currentFilter==='all'?'No tasks yet. Create your first task above!':'Nothing in this filter.'}</p></div>`;return;}
  list.innerHTML=filtered.map(t=>{
    const overdue=t.date&&!t.completed&&new Date(t.date)<now;
    const dateStr=t.date?new Date(t.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
    return `<div class="task-item${t.completed?' done':''}">
      <div class="task-check" onclick="toggleTask(${serializeId(t.id)})">${t.completed?'✓':''}</div>
      <div class="task-body">
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <span class="pri pri-${t.priority}">${t.priority}</span>
          ${t.subject?`<span class="tag">${t.subject}</span>`:''}
          ${dateStr?`<span class="task-date${overdue?' overdue':''}">📅 ${dateStr}${overdue?' · overdue':''}</span>`:''}
        </div>
      </div>
      <button class="task-del" onclick="deleteTask(${serializeId(t.id)})">🗑</button>
    </div>`;
  }).join('');
}

function renderDashboard() {
  const avgAtt=subjects.length>0?Math.round(subjects.reduce((a,s)=>a+(s.total>0?s.attended/s.total*100:0),0)/subjects.length):null;
  const done=tasks.filter(t=>t.completed).length;
  const totalMins=pomodoroSessions.filter(s=>s.mode==='focus').reduce((a,s)=>a+(s.duration||25),0);
  const g=id=>document.getElementById(id);
  if(g('statSubjects'))  g('statSubjects').textContent=subjects.length;
  if(g('statAvgAtt'))    g('statAvgAtt').textContent=avgAtt!==null?`${avgAtt}%`:'--%';
  if(g('statTasksDone')) g('statTasksDone').textContent=done;
  if(g('statFocusHours'))g('statFocusHours').textContent=`${Math.floor(totalMins/60)}h`;
  renderGradePrediction(); renderAlerts(); renderRecentTasks(); renderDashSubjects();
}

function renderGradePrediction() {
  if(subjects.length===0) return;
  const avgAtt=subjects.reduce((a,s)=>a+(s.total>0?s.attended/s.total*100:0),0)/subjects.length;
  const taskRate=tasks.length>0?tasks.filter(t=>t.completed).length/tasks.length*100:0;
  const focus=Math.min(pomodoroSessions.length*2,100);
  const score=avgAtt*0.5+taskRate*0.3+focus*0.2;
  const conf=Math.min(Math.round(subjects.length*10+tasks.length*5),90);
  let grade,color;
  if(score>=90){grade='A+';color='#0f7b6c';}else if(score>=80){grade='A';color='#0f7b6c';}
  else if(score>=70){grade='B';color='#2383e2';}else if(score>=60){grade='C';color='#c57b0e';}
  else{grade='D';color='#d44c47';}
  const g=id=>document.getElementById(id);
  if(g('predGrade')){g('predGrade').textContent=grade;g('predGrade').style.color=color;}
  if(g('predScore'))       g('predScore').textContent=`Predicted score: ${Math.round(score)}%`;
  if(g('predConfidence'))  g('predConfidence').textContent=`${conf}%`;
  if(g('confBar'))         g('confBar').style.width=conf+'%';
  if(g('predRecommendation')) g('predRecommendation').textContent=score<75?'⚠️ Focus on improving attendance and completing more tasks.':'✅ You\'re on track! Keep up the consistency.';
}

function renderAlerts() {
  const box=document.getElementById('alertsContainer'); if(!box) return;
  const now=new Date(); now.setHours(0,0,0,0);
  const alerts=[];
  subjects.forEach(s=>{const pct=s.total>0?s.attended/s.total*100:100;if(pct<75&&s.total>0) alerts.push({type:'danger',icon:'📉',title:`Low attendance: ${s.name}`,msg:`${Math.round(pct)}% — need 75%`});});
  tasks.forEach(t=>{
    if(!t.completed&&t.date){
      const diff=Math.ceil((new Date(t.date)-now)/86400000);
      if(diff<0) alerts.push({type:'danger',icon:'🔴',title:`Overdue: ${t.title}`,msg:`${-diff} day(s) ago`});
      else if(diff<=2) alerts.push({type:'warning',icon:'⏰',title:`Due soon: ${t.title}`,msg:`Due in ${diff} day(s)`});
    }
  });
  if(alerts.length===0){box.innerHTML=`<div class="alert alert-info"><span>✅</span><div><strong>All Clear</strong><br/><small>No issues detected.</small></div></div>`;return;}
  box.innerHTML=alerts.slice(0,4).map(a=>`<div class="alert alert-${a.type}"><span>${a.icon}</span><div><strong>${a.title}</strong><br/><small>${a.msg}</small></div></div>`).join('');
}

function renderRecentTasks() {
  const el=document.getElementById('recentTasks'); if(!el) return;
  const recent=tasks.slice(-5).reverse();
  if(recent.length===0){el.innerHTML=`<div class="empty-state"><div class="es-ico">📝</div><p>No tasks yet</p></div>`;return;}
  el.innerHTML=recent.map(t=>`<div class="task-item${t.completed?' done':''}">
    <div class="task-check" onclick="toggleTask(${serializeId(t.id)})">${t.completed?'✓':''}</div>
    <div class="task-body"><div class="task-title">${t.title}</div>
    <div class="task-meta"><span class="pri pri-${t.priority}">${t.priority}</span>${t.subject?`<span class="tag">${t.subject}</span>`:''}</div></div>
  </div>`).join('');
}

function renderDashSubjects() {
  const el=document.getElementById('dashSubjectList'); if(!el) return;
  if(subjects.length===0){el.innerHTML=`<div class="empty-state"><div class="es-ico">📚</div><p>No subjects added yet</p></div>`;return;}
  el.innerHTML=subjects.map(s=>{
    const pct=s.total>0?Math.round(s.attended/s.total*100):0;
    const color=pct>=75?'var(--success)':pct>=60?'var(--warning)':'var(--danger)';
    return `<div class="subject-item">
      <div class="sub-color" style="background:${s.color}"></div>
      <div class="sub-info"><div class="sub-name">${s.name}</div><div class="pct-bar" style="margin-top:5px;"><div class="pct-fill" style="width:${pct}%;background:${color}"></div></div></div>
      <div class="sub-pct" style="color:${color}">${pct}%</div>
    </div>`;
  }).join('');
}

function renderHeatmap() {
  const grid=document.getElementById('heatmapGrid'), months=document.getElementById('heatmapMonths');
  if(!grid) return;
  const today=new Date(); const cells=[]; const mLabels={};
  for(let i=83;i>=0;i--){
    const d=new Date(today); d.setDate(d.getDate()-i);
    const key=d.toDateString(), count=heatmap[key]||0;
    const level=count===0?0:count<=1?1:count<=3?2:count<=5?3:4;
    if(d.getDate()===1) mLabels[83-i]=d.toLocaleDateString('en-US',{month:'short'});
    cells.push(`<div class="hmap-cell" data-l="${level}" title="${key}: ${count} task(s)"></div>`);
  }
  grid.innerHTML=cells.join('');
  if(months){
    months.innerHTML='';
    Object.entries(mLabels).forEach(([pos,name])=>{
      const span=document.createElement('span');
      span.style.cssText=`position:absolute;left:${(parseInt(pos)/84*100).toFixed(1)}%`;
      span.textContent=name; months.appendChild(span);
    });
  }
}

function setPomoMode(mode,btn) {
  pomoMode=mode; pomoSeconds=POMO_DUR[mode]; pomoRunning=false; clearInterval(pomoTimer);
  document.querySelectorAll('.pomo-mode').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const labels={focus:'FOCUS',short:'SHORT BREAK',long:'LONG BREAK'};
  const lbl=document.getElementById('pomoModeLabel'); if(lbl) lbl.textContent=labels[mode];
  const sb=document.getElementById('pomoStartBtn'); if(sb) sb.textContent='▶ Start';
  updatePomoDisplay();
}

function togglePomo() {
  if(pomoRunning){
    pomoRunning=false; clearInterval(pomoTimer);
    const sb=document.getElementById('pomoStartBtn'); if(sb) sb.textContent='▶ Resume';
  } else {
    pomoRunning=true;
    const sb=document.getElementById('pomoStartBtn'); if(sb) sb.textContent='⏸ Pause';
    pomoTimer=setInterval(()=>{
      pomoSeconds--; updatePomoDisplay();
      if(pomoSeconds<=0){clearInterval(pomoTimer);pomoRunning=false;onPomoComplete();}
    },1000);
  }
}

function resetPomo() {
  clearInterval(pomoTimer); pomoRunning=false; pomoSeconds=POMO_DUR[pomoMode]; updatePomoDisplay();
  const sb=document.getElementById('pomoStartBtn'); if(sb) sb.textContent='▶ Start';
}

function onPomoComplete() {
  if(pomoMode==='focus'){
    pomoToday++;
    pomodoroSessions.push({date:new Date().toISOString(),duration:25,mode:'focus'});
    save('pomo'); addXP(20); showToast('🎉','Focus Session Done!','Great work! Take a break.');
    updatePomoStats(); checkAchievements();
    const td=new Date().toDateString(); heatmap[td]=(heatmap[td]||0)+0.5;
    scheduleRemoteSync(); renderHeatmap();
  }
  const sb=document.getElementById('pomoStartBtn'); if(sb) sb.textContent='▶ Start';
}

function updatePomoDisplay() {
  const m=Math.floor(pomoSeconds/60).toString().padStart(2,'0');
  const s=(pomoSeconds%60).toString().padStart(2,'0');
  const te=document.getElementById('pomoTime'); if(te) te.textContent=`${m}:${s}`;
  const prog=document.getElementById('pomoProgress');
  if(prog){
    const circ=2*Math.PI*88;
    const offset=circ*(pomoSeconds/POMO_DUR[pomoMode]);
    prog.style.strokeDasharray=circ;
    prog.style.strokeDashoffset=circ-(circ-offset);
  }
}

function updatePomoStats() {
  const today=new Date().toDateString(), weekAgo=new Date(Date.now()-7*86400000);
  const ts=pomodoroSessions.filter(s=>new Date(s.date).toDateString()===today).length;
  const ws=pomodoroSessions.filter(s=>new Date(s.date)>=weekAgo).length;
  const tm=pomodoroSessions.filter(s=>s.mode==='focus').reduce((a,s)=>a+(s.duration||25),0);
  const g=id=>document.getElementById(id);
  if(g('statTodaySessions')) g('statTodaySessions').textContent=ts;
  if(g('statWeekSessions'))  g('statWeekSessions').textContent=ws;
  if(g('statTotalSessions')) g('statTotalSessions').textContent=pomodoroSessions.length;
  if(g('statFocusTime'))     g('statFocusTime').textContent=`${Math.floor(tm/60)}h`;
  if(g('statFocusHours'))    g('statFocusHours').textContent=`${Math.floor(tm/60)}h`;
  if(g('pomoSessionCount'))  g('pomoSessionCount').textContent=`Sessions today: ${ts} · Total: ${pomodoroSessions.length}`;
  const el=document.getElementById('pomoAISuggestions'); if(!el) return;
  let msg,type;
  if(pomodoroSessions.length===0){msg={icon:'💡',ttl:'Start your first session!',desc:'25-minute focus blocks boost productivity.'};type='info';}
  else if(ts===0){msg={icon:'🌅',ttl:'No sessions today',desc:'Try to get at least 4 sessions in!'};type='warning';}
  else if(ts>=4){msg={icon:'🔥',ttl:'Great focus day!',desc:`${ts} sessions done. Take a proper break!`};type='success';}
  else{msg={icon:'📈',ttl:`${ts} session${ts!==1?'s':''} today`,desc:`${ws} sessions this week. Aim for 4 per day!`};type='info';}
  el.innerHTML=`<div class="alert alert-${type}"><span>${msg.icon}</span><div><strong>${msg.ttl}</strong><br/><small>${msg.desc}</small></div></div>`;
}

function renderAnalytics() {
  const avgAtt=subjects.length>0?Math.round(subjects.reduce((a,s)=>a+(s.total>0?s.attended/s.total*100:0),0)/subjects.length):0;
  const taskRate=tasks.length>0?Math.round(tasks.filter(t=>t.completed).length/tasks.length*100):0;
  const totalMins=pomodoroSessions.reduce((a,s)=>a+(s.duration||25),0);
  const g=id=>document.getElementById(id);
  if(g('anaOverallAtt'))  g('anaOverallAtt').textContent=`${avgAtt}%`;
  if(g('anaTaskRate'))    g('anaTaskRate').textContent=`${taskRate}%`;
  if(g('anaFocusTotal'))  g('anaFocusTotal').textContent=`${Math.floor(totalMins/60)}h`;
  renderAttChart(); renderTaskChart(); renderTrendChart();
}

function renderAttChart() {
  const ctx=document.getElementById('attChart'); if(!ctx||subjects.length===0) return;
  if(attChart) attChart.destroy();
  attChart=new Chart(ctx,{type:'bar',data:{labels:subjects.map(s=>s.name),datasets:[{label:'Attendance %',data:subjects.map(s=>s.total>0?Math.round(s.attended/s.total*100):0),backgroundColor:subjects.map(s=>s.color+'bb'),borderColor:subjects.map(s=>s.color),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100,grid:{color:'rgba(0,0,0,0.04)'}},x:{grid:{display:false}}}}});
}

function renderTaskChart() {
  const ctx=document.getElementById('taskChart'); if(!ctx||tasks.length===0) return;
  if(taskChart) taskChart.destroy();
  const h=tasks.filter(t=>t.priority==='high').length,m=tasks.filter(t=>t.priority==='medium').length,l=tasks.filter(t=>t.priority==='low').length;
  taskChart=new Chart(ctx,{type:'doughnut',data:{labels:['High','Medium','Low'],datasets:[{data:[h,m,l],backgroundColor:['#e03e3e','#dfab01','#0f7b6c'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:12}}},cutout:'65%'}});
}

function renderTrendChart() {
  const ctx=document.getElementById('trendChart'); if(!ctx) return;
  if(trendChart) trendChart.destroy();
  const labels=[],data=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);labels.push(d.toLocaleDateString('en-US',{weekday:'short'}));data.push(Math.floor(heatmap[d.toDateString()]||0));}
  trendChart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Tasks Completed',data,borderColor:'#2383e2',backgroundColor:'rgba(35,131,226,0.07)',borderWidth:2,pointBackgroundColor:'#2383e2',pointRadius:4,fill:true,tension:0.4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{stepSize:1}},x:{grid:{display:false}}}}});
}

const ACHIEVE_LIST=[
  {id:'first_subject',icon:'📚',name:'Scholar',desc:'Add your first subject',check:()=>subjects.length>=1},
  {id:'first_task',icon:'✅',name:'Go-Getter',desc:'Complete your first task',check:()=>tasks.some(t=>t.completed)},
  {id:'five_tasks',icon:'🏅',name:'Task Master',desc:'Complete 5 tasks',check:()=>tasks.filter(t=>t.completed).length>=5},
  {id:'first_pomo',icon:'⏱️',name:'Focused',desc:'Complete a Pomodoro session',check:()=>pomodoroSessions.length>=1},
  {id:'ten_pomo',icon:'🔥',name:'On Fire',desc:'Complete 10 focus sessions',check:()=>pomodoroSessions.length>=10},
  {id:'att_star',icon:'⭐',name:'Attendance Star',desc:'90%+ in any subject',check:()=>subjects.some(s=>s.total>=5&&s.attended/s.total>=0.9)},
  {id:'streak_3',icon:'🔁',name:'Consistent',desc:'3-day login streak',check:()=>streak>=3},
  {id:'streak_7',icon:'🏆',name:'Dedicated',desc:'7-day streak',check:()=>streak>=7}
];

function checkAchievements() {
  let n=0;
  ACHIEVE_LIST.forEach(a=>{if(!achievements.includes(a.id)&&a.check()){achievements.push(a.id);n++;showToast('🏆','Achievement Unlocked!',a.name);addXP(50);}});
  if(n>0){save('achievements');renderAchievements();}
}

function renderAchievements() {
  const grid=document.getElementById('achievementsGrid'),count=document.getElementById('achieveCount'); if(!grid) return;
  const unlocked=ACHIEVE_LIST.filter(a=>achievements.includes(a.id)).length;
  if(count) count.textContent=`${unlocked} / ${ACHIEVE_LIST.length} unlocked`;
  grid.innerHTML=ACHIEVE_LIST.map(a=>{const on=achievements.includes(a.id);return `<div class="ach-card ${on?'unlocked':'locked'}"><div class="ach-ico">${a.icon}</div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.desc}</div>${on?'<div class="ach-unlocked-tag">UNLOCKED</div>':''}</div>`;}).join('');
}

function initApiKeyUI() {
  const sec=document.getElementById('apiKeySection');
  if(!sec) return;
  if(isAuthenticated()){
    sec.innerHTML=`<div class="alert alert-success"><span>✅</span><div><strong>AI import ready</strong><br/><small>The server handles Gemini calls for signed-in users.</small></div></div>`;
  } else {
    sec.innerHTML=`<div class="alert alert-warning"><span>🔒</span><div><strong>Login required for AI import</strong><br/><small>Sign in first so the backend can track your demo usage safely.</small></div></div>`;
  }
}

function handleTimetableUpload(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas'),maxW=1200,scale=img.width>maxW?maxW/img.width:1;
      canvas.width=img.width*scale; canvas.height=img.height*scale;
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      uploadedImage=canvas.toDataURL('image/jpeg',0.85).split(',')[1];
      document.getElementById('previewImg').src=ev.target.result;
      document.getElementById('uploadPreview').style.display='block';
      document.getElementById('uploadZone').style.display='none';
      document.getElementById('aiResultPreview').style.display='none';
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

function clearUpload(){
  uploadedImage=null;
  document.getElementById('uploadPreview').style.display='none';
  document.getElementById('uploadZone').style.display='block';
  document.getElementById('ttFileInput').value='';
  document.getElementById('aiResultPreview').style.display='none';
  document.getElementById('aiProcessing').style.display='none';
  const eb=document.getElementById('extractBtn'); if(eb) eb.disabled=false;
}

// ─── FIXED extractTimetable ───────────────────────────────────────────────────
async function extractTimetable() {
  if(!isAuthenticated()){showToast('🔒','Login Required','Sign in to use AI timetable import');return;}
  if(!uploadedImage){showToast('⚠️','No Image','Upload a timetable image first');return;}
  document.getElementById('aiProcessing').style.display='block';
  document.getElementById('extractBtn').disabled=true;
  document.getElementById('aiResultPreview').style.display='none';
  document.getElementById('processingText').textContent='Sending image to Gemini AI...';

  try {
    const res = await fetch(`${API_BASE}/timetable/extract`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ imageBase64: uploadedImage })
    });

    document.getElementById('processingText').textContent = 'Processing response...';

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const parsed = data.classes || [];

    if (!Array.isArray(parsed) || parsed.length === 0)
      throw new Error('No classes detected. Try a clearer image.');

    freeExtractions = FREE_LIMIT - (data.remainingToday || 0);
    scheduleRemoteSync();
    document.getElementById('aiProcessing').style.display = 'none';
    document.getElementById('extractBtn').disabled = false;
    showAIResultPreview(parsed, data.remainingToday ?? 0);

  } catch(err) {
    document.getElementById('aiProcessing').style.display = 'none';
    document.getElementById('extractBtn').disabled = false;
    document.getElementById('aiResultPreview').style.display = 'block';
    document.getElementById('aiResultPreview').innerHTML =
      `<div class="alert alert-danger"><span>❌</span><div><strong>Extraction Failed</strong><br/><small>${err.message}</small></div></div>`;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function showAIResultPreview(classes,remaining) {
  const preview=document.getElementById('aiResultPreview'); preview.style.display='block';
  const rows=classes.map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;"><span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);min-width:34px;font-weight:600;">${c.day}</span><span style="font-weight:500;font-size:13px;flex:1;">${c.subject}</span><span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-2);">${c.start}–${c.end}</span>${c.room?`<span style="font-size:11px;color:var(--text-3);background:var(--surface2);padding:1px 6px;border-radius:3px;">${c.room}</span>`:''}</div>`).join('');
  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(classes))));
  preview.innerHTML=`<div class="alert alert-success" style="margin-bottom:10px;"><span>✅</span><div><strong>Gemini found ${classes.length} classes!</strong><br/><small>Review then confirm. ${remaining} free scan${remaining!==1?'s':''} remaining.</small></div></div><div style="max-height:220px;overflow-y:auto;margin-bottom:12px;">${rows}</div><div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="applyAITimetable('${encoded}')">✅ Add All to Timetable</button><button class="btn btn-ghost btn-sm" onclick="document.getElementById('aiResultPreview').style.display='none'">✕ Discard</button></div>`;
}

function applyAITimetable(encoded) {
  const classes=JSON.parse(decodeURIComponent(escape(atob(encoded))));
  const validDays=['Mon','Tue','Wed','Thu','Fri','Sat']; let added=0, subjAdded=0;

  const uniqueSubjects=[...new Set(classes.filter(c=>c.subject&&validDays.includes(c.day)&&c.start&&c.end).map(c=>c.subject))];

  uniqueSubjects.forEach(name=>{
    const alreadyExists=subjects.some(s=>s.name.trim().toLowerCase()===name.trim().toLowerCase());
    if(!alreadyExists){
      subjects.push({id:`subject-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,name:name.trim(),total:0,attended:0,color:SUBJECT_COLORS[subjects.length%SUBJECT_COLORS.length]});
      subjAdded++;
    }
  });
  if(subjAdded>0){ save('subjects'); renderSubjects(); populateTaskSubjectDropdown(); }

  classes.forEach(c=>{if(c.subject&&validDays.includes(c.day)&&c.start&&c.end){timetable.push({id:`tt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,subject:c.subject,day:c.day,start:c.start,end:c.end,room:c.room||''});added++;}});
  save('timetable'); renderTimetable(); renderDashboard(); clearUpload();
  document.getElementById('aiResultPreview').style.display='none';
  showToast('🗓️',`${added} Classes + ${subjAdded} Subjects Added!`,'Timetable & Attendance ready'); addXP(added*5);
}

function toggleManualForm() {
  const f=document.getElementById('manualForm'),hidden=f.style.display==='none'||!f.style.display;
  f.style.display=hidden?'block':'none';
  if(hidden){const sel=document.getElementById('ttSubject');sel.innerHTML='<option value="">-- Select Subject --</option>';subjects.forEach(s=>{const o=document.createElement('option');o.value=s.name;o.textContent=s.name;sel.appendChild(o);});}
}

function addTimetableEntry() {
  const subject=document.getElementById('ttSubject').value.trim(),day=document.getElementById('ttDay').value;
  const start=document.getElementById('ttStart').value,end=document.getElementById('ttEnd').value;
  const room=document.getElementById('ttRoom').value.trim();
  if(!subject){showToast('⚠️','Missing Subject','Select a subject');return;}
  if(!start||!end){showToast('⚠️','Missing Time','Set start and end time');return;}
  if(start>=end){showToast('⚠️','Invalid Time','End must be after start');return;}
  timetable.push({id:`tt-${Date.now()}`,subject,day,start,end,room}); save('timetable'); renderTimetable();
  document.getElementById('ttStart').value=''; document.getElementById('ttEnd').value=''; document.getElementById('ttRoom').value='';
  showToast('🗓️','Class Added',`${subject} on ${day}`);
}

function deleteTimetableEntry(id){timetable=timetable.filter(t=>String(t.id)!==String(id));save('timetable');renderTimetable();}

function clearTimetable(){
  if(!confirm('Clear all timetable entries?')) return;
  timetable=[];save('timetable');renderTimetable();showToast('🗑️','Timetable Cleared','All classes removed');
}

function renderTimetable() {
  const days=['Mon','Tue','Wed','Thu','Fri','Sat'];
  const full={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday'};
  const dayMap={1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  const today=dayMap[new Date().getDay()]||'';
  const grid=document.getElementById('ttGrid'); if(!grid) return;
  let html=`<div class="tt-head" style="font-size:9px;color:var(--text-3);">TIME</div>`;
  days.forEach(d=>{const isToday=d===today;html+=`<div class="tt-head${isToday?' today':''}">${full[d].slice(0,3).toUpperCase()}${isToday?'<br><span style="font-size:9px;opacity:0.8;font-weight:400;">TODAY</span>':''}</div>`;});
  const slots=[...new Set(timetable.map(t=>t.start))].sort();
  if(slots.length===0){html+=`<div style="grid-column:span 7;padding:36px;text-align:center;color:var(--text-3);font-size:13px;">No classes yet — upload an image or add manually.</div>`;}
  else{slots.forEach(slot=>{html+=`<div class="tt-cell" style="display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-2);font-weight:500;">${slot}</div>`;days.forEach(d=>{const cs=timetable.filter(t=>t.day===d&&t.start===slot);html+=`<div class="tt-cell">`;cs.forEach(c=>{html+=`<div class="tt-slot"><div class="tt-slot-del" onclick="deleteTimetableEntry('${c.id}')">✕</div><div class="tt-slot-name" title="${c.subject}">${c.subject}</div><div class="tt-slot-time">${c.start}–${c.end}</div>${c.room?`<div class="tt-slot-room">${c.room}</div>`:''}</div>`;});html+=`</div>`;});});}
  grid.innerHTML=html;
  const cc=document.getElementById('ttClassCount'); if(cc) cc.textContent=`${timetable.length} class${timetable.length!==1?'es':''} scheduled`;
  const todayEl=document.getElementById('todayClasses'); if(!todayEl) return;
  const tc=timetable.filter(t=>t.day===today).sort((a,b)=>a.start.localeCompare(b.start));
  if(tc.length===0){todayEl.innerHTML=`<div class="empty-state"><div class="es-ico">☀️</div><p>No classes for ${full[today]||'today'}</p></div>`;}
  else{todayEl.innerHTML=tc.map(c=>{
    const subj=subjects.find(s=>s.name===c.subject);
    const pct=subj&&subj.total>0?Math.round(subj.attended/subj.total*100):null;
    const color=pct===null?'var(--text-3)':pct>=75?'var(--success)':pct>=60?'var(--warning)':'var(--danger)';
    return `<div class="today-class" style="display:flex;align-items:center;gap:10px;">
      <div class="tc-time">${c.start} – ${c.end}</div>
      <div style="flex:1;">
        <div class="tc-name">${c.subject}</div>
        ${c.room?`<div class="tc-room">📍 ${c.room}</div>`:''}
        ${pct!==null?`<div style="font-size:11px;color:${color};margin-top:2px;">📊 ${pct}% attendance</div>`:'<div style="font-size:11px;color:var(--text-3);margin-top:2px;">Add subject in Attendance tab first</div>'}
      </div>
      ${subj?`<div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="att-btn present" onclick="markAttendance(${serializeId(subj.id)},'present');renderTimetable();renderDashboard();" style="padding:4px 10px;font-size:12px;">✓ Present</button>
        <button class="att-btn absent" onclick="markAttendance(${serializeId(subj.id)},'absent');renderTimetable();renderDashboard();" style="padding:4px 10px;font-size:12px;">✗ Absent</button>
      </div>`:''}
    </div>`;
  }).join('');}
}

function exportData(){
  const data={exportedAt:new Date().toISOString(),subjects,tasks,pomodoroSessions,xp,streak,achievements,timetable,geminiApiKey,freeExtractions,heatmap};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download=`student-manager-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('↓','Data Exported','JSON file downloaded');
}

let toastTmr;
function showToast(icon,title,body){
  const t=document.getElementById('toast'),i=document.getElementById('toastIcon'),tl=document.getElementById('toastTitle'),tb=document.getElementById('toastBody');
  if(!t) return;
  if(i) i.textContent=icon; if(tl) tl.textContent=title; if(tb) tb.textContent=body;
  t.classList.add('show'); clearTimeout(toastTmr); toastTmr=setTimeout(()=>t.classList.remove('show'),3000);
}

function save(key){
  const map={
    subjects:() => localStorage.setItem(STORAGE_KEYS.subjects, JSON.stringify(subjects)),
    tasks:() => localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks)),
    pomo:() => localStorage.setItem(STORAGE_KEYS.pomo, JSON.stringify(pomodoroSessions)),
    achievements:() => localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(achievements)),
    timetable:() => localStorage.setItem(STORAGE_KEYS.timetable, JSON.stringify(timetable))
  };
  if(map[key]) map[key]();
  scheduleRemoteSync();
}

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('open');}
