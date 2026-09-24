// ============================================================
// 档案层：散瞳药品协议、批次、仪器与时段网格目录
// ============================================================

import type { Batch, Instrument, Protocol } from "./types";

export const MINUTE = 60_000;

/** 眼压安全上限（mmHg）：小儿散瞳筛查常用截断值 21 */
export const IOP_LIMIT = 21;

/** 排程网格：每日 08:00–18:00，每 10 分钟一个时段 */
export const SLOT_SIZE_MS = 10 * MINUTE;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 18;
export const SLOT_COUNT = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / 10; // 60

export function dayStartOf(t: number): number {
  const d = new Date(t);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d.getTime();
}

export function slotStart(dayStart: number, slotIndex: number): number {
  return dayStart + slotIndex * SLOT_SIZE_MS;
}

export function slotLabel(dayStart: number, slotIndex: number): string {
  return formatHM(slotStart(dayStart, slotIndex));
}

export function formatHM(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatFull(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const PROTOCOLS: Protocol[] = [
  {
    id: "compound-tropicamide",
    name: "复方托吡卡胺",
    minIntervalMs: 5 * MINUTE,
    onsetMs: 20 * MINUTE,
    durationMs: 4 * 60 * MINUTE,
    note: "快速散瞳，滴眼 2 次、间隔 5 分钟，约 20 分钟起效",
  },
  {
    id: "cyclopentolate",
    name: "盐酸环喷托酯",
    minIntervalMs: 5 * MINUTE,
    onsetMs: 30 * MINUTE,
    durationMs: 6 * 60 * MINUTE,
    note: "儿童验光常用，约 30 分钟起效",
  },
];

export function protocolOf(id: string): Protocol {
  const p = PROTOCOLS.find((x) => x.id === id);
  if (!p) throw new Error(`未知药品协议: ${id}`);
  return p;
}

/** 批次目录按"今天"动态生成，保证演示数据里同时有有效与过期批次 */
export function buildBatches(now: number): Batch[] {
  const day = new Date(now);
  const at = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  void day;
  return [
    {
      id: "B-TPC-260315",
      drugId: "compound-tropicamide",
      lot: "TPC-260315",
      expiresAt: at(2027, 3, 15),
      registered: true,
    },
    {
      id: "B-TPC-250630",
      drugId: "compound-tropicamide",
      lot: "TPC-250630",
      expiresAt: at(2026, 6, 30),
      registered: true,
    },
    {
      id: "B-CYP-270110",
      drugId: "cyclopentolate",
      lot: "CYP-270110",
      expiresAt: at(2028, 1, 10),
      registered: true,
    },
    {
      id: "B-CYP-251220",
      drugId: "cyclopentolate",
      lot: "CYP-251220",
      expiresAt: at(2026, 3, 31),
      registered: true,
    },
  ];
}

export const INSTRUMENTS: Instrument[] = [
  { id: "AR-01", name: "电脑验光仪 AR-01", room: "1 号验光室" },
  { id: "AR-02", name: "电脑验光仪 AR-02", room: "2 号验光室" },
  { id: "RF-01", name: "综合验光台 RF-01", room: "暗室" },
];

/** 批次是否在有效期内（截止日当天仍有效） */
export function isBatchUsable(b: Batch, now: number): boolean {
  return b.expiresAt >= now;
}

/** 计算一次滴眼对应的药效窗口（对齐到 10 分钟网格） */
export function windowFor(
  dropAt: number,
  drugId: string,
  dayStart: number
): { start: number; end: number } {
  const p = protocolOf(drugId);
  const rawStart = dropAt + p.onsetMs;
  // 向上对齐到时段边界：起效时刻落在某时段内时，从下一个完整时段开始
  const aligned = Math.ceil((rawStart - dayStart) / SLOT_SIZE_MS) * SLOT_SIZE_MS + dayStart;
  return { start: aligned, end: rawStart + p.durationMs };
}
