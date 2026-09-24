import { useMemo, useState } from "react";
import { IOP_LIMIT, PROTOCOLS, buildBatches, formatHM } from "../domain/catalog";
import type { Batch, Eye } from "../domain/types";
import { EYE_LABEL } from "../domain/types";

interface Props {
  now: number;
  onSubmit: (input: {
    patientName: string;
    age: number;
    eye: Eye;
    drugId: string;
    at: number;
    batchId: string;
    customLot?: string;
    odIop?: number;
    osIop?: number;
    note?: string;
  }) => void;
}

function toLocalInputValue(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const EYES: Eye[] = ["OD", "OS", "OU"];

export function RegisterForm({ now, onSubmit }: Props) {
  const batches = useMemo<Batch[]>(() => buildBatches(now), [now]);
  const [name, setName] = useState("");
  const [age, setAge] = useState("8");
  const [eye, setEye] = useState<Eye>("OU");
  const [drugId, setDrugId] = useState(PROTOCOLS[0].id);
  const [at, setAt] = useState(toLocalInputValue(now));
  const [batchId, setBatchId] = useState(batches[0].id);
  const [customLot, setCustomLot] = useState("");
  const [odIop, setOdIop] = useState("");
  const [osIop, setOsIop] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const isCustom = batchId.startsWith("custom:");
  const drugBatches = batches.filter((b) => b.drugId === drugId);
  const selected = batches.find((b) => b.id === batchId);

  function submit() {
    const dropAt = new Date(at).getTime();
    if (!name.trim()) return setError("请填写患者姓名");
    if (!Number.isFinite(dropAt)) return setError("滴眼时刻无效");
    if (isCustom && !customLot.trim()) return setError("已选手工批次，请填写批次号");
    const od = odIop === "" ? undefined : Number(odIop);
    const os = osIop === "" ? undefined : Number(osIop);
    if ((od !== undefined && Number.isNaN(od)) || (os !== undefined && Number.isNaN(os))) {
      return setError("眼压必须是数字");
    }
    onSubmit({
      patientName: name.trim(),
      age: Math.max(0, Math.floor(Number(age) || 0)),
      eye,
      drugId,
      at: dropAt,
      batchId: isCustom ? `custom:${customLot.trim()}` : batchId,
      customLot: isCustom ? customLot.trim() : undefined,
      odIop: od,
      osIop: os,
      note: note.trim() || undefined,
    });
    setError("");
    setName("");
    setNote("");
  }

  return (
    <section className="panel register-panel">
      <div className="section-heading">
        <div>
          <p>滴药登记</p>
          <h2>散瞳登记台</h2>
        </div>
        <span className="clock-badge">当前 {formatHM(now)}</span>
      </div>

      <div className="form-grid">
        <label>
          <span>患者姓名 *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：李一诺" />
        </label>
        <label>
          <span>年龄</span>
          <input type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
        </label>

        <label>
          <span>眼别 *</span>
          <div className="seg">
            {EYES.map((e) => (
              <button
                type="button"
                key={e}
                className={eye === e ? "seg-on" : ""}
                onClick={() => setEye(e)}
              >
                {EYE_LABEL[e]}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>滴眼药品</span>
          <select value={drugId} onChange={(e) => {
            setDrugId(e.target.value);
            const first = batches.find((b) => b.drugId === e.target.value);
            if (first) setBatchId(first.id);
          }}>
            {PROTOCOLS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.note}）
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>滴眼时刻 *</span>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        <label>
          <span>药品批次 *</span>
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
          <label className="wide">
            <span>手工批次号（未登记在册，将被拦截）</span>
            <input value={customLot} onChange={(e) => setCustomLot(e.target.value)} placeholder="如：TPC-UNKNOWN" />
          </label>
        )}

        {(eye === "OD" || eye === "OU") && (
          <label>
            <span>右眼眼压 mmHg（&gt;{IOP_LIMIT} 拦截）</span>
            <input
              type="number"
              value={odIop}
              onChange={(e) => setOdIop(e.target.value)}
              placeholder="如：16"
              className={odIop !== "" && Number(odIop) > IOP_LIMIT ? "input-danger" : ""}
            />
          </label>
        )}
        {(eye === "OS" || eye === "OU") && (
          <label>
            <span>左眼眼压 mmHg（&gt;{IOP_LIMIT} 拦截）</span>
            <input
              type="number"
              value={osIop}
              onChange={(e) => setOsIop(e.target.value)}
              placeholder="如：16"
              className={osIop !== "" && Number(osIop) > IOP_LIMIT ? "input-danger" : ""}
            />
          </label>
        )}

        <label className="wide">
          <span>备注</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="过敏史、医嘱等（可选）" />
        </label>
      </div>

      {selected && (
        <p className="batch-hint">
          批次 {selected.lot} 有效期至 {new Date(selected.expiresAt).toLocaleDateString("zh-CN")}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="primary-action" onClick={submit}>登记滴眼并排程</button>
      </div>
    </section>
  );
}
