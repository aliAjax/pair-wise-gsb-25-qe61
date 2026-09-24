// 界面层：排程看板。行=时段，列=仪器；
// 格内是否可点由判定层 canBook 决定（药效窗口 + 同仪器同时段唯一）。

import type { ReactNode } from "react";
import type {
  Appointment,
  ArchiveState,
  DoseRecord,
} from "../archive/types";
import {
  canBook,
  efficacyWindow,
} from "../rules/schedule";
import { SLOT_MINUTES } from "../rules/constants";
import { formatClock } from "../rules/safety";

interface Props {
  state: ArchiveState;
  slots: number[];
  selected: DoseRecord | null;
  now: number;
  onBook: (instrumentId: string, slotStart: number) => void;
  onOpenAppointment: (appointment: Appointment) => void;
}

function slotLabel(ts: number): string {
  return formatClock(new Date(ts).toISOString());
}

export function ScheduleBoard({
  state,
  slots,
  selected,
  now,
  onBook,
  onOpenAppointment,
}: Props) {
  const selectedBatch = selected
    ? state.batches.find((b) => b.id === selected.batchId)
    : undefined;
  const window = selected ? efficacyWindow(selected, selectedBatch) : null;

  const apptAt = (instrumentId: string, slotStart: number) =>
    state.appointments.find(
      (a) =>
        a.instrumentId === instrumentId &&
        new Date(a.slotStart).getTime() === slotStart
    );

  return (
    <section className="panel board-panel">
      <div className="section-heading">
        <div>
          <p>仪器排班 · 每时段 {SLOT_MINUTES} 分钟</p>
          <h2>散瞳排程看板</h2>
        </div>
        {selected && (
          <div className="board-selected">
            正在为 <strong>{selected.patientName}</strong>（{selected.eyes}）排程
            {window && (
              <span className="board-window">
                {" "}
                · 可排 {slotLabel(window.start)}–{slotLabel(window.end)}
              </span>
            )}
          </div>
        )}
      </div>

      {!selected && (
        <p className="empty-line">请先在左侧候诊队列选择一名已滴药患者。</p>
      )}

      <div className="board-scroll">
        <table className="board-table">
          <thead>
            <tr>
              <th className="time-col">时段</th>
              {state.instruments.map((instrument) => (
                <th key={instrument.id}>
                  {instrument.name}
                  <small>{instrument.model}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slotStart) => {
              const past = slotStart + SLOT_MINUTES * 60000 <= now;
              return (
                <tr key={slotStart} className={past ? "row-past" : ""}>
                  <td className="time-col">
                    {slotLabel(slotStart)}
                    {past && <small>已过</small>}
                  </td>
                  {state.instruments.map((instrument) => {
                    const appt = apptAt(instrument.id, slotStart);
                    const classes = ["cell"];
                    let body: ReactNode = "";

                    if (appt) {
                      const owner = state.records.find(
                        (r) => r.id === appt.recordId
                      );
                      classes.push(
                        appt.status === "done" ? "cell-done" : "cell-booked"
                      );
                      body = (
                        <button
                          className="cell-btn"
                          onClick={() => onOpenAppointment(appt)}
                          title="查看 / 处理该时段"
                        >
                          <strong>{owner?.patientName ?? "档案缺失"}</strong>
                          <small>
                            {owner?.eyes} ·{" "}
                            {appt.status === "done" ? "已检查" : "已预约"}
                          </small>
                        </button>
                      );
                    } else if (selected) {
                      const check = canBook(
                        selected,
                        selectedBatch,
                        instrument.id,
                        slotStart,
                        state.appointments
                      );
                      if (check.ok) {
                        classes.push("cell-open");
                        body = (
                          <button
                            className="cell-btn"
                            onClick={() => onBook(instrument.id, slotStart)}
                            title="排入此时段"
                          >
                            <small>可排 +</small>
                          </button>
                        );
                      } else {
                        // 窗口外 / 已过时段 / 非等待状态：灰格不可点
                        classes.push("cell-off");
                      }
                    } else {
                      classes.push("cell-off");
                    }

                    return (
                      <td key={instrument.id} className={classes.join(" ")}>
                        {body}
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
