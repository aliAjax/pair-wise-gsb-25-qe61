// 档案层：首次加载的示例档案。时间相对当前时刻生成，
// 以便直接看到“等待起效 / 可排程 / 已排程 / 已检查 / 危险拦截”等状态。

import { DRUG_BATCHES, INSTRUMENTS } from "./config";
import type { ArchiveState, DoseRecord, EyePressure } from "./types";
import { floorSlot } from "../rules/schedule";
import { SLOT_MINUTES } from "../rules/constants";

const VALID_BATCH = DRUG_BATCHES[0].id;

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

function makeRecord(partial: Partial<DoseRecord> & {
  id: string;
  patientName: string;
  patientNo: string;
  age: number;
  eyes: DoseRecord["eyes"];
  iop: EyePressure;
  droppedAt: string;
  status: DoseRecord["status"];
}): DoseRecord {
  return {
    batchId: VALID_BATCH,
    blockReasons: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

export function buildSeedState(): ArchiveState {
  // 已排程的时段对齐当前网格，避免一打开就是错位时段
  const bookedSlot = new Date(floorSlot(Date.now()) + SLOT_MINUTES * 60000)
    .toISOString();

  const records: DoseRecord[] = [
    // 01 已滴药并过起效等待，可在药效窗口内排程
    makeRecord({
      id: "rec-seed-01",
      patientName: "李乐",
      patientNo: "MZ-20260924-01",
      age: 8,
      eyes: "OU",
      iop: { OD: 14, OS: 15 },
      droppedAt: isoMinutesAgo(25),
      status: "waiting",
    }),
    // 02 刚滴药，尚在起效等待
    makeRecord({
      id: "rec-seed-02",
      patientName: "王小雨",
      patientNo: "MZ-20260924-02",
      age: 10,
      eyes: "OS",
      iop: { OS: 16 },
      droppedAt: isoMinutesAgo(6),
      status: "waiting",
    }),
    // 03 已排程
    makeRecord({
      id: "rec-seed-03",
      patientName: "陈昊",
      patientNo: "MZ-20260924-03",
      age: 12,
      eyes: "OD",
      iop: { OD: 13 },
      droppedAt: isoMinutesAgo(40),
      status: "booked",
    }),
    // 04 已完成检查并补录
    makeRecord({
      id: "rec-seed-04",
      patientName: "赵一诺",
      patientNo: "MZ-20260924-04",
      age: 7,
      eyes: "OU",
      iop: { OD: 15, OS: 14 },
      droppedAt: isoMinutesAgo(150),
      status: "done",
    }),
    // 05 眼压偏高被拦截：输入保留、原因列出、不释放仪器
    makeRecord({
      id: "rec-seed-05",
      patientName: "孙小可",
      patientNo: "MZ-20260924-05",
      age: 9,
      eyes: "OU",
      iop: { OD: 24, OS: 22 },
      droppedAt: isoMinutesAgo(3),
      status: "blocked",
      blockReasons: [
        "眼压偏高：最高 24 mmHg ≥ 21 mmHg，疑似闭角型青光眼风险，禁止散瞳",
      ],
    }),
  ];

  const appointments: ArchiveState["appointments"] = [
    {
      id: "appt-seed-01",
      recordId: "rec-seed-03",
      instrumentId: INSTRUMENTS[0].id,
      slotStart: bookedSlot,
      status: "booked",
      createdAt: new Date().toISOString(),
    },
    {
      id: "appt-seed-02",
      recordId: "rec-seed-04",
      instrumentId: INSTRUMENTS[1].id,
      slotStart: isoMinutesAgo(95),
      status: "done",
      pupilMm: { OD: 7, OS: 7 },
      refraction: {
        OD: "-1.50DS / -0.50DC × 180",
        OS: "-1.25DS / -0.75DC × 5",
      },
      examinedAt: isoMinutesAgo(90),
      examiner: "当班验光师",
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    batches: DRUG_BATCHES,
    instruments: INSTRUMENTS,
    records,
    appointments,
  };
}
