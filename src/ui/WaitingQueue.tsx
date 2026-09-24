// 界面层：候诊队列（已滴药、等待排程）。
// 展示药效窗口状态：未到起效时间 / 可排时间区间 / 已错过窗口。

import type {
  ArchiveState,
  DoseRecord,
  DrugBatch,
} from "../archive/types";
import {
  efficacyWindow,
  earliestBookableSlot,
} from "../rules/schedule";
import { ONSET_MINUTES } from "../rules/constants";
import { BOTH_EYES, draftCovers, formatClock } from "../rules/safety";

interface Props {
  state: ArchiveState;
  slots: number[];
  now: number;
  onSelect: (record: DoseRecord) => void;
  selectedId?: string;
}

function windowStateText(
  record: DoseRecord,
  batch: DrugBatch | undefined,
  now: number
): { kind: "soon" | "open" | "expired"; text: string } {
  const window = efficacyWindow(record, batch);
  if (!window)
    return { kind: "expired", text: "批次缺失，无法计算药效窗口" };
  if (now < window.start) {
    const mins = Math.round((window.start - now) / 60000);
    return {
      kind: "soon",
      text: `起效等待中，约 ${mins} 分钟后（${formatClock(
        new Date(window.start).toISOString()
      )}）可检查`,
    };
  }
  if (now > window.end) {
    return { kind: "expired", text: "药效窗口已结束，需补滴后重新排程" };
  }
  return {
    kind: "open",
    text: `药效窗口内：${formatClock(
      new Date(window.start).toISOString()
    )} – ${formatClock(new Date(window.end).toISOString())}（滴药后起效 ${ONSET_MINUTES} 分钟）`,
  };
}

export function WaitingQueue({ state, slots, now, onSelect, selectedId }: Props) {
  const waiting = state.records.filter((r) => r.status === "waiting");

  return (
    <section className="panel queue-panel">
      <div className="section-heading">
        <div>
          <p>滴药后候诊</p>
          <h2>待排程（{waiting.length}）</h2>
        </div>
      </div>

      {waiting.length === 0 ? (
        <p className="empty-line">候诊队列为空。</p>
      ) : (
        <div className="queue-list">
          {waiting.map((record) => {
            const batch = state.batches.find((b) => b.id === record.batchId);
            const ws = windowStateText(record, batch, now);
            const earliest = earliestBookableSlot(
              record,
              state.batches,
              state.instruments,
              state.appointments,
              slots
            );
            return (
              <article
                key={record.id}
                className={`queue-card ${selectedId === record.id ? "selected" : ""}`}
              >
                <button
                  className="queue-select"
                  onClick={() => onSelect(record)}
                >
                  <div className="queue-main">
                    <h3>
                      {record.patientName}
                      <span className="tag-eyes">{record.eyes}</span>
                    </h3>
                    <p className={`window-line ${ws.kind}`}>{ws.text}</p>
                    <p className="queue-meta">
                      眼压：
                      {BOTH_EYES.filter((e) => draftCovers(record.eyes, e)).map(
                        (e) => (
                          <span key={e}>
                            {e === "OD" ? "右" : "左"} {record.iop[e]} mmHg
                          </span>
                        )
                      )}
                      {batch && (
                        <>
                          {" · 批次 "}
                          {batch.id}
                        </>
                      )}
                    </p>
                    <p className="queue-meta">
                      {earliest
                        ? `推荐最早：${
                            state.instruments.find(
                              (i) => i.id === earliest.instrumentId
                            )?.name
                          } ${formatClock(new Date(earliest.slotStart).toISOString())}`
                        : "当前看板范围内暂无可排时段（窗口结束或仪器已满）"}
                    </p>
                  </div>
                  <span className="pick">选择排程 →</span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
