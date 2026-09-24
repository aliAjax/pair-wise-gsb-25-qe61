// 判定层：散瞳药效窗口与仪器排班规则。
// 规则：检查只可排在药效窗口 [滴药+起效, 滴药+窗口结束] 内；
// 同一仪器同一时段只留一人。纯函数，不修改档案。

import type {
  Appointment,
  DoseRecord,
  DrugBatch,
} from "../archive/types";
import { ONSET_MINUTES, SLOT_COUNT, SLOT_MINUTES } from "./constants";

export interface TimeWindow {
  /** 可检查起点：滴药 + 起效等待 */
  start: number;
  /** 药效窗口结束 */
  end: number;
}

/** 依据药品批次计算药效窗口；找不到批次则不给窗口 */
export function efficacyWindow(
  record: Pick<DoseRecord, "droppedAt">,
  batch: DrugBatch | undefined
): TimeWindow | null {
  if (!batch) return null;
  const droppedAt = new Date(record.droppedAt).getTime();
  return {
    start: droppedAt + ONSET_MINUTES * 60000,
    end: droppedAt + batch.windowMinutes * 60000,
  };
}

/** 将任意时刻向下对齐到时段网格 */
export function floorSlot(ts: number): number {
  return Math.floor(ts / (SLOT_MINUTES * 60000)) * SLOT_MINUTES * 60000;
}

/** 以当前时刻为基准生成看板时段（含当前所处时段及之后 SLOT_COUNT 格） */
export function buildSlotGrid(nowIso: string): number[] {
  const base = floorSlot(new Date(nowIso).getTime());
  return Array.from(
    { length: SLOT_COUNT },
    (_, i) => base + i * SLOT_MINUTES * 60000
  );
}

/** 某时段是否完整落在药效窗口内 */
export function slotInWindow(
  slotStart: number,
  window: TimeWindow | null
): boolean {
  if (!window) return false;
  return (
    slotStart >= window.start &&
    slotStart + SLOT_MINUTES * 60000 <= window.end
  );
}

/** 真正占用仪器的排班（已取消 / 已完成的历史记录不再阻挡后续排程） */
export function activeAppointments(
  appointments: Appointment[]
): Appointment[] {
  return appointments.filter((a) => a.status === "booked");
}

/** 仪器 × 时段 占用键 */
export function occupancyKey(instrumentId: string, slotStart: number): string {
  return `${instrumentId}@${slotStart}`;
}

export interface BookingCheck {
  ok: boolean;
  reason?: string;
}

/**
 * 是否可把该档案排到指定仪器 / 时段。
 * 危险病例（blocked）一律不可排——不得释放仪器。
 */
export function canBook(
  record: DoseRecord,
  batch: DrugBatch | undefined,
  instrumentId: string,
  slotStart: number,
  appointments: Appointment[]
): BookingCheck {
  if (record.status === "blocked") {
    return { ok: false, reason: "危险病例不得排程，仪器保持锁定" };
  }
  if (record.status !== "waiting") {
    return { ok: false, reason: "当前状态不可排程" };
  }
  const window = efficacyWindow(record, batch);
  if (!slotInWindow(slotStart, window)) {
    return { ok: false, reason: "该时段不在药效窗口内" };
  }
  const key = occupancyKey(instrumentId, slotStart);
  const clash = activeAppointments(appointments).some(
    (a) => occupancyKey(a.instrumentId, new Date(a.slotStart).getTime()) === key
  );
  if (clash) {
    return { ok: false, reason: "同一仪器同一时段已有人" };
  }
  return { ok: true };
}

/** 该档案在给定仪器序列上的最早可排时段（无则 null） */
export function earliestBookableSlot(
  record: DoseRecord,
  batches: DrugBatch[],
  instruments: { id: string }[],
  appointments: Appointment[],
  slots: number[]
): { instrumentId: string; slotStart: number } | null {
  const batch = batches.find((b) => b.id === record.batchId);
  for (const slotStart of slots) {
    for (const instrument of instruments) {
      if (canBook(record, batch, instrument.id, slotStart, appointments).ok) {
        return { instrumentId: instrument.id, slotStart };
      }
    }
  }
  return null;
}
