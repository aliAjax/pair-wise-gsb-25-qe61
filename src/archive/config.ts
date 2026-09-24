// 档案层：药品批次与检查仪器的静态配置（由药房 / 设备台账维护）。

import type { DrugBatch, Instrument } from "./types";

/** 今日日期 ISO，用于构造示例批次有效期 */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DRUG_BATCHES: DrugBatch[] = [
  {
    id: "CPT-2608-14",
    name: "复方托吡卡胺滴眼液",
    spec: "5ml:托吡卡胺25mg+盐酸去氧肾上腺素25mg",
    manufacturedAt: `${today().slice(0, 4)}-02-10`,
    expiresAt: daysFromNow(180),
    windowMinutes: 340,
  },
  {
    id: "CPT-2501-07",
    name: "复方托吡卡胺滴眼液",
    spec: "5ml:托吡卡胺25mg+盐酸去氧肾上腺素25mg",
    manufacturedAt: `${Number(today().slice(0, 4)) - 2}-03-01`,
    expiresAt: daysFromNow(-12),
    windowMinutes: 340,
  },
];

export const INSTRUMENTS: Instrument[] = [
  { id: "AR-1", name: "电脑验光仪", model: "AR-1（1号机位）" },
  { id: "VT-5", name: "综合验光仪", model: "VT-5（2号机位）" },
];
