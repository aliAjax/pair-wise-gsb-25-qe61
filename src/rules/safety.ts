// 判定层：危险病例判定（眼压偏高 / 批次过期 / 滴药间隔不足）。
// 全部为纯函数，只给结论与原因，不修改档案，也不接触界面。

import type { DoseDraft, DoseRecord, DrugBatch, Eye } from "../archive/types";
import { IOP_DANGER, MIN_DOSE_INTERVAL_MINUTES } from "./constants";

export type SingleEye = Exclude<Eye, "OU">;
export const BOTH_EYES: SingleEye[] = ["OD", "OS"];

/** 所选眼别是否覆盖该单眼 */
export function draftCovers(eyes: Eye, eye: SingleEye): boolean {
  return eyes === "OU" || eyes === eye;
}

/** 药品批次有效期至的当天结束时刻 */
export function batchExpiryEnd(expiresAt: string): number {
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/** 批次在给定滴眼时刻是否已过期（到期当日仍有效） */
export function isBatchExpired(batch: DrugBatch, atIso: string): boolean {
  return new Date(atIso).getTime() > batchExpiryEnd(batch.expiresAt);
}

/** 取本次登记中受检眼的最高眼压 */
export function maxIop(draft: DoseDraft): number | null {
  const values = BOTH_EYES.filter((eye) => draftCovers(draft.eyes, eye))
    .map((eye) => draft.iop[eye])
    .filter((v): v is number => typeof v === "number");
  return values.length ? Math.max(...values) : null;
}

/**
 * 危险判定。返回的原因数组为空 = 可进入散瞳排程；
 * 非空 = 保留输入并建档为危险病例，不得释放仪器。
 */
export function evaluateDanger(
  draft: DoseDraft,
  batch: DrugBatch | undefined,
  /** 该患者此前的滴药档案（含被拦下的，用于间隔判定），按时间倒序 */
  patientHistory: DoseRecord[]
): string[] {
  const reasons: string[] = [];
  const at = new Date(draft.droppedAt).getTime();
  const top = maxIop(draft);

  if (top !== null && top >= IOP_DANGER) {
    reasons.push(
      `眼压偏高：最高 ${top} mmHg ≥ ${IOP_DANGER} mmHg，疑似闭角型青光眼风险，禁止散瞳`
    );
  }

  if (!batch) {
    reasons.push("药品批次缺失，无法核对有效期与药效窗口");
  } else if (isBatchExpired(batch, draft.droppedAt)) {
    const until = batchExpiryEnd(batch.expiresAt);
    reasons.push(
      `药品批次 ${batch.id} 已过期（有效期至 ${new Date(until).toLocaleDateString(
        "zh-CN"
      )}），不得用于散瞳`
    );
  }

  const previous = [...patientHistory]
    .filter((r) => r.status !== "void")
    .sort(
      (a, b) =>
        new Date(b.droppedAt).getTime() - new Date(a.droppedAt).getTime()
    )[0];
  if (previous) {
    const minutes = (at - new Date(previous.droppedAt).getTime()) / 60000;
    if (minutes >= 0 && minutes < MIN_DOSE_INTERVAL_MINUTES) {
      reasons.push(
        `距上次滴眼（${formatClock(previous.droppedAt)}）仅 ${minutes.toFixed(
          1
        )} 分钟，不足最小间隔 ${MIN_DOSE_INTERVAL_MINUTES} 分钟`
      );
    }
  }

  return reasons;
}

/** 表单层面的必填/格式校验（不属于临床危险，只阻止提交） */
export function validateDraft(draft: DoseDraft): string[] {
  const errors: string[] = [];
  if (!draft.patientName.trim()) errors.push("请填写患者姓名");
  if (!draft.patientNo.trim()) errors.push("请填写就诊卡号");
  if (!Number.isFinite(draft.age) || draft.age <= 0) errors.push("请填写有效年龄");
  if (!draft.batchId) errors.push("请选择药品批次");
  if (Number.isNaN(new Date(draft.droppedAt).getTime()))
    errors.push("请选择滴眼时刻");

  const eyesUsed = BOTH_EYES.filter((eye) => draftCovers(draft.eyes, eye));
  for (const eye of eyesUsed) {
    const value = draft.iop[eye];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      errors.push(`请填写${eye === "OD" ? "右" : "左"}眼眼压`);
    }
  }
  return errors;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
