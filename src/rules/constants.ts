// 判定层：临床与排班规则中用到的阈值和时间常量。
// 数值集中在此处，方便门店按医师授权调整，不与界面耦合。

/** 眼压偏高阈值（mmHg）：达到即禁止散瞳，须先转青光眼排查 */
export const IOP_DANGER = 21;

/** 同一患者两次滴药之间的最小间隔（分钟） */
export const MIN_DOSE_INTERVAL_MINUTES = 5;

/** 滴药后起效等待（分钟）：检查不得早于此时刻 */
export const ONSET_MINUTES = 20;

/** 排班时段粒度（分钟）：同一仪器同一时段只留一人 */
export const SLOT_MINUTES = 15;

/** 看板向前生成的时段数量（10.5 小时） */
export const SLOT_COUNT = 42;
