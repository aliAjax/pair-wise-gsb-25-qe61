// 界面层：预约处理弹窗。
// 已预约：可取消排程（退回候诊）、完成检查并补录瞳孔直径与验光值；
// 已完成：展示补录结果，可发起补滴（在 RedoseDialog 中处理）。

import { useState } from "react";
import type {
  Appointment,
  ArchiveState,
  EyePressure,
} from "../archive/types";
import { BOTH_EYES, draftCovers, formatDateTime, formatClock } from "../rules/safety";

interface Props {
  state: ArchiveState;
  appointment: Appointment;
  onClose: () => void;
  onCancelBooking: (recordId: string) => void;
  onComplete: (
    appointmentId: string,
    pupilMm: EyePressure,
    refraction: Partial<Record<"OD" | "OS", string>>,
    examiner: string
  ) => void;
  onRedose: (recordId: string) => void;
}

export function AppointmentDialog({
  state,
  appointment,
  onClose,
  onCancelBooking,
  onComplete,
  onRedose,
}: Props) {
  const record = state.records.find((r) => r.id === appointment.recordId);
  const instrument = state.instruments.find(
    (i) => i.id === appointment.instrumentId
  );
  const [pupil, setPupil] = useState<EyePressure>(appointment.pupilMm ?? {});
  const [refraction, setRefraction] = useState<
    Partial<Record<"OD" | "OS", string>>
  >(appointment.refraction ?? {});
  const [examiner, setExaminer] = useState(appointment.examiner ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  if (!record) return null;
  const eyes = BOTH_EYES.filter((e) => draftCovers(record.eyes, e));

  const submitExam = () => {
    const nextErrors: string[] = [];
    for (const eye of eyes) {
      const mm = pupil[eye];
      if (typeof mm !== "number" || mm <= 0)
        nextErrors.push(`请填写${eye === "OD" ? "右" : "左"}眼瞳孔直径（mm）`);
      if (!refraction[eye]?.trim())
        nextErrors.push(`请填写${eye === "OD" ? "右" : "左"}眼验光值`);
    }
    if (!examiner.trim()) nextErrors.push("请填写检查人");
    setErrors(nextErrors);
    if (nextErrors.length === 0) {
      onComplete(appointment.id, pupil, refraction, examiner.trim());
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              {appointment.status === "done" ? "检查完成" : "预约处理"}
            </p>
            <h2>
              {record.patientName} · {record.eyes}
            </h2>
          </div>
          <button className="ghost-action" onClick={onClose}>
            关闭
          </button>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>仪器</dt>
            <dd>{instrument ? `${instrument.name}（${instrument.model}）` : appointment.instrumentId}</dd>
          </div>
          <div>
            <dt>检查时段</dt>
            <dd>{formatDateTime(appointment.slotStart)}</dd>
          </div>
          <div>
            <dt>滴眼时刻</dt>
            <dd>{formatDateTime(record.droppedAt)}</dd>
          </div>
          <div>
            <dt>药品批次</dt>
            <dd>{record.batchId}</dd>
          </div>
          <div>
            <dt>散瞳前眼压</dt>
            <dd>
              {eyes.map((e) => (
                <span key={e}>
                  {e === "OD" ? "右" : "左"} {record.iop[e]} mmHg
                </span>
              ))}
            </dd>
          </div>
        </dl>

        {appointment.status === "booked" && (
          <>
            <h3 className="modal-sub">检查后补录</h3>
            <div className="exam-grid">
              {eyes.map((eye) => (
                <label key={`p-${eye}`}>
                  <span>{eye === "OD" ? "右" : "左"}眼瞳孔直径（mm）</span>
                  <input
                    type="number"
                    step={0.5}
                    value={pupil[eye] ?? ""}
                    onChange={(e) =>
                      setPupil((prev) => ({
                        ...prev,
                        [eye]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
              {eyes.map((eye) => (
                <label key={`r-${eye}`} className="wide">
                  <span>{eye === "OD" ? "右" : "左"}眼验光值（散瞳结果）</span>
                  <input
                    placeholder="如 -2.75DS / -0.50DC × 180"
                    value={refraction[eye] ?? ""}
                    onChange={(e) =>
                      setRefraction((prev) => ({
                        ...prev,
                        [eye]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <label className="wide">
                <span>检查人</span>
                <input
                  value={examiner}
                  placeholder="当班验光师 / 医生"
                  onChange={(e) => setExaminer(e.target.value)}
                />
              </label>
            </div>
            {errors.length > 0 && (
              <ul className="form-errors">
                {errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button className="primary-action" onClick={submitExam}>
                补录并完成检查
              </button>
              <button onClick={() => onCancelBooking(record.id)}>
                取消排程（退回候诊）
              </button>
            </div>
          </>
        )}

        {appointment.status === "done" && (
          <>
            <h3 className="modal-sub">检查结果（{formatClock(appointment.examinedAt ?? appointment.slotStart)} 补录）</h3>
            <div className="result-grid">
              {eyes.map((eye) => (
                <div key={eye} className="result-card">
                  <h4>{eye === "OD" ? "右眼" : "左眼"}</h4>
                  <p>瞳孔直径：{appointment.pupilMm?.[eye] ?? "—"} mm</p>
                  <p>验光值：{appointment.refraction?.[eye] ?? "—"}</p>
                </div>
              ))}
            </div>
            <p className="hint">检查人：{appointment.examiner ?? "—"}</p>
            <div className="modal-actions">
              <button onClick={() => onRedose(record.id)}>
                补滴（作废原排程并重新计时）
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
