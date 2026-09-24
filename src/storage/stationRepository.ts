// ============================================================
// 本机留档层：localStorage 仓储 + 种子数据
// 与判定层、界面层解耦：只负责状态的持久化读写
// ============================================================

import { MINUTE, buildBatches, protocolOf } from "../domain/catalog";
import { reducer, emptyState } from "../domain/store";
import type { StationState } from "../domain/types";

const STORAGE_KEY = "myd-station-state-v1";

export function loadState(): StationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StationState;
      if (parsed && Array.isArray(parsed.cases) && Array.isArray(parsed.appointments)) {
        return parsed;
      }
    }
  } catch {
    // 存档损坏时回退到空台，不让界面崩溃
  }
  return emptyState();
}

export function saveState(state: StationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 本机存储不可用时静默降级（内存态仍可用）
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 构造一份覆盖各种情形的当班种子数据：
 * 正常排程 / 等待队列 / 高眼压隔离 / 过期批次隔离 / 间隔不足 / 已完成 / 作废重排
 */
export function seedState(now: number): StationState {
  let state = emptyState();
  const batches = buildBatches(now);
  const t = (offsetMin: number) => now - 40 * MINUTE + offsetMin * MINUTE;

  const reg = (
    name: string,
    age: number,
    eye: "OD" | "OS" | "OU",
    drugId: string,
    at: number,
    batchId: string,
    iop: { od?: number; os?: number }
  ) =>
    reducer(state, {
      type: "register",
      now,
      protocol: protocolOf(drugId),
      batches,
      input: { patientName: name, age, eye, drugId, at, batchId, odIop: iop.od, osIop: iop.os },
    });

  // 1. 正常：已进入排程
  state = reg("李一诺", 8, "OU", "compound-tropicamide", t(0), "B-TPC-260315", { od: 15, os: 16 });
  // 2. 正常：另一台仪器
  state = reg("王小满", 10, "OD", "cyclopentolate", t(2), "B-CYP-270110", { od: 17 });
  // 3. 危险：右眼眼压偏高（输入保留、隔离、不占仪器）
  state = reg("赵小童", 7, "OU", "compound-tropicamide", t(4), "B-TPC-260315", { od: 26, os: 15 });
  // 4. 危险：批次过期
  state = reg("陈朵朵", 9, "OS", "compound-tropicamide", t(6), "B-TPC-250630", { os: 14 });
  // 5. 危险：补滴间隔不足（先正常登记，再立刻补滴）
  state = reg("孙乐乐", 11, "OD", "compound-tropicamide", t(-8), "B-TPC-260315", { od: 16 });
  const sunCase = state.cases[state.cases.length - 1];
  state = reducer(state, {
    type: "redrop",
    caseId: sunCase.id,
    now,
    protocol: protocolOf("compound-tropicamide"),
    batches,
    drop: { at: t(-6), batchId: "B-TPC-260315", odIop: 16 },
  });
  // 6. 正常补滴：原排程作废、生成新时段
  state = reg("周雨桐", 8, "OU", "cyclopentolate", t(-15), "B-CYP-270110", { od: 15, os: 15 });
  const zhouCase = state.cases[state.cases.length - 1];
  state = reducer(state, {
    type: "redrop",
    caseId: zhouCase.id,
    now,
    protocol: protocolOf("cyclopentolate"),
    batches,
    drop: { at: t(-2), batchId: "B-CYP-270110", odIop: 15, osIop: 15, note: "散瞳不充分，遵医嘱补滴" },
  });
  // 7. 已完成检查
  state = reg("吴思远", 12, "OS", "compound-tropicamide", t(-35), "B-TPC-260315", { os: 13 });
  const wuCase = state.cases[state.cases.length - 1];
  const wuAppt = state.appointments.filter((a) => a.caseId === wuCase.id).slice(-1)[0];
  if (wuAppt) {
    state = reducer(state, {
      type: "recordExam",
      caseId: wuCase.id,
      result: {
        appointmentId: wuAppt.id,
        examinedAt: now - 5 * MINUTE,
        pupilOdMm: 6.5,
        pupilOsMm: 7.0,
        odSphere: "-1.50",
        odCylinder: "-0.50",
        odAxis: "180",
        osSphere: "-1.75",
        osCylinder: "-0.75",
        osAxis: "5",
      },
    });
  }

  return state;
}
