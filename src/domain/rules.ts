// ============================================================
// 判定层：危险病例规则（纯函数）
// 规则对所有登记输入一视同仁：命中即隔离，保留输入、列出原因、不释放仪器
// ============================================================

import { IOP_LIMIT, MINUTE } from "./catalog";
import type {
  Batch,
  DangerReason,
  DropEvent,
  Eye,
  MydCase,
  Protocol,
} from "./types";
import { EYE_LABEL } from "./types";

export interface DropInput {
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
}

/** 眼别是否覆盖指定侧别 */
export function eyeCovers(eye: Eye, side: "OD" | "OS"): boolean {
  if (eye === "OU") return true;
  return eye === side;
}

/** 同患者不同登记单的眼别是否冲突（OU 与任意单眼冲突） */
export function eyeConflict(a: Eye, b: Eye): boolean {
  if (a === b) return true;
  return a === "OU" || b === "OU";
}

export function resolveBatch(
  batchId: string,
  batches: Batch[]
): Batch | undefined {
  if (batchId.startsWith("custom:")) return undefined;
  return batches.find((b) => b.id === batchId);
}

/**
 * 对一次滴眼登记做安全判定。
 * @param input 本次登记
 * @param existing 同一患者已有病例（用于补滴间隔、眼别冲突检查）
 */
export function evaluateDrop(
  input: DropInput,
  batches: Batch[],
  existing: MydCase[],
  protocol: Protocol
): DangerReason[] {
  const reasons: DangerReason[] = [];

  // 1. 眼压偏高：按登记眼别检查对应侧别
  if (eyeCovers(input.eye, "OD") && input.odIop !== undefined && input.odIop > IOP_LIMIT) {
    reasons.push({
      code: "HIGH_IOP",
      text: `右眼眼压 ${input.odIop} mmHg，高于安全上限 ${IOP_LIMIT} mmHg，散瞳可能诱发闭角型青光眼，需医生评估`,
    });
  }
  if (eyeCovers(input.eye, "OS") && input.osIop !== undefined && input.osIop > IOP_LIMIT) {
    reasons.push({
      code: "HIGH_IOP",
      text: `左眼眼压 ${input.osIop} mmHg，高于安全上限 ${IOP_LIMIT} mmHg，散瞳可能诱发闭角型青光眼，需医生评估`,
    });
  }

  // 2. 药品批次：过期 / 未登记在册（手工录入批次）
  const batch = resolveBatch(input.batchId, batches);
  if (!batch) {
    reasons.push({
      code: "BATCH_UNREGISTERED",
      text: `批次「${input.customLot ?? input.batchId}」未在本机批次档案中登记，来源不可追溯，禁止上机`,
    });
  } else {
    if (batch.expiresAt < input.at) {
      const d = new Date(batch.expiresAt);
      const expire = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      reasons.push({
        code: "BATCH_EXPIRED",
        text: `批次 ${batch.lot} 已于 ${expire} 过期，不得用于散瞳检查`,
      });
    }
  }

  // 3. 同一只眼补滴间隔不足
  const sameEyeCase = existing.find((c) => c.eye === input.eye);
  if (sameEyeCase && sameEyeCase.drops.length > 0) {
    const last = sameEyeCase.drops[sameEyeCase.drops.length - 1];
    const gap = input.at - last.at;
    if (gap < protocol.minIntervalMs) {
      const need = Math.round(protocol.minIntervalMs / MINUTE);
      const got = Math.max(0, Math.round(gap / MINUTE));
      reasons.push({
        code: "INTERVAL_SHORT",
        text: `${EYE_LABEL[input.eye]}距上一滴仅 ${got} 分钟，${protocol.name}要求至少间隔 ${need} 分钟`,
      });
    }
  }

  // 4. 眼别与该患者已有登记冲突（如已登记右眼，又登记双眼，存在重复散瞳风险）
  for (const c of existing) {
    if (eyeConflict(c.eye, input.eye)) {
      reasons.push({
        code: "EYE_OVERLAP",
        text: `该患者已登记「${EYE_LABEL[c.eye]}」散瞳（${c.id}），与本次「${EYE_LABEL[input.eye]}」眼别重叠，需核对后再处理`,
      });
      break;
    }
  }

  return reasons;
}

/** 补滴是否命中危险（用于已存在病例的补滴判定） */
export function evaluateRedrop(
  drop: DropEvent,
  eye: Eye,
  drugId: string,
  batches: Batch[],
  previous: DropEvent[],
  protocol: Protocol,
  now: number
): DangerReason[] {
  const reasons: DangerReason[] = [];

  if (eyeCovers(eye, "OD") && drop.odIop !== undefined && drop.odIop > IOP_LIMIT) {
    reasons.push({
      code: "HIGH_IOP",
      text: `右眼眼压 ${drop.odIop} mmHg，高于安全上限 ${IOP_LIMIT} mmHg，补滴拒绝上机`,
    });
  }
  if (eyeCovers(eye, "OS") && drop.osIop !== undefined && drop.osIop > IOP_LIMIT) {
    reasons.push({
      code: "HIGH_IOP",
      text: `左眼眼压 ${drop.osIop} mmHg，高于安全上限 ${IOP_LIMIT} mmHg，补滴拒绝上机`,
    });
  }

  const batch = resolveBatch(drop.batchId, batches);
  if (!batch) {
    reasons.push({
      code: "BATCH_UNREGISTERED",
      text: `批次「${drop.customLot ?? drop.batchId}」未在本机批次档案中登记，补滴拒绝上机`,
    });
  } else if (batch.expiresAt < now) {
    const d = new Date(batch.expiresAt);
    const expire = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    reasons.push({
      code: "BATCH_EXPIRED",
      text: `批次 ${batch.lot} 已于 ${expire} 过期，补滴拒绝上机`,
    });
  }

  if (previous.length > 0) {
    const last = previous[previous.length - 1];
    const gap = drop.at - last.at;
    if (gap < protocol.minIntervalMs) {
      const need = Math.round(protocol.minIntervalMs / MINUTE);
      const got = Math.max(0, Math.round(gap / MINUTE));
      reasons.push({
        code: "INTERVAL_SHORT",
        text: `距上一滴仅 ${got} 分钟，${protocol.name}要求至少间隔 ${need} 分钟，补滴拒绝上机`,
      });
    }
  }

  return reasons;
}
