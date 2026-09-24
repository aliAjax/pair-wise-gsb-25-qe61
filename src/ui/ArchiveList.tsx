// 界面层：本机留档列表。按状态筛选，展示补滴作废链与补录结果。

import { useState } from "react";
import type { ArchiveState, RecordStatus } from "../archive/types";
import { formatDateTime } from "../rules/safety";

interface Props {
  state: ArchiveState;
}

const FILTERS: { value: RecordStatus | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "waiting", label: "候诊" },
  { value: "booked", label: "已排程" },
  { value: "done", label: "已检查" },
  { value: "blocked", label: "危险拦截" },
  { value: "void", label: "已作废" },
];

const STATUS_TEXT: Record<RecordStatus, string> = {
  waiting: "候诊中",
  booked: "已排程",
  done: "已检查",
  blocked: "危险拦截",
  void: "已作废",
};

export function ArchiveList({ state }: Props) {
  const [filter, setFilter] = useState<RecordStatus | "all">("all");
  const records =
    filter === "all"
      ? state.records
      : state.records.filter((r) => r.status === filter);

  const apptOf = (recordId: string) =>
    state.appointments.filter((a) => a.recordId === recordId);

  return (
    <section className="panel archive-panel">
      <div className="section-heading">
        <div>
          <p>本机留档（localStorage）</p>
          <h2>滴药档案（{state.records.length}）</h2>
        </div>
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              type="button"
              key={f.value}
              className={filter === f.value ? "seg-on" : ""}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-scroll">
        <table className="archive-table">
          <thead>
            <tr>
              <th>患者</th>
              <th>眼别</th>
              <th>批次</th>
              <th>滴药时刻</th>
              <th>眼压</th>
              <th>状态 / 排程</th>
              <th>检查补录</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const appts = apptOf(r.id);
              return (
                <tr key={r.id} className={`st-${r.status}`}>
                  <td>
                    <strong>{r.patientName}</strong>
                    <small>{r.patientNo}</small>
                  </td>
                  <td>{r.eyes}</td>
                  <td>{r.batchId}</td>
                  <td>{formatDateTime(r.droppedAt)}</td>
                  <td>
                    {r.iop.OD !== undefined && `右${r.iop.OD} `}
                    {r.iop.OS !== undefined && `左${r.iop.OS}`} mmHg
                  </td>
                  <td>
                    <span className={`pill pill-${r.status}`}>
                      {STATUS_TEXT[r.status]}
                    </span>
                    {appts.map((a) => (
                      <small key={a.id} className="appt-line">
                        {state.instruments.find((i) => i.id === a.instrumentId)
                          ?.name ?? a.instrumentId}{" "}
                        {formatDateTime(a.slotStart)}（
                        {a.status === "booked"
                          ? "已预约"
                          : a.status === "done"
                            ? "已完成"
                            : "已取消"}
                        ）
                      </small>
                    ))}
                    {r.supersededById && (
                      <small className="chain-line">
                        → 已由补滴档案 {r.supersededById.slice(0, 18)}… 接替
                      </small>
                    )}
                    {r.supersedesId && (
                      <small className="chain-line">
                        ← 补滴自 {r.supersedesId.slice(0, 18)}…
                      </small>
                    )}
                    {r.blockReasons.length > 0 && (
                      <small className="chain-line danger-text">
                        {r.blockReasons.join("；")}
                      </small>
                    )}
                  </td>
                  <td>
                    {appts
                      .filter((a) => a.status === "done")
                      .map((a) => (
                        <small key={a.id} className="appt-line">
                          瞳孔 右{a.pupilMm?.OD ?? "-"}/左{a.pupilMm?.OS ?? "-"}
                          mm；验光已录；{a.examiner ?? ""}
                        </small>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
