(() => {
  const MODE_KEY = 'cute-science-temp-app-view-mode-v1';
  const GROUP_KEY = 'cute-science-temp-app-student-group-v1';
  const SESSION_KEY = 'cute-science-temp-app-session-id-v1';
  const GROUPS = ['1','2','3','4','5','6'];

  const normalizeSessionId = (value) => {
    const normalized = String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\\s+/g, '-')
      .replace(/[^A-Z0-9가-힣_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    return normalized;
  };

  const makeSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const urlParams = new URLSearchParams(location.search);
  const urlMode = urlParams.get('mode') === 'teacher' || urlParams.get('mode') === 'student'
    ? urlParams.get('mode')
    : '';
  const urlSession = normalizeSessionId(urlParams.get('session') || '');
  const savedSession = normalizeSessionId(localStorage.getItem(SESSION_KEY) || '');
  const initialSession = urlSession || savedSession;

  if (initialSession) {
    localStorage.setItem(SESSION_KEY, initialSession);
    window.__SCIENCE_SESSION_ID__ = initialSession;
  }
  if (urlMode) localStorage.setItem(MODE_KEY, urlMode);

  const state = {
    mode: urlMode || localStorage.getItem(MODE_KEY) || '',
    group: GROUPS.includes(urlParams.get('group') || '') ? urlParams.get('group') : (GROUPS.includes(localStorage.getItem(GROUP_KEY) || '') ? localStorage.getItem(GROUP_KEY) : '1'),
    session: initialSession
  };
  window.__SCIENCE_VIEW_MODE__ = state.mode;

  const style = document.createElement('style');
  style.textContent = `
    .classroom-mode-panel{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.78);backdrop-filter:blur(8px);font-family:Arial,"Noto Sans KR",sans-serif}
    .classroom-mode-card{width:min(820px,100%);background:#fff;border-radius:28px;padding:32px;box-shadow:0 25px 70px rgba(0,0,0,.25);text-align:center;max-height:92vh;overflow:auto}
    .classroom-mode-card h2{margin:0 0 8px;font-size:30px;color:#1e293b}
    .classroom-mode-card p{margin:0 0 22px;color:#64748b;font-weight:700;line-height:1.5}
    .classroom-mode-buttons{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .classroom-mode-button{border:3px solid #e2e8f0;border-radius:24px;padding:22px;background:#f8fafc;font-weight:900;text-align:left}
    .classroom-mode-button.teacher{background:#eef2ff;border-color:#c7d2fe}
    .classroom-mode-button.student{background:#ecfdf5;border-color:#a7f3d0}
    .classroom-mode-icon{font-size:38px;display:block;margin-bottom:10px}
    .classroom-mode-title{font-size:20px;margin-bottom:8px}
    .classroom-mode-desc{font-size:13px;color:#475569;line-height:1.5}
    .classroom-mode-input{width:100%;margin-top:12px;padding:13px 14px;border:2px solid #cbd5e1;border-radius:14px;font-size:18px;font-weight:900;background:#fff;box-sizing:border-box;text-transform:uppercase}
    .classroom-mode-input:focus{outline:none;border-color:#818cf8;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
    .classroom-mode-select{width:100%;margin-top:12px;padding:12px 14px;border:2px solid #86efac;border-radius:14px;font-size:16px;font-weight:900;background:#fff}
    .classroom-mode-start{width:100%;margin-top:12px;padding:13px 16px;border:0;border-radius:14px;background:#10b981;color:#fff;font-size:16px;font-weight:900;cursor:pointer}
    .classroom-mode-start.teacher-start{background:#6366f1}
    .classroom-code-row{display:flex;gap:8px;margin-top:12px}
    .classroom-code-row .classroom-mode-input{margin-top:0;flex:1;min-width:0}
    .classroom-code-generate{border:0;border-radius:14px;padding:0 14px;background:#e0e7ff;color:#4338ca;font-weight:900;cursor:pointer;white-space:nowrap}
    .classroom-current-code{display:inline-flex;align-items:center;gap:6px;margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:999px;font-size:13px;color:#475569;font-weight:900}
    .classroom-error{margin-top:12px;color:#e11d48;font-size:13px;font-weight:900}
    .classroom-mode-reopen{position:fixed;right:16px;bottom:16px;z-index:99990;border:0;border-radius:999px;padding:11px 15px;background:#fff;color:#334155;box-shadow:0 8px 28px rgba(0,0,0,.18);font-weight:900;cursor:pointer}
    .classroom-reset-menu{z-index:99990}
    @media(max-width:700px){.classroom-mode-card{padding:22px}.classroom-mode-buttons{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function groupCards() {
    const found = [];
    document.querySelectorAll('input').forEach(input => {
      const value = (input.value || '').trim();
      if (!/^[1-6]모둠$/.test(value)) return;

      let node = input.parentElement;
      let depth = 0;
      while (node && depth < 12) {
        const tables = node.querySelectorAll('table');
        const timerButtons = Array.from(node.querySelectorAll('button')).filter(btn => {
          const text = (btn.textContent || '').trim();
          return text.includes('시작') || text.includes('정지');
        });

        if (tables.length === 1 && timerButtons.length >= 1) {
          if (!found.includes(node)) found.push(node);
          break;
        }
        node = node.parentElement;
        depth += 1;
      }
    });
    return found;
  }

  function applyStudentView() {
    if (state.mode !== 'student') return;
    const cards = groupCards();
    cards.forEach(card => {
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

  function setSession(sessionId, mode, group) {
    const session = normalizeSessionId(sessionId);
    if (!session) return false;

    state.session = session;
    if (mode) state.mode = mode;
    if (group) state.group = group;

    localStorage.setItem(SESSION_KEY, session);
    localStorage.setItem(MODE_KEY, state.mode);
    localStorage.setItem(GROUP_KEY, state.group);
    window.__SCIENCE_SESSION_ID__ = session;
    window.__SCIENCE_VIEW_MODE__ = mode || state.mode;
    return true;
  }

  function reloadWithSelection(sessionId, mode, group) {
    if (!setSession(sessionId, mode, group)) return;
    const next = new URL(location.href);
    next.searchParams.set('mode', mode);
    next.searchParams.set('session', state.session);
    if (group) next.searchParams.set('group', group);
    else next.searchParams.delete('group');
    location.replace(next.toString());
  }

  function showPanel() {
    if (document.querySelector('.classroom-mode-panel')) return;

    const panel = document.createElement('div');
    panel.className = 'classroom-mode-panel';

    const initialTeacherCode = state.session || makeSessionCode();
    const initialStudentCode = state.session || '';

    const options = GROUPS.map(g =>
      '<option value="' + g + '"' + (g === state.group ? ' selected' : '') + '>' + g + '모둠</option>'
    ).join('');

    panel.innerHTML = `
      <div class="classroom-mode-card">
        <div style="font-size:52px;margin-bottom:8px">🧪</div>
        <h2>수업 코드와 사용 화면을 선택하세요</h2>
        <p>같은 수업에 참여하는 기기들은 <b>같은 수업 코드</b>를 사용합니다.<br>다른 반은 다른 코드를 사용하면 기록이 서로 섞이지 않습니다.</p>

        <div class="classroom-mode-buttons">
          <div class="classroom-mode-button teacher">
            <span class="classroom-mode-icon">👩‍🏫</span>
            <div class="classroom-mode-title">선생님 화면</div>
            <div class="classroom-mode-desc">선생님 컴퓨터에서 1~6모둠을 모두 봅니다.</div>

            <div class="classroom-code-row">
              <input class="classroom-mode-input teacher-code" value="${initialTeacherCode}" maxlength="30" placeholder="예: 5-1-A" aria-label="선생님 수업 코드">
              <button class="classroom-code-generate" type="button">새 코드</button>
            </div>
            <button class="classroom-mode-start teacher-start" type="button">이 수업으로 시작하기 →</button>
            <div class="classroom-current-code teacher-copy-status">💡 수업 코드만 같으면 다른 기기도 같은 수업에 연결됩니다.</div>
          </div>

          <div class="classroom-mode-button student">
            <span class="classroom-mode-icon">📱</span>
            <div class="classroom-mode-title">학생 화면</div>
            <div class="classroom-mode-desc">선생님에게 받은 수업 코드를 입력한 뒤 자기 모둠을 선택합니다.</div>

            <input class="classroom-mode-input student-code" value="${initialStudentCode}" maxlength="30" placeholder="수업 코드 입력" aria-label="학생 수업 코드">
            <select class="classroom-mode-select">${options}</select>
            <button class="classroom-mode-start" type="button">이 모둠으로 시작하기 →</button>
          </div>
        </div>

        <div class="classroom-error" style="display:none"></div>
      </div>
    `;

    document.body.appendChild(panel);

    const errorBox = panel.querySelector('.classroom-error');

    panel.querySelector('.classroom-code-generate').onclick = () => {
      panel.querySelector('.teacher-code').value = makeSessionCode();
      const status = panel.querySelector('.teacher-copy-status');
      status.textContent = '✨ 새 수업 코드가 만들어졌어요. 이 코드로 수업을 시작하세요.';
    };

    panel.querySelector('.teacher-start').onclick = () => {
      const code = panel.querySelector('.teacher-code').value;
      if (!normalizeSessionId(code)) {
        errorBox.textContent = '수업 코드를 입력해 주세요.';
        errorBox.style.display = '';
        return;
      }
      reloadWithSelection(code, 'teacher');
    };

    panel.querySelector('.classroom-mode-start').onclick = () => {
      const code = panel.querySelector('.student-code').value;
      const group = panel.querySelector('.classroom-mode-select').value;
      if (!normalizeSessionId(code)) {
        errorBox.textContent = '선생님에게 받은 수업 코드를 입력해 주세요.';
        errorBox.style.display = '';
        return;
      }
      reloadWithSelection(code, 'student', group);
    };
  }

  async function copySessionCode() {
    if (!state.session) return;
    try {
      await navigator.clipboard.writeText(state.session);
      const button = document.querySelector('.classroom-copy-session');
      if (button) {
        const oldText = button.textContent;
        button.textContent = '✅ 복사했어요!';
        setTimeout(() => {
          button.textContent = oldText;
        }, 1500);
      }
    } catch (e) {
      window.prompt('아래 수업 코드를 복사해서 학생들에게 알려주세요.', state.session);
    }
  }

  function addTeacherResetButton() {
    if (state.mode !== 'teacher') return;
    if (document.querySelector('.classroom-reset-menu')) return;

    const wrap = document.createElement('div');
    wrap.className = 'classroom-reset-menu';
    wrap.style.cssText = 'position:fixed;right:16px;bottom:64px;background:white;border-radius:20px;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-family:Arial,"Noto Sans KR",sans-serif';

    const title = document.createElement('div');
    title.textContent = '🧹 모둠 기록 초기화';
    title.style.cssText = 'font-weight:900;color:#334155;padding:4px 8px 8px;text-align:center;font-size:13px';
    wrap.appendChild(title);

    const sessionInfo = document.createElement('div');
    sessionInfo.style.cssText = 'font-weight:800;color:#64748b;padding:0 8px 8px;text-align:center;font-size:11px';
    sessionInfo.innerHTML = '수업: <strong>' + state.session + '</strong>';
    wrap.appendChild(sessionInfo);

    const copyButton = document.createElement('button');
    copyButton.className = 'classroom-copy-session';
    copyButton.type = 'button';
    copyButton.textContent = '📋 수업 코드 복사';
    copyButton.style.cssText = 'width:100%;border:0;border-radius:12px;padding:9px 10px;background:#eef2ff;color:#4338ca;font-weight:900;cursor:pointer;margin-bottom:8px';
    copyButton.addEventListener('click', copySessionCode);
    wrap.appendChild(copyButton);

    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px';

    GROUPS.forEach(group => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = group + '모둠';
      btn.style.cssText = 'border:0;border-radius:12px;padding:9px 10px;background:#fff1f2;color:#be123c;font-weight:900;cursor:pointer';
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('classroom-reset-request', { detail: { groupId: group } }));
      });
      row.appendChild(btn);
    });

    wrap.appendChild(row);
    document.body.appendChild(wrap);
  }

  function addReopen() {
    if (document.querySelector('.classroom-mode-reopen')) return;
    const button = document.createElement('button');
    button.className = 'classroom-mode-reopen';
    button.textContent = state.mode === 'teacher' ? '🔄 수업/사용 모드 변경' : '🔄 수업/모둠 변경';
    button.onclick = showPanel;
    document.body.appendChild(button);
  }

  if (!state.session || !state.mode) {
    showPanel();
  } else {
    addReopen();
    addTeacherResetButton();
  }

  const observer = new MutationObserver(() => {
    applyStudentView();
    addReopen();
    addTeacherResetButton();
  });
  observer.observe(document.body, {childList:true, subtree:true});

  [200,700,1500,3000,5000].forEach(ms => setTimeout(() => {
    applyStudentView();
    addReopen();
    addTeacherResetButton();
  }, ms));
})();
