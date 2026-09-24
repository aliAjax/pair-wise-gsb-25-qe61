// 档案层：散瞳排程台的核心数据结构
// 只描述“存了什么”，不包含任何判定与界面逻辑。

export type Eye = "OD" | "OS" | "OU";

/** 滴药档案的生命周期状态 */
export type RecordStatus = "blocked" | "waiting" | "booked" | "done" | "void";

/** 仪器排班单元的占用状态 */
export type AppointmentStatus = "booked" | "done" | "cancelled";

/** 药品批次 */
export interface DrugBatch {
  id: string;
  /** 通用名 */
  name: string;
  /** 规格 / 浓度 */
  spec: string;
  /** 生产日期 ISO */
  manufacturedAt: string;
  /** 有效期至 ISO（当日仍视为有效） */
  expiresAt: string;
  /** 生效时长（分钟），用于计算药效窗口 */
  windowMinutes: number;
}

/** 检查仪器 */
export interface Instrument {
  id: string;
  name: string;
  model: string;
}

/** 单眼眼压（mmHg） */
export type EyePressure = Partial<Record<Exclude<Eye, "OU">, number>>;

/** 一次滴眼登记（危险病例也建档保留） */
export interface DoseRecord {
  id: string;
  patientName: string;
  /** 就诊卡号 */
  patientNo: string;
  age: number;
  eyes: Eye;
  batchId: string;
  /** 实际滴眼时刻 ISO */
  droppedAt: string;
  iop: EyePressure;
  status: RecordStatus;
  /** 被判定为危险病例时的原因；其余状态为空 */
  blockReasons: string[];
  /** 补滴作废后，指向新档案 */
  supersededById?: string;
  /** 若由补滴生成，指向被作废的旧档案 */
  supersedesId?: string;
  createdAt: string;
}

/** 仪器 × 时段 占用 */
export interface Appointment {
  id: string;
  recordId: string;
  instrumentId: string;
  /** 时段起点 ISO，按 SLOT_MINUTES 对齐 */
  slotStart: string;
  status: AppointmentStatus;
  /** 检查后补录：瞳孔直径（mm，按眼别） */
  pupilMm?: EyePressure;
  /** 检查后补录：验光值（按眼别，自然记录文本） */
  refraction?: Partial<Record<Exclude<Eye, "OU">, string>>;
  examinedAt?: string;
  examiner?: string;
  createdAt: string;
}

/** 本机留档的完整档案 */
export interface ArchiveState {
  batches: DrugBatch[];
  instruments: Instrument[];
  records: DoseRecord[];
  appointments: Appointment[];
}

/** 登记表单提交内容（不含系统字段） */
export interface DoseDraft {
  patientName: string;
  patientNo: string;
  age: number;
  eyes: Eye;
  batchId: string;
  droppedAt: string;
  iop: EyePressure;
}
