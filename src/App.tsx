import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, onSnapshot } from "firebase/firestore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ModeChooser from './ModeChooser';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const firebaseConfig = {
  apiKey: "AIzaSyCin-PWOGR9Yb4w7eKgWTh5JGY7CvhLWSg",
  authDomain: "science-t.firebaseapp.com",
  projectId: "science-t",
  storageBucket: "science-t.firebasestorage.app",
  messagingSenderId: "46317460386",
  appId: "1:46317460386:web:671a52f2c1f3674fffb0fb",
  measurementId: "G-SW1463773V"
};

const APP_ID = 'cute-science-temp-app';
const COLLECTION_NAME = 'temperature-data';
const SESSION_STORAGE_KEY = `${APP_ID}-session-id-v1`;
const NUM_GROUPS = 6;
const TIME_LABELS = ['처음', '30초', '1분', '2분', '3분', '4분', '5분', '6분', '7분', '8분'];
const TARGET_TIMES = [30, 60, 120, 180, 240, 300, 360, 420, 480];

const normalizeSessionId = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\\s+/g, '-')
    .replace(/[^A-Z0-9가-힣_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return normalized || 'DEFAULT';
};

const SESSION_ID = normalizeSessionId(
  (typeof window !== 'undefined' && window.localStorage.getItem(SESSION_STORAGE_KEY)) ||
  (typeof window !== 'undefined' && window.__SCIENCE_SESSION_ID__) ||
  'DEFAULT'
);

// Firebase 이메일/비밀번호 인증은 최소 6자 이상의 비밀번호가 필요합니다.
// 이 수업용 앱은 사용 편의를 위해 별도의 4자리 선생님 PIN을 사용합니다.
const TEACHER_PIN = '2468';

const STORAGE_KEY = `${APP_ID}-${SESSION_ID}-local-state-v3`;

const getGroupCollection = (db) =>
  collection(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, SESSION_ID, 'groups');

const getGroupDoc = (db, groupId) =>
  doc(db, 'artifacts', APP_ID, 'public', 'data', COLLECTION_NAME, SESSION_ID, 'groups', String(groupId));

const createInitialGroup = (i) => ({
  name: `${i}모둠`,
  hotWater: Array(10).fill(''),
  coldWater: Array(10).fill(''),
  timerStartTime: null,
  members: [
    { name: '', role: '기록자' },
    { name: '', role: '온도측정자' },
    { name: '', role: '온도측정자' },
    { name: '', role: '시간확인자' }
  ]
});

const createInitialState = () => {
  const data = {};
  const timers = {};
  const quiz = {};
  for (let i = 1; i <= NUM_GROUPS; i++) {
    data[i] = createInitialGroup(i);
    timers[i] = { elapsed: 0, lastDingTime: -1 };
    quiz[i] = false;
  }
  return { data, timers, quiz };
};

const GROUP_STYLES = [
  { icon: '🐶', color: 'bg-rose-100', borderColor: 'border-rose-300', textColor: 'text-rose-800' },
  { icon: '🐱', color: 'bg-orange-100', borderColor: 'border-orange-300', textColor: 'text-orange-800' },
  { icon: '🐰', color: 'bg-amber-100', borderColor: 'border-amber-300', textColor: 'text-amber-800' },
  { icon: '🐻', color: 'bg-emerald-100', borderColor: 'border-emerald-300', textColor: 'text-emerald-800' },
  { icon: '🐼', color: 'bg-sky-100', borderColor: 'border-sky-300', textColor: 'text-sky-800' },
  { icon: '🐹', color: 'bg-violet-100', borderColor: 'border-violet-300', textColor: 'text-violet-800' },
];

let globalAudioCtx = null;

const playDing = (type = 'ding', silent = false) => {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    if (silent) return; 

    const osc = globalAudioCtx.createOscillator();
    const gainNode = globalAudioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(globalAudioCtx.destination);
    
    if (type === 'ding') {
      osc.type = 'sine'; 
      osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(1760, globalAudioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.5, globalAudioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, globalAudioCtx.currentTime + 0.5);
      osc.start(globalAudioCtx.currentTime);
      osc.stop(globalAudioCtx.currentTime + 0.5);
    } else if (type === 'tada') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, globalAudioCtx.currentTime); 
      osc.frequency.setValueAtTime(659.25, globalAudioCtx.currentTime + 0.15); 
      osc.frequency.setValueAtTime(783.99, globalAudioCtx.currentTime + 0.3); 
      gainNode.gain.setValueAtTime(0.3, globalAudioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, globalAudioCtx.currentTime + 0.6);
      osc.start(globalAudioCtx.currentTime);
      osc.stop(globalAudioCtx.currentTime + 0.6);
    }
  } catch (e) {}
};

const GroupChart = ({ hotData, coldData, groupName }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            usePointStyle: true, 
            pointStyle: 'circle',
            boxWidth: 8,       
            boxHeight: 8,      
            color: '#333',       
            font: {
                family: "'Pretendard', 'Noto Sans KR', sans-serif",
                weight: 'bold',
                size: 13
            },
            padding: 20          
        }
      },
      title: {
        display: true,
        text: `${groupName} 온도 변화`,
        color: '#333',
        font: {
            size: 18,
            weight: '900',
            family: "'Pretendard', 'Noto Sans KR', sans-serif"
        },
        padding: {
            top: 10,
            bottom: 20
        }
      },
      tooltip: {
          titleFont: { family: "'Pretendard', 'Noto Sans KR', sans-serif" },
          bodyFont: { family: "'Pretendard', 'Noto Sans KR', sans-serif" },
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1e293b',
          bodyColor: '#334155',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6
      }
    },
    scales: {
      y: {
        title: {
            display: true,
            text: '온도 (℃)',
            color: '#64748b',
            font: { family: "'Pretendard', 'Noto Sans KR', sans-serif", weight: 'bold' },
            align: 'end'
        },
        min: 0,
        max: 70, 
        ticks: {
            color: '#64748b',
            font: {
    family: "'Pretendard', 'Noto Sans KR', sans-serif",
    weight: 'bold',
    size: 10
},
            stepSize: 5
        },
        grid: {
            color: '#f1f5f9', 
            lineWidth: 1
        },
        border: {
            display: true,
            color: '#cbd5e1'
        }
      },
      x: {
        title: {
            display: true,
            text: '시간', 
            color: '#64748b',
            font: { family: "'Pretendard', 'Noto Sans KR', sans-serif", weight: 'bold' },
            align: 'end'
        },
        ticks: {
            color: '#64748b',
            font: { family: "'Pretendard', 'Noto Sans KR', sans-serif", weight: 'bold' }
        },
        grid: {
            color: '#f1f5f9',
            lineWidth: 1.5
        },
        border: {
            display: true,
            color: '#cbd5e1'
        }
      }
    },
    layout: {
        padding: { left: 10, right: 20, top: 10, bottom: 10 }
    }
  };

  const data = {
    labels: TIME_LABELS,
    datasets: [
      {
        label: '따뜻한 물',
        data: hotData.map(v => (v === '' || isNaN(v) ? null : Number(v))),
        borderColor: '#ef4444', 
        backgroundColor: '#ef4444', 
        borderWidth: 3,         
        tension: 0,             
        pointRadius: 6,         
        pointBackgroundColor: '#fff',
        pointBorderWidth: 3,
        pointHoverRadius: 8,
        fill: false,
      },
      {
        label: '차가운 물',
        data: coldData.map(v => (v === '' || isNaN(v) ? null : Number(v))),
        borderColor: '#3b82f6', 
        backgroundColor: '#3b82f6', 
        borderWidth: 3,         
        tension: 0,             
        pointRadius: 6,         
        pointBackgroundColor: '#fff',
        pointBorderWidth: 3,
        pointHoverRadius: 8,
        fill: false,
      },
    ],
  };

  return (
    <div className="w-full h-[330px] bg-white rounded-2xl p-4 border border-slate-200 relative shadow-sm">
      <Line options={options} data={data} />
    </div>
  );
};

export default function App() {
  const [groupData, setGroupData] = useState({});
  const [localTimers, setLocalTimers] = useState({});
  const [quizState, setQuizState] = useState({});
  const groupDataRef = useRef({}); 
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    if (urlMode === 'teacher' || urlMode === 'student') return urlMode;
    const saved = window.localStorage.getItem('cute-science-temp-app-view-mode-v1');
    return saved === 'teacher' || saved === 'student' ? saved : '';
  });
  const [studentGroup, setStudentGroup] = useState(() => {
    if (typeof window === 'undefined') return '1';
    const params = new URLSearchParams(window.location.search);
    const urlGroup = params.get('group');
    if (/^[1-6]$/.test(urlGroup || '')) return urlGroup;
    const saved = window.localStorage.getItem('cute-science-temp-app-student-group-v1');
    return /^[1-6]$/.test(saved || '') ? saved : '1';
  });
  const [showModeChooser, setShowModeChooser] = useState(() => {
    if (typeof window === 'undefined') return true;
    const justSelected = window.sessionStorage.getItem('cute-science-temp-app-mode-selected-once-v1') === '1';
    if (justSelected) {
      window.sessionStorage.removeItem('cute-science-temp-app-mode-selected-once-v1');
      return false;
    }
    return true;
  });
  const [chooserMode, setChooserMode] = useState('');
  const [chooserSession, setChooserSession] = useState(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || window.localStorage.getItem(SESSION_STORAGE_KEY) || '';
  });
  const [chooserGroup, setChooserGroup] = useState('1');
  const [teacherPin, setTeacherPin] = useState('');
  const [teacherAuthError, setTeacherAuthError] = useState('');
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(() =>
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem('cute-science-temp-app-teacher-auth-v1') === '1'
  );
  const dbRef = useRef(null);

  const [showThermometerModal, setShowThermometerModal] = useState(false);
  const [isSafetyChecked, setIsSafetyChecked] = useState(false); // 안전 수칙 동의 체크박스 상태
  const [showRoleModal, setShowRoleModal] = useState(false); 
  const [selectedRoleGroup, setSelectedRoleGroup] = useState('1'); 
  const [hasAgreedSafety, setHasAgreedSafety] = useState(false);
  const [activeQuizGroup, setActiveQuizGroup] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({ ans1: '', ans2: '' });
  const [quizFeedback, setQuizFeedback] = useState('');
  const [pendingTimerGroup, setPendingTimerGroup] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetTargetGroup, setResetTargetGroup] = useState(null);

  useEffect(() => {
    const initial = createInitialState();
    let restored = false;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.data) {
          const mergedData = { ...initial.data, ...saved.data };
          Object.keys(mergedData).forEach(id => {
            mergedData[id] = { ...createInitialGroup(Number(id)), ...mergedData[id] };
            if (!Array.isArray(mergedData[id].hotWater)) mergedData[id].hotWater = Array(10).fill('');
            if (!Array.isArray(mergedData[id].coldWater)) mergedData[id].coldWater = Array(10).fill('');
            if (!Array.isArray(mergedData[id].members)) mergedData[id].members = createInitialGroup(Number(id)).members;
          });
          setGroupData(mergedData);
          groupDataRef.current = mergedData;
          restored = true;
        }
        if (saved?.quiz) setQuizState({ ...initial.quiz, ...saved.quiz });
      }
    } catch (e) {}

    if (!restored) {
      setGroupData(initial.data);
      groupDataRef.current = initial.data;
    }
    setLocalTimers(initial.timers);
    if (!restored) setQuizState(initial.quiz);

    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);
      dbRef.current = db;

      let unsubscribeSnapshot = null;
      let unsubscribeAuth = null;

      const startSnapshot = () => {
        if (unsubscribeSnapshot) return;
        setIsConnected(true);
        const collRef = getGroupCollection(db);
        unsubscribeSnapshot = onSnapshot(collRef, (snapshot) => {
          const newData = { ...groupDataRef.current };
          const nextQuiz = {};
          snapshot.docs.forEach(docSnap => {
            const id = docSnap.id;
            const incoming = docSnap.data();
            newData[id] = { ...createInitialGroup(Number(id)), ...newData[id], ...incoming };
            nextQuiz[id] = !!incoming.quizCompleted;
          });
          setGroupData(newData);
          groupDataRef.current = newData;
          setQuizState(prev => ({ ...prev, ...nextQuiz }));
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: newData, quiz: { ...quizState, ...nextQuiz } }));
          } catch (e) {}
        });
      };

      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {

        if (user) {
          startSnapshot();
        } else {
          try {
            await signInAnonymously(auth);
          } catch (e) {}
        }
      });

      return () => {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeAuth) unsubscribeAuth();
      };
    } catch (e) {
      setIsConnected(false);
    }
  }, []);

  const makeSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const startSelectedMode = () => {
    const session = normalizeSessionId(chooserSession);
    if (!session || session === 'DEFAULT') {
      setTeacherAuthError('수업 코드를 입력해 주세요.');
      return;
    }
    if (chooserMode === 'teacher') {
      if (teacherPin !== TEACHER_PIN) {
        setTeacherAuthError('선생님 PIN이 올바르지 않습니다.');
        return;
      }
      window.localStorage.setItem('cute-science-temp-app-view-mode-v1', 'teacher');
      window.localStorage.setItem(SESSION_STORAGE_KEY, session);
      window.sessionStorage.setItem('cute-science-temp-app-teacher-auth-v1', '1');
      window.sessionStorage.setItem('cute-science-temp-app-mode-selected-once-v1', '1');
      window.location.href = window.location.pathname + '?mode=teacher&session=' + encodeURIComponent(session);
      return;
    }
    if (chooserMode === 'student') {
      const group = /^[1-6]$/.test(chooserGroup) ? chooserGroup : '1';
      window.localStorage.setItem('cute-science-temp-app-view-mode-v1', 'student');
      window.localStorage.setItem('cute-science-temp-app-student-group-v1', group);
      window.localStorage.setItem(SESSION_STORAGE_KEY, session);
      window.sessionStorage.removeItem('cute-science-temp-app-teacher-auth-v1');
      window.sessionStorage.setItem('cute-science-temp-app-mode-selected-once-v1', '1');
      window.location.href = window.location.pathname + '?mode=student&session=' + encodeURIComponent(session) + '&group=' + group;
    }
  };

  const openModeChooser = () => {
    setChooserMode('');
    setTeacherPin('');
    setTeacherAuthError('');
    setChooserSession(SESSION_ID === 'DEFAULT' ? '' : SESSION_ID);
    setShowModeChooser(true);
  };

  const requestReset = (groupId = null) => {
    if (viewMode !== 'teacher' || !isTeacherAuthenticated) return;
    setResetTargetGroup(groupId);
    setResetMessage('');
    setShowResetModal(true);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setLocalTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        let shouldPlaySound = false;

        Object.entries(groupDataRef.current).forEach(([groupId, data]) => {
          if (!newTimers[groupId]) newTimers[groupId] = { elapsed: 0, lastDingTime: -1 };

          if (data.timerStartTime) {
            let diff = Math.floor((now - data.timerStartTime) / 1000);
            if (diff < 0) diff = 0;
            if (diff > 480) diff = 480; 

            newTimers[groupId].elapsed = diff;

            if (diff >= 480 && newTimers[groupId].lastDingTime !== 480) {
              newTimers[groupId].lastDingTime = 480;
              setTimeout(() => {
                const latest = groupDataRef.current[groupId];
                if (latest?.timerStartTime) {
                  const stopped = { ...latest, timerStartTime: null };
                  const nextAll = { ...groupDataRef.current, [groupId]: stopped };
                  groupDataRef.current = nextAll;
                  setGroupData(nextAll);
                  persistGroup(groupId, { timerStartTime: null });
                  playDing('tada');
                }
              }, 0);
            }

            if (TARGET_TIMES.includes(diff) && newTimers[groupId].lastDingTime !== diff) {
              shouldPlaySound = true;
              newTimers[groupId].lastDingTime = diff;
            }
          } else {
            newTimers[groupId].elapsed = 0;
            newTimers[groupId].lastDingTime = -1; 
          }
        });

        if (shouldPlaySound) playDing('ding');
        return newTimers;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const isInputUnlocked = (groupId, index) => {
    const data = groupData[groupId];
    const local = localTimers[groupId] || { elapsed: 0 };
    if (index === 0) return true; 
    if (!data?.timerStartTime) return false; 
    const unlockTime = index === 1 ? 30 : (index - 1) * 60;
    return local.elapsed >= unlockTime;
  };

  const isAllDataFilled = (groupId) => {
    const data = groupData[groupId];
    if (!data) return false;
    const hotFilled = data.hotWater.every(val => val !== '');
    const coldFilled = data.coldWater.every(val => val !== '');
    return hotFilled && coldFilled;
  };

  const persistGroup = async (groupId, groupValue, extra = {}) => {
    try {
      const next = { ...groupDataRef.current[groupId], ...groupValue };
      const nextAll = { ...groupDataRef.current, [groupId]: next };
      groupDataRef.current = nextAll;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data: nextAll, quiz: quizState })
      );
    } catch (e) {}

    if (isConnected && dbRef.current) {
      try {
        const docRef = getGroupDoc(dbRef.current, groupId);
        await setDoc(docRef, { ...groupValue, ...extra }, { merge: true });
      } catch(e) {}
    }
  };

  const handleInputChange = async (groupId, type, index, value) => {
    const current = groupDataRef.current[groupId] || createInitialGroup(Number(groupId));
    const nextGroup = {
      ...current,
      hotWater: [...(current.hotWater || Array(10).fill(''))],
      coldWater: [...(current.coldWater || Array(10).fill(''))],
      members: (current.members || createInitialGroup(Number(groupId)).members).map(member => ({ ...member }))
    };

    if (type === 'name') {
      nextGroup.name = value;
    } else {
      nextGroup[type][index] = value;
    }

    const updatedGroupData = { ...groupDataRef.current, [groupId]: nextGroup };
    setGroupData(updatedGroupData);
    groupDataRef.current = updatedGroupData;
    await persistGroup(groupId, nextGroup);
  };

  const startRealTimer = async (groupId, isTimerRunning) => {
    try {
      if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    } catch(e) {}

    const current = groupDataRef.current[groupId] || createInitialGroup(Number(groupId));
    const newTime = isTimerRunning ? null : Date.now();
    const nextGroup = { ...current, timerStartTime: newTime };
    const updatedGroupData = { ...groupDataRef.current, [groupId]: nextGroup };

    setGroupData(updatedGroupData);
    groupDataRef.current = updatedGroupData;
    await persistGroup(groupId, { timerStartTime: newTime });
  };

  const toggleTimer = (groupId) => {
    const data = groupData[groupId];
    const isTimerRunning = !!data.timerStartTime;

    if (!isTimerRunning && !hasAgreedSafety && viewMode !== 'teacher') {
      setPendingTimerGroup(groupId);
      setShowGuideModal(true);
      return;
    }

    startRealTimer(groupId, isTimerRunning);
  };

  const handleSafetyAgree = () => {
    setHasAgreedSafety(true);
    setShowGuideModal(false);
    setShowRoleModal(true);
  };

  const handleMemberRoleChange = async (memberIdx, field, value) => {
    const groupId = selectedRoleGroup;
    const current = groupDataRef.current[groupId] || createInitialGroup(Number(groupId));
    const members = (current.members || createInitialGroup(Number(groupId)).members).map(member => ({ ...member }));
    members[memberIdx] = { ...members[memberIdx], [field]: value };

    const nextGroup = { ...current, members };
    const updatedData = { ...groupDataRef.current, [groupId]: nextGroup };
    setGroupData(updatedData);
    groupDataRef.current = updatedData;
    await persistGroup(groupId, { members });
  };

  const handleRoleSetupComplete = () => {
    if (!hasAgreedSafety) {
      setPendingTimerGroup(pendingTimerGroup || selectedRoleGroup);
      setShowRoleModal(false);
      setShowGuideModal(true);
      return;
    }

    setShowRoleModal(false);
    if (pendingTimerGroup) {
      startRealTimer(pendingTimerGroup, false);
      setPendingTimerGroup(null);
    }
  };

  const resetClassroomRecords = async () => {
    if (isResetting) return;

    if (viewMode !== 'teacher' || !isTeacherAuthenticated) {
      setResetMessage('선생님 화면에서 인증 후 사용할 수 있습니다.');
      return;
    }

    setIsResetting(true);
    setResetMessage('');

    const target = resetTargetGroup;

    try {
      if (!isConnected || !dbRef.current) {
        throw new Error('Firebase 연결이 준비되지 않았습니다.');
      }

      if (target) {
        const groupId = target;
        const initialGroup = createInitialGroup(Number(groupId));
        const docRef = getGroupDoc(dbRef.current, groupId);

        await setDoc(docRef, {
          ...initialGroup,
          quizCompleted: false
        });

        const nextAll = { ...groupDataRef.current, [groupId]: initialGroup };
        groupDataRef.current = nextAll;
        setGroupData(nextAll);
        setLocalTimers(prev => ({
          ...prev,
          [groupId]: { elapsed: 0, lastDingTime: -1 }
        }));
        setQuizState(prev => ({ ...prev, [groupId]: false }));

        setShowResetModal(false);
        setResetTargetGroup(null);
        setResetMessage(groupId + '모둠 기록을 초기화했습니다.');
      } else {
        const initial = createInitialState();

        for (let i = 1; i <= NUM_GROUPS; i++) {
          const docRef = getGroupDoc(dbRef.current, i);

          await setDoc(docRef, {
            ...initial.data[i],
            quizCompleted: false
          });
        }

        setGroupData(initial.data);
        groupDataRef.current = initial.data;
        setLocalTimers(initial.timers);
        setQuizState(initial.quiz);
        setActiveQuizGroup(null);
        setQuizAnswers({ ans1: '', ans2: '' });
        setQuizFeedback('');

        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ data: initial.data, quiz: initial.quiz })
        );

        setShowRoleModal(false);
        setShowGuideModal(false);
        setIsSafetyChecked(false);
        setHasAgreedSafety(false);
        setPendingTimerGroup(null);
        setShowResetModal(false);
        setResetTargetGroup(null);
        setResetMessage('1~6모둠의 모든 기록을 초기화했습니다.');
      }
    } catch (e) {
      setResetMessage('초기화에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsResetting(false);
    }
  };
  const handleQuizSubmit = async () => {
    if (quizAnswers.ans1 === '높은' && quizAnswers.ans2 === '낮은') {
      playDing('tada');
      setQuizFeedback('정답입니다! 🎉 heat moves from higher to lower temperature.');
      setQuizState(prev => {
        const nextQuiz = { ...prev, [activeQuizGroup]: true };
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ data: groupDataRef.current, quiz: nextQuiz })
          );
        } catch (e) {}
        return nextQuiz;
      });
      
      if (isConnected && dbRef.current) {
        try {
          const docRef = getGroupDoc(dbRef.current, activeQuizGroup);
          await setDoc(docRef, { quizCompleted: true }, { merge: true });
        } catch(e) {}
      }
    } else {
      setQuizFeedback('다시 한번 생각해 볼까요? 🤔');
    }
  };

  return (
    <>
      {showModeChooser && (
        <ModeChooser
          mode={chooserMode}
          session={chooserSession}
          group={chooserGroup}
          pin={teacherPin}
          error={teacherAuthError}
          onTeacher={() => { setChooserMode('teacher'); setTeacherAuthError(''); }}
          onStudent={() => { setChooserMode('student'); setTeacherAuthError(''); }}
          onSessionChange={(value) => { setChooserSession(value); setTeacherAuthError(''); }}
          onGroupChange={setChooserGroup}
          onPinChange={(value) => { setTeacherPin(value); setTeacherAuthError(''); }}
          onStart={startSelectedMode}
          makeCode={makeSessionCode}
        />
      )}

    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center relative space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full shadow-sm border-2 border-indigo-100 text-sm font-black text-indigo-700">
            🧪 현재 수업 코드: <span className="text-indigo-900">{SESSION_ID}</span>
          </div>
          <div className="inline-block bg-white px-8 py-4 rounded-full shadow-sm border-2 border-pink-100">
            <h1 className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center gap-3">
              <span className="text-4xl">🌡️</span> 
              온도가 다른 두 물체가 접촉할 때
              <span className="text-4xl">✨</span>
            </h1>
          </div>
          
          {viewMode === 'teacher' ? (
            <div className="flex flex-wrap justify-center items-center gap-3">
              <div className="bg-white text-slate-700 px-5 py-3 rounded-3xl text-sm font-black shadow-md border-b-4 border-slate-200">👩‍🏫 선생님 화면 · 1~6모둠 전체</div>
              <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl px-3 py-2 flex items-center gap-2 flex-wrap justify-center">
                <span className="text-xs font-black text-rose-700">🧹 초기화</span>
                {[1,2,3,4,5,6].map(g => <button key={g} onClick={() => requestReset(String(g))} className="bg-white hover:bg-rose-100 text-rose-700 px-3 py-2 rounded-xl text-xs font-black border border-rose-200">{g}모둠</button>)}
              </div>
              <button onClick={() => requestReset(null)} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-3 rounded-2xl text-sm font-black shadow-md">전체 초기화</button>
              <button onClick={openModeChooser} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl text-sm font-black">🔄 화면 변경</button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <div className="bg-white text-slate-700 px-6 py-4 rounded-3xl text-sm md:text-base font-bold shadow-md border-b-4 border-slate-200">💡 모둠별 <strong className="text-blue-500">타이머 시작</strong> 버튼을 누르면 정해진 시간에 띠링! 소리가 나요.</div>
              <button onClick={() => setShowRoleModal(true)} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-6 py-4 rounded-3xl inline-flex items-center gap-2 text-sm md:text-base font-extrabold shadow-md border-b-4 border-indigo-300"><span className="text-xl">👥</span> 모둠 역할 설정</button>
              <button onClick={() => setShowThermometerModal(true)} className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-6 py-4 rounded-3xl inline-flex items-center gap-2 text-sm md:text-base font-extrabold shadow-md border-b-4 border-yellow-300"><span className="text-xl">📖</span> 탐침 온도계 사용법</button>
            </div>
          )}        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Object.entries(groupData).filter(([groupId]) => viewMode === 'teacher' || groupId === studentGroup).map(([groupId, data]) => {
            const local = localTimers[groupId] || { elapsed: 0 };
            const isTimerRunning = !!data.timerStartTime;
            const style = GROUP_STYLES[(groupId - 1) % GROUP_STYLES.length];
            const allFilled = isAllDataFilled(groupId);
            const isQuizDone = quizState[groupId];

            return (
              <div key={groupId} className={`bg-white rounded-[2rem] shadow-xl border-4 border-white overflow-hidden relative ${isQuizDone ? 'ring-4 ring-green-400 ring-offset-4' : ''}`}>
                <div className={`${style.color} px-6 py-5 flex flex-wrap items-center justify-between border-b-2 ${style.borderColor} gap-4`}>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl bg-white p-2 rounded-full shadow-sm">{style.icon}</span>
                    <input
                      type="text"
                      value={data.name}
                      onChange={(e) => handleInputChange(groupId, 'name', null, e.target.value)}
                      className={`text-2xl font-black bg-transparent border-b-2 ${style.borderColor} outline-none w-32 pb-1 ${style.textColor}`}
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl shadow-sm border border-white">
                    <span className="font-mono text-3xl font-black text-slate-700 w-24 text-center tracking-tight">
                      {Math.floor(local.elapsed / 60).toString().padStart(2, '0')}:{(local.elapsed % 60).toString().padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => toggleTimer(groupId)}
                      className={`px-6 py-3 rounded-2xl text-sm font-extrabold shadow-md border-b-4 active:translate-y-1 active:border-b-0 transition-all ${
                        isTimerRunning 
                        ? 'bg-rose-400 text-white border-rose-600 hover:bg-rose-500' 
                        : 'bg-sky-400 text-white border-sky-600 hover:bg-sky-500'
                      }`}
                    >
                      {isTimerRunning ? '⏹️ 정지' : '▶️ 시작'}
                    </button>
                  </div>
                </div>

                <div className="px-5 pt-4 pb-1 flex flex-wrap gap-2 items-center text-xs font-bold text-slate-600">
                  <span className="text-slate-400 font-extrabold">👥 역할:</span>
                  {data.members?.filter(m => m.name.trim() !== '').length > 0 ? (
                    data.members.filter(m => m.name.trim() !== '').map((m, idx) => (
                      <span key={idx} className={`px-2.5 py-1 rounded-lg border text-xs font-black ${
                        m.role === '기록자' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        m.role === '온도측정자' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-sky-100 text-sky-800 border-sky-300'
                      }`}>
                        {m.role}: <strong>{m.name}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 font-medium">모둠원 미지정</span>
                  )}
                </div>

                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-center border-separate border-spacing-y-2 text-sm min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="p-2 font-black text-slate-400 bg-slate-50 rounded-xl">시간</th>
                        {TIME_LABELS.map(label => (
                          <th key={label} className="p-2 text-slate-500 font-extrabold">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3 font-black text-rose-600 bg-rose-50 rounded-2xl shadow-sm border border-rose-100">🔥 따뜻한 물</td>
                        {TIME_LABELS.map((_, i) => {
                          const unlocked = isInputUnlocked(groupId, i);
                          return (
                            <td key={`hot-${i}`} className="p-1">
                              <input
                                type="number"
                                disabled={!unlocked}
                                value={data.hotWater[i]}
                                onChange={(e) => handleInputChange(groupId, 'hotWater', i, e.target.value)}
                                placeholder={unlocked ? "" : "🔒"}
                                className={`w-12 h-12 text-center font-black outline-none rounded-2xl transition-all shadow-sm ${
                                  unlocked 
                                  ? 'bg-white text-rose-600 border-2 border-rose-200 focus:border-rose-400 focus:scale-110' 
                                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border-2 border-slate-100'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="p-3 font-black text-sky-600 bg-sky-50 rounded-2xl shadow-sm border border-sky-100 mt-2">🧊 차가운 물</td>
                        {TIME_LABELS.map((_, i) => {
                          const unlocked = isInputUnlocked(groupId, i);
                          return (
                            <td key={`cold-${i}`} className="p-1">
                              <input
                                type="number"
                                disabled={!unlocked}
                                value={data.coldWater[i]}
                                onChange={(e) => handleInputChange(groupId, 'coldWater', i, e.target.value)}
                                placeholder={unlocked ? "" : "🔒"}
                                className={`w-12 h-12 text-center font-black outline-none rounded-2xl transition-all shadow-sm mt-1 ${
                                  unlocked 
                                  ? 'bg-white text-sky-600 border-2 border-sky-200 focus:border-sky-400 focus:scale-110' 
                                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border-2 border-slate-100'
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {allFilled && (
                  <div className="mx-5 mb-5 p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between">
                    <span className="font-extrabold text-slate-700 text-sm">
                      {isQuizDone ? '✨ 결론 도출 완료! 참 잘했어요!' : '👀 모든 온도 측정이 완료되었습니다!'}
                    </span>
                    {!isQuizDone && (
                      <button
                        onClick={() => { setActiveQuizGroup(groupId); setQuizFeedback(''); setQuizAnswers({ans1:'', ans2:''}); }}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-full font-black text-xs md:text-sm shadow-md transition-all"
                      >
                        🎯 결론 퀴즈 풀기
                      </button>
                    )}
                  </div>
                )}

                {}
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col items-center w-full">
                  <GroupChart hotData={data.hotWater} coldData={data.coldWater} groupName={data.name} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 md:p-10 shadow-2xl border-8 border-rose-100 text-center relative">
            <div className="inline-block bg-rose-100 p-4 rounded-full mb-4">
              <span className="text-5xl">🧹</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-3">
              {resetTargetGroup ? resetTargetGroup + '모둠 기록을 초기화할까요?' : '학생 기록을 모두 초기화할까요?'}
            </h2>

            <p className="text-slate-600 font-bold leading-relaxed mb-6">
              {resetTargetGroup
                ? resetTargetGroup + '모둠의 온도 기록, 타이머, 역할, 결론 퀴즈 기록이 지워집니다.'
                : '1~6모둠의 온도 기록, 타이머, 역할, 결론 퀴즈 기록이 모두 지워집니다.'}
              <br />
              <span className="text-rose-600">새로운 모둠 또는 반 수업을 시작할 때 사용하세요.</span>
            </p>

            {resetMessage && (
              <div className="mb-5 p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 font-bold text-slate-700">
                {resetMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setShowResetModal(false); setResetTargetGroup(null); setResetMessage(''); }}
                disabled={isResetting}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-7 py-3.5 rounded-full font-black text-lg"
              >
                취소
              </button>

              <button
                onClick={resetClassroomRecords}
                disabled={isResetting}
                className="bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-full font-black text-lg shadow-md border-b-4 border-rose-700 disabled:border-slate-400"
              >
                {isResetting ? '초기화 중...' : (resetTargetGroup ? resetTargetGroup + '모둠 초기화하기 🧹' : '전체 초기화하기 🧹')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-6 md:p-8 shadow-2xl border-8 border-white text-center relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowRoleModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 w-10 h-10 rounded-full font-bold">X</button>
            
            <div className="inline-block bg-indigo-100 p-3 rounded-full mb-3">
              <span className="text-4xl">👥</span>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">우리 모둠 <span className="text-indigo-600">역할 분담</span></h2>
            <p className="text-slate-500 font-bold mb-4 text-sm">이름을 입력하고, 원하는 역할 버튼을 지정해 주세요!</p>

            <div className="flex flex-wrap justify-center gap-2 mb-4 text-xs font-extrabold">
              <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full border border-amber-300">📝 기록자 (1명)</span>
              <span className="bg-rose-100 text-rose-800 px-3 py-1.5 rounded-full border border-rose-300">🌡️ 온도측정자 (2명)</span>
              <span className="bg-sky-100 text-sky-800 px-3 py-1.5 rounded-full border border-sky-300">⏱️ 시간확인자 (1명)</span>
            </div>

            <div className="mb-4 flex justify-center items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <label className="font-extrabold text-slate-700 text-sm">모둠 선택:</label>
              <select 
                value={selectedRoleGroup} 
                onChange={e => setSelectedRoleGroup(e.target.value)}
                className="bg-white font-black text-indigo-600 border-2 border-indigo-200 rounded-xl px-4 py-1.5 text-base outline-none cursor-pointer"
              >
                {[1,2,3,4,5,6].map(g => (
                  <option key={g} value={g.toString()}>{g} 모둠</option>
                ))}
              </select>
            </div>

            <div className="space-y-3 mb-6 text-left">
              {(groupData[selectedRoleGroup]?.members || [
                { name: '', role: '기록자' },
                { name: '', role: '온도측정자' },
                { name: '', role: '온도측정자' },
                { name: '', role: '시간확인자' }
              ]).map((member, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 flex flex-col sm:flex-row items-center gap-3">
                  <span className="font-black text-slate-500 text-sm w-16">팀원 {idx + 1}</span>
                  <input
                    type="text"
                    placeholder="학생 이름 입력"
                    value={member.name}
                    onChange={e => handleMemberRoleChange(idx, 'name', e.target.value)}
                    className="bg-white border-2 border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400 flex-1 w-full sm:w-auto text-sm"
                  />
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                    {[
                      { id: '기록자', label: '📝 기록자', class: 'bg-amber-100 text-amber-800 border-amber-300' },
                      { id: '온도측정자', label: '🌡️ 온도측정자', class: 'bg-rose-100 text-rose-800 border-rose-300' },
                      { id: '시간확인자', label: '⏱️ 시간확인자', class: 'bg-sky-100 text-sky-800 border-sky-300' }
                    ].map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleMemberRoleChange(idx, 'role', r.id)}
                        className={`px-2.5 py-1.5 text-xs font-black rounded-xl border transition-all ${
                          member.role === r.id ? `${r.class} ring-2 ring-indigo-400 font-black scale-105 shadow-sm` : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleRoleSetupComplete}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-full font-black text-lg shadow-md border-b-4 border-indigo-700 active:translate-y-1 active:border-b-0 transition-all w-full"
            >
              역할 설정 완료 & 실험 시작 🚀
            </button>
          </div>
        </div>
      )}
{showThermometerModal && (
  <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-8 shadow-2xl text-center relative">
      
      <button
        onClick={() => setShowThermometerModal(false)}
        className="absolute top-4 right-4 text-slate-400 bg-slate-100 w-10 h-10 rounded-full font-bold"
      >
        X
      </button>

      <div className="text-5xl mb-4">🌡️</div>

      <h2 className="text-3xl font-black text-slate-800 mb-6">
        탐침 온도계 사용법
      </h2>

      <div className="space-y-4 text-left">

        <div className="p-4 bg-slate-50 rounded-2xl">
          <b>🔘 ON/OFF</b>
          <p>전원을 켜고 끄는 버튼이에요.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl">
          <b>🌡️ °C/°F</b>
          <p>반드시 섭씨(°C)로 맞춰서 측정해 주세요.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl">
          <b>📌 HOLD</b>
          <p>현재 온도를 화면에 고정해서 편하게 기록할 수 있어요.</p>
        </div>

        <div className="p-4 bg-yellow-50 rounded-2xl">
          <b>☝️ 측정할 때</b>
          <p>탐침을 물속에 넣고 온도가 안정될 때까지 기다려 주세요.</p>
        </div>

      </div>

      <button
        onClick={() => setShowThermometerModal(false)}
        className="mt-6 bg-yellow-400 text-white px-10 py-4 rounded-full font-black text-lg"
      >
        확인했어요! 👍
      </button>

    </div>
  </div>
)}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-8 md:p-10 shadow-2xl border-8 border-rose-100 text-center relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowGuideModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 w-10 h-10 rounded-full font-bold">X</button>
            
            <div className="inline-block bg-rose-100 p-4 rounded-full mb-4">
              <span className="text-5xl">⚠️</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-6">실험 전 <span className="text-rose-600">안전 수칙</span> 확인!</h2>
            
            <div className="bg-slate-50 rounded-3xl p-6 border-2 border-slate-200 text-left space-y-4 mb-6 text-sm md:text-base">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <h3 className="font-bold text-slate-800">뜨거운 물 주의!</h3>
                  <p className="text-slate-600">뜨거운 물을 다룰 때는 화상을 입지 않도록 절대 장난치지 마세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🧤</span>
                <div>
                  <h3 className="font-bold text-slate-800">안전장갑 필수 착용</h3>
                  <p className="text-slate-600">비커를 만질 때는 안전장갑을 꼭 착용하세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🌡️</span>
                <div>
                  <h3 className="font-bold text-slate-800">탐침 온도계 주의사항</h3>
                  <p className="text-slate-600">탐침 온도계의 뾰족한 부분이 사람을 향하지 않도록 주의하세요.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8 text-left">
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-white px-5 py-2.5 rounded-full font-bold text-slate-800 shadow-sm border border-slate-200 whitespace-nowrap min-w-[80px] text-center tracking-wider text-sm">ON/OFF</div>
                    <p className="font-medium text-slate-700 text-sm md:text-base">전원을 켜고 끄는 버튼이에요.</p>
                </div>
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-white px-5 py-2.5 rounded-full font-bold text-slate-800 shadow-sm border border-slate-200 whitespace-nowrap min-w-[80px] text-center tracking-wider text-sm">°C/°F</div>
                    <p className="font-medium text-slate-700 text-sm md:text-base">반드시 섭씨(°C)로 맞춰서 측정해 주세요.</p>
                </div>
                <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-white px-5 py-2.5 rounded-full font-bold text-slate-800 shadow-sm border border-slate-200 whitespace-nowrap min-w-[80px] text-center tracking-wider text-sm">HOLD</div>
                    <p className="font-medium text-slate-700 text-sm md:text-base leading-snug">이 버튼을 누르면 온도가 화면에 고정<br/>돼서 편하게 기록할 수 있어요.</p>
                </div>
            </div>

            {}
            <div className="flex flex-col items-center gap-4 mb-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={isSafetyChecked} 
                  onChange={(e) => setIsSafetyChecked(e.target.checked)}
                  className="w-6 h-6 rounded border-2 border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer" 
                />
                <span className="text-base md:text-lg font-bold text-slate-700 group-hover:text-slate-900">위 안전 수칙을 모두 확인하였으며, 잘 지키겠습니다.</span>
              </label>

              <button 
                onClick={handleSafetyAgree}
                disabled={!isSafetyChecked}
                className={`text-white px-10 py-4 rounded-full font-black text-lg shadow-md border-b-4 active:translate-y-1 active:border-b-0 transition-all w-full md:w-auto ${isSafetyChecked ? 'bg-rose-500 hover:bg-rose-600 border-rose-700' : 'bg-slate-300 border-slate-400 cursor-not-allowed text-slate-100'}`}
              >
                동의하고 역할 설정하기 ➡️
              </button>
            </div>
          </div>
        </div>
      )}

      {activeQuizGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] max-w-2xl w-full p-8 md:p-10 shadow-2xl border-8 border-white text-center relative animate-fade-in-up">
            <h2 className="text-3xl font-black text-slate-800 mb-2">마무리 결론 퀴즈 🎯</h2>
            <p className="text-slate-500 font-bold mb-6">우리 모둠이 만든 그래프를 보고 빈칸을 채워보세요!</p>
            
            {}
            <div className="flex justify-center mb-8 w-full">
              <GroupChart 
                hotData={groupData[activeQuizGroup].hotWater} 
                coldData={groupData[activeQuizGroup].coldWater}
                groupName={groupData[activeQuizGroup].name} 
              />
            </div>

            <div className="bg-indigo-50 p-6 md:p-8 rounded-3xl border-2 border-indigo-100 text-lg md:text-xl font-black text-slate-700 leading-loose">
              "접촉한 두 물체 사이에서 열은 온도가 <br className="md:hidden" />
              <select 
                value={quizAnswers.ans1} 
                onChange={e => setQuizAnswers({...quizAnswers, ans1: e.target.value})}
                className="bg-white border-4 border-indigo-200 rounded-xl px-4 py-2 mx-2 text-indigo-600 cursor-pointer outline-none focus:border-indigo-400"
              >
                <option value="">선택</option>
                <option value="높은">높은 🔼</option>
                <option value="낮은">낮은 🔽</option>
              </select>
              곳에서 온도가 <br className="md:hidden" />
              <select 
                value={quizAnswers.ans2} 
                onChange={e => setQuizAnswers({...quizAnswers, ans2: e.target.value})}
                className="bg-white border-4 border-indigo-200 rounded-xl px-4 py-2 mx-2 text-indigo-600 cursor-pointer outline-none focus:border-indigo-400"
              >
                <option value="">선택</option>
                <option value="높은">높은 🔼</option>
                <option value="낮은">낮은 🔽</option>
              </select>
              곳으로 이동합니다."
            </div>

            <div className="mt-6 font-bold text-lg h-8 flex items-center justify-center">
                {quizFeedback && <span className={quizFeedback.includes('정답') ? 'text-green-500' : 'text-red-500'}>{quizFeedback}</span>}
            </div>

            <div className="mt-6 flex gap-4 justify-center">
              <button 
                onClick={() => {setActiveQuizGroup(null); setQuizFeedback(''); setQuizAnswers({ans1:'', ans2:''})}}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-8 py-4 rounded-full font-black text-lg transition-colors"
              >
                닫기
              </button>
              <button 
                onClick={handleQuizSubmit}
                className="bg-green-400 hover:bg-green-500 text-white px-10 py-4 rounded-full font-black text-lg shadow-md border-b-4 border-green-600 active:translate-y-1 active:border-b-0 transition-all"
              >
                정답 확인하기! ✨
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
    </>
  );
}
