(() => {
  const MODE_KEY = 'cute-science-temp-app-view-mode-v1';
  const GROUP_KEY = 'cute-science-temp-app-student-group-v1';
  const GROUPS = ['1','2','3','4','5','6'];
  const state = {
    mode: localStorage.getItem(MODE_KEY) || '',
    group: GROUPS.includes(localStorage.getItem(GROUP_KEY) || '') ? localStorage.getItem(GROUP_KEY) : '1'
  };

  const style = document.createElement('style');
  style.textContent = '.classroom-mode-panel{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.78);backdrop-filter:blur(8px);font-family:Arial,"Noto Sans KR",sans-serif}.classroom-mode-card{width:min(760px,100%);background:#fff;border-radius:28px;padding:34px;box-shadow:0 25px 70px rgba(0,0,0,.25);text-align:center}.classroom-mode-card h2{margin:0 0 8px;font-size:30px;color:#1e293b}.classroom-mode-card p{margin:0 0 22px;color:#64748b;font-weight:700;line-height:1.5}.classroom-mode-buttons{display:grid;grid-template-columns:1fr 1fr;gap:16px}.classroom-mode-button{border:3px solid #e2e8f0;border-radius:24px;padding:24px;background:#f8fafc;cursor:pointer;font-weight:900;text-align:left}.classroom-mode-button.teacher{background:#eef2ff;border-color:#c7d2fe}.classroom-mode-button.student{background:#ecfdf5;border-color:#a7f3d0}.classroom-mode-icon{font-size:38px;display:block;margin-bottom:10px}.classroom-mode-title{font-size:20px;margin-bottom:8px}.classroom-mode-desc{font-size:13px;color:#475569;line-height:1.5}.classroom-mode-select{width:100%;margin-top:14px;padding:12px 14px;border:2px solid #86efac;border-radius:14px;font-size:16px;font-weight:900;background:#fff}.classroom-mode-start{width:100%;margin-top:12px;padding:13px 16px;border:0;border-radius:14px;background:#10b981;color:#fff;font-size:16px;font-weight:900;cursor:pointer}.classroom-mode-reopen{position:fixed;right:16px;bottom:16px;z-index:99990;border:0;border-radius:999px;padding:11px 15px;background:#fff;color:#334155;box-shadow:0 8px 28px rgba(0,0,0,.18);font-weight:900;cursor:pointer}@media(max-width:700px){.classroom-mode-card{padding:24px}.classroom-mode-buttons{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  function groupCards() {
    const found = [];
    document.querySelectorAll('input').forEach(input => {
      const value = (input.value || '').trim();
      if (!/^[1-6]모둠$/.test(value)) return;
      const card = input.closest('div.rounded-[2rem]') || input.parentElement?.parentElement?.parentElement?.parentElement;
      if (card && !found.includes(card)) found.push(card);
    });
    return found;
  }

  function applyStudentView() {
    if (state.mode !== 'student') return;
    groupCards().forEach(card => {
      const input = card.querySelector('input');
      const id = input ? (input.value || '').trim().replace('모둠','') : '';
      card.style.display = id === state.group ? '' : 'none';
    });

    document.querySelectorAll('select').forEach(select => {
      const options = Array.from(select.options);
      const hasGroups = options.some(o => /[1-6]\s*모둠/.test((o.textContent || '').trim()));
      if (!hasGroups) return;
      const wanted = options.find(o => (o.value || '') === state.group) || options.find(o => (o.textContent || '').replace(/\s/g,'') === state.group + '모둠');
      if (!wanted) return;
      select.value = wanted.value;
      select.dispatchEvent(new Event('change', {bubbles:true}));
      select.dataset.classroomModeLocked = '1';
      select.style.pointerEvents = 'none';
      select.style.opacity = '0.75';
    });
  }

  function saveMode(mode, group) {
    state.mode = mode;
    if (group) state.group = group;
    localStorage.setItem(MODE_KEY, state.mode);
    localStorage.setItem(GROUP_KEY, state.group);
    const panel = document.querySelector('.classroom-mode-panel');
    if (panel) panel.remove();
    applyStudentView();
  }

  function showPanel() {
    if (document.querySelector('.classroom-mode-panel')) return;
    const panel = document.createElement('div');
    panel.className = 'classroom-mode-panel';
    const options = GROUPS.map(g => '<option value="'+g+'"'+(g===state.group?' selected':'')+'>'+g+'모둠</option>').join('');
    panel.innerHTML = '<div class="classroom-mode-card"><div style="font-size:52px;margin-bottom:8px">🧪</div><h2>이 기기는 어떻게 사용할까요?</h2><p>선생님 컴퓨터에서는 1~6모둠을 모두 보고,<br>학생 태블릿에서는 자기 모둠만 보게 할 수 있어요.</p><div class="classroom-mode-buttons"><button class="classroom-mode-button teacher" type="button"><span class="classroom-mode-icon">👩‍🏫</span><div class="classroom-mode-title">선생님 화면</div><div class="classroom-mode-desc">1~6모둠의 타이머, 온도, 그래프를 모두 표시합니다.</div></button><div class="classroom-mode-button student"><span class="classroom-mode-icon">📱</span><div class="classroom-mode-title">학생 화면</div><div class="classroom-mode-desc">선택한 모둠의 화면만 표시합니다.</div><select class="classroom-mode-select">'+options+'</select><button class="classroom-mode-start" type="button">이 모둠으로 시작하기 →</button></div></div></div>';
    document.body.appendChild(panel);
    panel.querySelector('.teacher').onclick = () => saveMode('teacher');
    panel.querySelector('.classroom-mode-start').onclick = () => saveMode('student', panel.querySelector('.classroom-mode-select').value);
  }

  function addReopen() {
    if (document.querySelector('.classroom-mode-reopen')) return;
    const button = document.createElement('button');
    button.className = 'classroom-mode-reopen';
    button.textContent = '🔄 사용 모드 변경';
    button.onclick = showPanel;
    document.body.appendChild(button);
  }

  if (!state.mode) showPanel(); else addReopen();
  const observer = new MutationObserver(() => { applyStudentView(); addReopen(); });
  observer.observe(document.body, {childList:true, subtree:true});
  [200,700,1500,3000,5000].forEach(ms => setTimeout(() => { applyStudentView(); addReopen(); }, ms));
})();