// ============================================================
// 档案层：散瞳排程台领域模型
// 仅描述数据结构，不包含任何存储与界面逻辑
// ============================================================

export type Eye = "OD" | "OS" | "OU"; // 右眼 / 左眼 / 双眼
export const EYE_LABEL: Record<Eye, string> = {
  OD: "右眼",
  OS: "左眼",
  OU: "双眼",
};

export type CaseStatus =
  | "scheduled" // 已排入仪器时段
  | "awaiting" // 安全但当前窗口无空档，等待安排
  | "quarantined" // 危险病例：保留登记，锁定，不释放仪器
  | "done"; // 已完成检查并补录结果

/** 药品散瞳协议 */
export interface Protocol {
  id: string;
  name: string;
  /** 同一只眼两次滴眼之间要求的最小间隔（毫秒） */
  minIntervalMs: number;
  /** 起效时间：滴药后多久进入药效窗口（毫秒） */
  onsetMs: number;
  /** 药效窗口时长（毫秒） */
  durationMs: number;
  note: string;
}

/** 药品批次档案：批次号 + 有效期 */
export interface Batch {
  id: string;
  drugId: string;
  lot: string;
  /** 有效期截止日（当日 23:59:59.999） */
  expiresAt: number;
  registered: boolean; // 是否为本机登记在册的批次
}

/** 验光仪档案 */
export interface Instrument {
  id: string;
  name: string;
  room: string;
}

/** 一次滴眼（首滴或补滴都会追加一条，永不覆盖） */
export interface DropEvent {
  id: string;
  at: number; // 滴眼时刻
  batchId: string; // 引用批次档案；手工批次以 "custom:" 前缀
  customLot?: string;
  odIop?: number; // 滴眼时眼压 mmHg
  osIop?: number;
  isRedrop: boolean;
  note?: string;
}

/** 危险原因（判定层产出） */
export interface DangerReason {
  code: "HIGH_IOP" | "BATCH_EXPIRED" | "BATCH_UNREGISTERED" | "INTERVAL_SHORT" | "EYE_OVERLAP";
  text: string;
}

/** 散瞳病例档案：一个患者 + 一个眼别 对应一个排程单元 */
export interface MydCase {
  id: string;
  patientName: string;
  age: number;
  eye: Eye;
  drugId: string;
  drops: DropEvent[];
  status: CaseStatus;
  /** 最近一次判定为危险时的原因（历史滴眼保留在 drops 中） */
  dangerReasons: DangerReason[];
  /** 历次拦截记录：永久留痕，安全补滴后也不清空 */
  dangerHistory: { at: number; reasons: DangerReason[] }[];
  createdAt: number;
}

export type AppointmentStatus = "scheduled" | "voided" | "done";

/** 仪器占用排程：同一仪器同一 slot 最多一条有效记录 */
export interface Appointment {
  id: string;
  caseId: string;
  patientName: string;
  eye: Eye;
  instrumentId: string;
  slotIndex: number;
  windowStart: number; // 本次药效窗口起
  windowEnd: number; // 本次药效窗口止
  status: AppointmentStatus;
  /** 作废原因，例如「补滴作废」「重排作废」 */
  voidReason?: string;
  createdAt: number;
}

/** 检查后补录：瞳孔直径 + 验光值 */
export interface ExamResult {
  caseId: string;
  appointmentId: string;
  examinedAt: number;
  pupilOdMm?: number;
  pupilOsMm?: number;
  odSphere?: string;
  odCylinder?: string;
  odAxis?: string;
  osSphere?: string;
  osCylinder?: string;
  osAxis?: string;
}

/** 留档事件：作废、危险拦截、完成等动作流水 */
export interface AuditEvent {
  id: string;
  at: number;
  text: string;
  kind: "void" | "danger" | "schedule" | "done" | "await" | "info";
}

export interface StationState {
  cases: MydCase[];
  appointments: Appointment[];
  exams: ExamResult[];
  log: AuditEvent[];
  idCounter: number;
}
