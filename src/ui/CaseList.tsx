import { useMemo } from "react";
import {
  buildBatches,
  dayStartOf,
  formatFull,
  formatHM,
  protocolOf,
  slotLabel,
  windowFor,
} from "../domain/catalog";
import { activeAppointmentOf } from "../domain/scheduling";
import type { MydCase, StationState } from "../domain/types";
import { EYE_LABEL } from "../domain/types";

interface Props {
  state: StationState;
  now: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRedrop: (caseId: string) => void;
  onExam: (caseId: string) => void;
  onRetry: (caseId: string) => void;
}

const STATUS_TEXT: Record<MydCase["status"], string> = {
  scheduled: "已排程",
  awaiting: "等待空档",
  quarantined: "危险隔离",
  done: "已完成",
};

function BatchTag({ batchId, customLot, now }: { batchId: string; customLot?: string; now: number }) {
  const batches = useMemo(() => buildBatches(now), [now]);
  const b = batches.find((x) => x.id === batchId);
  if (!b) return <span className="tag tag-bad">批次 {customLot ?? batchId} · 未登记</span>;
  const expired = b.expiresAt < now;
  return (
    <span className={expired ? "tag tag-bad" : "tag tag-ok"}>
      {b.lot} · {expired ? "已过期" : "在册有效"}
    </span>
  );
}

function IopView({ c }: { c: MydCase }) {
  const last = c.drops[c.drops.length - 1];
  if (!last) return null;
  const parts: string[] = [];
  if (last.odIop !== undefined) parts.push(`右 ${last.odIop}`);
  if (last.osIop !== undefined) parts.push(`左 ${last.osIop}`);
  return parts.length > 0 ? <span className="iop">眼压 {parts.join(" / ")} mmHg</span> : null;
}

export function CaseList({ state, now, selectedId, onSelect, onRedrop, onExam, onRetry }: Props) {
  const dayStart = dayStartOf(now);
  const sorted = useMemo(() => {
    const rank = { quarantined: 0, awaiting: 1, scheduled: 2, done: 3 } as const;
    return [...state.cases].sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt - a.createdAt);
  }, [state.cases]);

  return (
    <section className="panel case-panel">
      <div className="section-heading">
        <div>
          <p>病例队列</p>
          <h2>散瞳病例（{sorted.length}）</h2>
        </div>
      </div>

      <div className="case-list">
        {sorted.length === 0 && <p className="empty-hint">暂无登记，先在左侧完成滴药登记。</p>}
        {sorted.map((c) => {
          const appt = activeAppointmentOf(state, c.id);
          const exam = state.exams.find((e) => e.caseId === c.id);
          const last = c.drops[c.drops.length - 1];
          const win = last ? windowFor(last.at, c.drugId, dayStart) : undefined;
          const expired = win ? now >= win.end : false;
          return (
            <article
              key={c.id}
              className={[
                "case-card",
                `case-${c.status}`,
                selectedId === c.id ? "case-selected" : "",
              ].join(" ")}
              onClick={() => onSelect(c.id)}
            >
              <header>
                <div>
                  <h3>
                    {c.patientName}
                    <span className="age">{c.age} 岁</span>
                  </h3>
                  <p className="sub">
                    {c.id} · {EYE_LABEL[c.eye]} · {protocolOf(c.drugId).name}
                  </p>
                </div>
                <span className={`status-pill pill-${c.status}`}>{STATUS_TEXT[c.status]}</span>
              </header>

              {c.dangerReasons.length > 0 && (
                <ul className="danger-list">
                  {c.dangerReasons.map((r, i) => (
                    <li key={`${r.code}-${i}`}>⛔ {r.text}</li>
                  ))}
                  <li className="danger-lock">已保留全部输入并锁定，仪器不释放；请医生处理后以"补滴"重新登记。</li>
                </ul>
              )}

              {c.dangerReasons.length === 0 && c.dangerHistory.length > 0 && (
                <details className="danger-history">
                  <summary>⚠ 历史拦截 {c.dangerHistory.length} 次（原因已留档）</summary>
                  <ul>
                    {c.dangerHistory.map((h, i) => (
                      <li key={i}>
                        <time>{formatHM(h.at)}</time>
                        {h.reasons.map((r, j) => (
                          <span key={j} className="dh-reason">⛔ {r.text}</span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="case-meta">
                <span>滴眼 {c.drops.length} 次（最近 {last ? formatHM(last.at) : "—"}）</span>
                <IopView c={c} />
                {last && <BatchTag batchId={last.batchId} customLot={last.customLot} now={now} />}
              </div>

              {appt && (
                <div className="case-appt">
                  🕒 {appt.instrumentId} · {slotLabel(dayStart, appt.slotIndex)} 时段
                  {appt.status === "done" ? "（已完成）" : ""}
                  {win && appt.status !== "done" && (
                    <span className={expired ? "win-expired" : "win-ok"}>
                      药效窗口 {formatHM(win.start)}–{formatHM(win.end)}
                      {expired ? "（已过窗口，需补滴）" : ""}
                    </span>
                  )}
                </div>
              )}
              {c.status === "awaiting" && win && (
                <div className="case-appt">
                  ⏳ 窗口 {formatHM(win.start)}–{formatHM(win.end)} 内暂无空档
                  <button
                    className="mini"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(c.id);
                    }}
                  >
                    重新尝试安排
                  </button>
                </div>
              )}

              {exam && (
                <dl className="exam-mini">
                  <div><dt>瞳孔(mm)</dt><dd>右 {exam.pupilOdMm ?? "—"} / 左 {exam.pupilOsMm ?? "—"}</dd></div>
                  <div><dt>右眼球柱轴</dt><dd>{exam.odSphere ?? ""} / {exam.odCylinder ?? ""} / {exam.odAxis ?? ""}</dd></div>
                  <div><dt>左眼球柱轴</dt><dd>{exam.osSphere ?? ""} / {exam.osCylinder ?? ""} / {exam.osAxis ?? ""}</dd></div>
                  <div className="exam-time">补录于 {formatFull(exam.examinedAt)}</div>
                </dl>
              )}

              {c.drops.length > 0 && (
                <details className="drop-history" onClick={(e) => e.stopPropagation()}>
                  <summary>滴眼历史（{c.drops.length}）</summary>
                  <ol>
                    {[...c.drops].reverse().map((d) => (
                      <li key={d.id}>
                        {formatFull(d.at)} {d.isRedrop ? "· 补滴" : "· 首滴"}
                        {d.note ? ` · ${d.note}` : ""}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <div className="case-actions" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onRedrop(c.id)} disabled={c.status === "done"}>
                  补滴（作废原排程）
                </button>
                <button
                  className="primary-action"
                  onClick={() => onExam(c.id)}
                  disabled={c.status !== "scheduled" || !appt}
                >
                  完成检查并补录
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
