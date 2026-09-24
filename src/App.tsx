// 界面层：散瞳排程台组装。
// 档案（archive）/ 判定（rules）/ 本机留档（storage）三层均不依赖本文件；
// 这里只负责采集界面事件、调用判定层结论、派发档案变更。

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import "./styles.css";

import type { Appointment, DoseDraft, DoseRecord } from "./archive/types";
import { archiveReducer } from "./archive/reducer";
import { buildSeedState } from "./archive/seed";
import { uid, nowLocalInputValue, toLocalInputValue } from "./archive/format";
import { loadArchive, saveArchive, clearArchive } from "./storage/localArchive";
import { evaluateDanger, validateDraft } from "./rules/safety";
import { buildSlotGrid, canBook } from "./rules/schedule";
import { SLOT_MINUTES } from "./rules/constants";

import { Metrics } from "./ui/Metrics";
import { RegisterForm } from "./ui/RegisterForm";
import { DangerPanel } from "./ui/DangerPanel";
import { WaitingQueue } from "./ui/WaitingQueue";
import { ScheduleBoard } from "./ui/ScheduleBoard";
import { AppointmentDialog } from "./ui/AppointmentDialog";
import { RedoseDialog } from "./ui/RedoseDialog";
import { ArchiveList } from "./ui/ArchiveList";

function initDraft(): DoseDraft {
  return {
    patientName: "",
    patientNo: "",
    age: 0,
    eyes: "OU",
    batchId: "",
    droppedAt: nowLocalInputValue(),
    iop: {},
  };
}

function initState() {
  return loadArchive() ?? buildSeedState();
}

export default function App() {
  const [state, dispatch] = useReducer(archiveReducer, undefined, initState);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<DoseDraft>(initDraft);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<{
    kind: "blocked" | "ok";
    text: string;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [apptDialogId, setApptDialogId] = useState<string | null>(null);
  const [redoseRecordId, setRedoseRecordId] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);

  // 本机留档：每次档案变更即写入
  useEffect(() => {
    saveArchive(state);
  }, [state]);

  // 驱动“起效等待倒计时 / 已过时段”刷新
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  const slots = useMemo(() => buildSlotGrid(new Date(now).toISOString()), [now]);

  const flashNotice = (n: { kind: "blocked" | "ok"; text: string }) => {
    setNotice(n);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  };

  /** 登记：先表单校验，再走危险判定；危险病例同样建档但不进排程 */
  const register = () => {
    const errors = validateDraft(draft);
    setFormErrors(errors);
    if (errors.length > 0) return;

    const batch = state.batches.find((b) => b.id === draft.batchId);
    const history = state.records.filter(
      (r) => r.patientNo === draft.patientNo && r.status !== "void"
    );
    const reasons = evaluateDanger(draft, batch, history);

    const record: DoseRecord = {
      id: uid("rec"),
      ...draft,
      status: reasons.length > 0 ? "blocked" : "waiting",
      blockReasons: reasons,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "register", record });

    if (reasons.length > 0) {
      flashNotice({
        kind: "blocked",
        text: `已登记为危险病例并保留输入（${reasons.length} 项原因），未安排检查、未释放仪器。`,
      });
    } else {
      flashNotice({
        kind: "ok",
        text: `登记成功：${draft.patientName} 已进入候诊队列，请在药效窗口内安排检查。`,
      });
      setDraft(initDraft());
      setSelectedId(record.id);
      setFormErrors([]);
    }
  };

  const reloadBlocked = (record: DoseRecord) => {
    setDraft({
      patientName: record.patientName,
      patientNo: record.patientNo,
      age: record.age,
      eyes: record.eyes,
      batchId: record.batchId,
      droppedAt: toLocalInputValue(record.droppedAt),
      iop: { ...record.iop },
    });
    setNotice({
      kind: "blocked",
      text: "已载入该危险病例的原始输入，核对修正后重新登记（原拦截档案保留可追溯）。",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const book = (instrumentId: string, slotStart: number) => {
    const record = state.records.find((r) => r.id === selectedId);
    if (!record) return;
    const batch = state.batches.find((b) => b.id === record.batchId);
    const check = canBook(
      record,
      batch,
      instrumentId,
      slotStart,
      state.appointments
    );
    if (!check.ok) {
      flashNotice({ kind: "blocked", text: check.reason ?? "无法排程" });
      return;
    }
    dispatch({
      type: "book",
      appointment: {
        id: uid("appt"),
        recordId: record.id,
        instrumentId,
        slotStart: new Date(slotStart).toISOString(),
        status: "booked",
        createdAt: new Date().toISOString(),
      },
    });
    setSelectedId(null);
    flashNotice({ kind: "ok", text: `已为 ${record.patientName} 锁定仪器时段。` });
  };

  const openAppointment = (appt: Appointment) => setApptDialogId(appt.id);

  const completeExam = (
    appointmentId: string,
    pupilMm: DoseRecord["iop"],
    refraction: Partial<Record<"OD" | "OS", string>>,
    examiner: string
  ) => {
    dispatch({
      type: "completeExam",
      appointmentId,
      pupilMm,
      refraction,
      examiner,
      examinedAt: new Date().toISOString(),
    });
    setApptDialogId(null);
    flashNotice({ kind: "ok", text: "检查结果已补录，档案标记为已检查。" });
  };

  /** 补滴：危险则新建拦截档案（原排程不动）；通过则作废旧档案并生成新候诊档案 */
  const redose = (oldRecordId: string, newDraft: DoseDraft): string[] => {
    const old = state.records.find((r) => r.id === oldRecordId);
    if (!old) return [];
    const batch = state.batches.find((b) => b.id === newDraft.batchId);
    const history = state.records.filter(
      (r) =>
        r.patientNo === old.patientNo &&
        r.id !== old.id &&
        r.status !== "void"
    );
    const reasons = evaluateDanger(newDraft, batch, history);

    const newRecord: DoseRecord = {
      id: uid("rec"),
      ...newDraft,
      status: reasons.length > 0 ? "blocked" : "waiting",
      blockReasons: reasons,
      supersedesId: reasons.length > 0 ? undefined : old.id,
      createdAt: new Date().toISOString(),
    };

    if (reasons.length > 0) {
      dispatch({ type: "register", record: newRecord });
      return reasons;
    }

    dispatch({ type: "redose", oldRecordId, newRecord });
    setRedoseRecordId(null);
    setSelectedId(newRecord.id);
    flashNotice({
      kind: "ok",
      text: `补滴完成：原排程已作废并释放仪器，${newDraft.patientName} 按新滴药时刻重新进入候诊。`,
    });
    return [];
  };

  const blockedRecords = state.records.filter((r) => r.status === "blocked");
  const selectedRecord =
    state.records.find((r) => r.id === selectedId && r.status === "waiting") ??
    null;
  const openApptRecord = state.appointments.find(
    (a) => a.id === apptDialogId
  );

  const metrics = [
    {
      label: "候诊待排",
      value: state.records.filter((r) => r.status === "waiting").length,
      tone: "neutral" as const,
    },
    {
      label: "已排程 / 已检查",
      value: state.records.filter(
        (r) => r.status === "booked" || r.status === "done"
      ).length,
      tone: "ok" as const,
    },
    {
      label: "危险拦截",
      value: blockedRecords.length,
      tone: blockedRecords.length ? ("danger" as const) : ("neutral" as const),
    },
    {
      label: "仪器占用（当前时段）",
      value: state.appointments.filter((a) => {
        if (a.status !== "booked") return false;
        const start = new Date(a.slotStart).getTime();
        return start <= now && now < start + SLOT_MINUTES * 60000;
      }).length,
      tone: "watch" as const,
    },
  ];

  const resetLocal = () => {
    if (window.confirm("清空本机留档并恢复示例数据？此操作不可撤销。")) {
      clearArchive();
      window.location.reload();
    }
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-11 · port 5111 · 本机留档</p>
          <h1>儿童散瞳排程台</h1>
          <p className="subtitle">
            登记患者、眼别、药品批次、滴眼时刻与散瞳前眼压；眼压偏高、批次过期或滴药间隔不足者保留输入并列出原因，不释放仪器。检查只在药效窗口内安排，同一仪器同一时段只留一人。
          </p>
        </div>
        <div className="stack-card">
          <span>分层结构</span>
          <strong>
            archive 档案 · rules 判定 · storage 本机留档 · ui 界面
          </strong>
          <button className="ghost-action" onClick={resetLocal}>
            清空本机数据并恢复示例
          </button>
        </div>
      </section>

      <Metrics metrics={metrics} />

      <RegisterForm
        draft={draft}
        batches={state.batches}
        onChange={setDraft}
        onSubmit={register}
        onReset={() => {
          setDraft(initDraft());
          setFormErrors([]);
          setNotice(null);
        }}
        formErrors={formErrors}
        notice={notice}
      />

      <DangerPanel
        records={blockedRecords}
        batches={state.batches}
        onReload={reloadBlocked}
      />

      <section className="schedule-layout">
        <WaitingQueue
          state={state}
          slots={slots}
          now={now}
          selectedId={selectedId ?? undefined}
          onSelect={(r) =>
            setSelectedId((cur) => (cur === r.id ? null : r.id))
          }
        />
        <ScheduleBoard
          state={state}
          slots={slots}
          selected={selectedRecord}
          now={now}
          onBook={book}
          onOpenAppointment={openAppointment}
        />
      </section>

      <ArchiveList state={state} />

      {openApptRecord && (
        <AppointmentDialog
          state={state}
          appointment={openApptRecord}
          onClose={() => setApptDialogId(null)}
          onCancelBooking={(recordId) => {
            dispatch({ type: "cancelBooking", recordId });
            setApptDialogId(null);
            flashNotice({ kind: "ok", text: "已取消排程，患者退回候诊队列。" });
          }}
          onComplete={completeExam}
          onRedose={(recordId) => {
            setApptDialogId(null);
            setRedoseRecordId(recordId);
          }}
        />
      )}

      {redoseRecordId && (
        <RedoseDialog
          state={state}
          oldRecordId={redoseRecordId}
          onClose={() => setRedoseRecordId(null)}
          onSubmit={redose}
        />
      )}

      <footer className="footer-note">
        判定阈值：眼压 ≥21 mmHg 禁止散瞳 · 滴药最小间隔 5 分钟 · 滴药后 20
        分钟起效 · 每时段 15 分钟同仪器一人 ·
        数据仅存于当前浏览器（localStorage）。
      </footer>
    </main>
  );
}
