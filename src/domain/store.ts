// ============================================================
// 判定层：散瞳排程台状态机（纯 reducer）
// ============================================================

import { INSTRUMENTS, dayStartOf, slotLabel, windowFor } from "./catalog";
import { evaluateDrop, evaluateRedrop } from "./rules";
import {
  activeAppointmentOf,
  findEarliestSlot,
  latestDrop,
} from "./scheduling";
import type {
  Appointment,
  AuditEvent,
  Batch,
  DropEvent,
  ExamResult,
  Eye,
  MydCase,
  Protocol,
  StationState,
} from "./types";
import { EYE_LABEL } from "./types";

export type RegisterDropInput = {
  patientName: string;
  age: number;
  eye: Eye;
  drugId: string;
  at: number;
  batchId: string;
  customLot?: string;
  odIop?: number;
  osIop?: number;
  note?: string;
};

export type Action =
  | { type: "register"; input: RegisterDropInput; now: number; protocol: Protocol; batches: Batch[] }
  | { type: "redrop"; caseId: string; drop: Omit<DropEvent, "id" | "isRedrop">; now: number; protocol: Protocol; batches: Batch[] }
  | { type: "retry"; caseId: string; now: number }
  | { type: "recordExam"; caseId: string; result: Omit<ExamResult, "caseId"> }
  | { type: "hydrate"; state: StationState };

const INSTRUMENT_IDS = INSTRUMENTS.map((i) => i.id);

let seq = 0;
function nextId(state: StationState, prefix: string): string {
  seq = Math.max(seq, state.idCounter + 1);
  state.idCounter = seq;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

function log(state: StationState, kind: AuditEvent["kind"], text: string, at: number) {
  state.log.unshift({ id: `LOG-${state.idCounter}-${state.log.length}`, at, kind, text });
}

/** 安全登记：创建病例并尝试排程；危险则隔离，绝不占仪器 */
function register(state: StationState, input: RegisterDropInput, now: number, protocol: Protocol, batches: Batch[]): StationState {
  const samePatient = state.cases.filter(
    (c) => c.patientName === input.patientName && c.status !== "done"
  );
  const reasons = evaluateDrop(input, batches, samePatient, protocol);

  const dropId = nextId(state, "DRP");
  const drop: DropEvent = {
    id: dropId,
    at: input.at,
    batchId: input.batchId,
    customLot: input.customLot,
    odIop: input.odIop,
    osIop: input.osIop,
    isRedrop: false,
    note: input.note,
  };

  const caseId = nextId(state, "CASE");
  const c: MydCase = {
    id: caseId,
    patientName: input.patientName,
    age: input.age,
    eye: input.eye,
    drugId: input.drugId,
    drops: [drop],
    status: reasons.length > 0 ? "quarantined" : "scheduled",
    dangerReasons: reasons,
    dangerHistory: reasons.length > 0 ? [{ at: now, reasons }] : [],
    createdAt: now,
  };

  if (reasons.length > 0) {
    c.status = "quarantined";
    state.cases.push(c);
    log(state, "danger", `${input.patientName}（${EYE_LABEL[input.eye]}）登记被拦截：${reasons.map((r) => r.text).join("；")}。输入已保留，仪器不释放`, now);
    return state;
  }

  const dayStart = dayStartOf(input.at);
  const win = windowFor(input.at, input.drugId, dayStart);
  const slot = findEarliestSlot(state, win.start, win.end, INSTRUMENT_IDS);
  state.cases.push(c);

  if (slot) {
    pushAppointment(state, c, slot.slotIndex, slot.instrumentId, win.start, win.end, now, "schedule");
  } else {
    c.status = "awaiting";
    log(state, "await", `${input.patientName}（${EYE_LABEL[input.eye]}）安全但药效窗口内仪器全满，进入等待队列`, now);
  }
  return state;
}


function pushAppointment(
  state: StationState,
  c: MydCase,
  slotIndex: number,
  instrumentId: string,
  windowStart: number,
  windowEnd: number,
  now: number,
  kind: AuditEvent["kind"]
) {
  const appt: Appointment = {
    id: nextId(state, "APT"),
    caseId: c.id,
    patientName: c.patientName,
    eye: c.eye,
    instrumentId,
    slotIndex,
    windowStart,
    windowEnd,
    status: "scheduled",
    createdAt: now,
  };
  state.appointments.push(appt);
  c.status = "scheduled";
  const hhmm = slotLabel(dayStartOf(windowStart), slotIndex);
  log(
    state,
    kind,
    `${c.patientName}（${EYE_LABEL[c.eye]}）排入 ${instrumentId} ${hhmm} 时段`,
    now
  );
  return appt;
}

/**
 * 补滴：
 *  - 危险（眼压/批次/间隔）→ 仅追加滴眼记录、保留输入、列出原因，病例锁定隔离；
 *    原排程仍然作废（已滴的药与新批次有关，原窗口不再可信），但危险病例不得重新占用仪器。
 *  - 安全 → 作废原排程，按最新滴眼的药效窗口生成新时段。
 */
function redrop(state: StationState, caseId: string, drop: Omit<DropEvent, "id" | "isRedrop">, now: number, protocol: Protocol, batches: Batch[]): StationState {
  const c = state.cases.find((x) => x.id === caseId);
  if (!c) return state;

  const reasons = evaluateRedrop(
    { ...drop, id: "tmp", isRedrop: true },
    c.eye,
    c.drugId,
    batches,
    c.drops,
    protocol,
    now
  );

  const newDrop: DropEvent = { ...drop, id: nextId(state, "DRP"), isRedrop: true };
  c.drops.push(newDrop);

  // 无论是否危险，补滴都使原排程失效
  const old = activeAppointmentOf(state, c.id);
  if (old) {
    old.status = "voided";
    old.voidReason = "补滴作废";
    log(state, "void", `${c.patientName}（${EYE_LABEL[c.eye]}）补滴，原排程 ${old.instrumentId} 时段作废`, now);
  }

  if (reasons.length > 0) {
    c.status = "quarantined";
    c.dangerReasons = reasons;
    c.dangerHistory.push({ at: now, reasons });
    log(state, "danger", `${c.patientName}（${EYE_LABEL[c.eye]}）补滴被拦截：${reasons.map((r) => r.text).join("；")}。输入已保留，仪器不释放`, now);
    return state;
  }

  // 安全补滴：当前危险标记解除，但历次拦截原因永久保留在 dangerHistory
  c.dangerReasons = [];
  const win = windowFor(drop.at, c.drugId, dayStartOf(drop.at));
  const slot = findEarliestSlot(state, win.start, win.end, INSTRUMENT_IDS);
  if (slot) {
    pushAppointment(state, c, slot.slotIndex, slot.instrumentId, win.start, win.end, now, "schedule");
    log(state, "info", `补滴安全，${c.patientName} 已按新药效窗口重新排程`, now);
  } else {
    c.status = "awaiting";
    log(state, "await", `${c.patientName}（${EYE_LABEL[c.eye]}）补滴后窗口内无空档，等待安排`, now);
  }
  return state;
}

/** 等待队列重试：窗口内出现空档即安排 */
function retry(state: StationState, caseId: string, now: number): StationState {
  const c = state.cases.find((x) => x.id === caseId);
  if (!c || c.status !== "awaiting") return state;
  const last = latestDrop(c);
  if (!last) return state;
  const win = windowFor(last.at, c.drugId, dayStartOf(last.at));
  const slot = findEarliestSlot(state, win.start, win.end, INSTRUMENT_IDS);
  if (!slot) return state;
  pushAppointment(state, c, slot.slotIndex, slot.instrumentId, win.start, win.end, now, "schedule");
  return state;
}

/** 检查后补录：排程标记完成，瞳孔直径与验光值入档 */
function recordExam(state: StationState, caseId: string, result: Omit<ExamResult, "caseId">): StationState {
  const c = state.cases.find((x) => x.id === caseId);
  if (!c) return state;
  const appt = activeAppointmentOf(state, caseId);
  if (!appt) return state;

  appt.status = "done";
  c.status = "done";
  state.exams.push({ ...result, caseId: c.id, appointmentId: appt.id });
  log(state, "done", `${c.patientName}（${EYE_LABEL[c.eye]}）完成检查并补录瞳孔直径与验光值`, result.examinedAt);
  return state;
}

/**
 * 危险病例不设"放行"动作：规则要求不得释放仪器。
 * 当班人员只能在该病例上追加新的滴眼登记（补滴），
 * 由 evaluateRedrop 重新判定；新滴眼安全时才会生成新时段，
 * 历史输入与危险原因始终保留在档案中。
 */

export function reducer(prev: StationState, action: Action): StationState {
  if (action.type === "hydrate") return action.state;
  // 浅拷贝顶层与数组，函数内对实体做变更
  const state: StationState = {
    ...prev,
    cases: prev.cases.map((c) => ({
      ...c,
      drops: [...c.drops],
      dangerReasons: [...c.dangerReasons],
      dangerHistory: c.dangerHistory ? c.dangerHistory.map((h) => ({ ...h, reasons: [...h.reasons] })) : [],
    })),
    appointments: prev.appointments.map((a) => ({ ...a })),
    exams: [...prev.exams],
    log: [...prev.log],
  };
  seq = state.idCounter;
  switch (action.type) {
    case "register":
      return register(state, action.input, action.now, action.protocol, action.batches);
    case "redrop":
      return redrop(state, action.caseId, action.drop, action.now, action.protocol, action.batches);
    case "retry":
      return retry(state, action.caseId, action.now);
    case "recordExam":
      return recordExam(state, action.caseId, action.result);
  }
}

export function emptyState(): StationState {
  return { cases: [], appointments: [], exams: [], log: [], idCounter: 0 };
}
