import { useEffect, useMemo, useRef } from "react";
import {
  INSTRUMENTS,
  SLOT_COUNT,
  dayStartOf,
  formatHM,
  protocolOf,
  slotLabel,
  slotStart,
  windowFor,
} from "../domain/catalog";
import { activeAppointments } from "../domain/scheduling";
import type { Appointment, MydCase, StationState } from "../domain/types";
import { EYE_LABEL } from "../domain/types";

interface Props {
  state: StationState;
  now: number;
  onSelect: (caseId: string) => void;
  selectedCaseId?: string;
}

function statusTone(a: Appointment, now: number, dayStart: number): "past" | "now" | "future" {
  const t = slotStart(dayStart, a.slotIndex);
  if (now >= t + 10 * 60_000) return "past";
  if (now >= t) return "now";
  return "future";
}

export function TimelineBoard({ state, now, onSelect, selectedCaseId }: Props) {
  const dayStart = dayStartOf(now);
  const actives = useMemo(() => activeAppointments(state), [state]);

  // 每个病例最新窗口（用于在网格上标出可安排区间）
  const windows = useMemo(() => {
    const map = new Map<string, { start: number; end: number }>();
    for (const c of state.cases) {
      const last = c.drops[c.drops.length - 1];
      if (!last) continue;
      map.set(c.id, windowFor(last.at, c.drugId, dayStart));
    }
    return map;
  }, [state.cases, dayStart]);

  // 当前时段索引（用于滚动定位）
  const currentSlot = Math.min(
    SLOT_COUNT - 1,
    Math.max(0, Math.floor((now - dayStart) / (10 * 60_000)))
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const row = el.querySelector<HTMLElement>('[data-ref="now-row"]');
      if (row) el.scrollTop = Math.max(0, row.offsetTop - 120);
    }
  }, []);

  const apptAt = (instrumentId: string, slot: number) =>
    actives.find((a) => a.instrumentId === instrumentId && a.slotIndex === slot);

  const inAnyWindow = (slot: number): boolean => {
    const cellT = slotStart(dayStart, slot);
    for (const c of state.cases) {
      if (c.status === "quarantined") continue;
      const w = windows.get(c.id);
      if (w && cellT >= w.start && cellT < w.end) return true;
    }
    return false;
  };

  return (
    <section className="panel board-panel">
      <div className="section-heading">
        <div>
          <p>排程网格 · 10 分钟/格 · 08:00–18:00</p>
          <h2>散瞳检查排程台</h2>
        </div>
        <div className="legend">
          <span><i className="lg-done" />已完成</span>
          <span><i className="lg-sched" />已排程</span>
          <span><i className="lg-window" />药效窗口</span>
          <span><i className="lg-now" />当前</span>
        </div>
      </div>

      <div className="board-scroll" ref={scrollRef}>
        <table className="board-table">
          <thead>
            <tr>
              <th className="time-col">时段</th>
              {INSTRUMENTS.map((ins) => (
                <th key={ins.id}>
                  <strong>{ins.name}</strong>
                  <span>{ins.room}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOT_COUNT }, (_, slot) => {
              const isNow = slot === currentSlot;
              const win = inAnyWindow(slot);
              return (
                <tr key={slot} className={isNow ? "row-now" : ""} data-ref={isNow ? "now-row" : undefined}>
                  <td className="time-col">
                    <span>{slotLabel(dayStart, slot)}</span>
                  </td>
                  {INSTRUMENTS.map((ins) => {
                    const a = apptAt(ins.id, slot);
                    const c: MydCase | undefined = a
                      ? state.cases.find((x) => x.id === a.caseId)
                      : undefined;
                    return (
                      <td
                        key={ins.id}
                        className={[
                          "cell",
                          win && !a ? "cell-window" : "",
                          isNow ? "cell-now" : "",
                          a ? `cell-${a.status}` : "",
                          a ? `tone-${statusTone(a, now, dayStart)}` : "",
                          selectedCaseId && a?.caseId === selectedCaseId ? "cell-selected" : "",
                        ].join(" ")}
                      >
                        {a && (
                          <button
                            className="chip-appt"
                            title={c ? `${protocolOf(c.drugId).name} 窗口 ${formatHM(a.windowStart)}–${formatHM(a.windowEnd)}` : ""}
                            onClick={() => onSelect(a.caseId)}
                          >
                            <strong>{a.patientName}</strong>
                            <span>
                              {EYE_LABEL[a.eye]} · {a.status === "done" ? "已检查" : "待检查"}
                            </span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
