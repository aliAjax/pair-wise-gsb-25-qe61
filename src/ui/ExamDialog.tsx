import { useState } from "react";
import type { Appointment, ExamResult, MydCase } from "../domain/types";
import { EYE_LABEL } from "../domain/types";

interface Props {
  c: MydCase;
  appt: Appointment;
  now: number;
  onClose: () => void;
  onConfirm: (result: Omit<ExamResult, "caseId">) => void;
}

export function ExamDialog({ c, appt, now, onClose, onConfirm }: Props) {
  const [pupilOd, setPupilOd] = useState("");
  const [pupilOs, setPupilOs] = useState("");
  const [odS, setOdS] = useState("");
  const [odC, setOdC] = useState("");
  const [odA, setOdA] = useState("");
  const [osS, setOsS] = useState("");
  const [osC, setOsC] = useState("");
  const [osA, setOsA] = useState("");
  const [error, setError] = useState("");

  const showOd = c.eye === "OD" || c.eye === "OU";
  const showOs = c.eye === "OS" || c.eye === "OU";
  const num = (v: string) => (v === "" ? undefined : Number(v));

  function confirm() {
    const po = num(pupilOd);
    const ps = num(pupilOs);
    if (showOd && (po === undefined || Number.isNaN(po))) return setError("请填写右眼瞳孔直径（mm）");
    if (showOs && (ps === undefined || Number.isNaN(ps))) return setError("请填写左眼瞳孔直径（mm）");
    onConfirm({
      appointmentId: appt.id,
      examinedAt: now,
      pupilOdMm: po,
      pupilOsMm: ps,
      odSphere: showOd ? odS.trim() || undefined : undefined,
      odCylinder: showOd ? odC.trim() || undefined : undefined,
      odAxis: showOd ? odA.trim() || undefined : undefined,
      osSphere: showOs ? osS.trim() || undefined : undefined,
      osCylinder: showOs ? osC.trim() || undefined : undefined,
      osAxis: showOs ? osA.trim() || undefined : undefined,
    });
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>检查补录 — {c.patientName}（{EYE_LABEL[c.eye]}）</h2>
        <p className="modal-hint">补录后该排程标记完成，仪器时段保留为已占用记录。</p>

        <fieldset>
          <legend>瞳孔直径（mm）</legend>
          <div className="form-grid">
            {showOd && (
              <label><span>右眼</span>
                <input type="number" step="0.1" value={pupilOd} onChange={(e) => setPupilOd(e.target.value)} placeholder="如：6.5" />
              </label>
            )}
            {showOs && (
              <label><span>左眼</span>
                <input type="number" step="0.1" value={pupilOs} onChange={(e) => setPupilOs(e.target.value)} placeholder="如：6.5" />
              </label>
            )}
          </div>
        </fieldset>

        {showOd && (
          <fieldset>
            <legend>右眼验光值（DS 球镜 / DC 柱镜 / 轴位°）</legend>
            <div className="form-grid three">
              <input placeholder="球镜 -1.50" value={odS} onChange={(e) => setOdS(e.target.value)} />
              <input placeholder="柱镜 -0.50" value={odC} onChange={(e) => setOdC(e.target.value)} />
              <input placeholder="轴位 180" value={odA} onChange={(e) => setOdA(e.target.value)} />
            </div>
          </fieldset>
        )}
        {showOs && (
          <fieldset>
            <legend>左眼验光值（DS 球镜 / DC 柱镜 / 轴位°）</legend>
            <div className="form-grid three">
              <input placeholder="球镜 -1.75" value={osS} onChange={(e) => setOsS(e.target.value)} />
              <input placeholder="柱镜 -0.75" value={osC} onChange={(e) => setOsC(e.target.value)} />
              <input placeholder="轴位 5" value={osA} onChange={(e) => setOsA(e.target.value)} />
            </div>
          </fieldset>
        )}

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary-action" onClick={confirm}>保存补录</button>
        </div>
      </div>
    </div>
  );
}
