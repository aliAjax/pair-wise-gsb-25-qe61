// 界面层：滴眼登记表单。只采集输入，判定结果由上层显示。

import type { DoseDraft, DrugBatch, Eye, EyePressure } from "../archive/types";
import { BOTH_EYES, draftCovers } from "../rules/safety";
import { batchExpiryEnd } from "../rules/safety";

interface Props {
  draft: DoseDraft;
  batches: DrugBatch[];
  onChange: (next: DoseDraft) => void;
  onSubmit: () => void;
  onReset: () => void;
  formErrors: string[];
  notice: { kind: "blocked" | "ok"; text: string } | null;
}

const EYE_OPTIONS: { value: Eye; label: string }[] = [
  { value: "OD", label: "右眼 OD" },
  { value: "OS", label: "左眼 OS" },
  { value: "OU", label: "双眼 OU" },
];

function patchIop(iop: EyePressure, eye: "OD" | "OS", raw: string): EyePressure {
  if (raw.trim() === "") {
    const next = { ...iop };
    delete next[eye];
    return next;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? { ...iop, [eye]: value } : iop;
}

export function RegisterForm({
  draft,
  batches,
  onChange,
  onSubmit,
  onReset,
  formErrors,
  notice,
}: Props) {
  const set = <K extends keyof DoseDraft>(key: K, value: DoseDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <section className="panel register-panel">
      <div className="section-heading">
        <div>
          <p>滴药登记</p>
          <h2>散瞳登记台</h2>
        </div>
        <button onClick={onReset} className="ghost-action">
          清空
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>患者姓名</span>
          <input
            value={draft.patientName}
            placeholder="如：李乐"
            onChange={(e) => set("patientName", e.target.value)}
          />
        </label>
        <label>
          <span>就诊卡号</span>
          <input
            value={draft.patientNo}
            placeholder="如：MZ-20260924-01"
            onChange={(e) => set("patientNo", e.target.value)}
          />
        </label>
        <label>
          <span>年龄</span>
          <input
            type="number"
            min={0}
            value={draft.age || ""}
            placeholder="岁"
            onChange={(e) => set("age", Number(e.target.value))}
          />
        </label>
        <label>
          <span>眼别</span>
          <div className="seg">
            {EYE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={draft.eyes === opt.value ? "seg-on" : ""}
                onClick={() => set("eyes", opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>
        <label>
          <span>药品批次</span>
          <select
            value={draft.batchId}
            onChange={(e) => set("batchId", e.target.value)}
          >
            <option value="">请选择批次</option>
            {batches.map((b) => {
              const expired =
                new Date(draft.droppedAt).getTime() >
                batchExpiryEnd(b.expiresAt);
              return (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.name}
                  {expired ? "（已过期）" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>滴眼时刻</span>
          <input
            type="datetime-local"
            value={draft.droppedAt}
            onChange={(e) => set("droppedAt", e.target.value)}
          />
        </label>
        {BOTH_EYES.filter((eye) => draftCovers(draft.eyes, eye)).map((eye) => (
          <label key={eye}>
            <span>{eye === "OD" ? "右眼" : "左眼"}眼压（mmHg）</span>
            <input
              type="number"
              step={1}
              value={draft.iop[eye] ?? ""}
              placeholder="散瞳前测量"
              onChange={(e) => onChange({ ...draft, iop: patchIop(draft.iop, eye, e.target.value) })}
            />
          </label>
        ))}
      </div>

      {formErrors.length > 0 && (
        <ul className="form-errors">
          {formErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}
      {notice && (
        <div className={`form-notice ${notice.kind}`}>
          {notice.kind === "blocked" ? "⛔ " : "✅ "}
          {notice.text}
        </div>
      )}

      <div className="form-actions">
        <button className="primary-action" onClick={onSubmit}>
          登记并判定
        </button>
        <span className="hint">
          眼压 ≥21 mmHg、批次过期或滴药间隔不足将被拦截，输入保留且不释放仪器
        </span>
      </div>
    </section>
  );
}
