import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./styles.css";
import { protocolOf } from "./domain/catalog";
import { reducer, emptyState } from "./domain/store";
import { activeAppointmentOf } from "./domain/scheduling";
import { buildBatches } from "./domain/catalog";
import type { ExamResult } from "./domain/types";
import { loadState, saveState, clearState, seedState } from "./storage/stationRepository";
import { RegisterForm } from "./ui/RegisterForm";
import { TimelineBoard } from "./ui/TimelineBoard";
import { CaseList } from "./ui/CaseList";
import { Sidebar } from "./ui/Sidebar";
import { RedropDialog } from "./ui/RedropDialog";
import { ExamDialog } from "./ui/ExamDialog";

interface Toast {
  id: number;
  kind: "danger" | "ok" | "info";
  text: string;
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [redropId, setRedropId] = useState<string | undefined>();
  const [examId, setExamId] = useState<string | undefined>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const logLenRef = useRef(state.log.length);

  const batches = useMemo(() => buildBatches(now), [now]);

  // 时钟：每 20 秒推进，驱动"当前时段"和窗口状态
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  // 本机留档：状态变更即写入 localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 监听留档流水，把最新动作反馈到界面
  useEffect(() => {
    if (state.log.length > logLenRef.current) {
      const latest = state.log[0];
      const kind: Toast["kind"] =
        latest.kind === "danger" ? "danger" : latest.kind === "void" ? "info" : "ok";
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, text: latest.text }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    }
    logLenRef.current = state.log.length;
  }, [state.log]);

  const selected = state.cases.find((c) => c.id === selectedId);
  const redropCase = state.cases.find((c) => c.id === redropId);
  const examCase = state.cases.find((c) => c.id === examId);
  const examAppt = examCase ? activeAppointmentOf(state, examCase.id) : undefined;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HXWL-11 · 散瞳排程台</p>
          <h1>小儿散瞳验光 · 滴药排程看板</h1>
          <p className="subtitle">
            登记患者 / 眼别 / 药品批次 / 滴眼时刻 / 眼压；药效窗口内安排检查，同一仪器同一时段仅留一人；
            危险病例保留输入并列出原因，锁定不释放仪器。
          </p>
        </div>
      </header>

      <div className="layout">
        <div className="main-col">
          <RegisterForm
            now={now}
            onSubmit={(input) =>
              dispatch({
                type: "register",
                now: Date.now(),
                protocol: protocolOf(input.drugId),
                batches,
                input,
              })
            }
          />
          <TimelineBoard state={state} now={now} selectedCaseId={selectedId} onSelect={setSelectedId} />
          <CaseList
            state={state}
            now={now}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRedrop={setRedropId}
            onExam={setExamId}
            onRetry={(caseId) => dispatch({ type: "retry", caseId, now: Date.now() })}
          />
        </div>
        <Sidebar
          state={state}
          now={now}
          onLoadSeed={() => {
            const s = seedState(Date.now());
            dispatch({ type: "hydrate", state: s });
          }}
          onClear={() => {
            if (window.confirm("确定清空本机全部留档？")) {
              clearState();
              dispatch({ type: "hydrate", state: emptyState() });
            }
          }}
        />
      </div>

      {redropCase && (
        <RedropDialog
          c={redropCase}
          now={now}
          onClose={() => setRedropId(undefined)}
          onConfirm={(drop) => {
            dispatch({
              type: "redrop",
              caseId: redropCase.id,
              now: Date.now(),
              protocol: protocolOf(redropCase.drugId),
              batches,
              drop,
            });
            setRedropId(undefined);
          }}
        />
      )}

      {examCase && examAppt && (
        <ExamDialog
          c={examCase}
          appt={examAppt}
          now={now}
          onClose={() => setExamId(undefined)}
          onConfirm={(result: Omit<ExamResult, "caseId">) => {
            dispatch({ type: "recordExam", caseId: examCase.id, result });
            setExamId(undefined);
          }}
        />
      )}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </main>
  );
}

export default App;
