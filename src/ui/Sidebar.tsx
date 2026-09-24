import { useMemo } from "react";
import { buildBatches, formatHM, formatFull } from "../domain/catalog";
import { activeAppointments } from "../domain/scheduling";
import type { StationState } from "../domain/types";

interface Props {
  state: StationState;
  now: number;
  onLoadSeed: () => void;
  onClear: () => void;
}

function StatGrid({ state, now }: { state: StationState; now: number }) {
  const counts = { scheduled: 0, awaiting: 0, quarantined: 0, done: 0 };
  for (const c of state.cases) counts[c.status]++;
  const dayStart = new Date(now);
  dayStart.setHours(8, 0, 0, 0);
  const cur = Math.floor((now - dayStart.getTime()) / (10 * 60_000));
  const occupiedNow = activeAppointments(state).filter((a) => a.slotIndex === cur).length;

  return (
    <div className="stat-grid">
      <div className="stat stat-sched"><strong>{counts.scheduled}</strong><span>已排程</span></div>
      <div className="stat stat-wait"><strong>{counts.awaiting}</strong><span>等待中</span></div>
      <div className="stat stat-danger"><strong>{counts.quarantined}</strong><span>危险隔离</span></div>
      <div className="stat stat-done"><strong>{counts.done}</strong><span>已完成</span></div>
      <div className="stat stat-wide"><strong>{occupiedNow} / 3</strong><span>当前时段占用仪器</span></div>
    </div>
  );
}

function BatchCatalog({ now }: { now: number }) {
  const batches = useMemo(() => buildBatches(now), [now]);
  return (
    <div className="batch-catalog">
      {batches.map((b) => {
        const expired = b.expiresAt < now;
        return (
          <div key={b.id} className={expired ? "batch-row batch-expired" : "batch-row"}>
            <strong>{b.lot}</strong>
            <span>有效期至 {formatFull(b.expiresAt).slice(0, 10)}</span>
            <em>{expired ? "已过期 · 拦截" : "在册有效"}</em>
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ state, now, onLoadSeed, onClear }: Props) {
  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="section-heading compact">
          <div><p>当班概览</p><h2>态势</h2></div>
          <span className="clock-badge">{formatHM(now)}</span>
        </div>
        <StatGrid state={state} now={now} />
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div><p>本机批次档案</p><h2>药品批次</h2></div>
        </div>
        <BatchCatalog now={now} />
      </section>

      <section className="panel">
        <div className="section-heading compact">
          <div><p>留档动作流水</p><h2>本机留档</h2></div>
        </div>
        <ol className="audit-log">
          {state.log.slice(0, 14).map((e) => (
            <li key={e.id} className={`log-${e.kind}`}>
              <time>{formatHM(e.at)}</time>
              <span>{e.text}</span>
            </li>
          ))}
          {state.log.length === 0 && <li className="log-empty">暂无动作记录</li>}
        </ol>
        <div className="sidebar-actions">
          <button onClick={onLoadSeed}>载入演示数据</button>
          <button onClick={onClear} className="danger-btn">清空本机留档</button>
        </div>
      </section>
    </aside>
  );
}
