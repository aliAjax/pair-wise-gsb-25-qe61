// ============================================================
// 判定层：仪器排程（纯函数）
// 不变量：同一仪器同一时段（slot）最多保留一条 scheduled/done 排程
// ============================================================

import { SLOT_COUNT, SLOT_SIZE_MS, dayStartOf, slotStart } from "./catalog";
import type { Appointment, MydCase, StationState } from "./types";

/** 当前仍占用仪器的排程（已排或已完成；作废的不占） */
export function activeAppointments(state: StationState): Appointment[] {
  return state.appointments.filter((a) => a.status !== "voided");
}

export function isSlotTaken(state: StationState, instrumentId: string, slotIndex: number): boolean {
  return activeAppointments(state).some(
    (a) => a.instrumentId === instrumentId && a.slotIndex === slotIndex
  );
}

/** 病例当前生效的排程 */
export function activeAppointmentOf(state: StationState, caseId: string): Appointment | undefined {
  return activeAppointments(state).find((a) => a.caseId === caseId);
}

/** 病例最新滴眼 */
export function latestDrop(c: MydCase) {
  return c.drops.length > 0 ? c.drops[c.drops.length - 1] : undefined;
}

/**
 * 在药效窗口 [windowStart, windowEnd) 内寻找最早可用的（仪器, 时段）。
 * 优先更早的时段；同一时段按仪器顺序分配。窗口外（含当日 18:00 后）不安排。
 */
export function findEarliestSlot(
  state: StationState,
  windowStart: number,
  windowEnd: number,
  instrumentIds: string[]
): { instrumentId: string; slotIndex: number } | undefined {
  const dayStart = dayStartOf(windowStart);
  const firstIndex = Math.max(0, Math.ceil((windowStart - dayStart) / SLOT_SIZE_MS));
  const lastIndexRaw = Math.floor((windowEnd - 1 - dayStart) / SLOT_SIZE_MS);
  const lastIndex = Math.min(SLOT_COUNT - 1, lastIndexRaw);

  for (let s = firstIndex; s <= lastIndex; s++) {
    for (const instrumentId of instrumentIds) {
      if (!isSlotTaken(state, instrumentId, s)) {
        return { instrumentId, slotIndex: s };
      }
    }
  }
  return undefined;
}

/** 排程单元格在网格中的定位 */
export function cellAt(t: number): number {
  const dayStart = dayStartOf(t);
  return Math.floor((t - dayStart) / SLOT_SIZE_MS);
}

export type WindowPhase = "before" | "in" | "after";

export function windowPhase(a: Appointment, now: number): WindowPhase {
  const t = slotStart(dayStartOf(a.windowStart), a.slotIndex);
  if (now < t) return "before";
  if (now >= t + SLOT_SIZE_MS) return "after";
  return "in";
}

/** 病例最新药效窗口的实时阶段（用于未排入网格的等待病例） */
export function caseWindowPhase(
  c: MydCase,
  window: { start: number; end: number },
  now: number
): WindowPhase {
  void c;
  if (now < window.start) return "before";
  if (now >= window.end) return "after";
  return "in";
}
