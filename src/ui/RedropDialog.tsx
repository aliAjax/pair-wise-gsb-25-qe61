import { useMemo, useState } from "react";
import { IOP_LIMIT, buildBatches, protocolOf } from "../domain/catalog";
import type { MydCase } from "../domain/types";
import { EYE_LABEL } from "../domain/types";

interface Props {
  c: MydCase;
  now: number;
  onClose: () => void;
  onConfirm: (drop: {
    at: number;
    batchId: string;
    customLot?: string;
    odIop?: number;
    osIop?: number;
    note?: string;
  }) => void;
}

function localValue(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function RedropDialog({ c, now, onClose, onConfirm }: Props) {
  const batches = useMemo(() => buildBatches(now), [now]);
  const drugBatches = batches.filter((b) => b.drugId === c.drugId);
  const last = c.drops[c.drops.length - 1];
  const p = protocolOf(c.drugId);

  const [at, setAt] = useState(localValue(now));
  const [batchId, setBatchId] = useState(drugBatches[0]?.id ?? "custom:");
  const [customLot, setCustomLot] = useState("");
  const [odIop, setOdIop] = useState(last?.odIop?.toString() ?? "");
  const [osIop, setOsIop] = useState(last?.osIop?.toString() ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const isCustom = batchId.startsWith("custom:");
  const minIntervalMin = Math.round(p.minIntervalMs / 60000);

  function confirm() {
    const t = new Date(at).getTime();
    if (!Number.isFinite(t)) return setError("补滴时刻无效");
    if (isCustom && !customLot.trim()) return setError("请填写手工批次号");
    const od = odIop === "" ? undefined : Number(odIop);
    const os = osIop === "" ? undefined : Number(osIop);
    if ((od !== undefined && Number.isNaN(od)) || (os !== undefined && Number.isNaN(os))) {
      return setError("眼压必须是数字");
    }
    onConfirm({
      at: t,
      batchId: isCustom ? `custom:${customLot.trim()}` : batchId,
      customLot: isCustom ? customLot.trim() : undefined,
      odIop: od,
      osIop: os,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>补滴登记 — {c.patientName}（{EYE_LABEL[c.eye]}）</h2>
        <p className="modal-warn">
          补滴将立即作废当前排程并按新药效窗口重新生成时段；若眼压偏高、批次过期/未登记或距上一滴不足 {minIntervalMin} 分钟，
          新输入会被保留并列出原因，病例继续隔离，仪器不释放。
        </p>

        <div className="form-grid">
          <label>
            <span>药品</span>
            <input value={p.name} disabled />
          </label>
          <label>
            <span>补滴时刻 *</span>
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <label>
            <span>批次 *</span>
            <select value={isCustom ? "__custom__" : batchId} onChange={(e) => {
              if (e.target.value === "__custom__") setBatchId("custom:");
              else setBatchId(e.target.value);
            }}>
              {drugBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.lot}（{b.expiresAt >= now ? "有效" : "已过期"}）
                </option>
              ))}
              <option value="__custom__">手工录入批次号…</option>
            </select>
          </label>
          {isCustom && (
            <label>
              <span>手工批次号</span>
              <input value={customLot} onChange={(e) => setCustomLot(e.target.value)} />
            </label>
          )}
          {(c.eye === "OD" || c.eye === "OU") && (
            <label>
              <span>右眼眼压 mmHg（&gt;{IOP_LIMIT} 拦截）</span>
              <input type="number" value={odIop} onChange={(e) => setOdIop(e.target.value)}
                className={odIop !== "" && Number(odIop) > IOP_LIMIT ? "input-danger" : ""} />
            </label>
          )}
          {(c.eye === "OS" || c.eye === "OU") && (
            <label>
              <span>左眼眼压 mmHg（&gt;{IOP_LIMIT} 拦截）</span>
              <input type="number" value={osIop} onChange={(e) => setOsIop(e.target.value)}
                className={osIop !== "" && Number(osIop) > IOP_LIMIT ? "input-danger" : ""} />
            </label>
          )}
          <label className="wide">
            <span>补滴原因 / 备注</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：散瞳不充分，遵医嘱补滴" />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary-action" onClick={confirm}>确认补滴并重排</button>
        </div>
      </div>
    </div>
  );
}
