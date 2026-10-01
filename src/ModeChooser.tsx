import React from "react";

type ModeChooserProps = {
  mode: string;
  session: string;
  group: string;
  pin: string;
  error: string;
  onTeacher: () => void;
  onStudent: () => void;
  onSessionChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onPinChange: (value: string) => void;
  onStart: () => void;
  makeCode: () => string;
};

export default function ModeChooser({
  mode, session, group, pin, error, onTeacher, onStudent,
  onSessionChange, onGroupChange, onPinChange, onStart, makeCode
}: ModeChooserProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] max-w-3xl w-full p-7 md:p-9 shadow-2xl border-8 border-indigo-50">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🧪</div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800">수업 코드와 사용 화면을 선택하세요</h2>
          <p className="text-slate-500 font-bold mt-2">선생님은 1~6모둠 전체, 학생은 자기 모둠만 볼 수 있어요.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className={`rounded-3xl border-4 p-5 ${mode === "teacher" ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-50"}`}>
            <button type="button" onClick={onTeacher} className="w-full text-left">
              <div className="text-4xl mb-2">👩‍🏫</div>
              <div className="text-xl font-black text-slate-800">선생님 화면</div>
              <div className="text-sm text-slate-500 font-bold mt-1">1~6모둠을 모두 보고 모둠별 기록을 초기화할 수 있습니다.</div>
            </button>
            {mode === "teacher" && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input value={session} onChange={e => onSessionChange(e.target.value.toUpperCase())} placeholder="수업 코드 예: 5-1-A" className="flex-1 min-w-0 bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-black outline-none focus:border-indigo-400" />
                  <button type="button" onClick={() => onSessionChange(makeCode())} className="bg-indigo-100 text-indigo-700 px-4 rounded-2xl font-black">새 코드</button>
                </div>
                <input
                  type="password"
                  value={pin}
                  onChange={e => onPinChange(e.target.value.replace(/\D/g, "").slice(0,4))}
                  placeholder="선생님 PIN 4자리"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  className="w-full text-center tracking-[0.7em] text-2xl bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-black outline-none focus:border-indigo-400"
                />
              </div>
            )}
          </div>

          <div className={`rounded-3xl border-4 p-5 ${mode === "student" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <button type="button" onClick={onStudent} className="w-full text-left">
              <div className="text-4xl mb-2">📱</div>
              <div className="text-xl font-black text-slate-800">학생 화면</div>
              <div className="text-sm text-slate-500 font-bold mt-1">수업 코드와 모둠을 선택하면 자기 모둠만 보여요.</div>
            </button>
            {mode === "student" && (
              <div className="mt-4 space-y-3">
                <input value={session} onChange={e => onSessionChange(e.target.value.toUpperCase())} placeholder="수업 코드 입력" className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 font-black outline-none focus:border-emerald-400" />
                <select value={group} onChange={e => onGroupChange(e.target.value)} className="w-full bg-white border-2 border-emerald-200 rounded-2xl px-4 py-3 font-black">
                  {[1,2,3,4,5,6].map(g => <option key={g} value={String(g)}>{g}모둠</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {error && <div className="mt-4 p-3 rounded-2xl bg-rose-50 border-2 border-rose-100 text-rose-600 font-bold text-sm text-center">{error}</div>}

        <button type="button" onClick={onStart} className={`mt-5 w-full ${mode === "teacher" ? "bg-indigo-500 hover:bg-indigo-600" : "bg-emerald-500 hover:bg-emerald-600"} text-white px-6 py-4 rounded-full font-black text-lg shadow-md`}>
          {mode === "teacher" ? "선생님 화면 열기 🔐" : "이 모둠으로 시작하기 →"}
        </button>
      </div>
    </div>
  );
}
