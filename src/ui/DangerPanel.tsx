// 界面层：危险病例面板。输入已建档保留，原因逐条列出，
// 并明确提示“未释放任何仪器”。

import type { DoseRecord, DrugBatch } from "../archive/types";
import { formatDateTime, formatClock } from "../rules/safety";

interface Props {
  records: DoseRecord[];
  batches: DrugBatch[];
  onReload: (record: DoseRecord) => void;
}

function batchLabel(batches: DrugBatch[], id: string): string {
  const b = batches.find((x) => x.id === id);
  return b ? `${b.id} · ${b.name}` : id;
}

export function DangerPanel({ records, batches, onReload }: Props) {
  return (
    <section className="panel danger-panel">
      <div className="section-heading">
        <div>
          <p>禁止散瞳 · 仪器锁定</p>
          <h2>危险病例（{records.length}）</h2>
        </div>
      </div>

      {records.length === 0 ? (
        <p className="empty-line">暂无被拦截病例，登记时会自动判定。</p>
      ) : (
        <div className="danger-list">
          {records.map((r) => (
            <article key={r.id} className="danger-card">
              <div className="danger-head">
                <div>
                  <h3>
                    {r.patientName}
                    <span className="tag-patient-no">{r.patientNo}</span>
                  </h3>
                  <p className="danger-meta">
                    {r.age} 岁 · 眼别 {r.eyes} · 滴药 {formatClock(r.droppedAt)}{" "}
                    · {formatDateTime(r.createdAt)} 建档
                  </p>
                  <p className="danger-meta">{batchLabel(batches, r.batchId)}</p>
                  <p className="danger-meta">
                    眼压：
                    {r.iop.OD !== undefined && `右眼 ${r.iop.OD} `}
                    {r.iop.OS !== undefined && `左眼 ${r.iop.OS} `}
                    mmHg
                  </p>
                </div>
                <button
                  className="danger-reload"
                  onClick={() => onReload(r)}
                  title="把原始输入带回登记表核对修正，原拦截档案保留"
                >
                  载入表单修正
                </button>
              </div>
              <ul className="reason-list">
                {r.blockReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="lock-line">🔒 已保留登记输入，未安排检查、未释放任何仪器</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
