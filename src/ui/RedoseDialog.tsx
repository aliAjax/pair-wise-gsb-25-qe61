// 界面层：补滴弹窗。只负责采集补滴输入；
// 是否危险、是否作废原排程，由父层调用判定层决定。

import { useState } from "react";
import type { ArchiveState, DoseDraft, EyePressure } from "../archive/types";
import {
  BOTH_EYES,
  draftCovers,
  formatDateTime,
} from "../rules/safety";
import { nowLocalInputValue } from "../archive/format";

interface Props {
  state: ArchiveState;
  oldRecordId: string;
  onClose: () => void;
  /** 提交补滴登记；返回非空数组表示被判定为危险病例（已建档，原排程不动） */
  onSubmit: (oldRecordId: string, draft: DoseDraft) => string[];
}

export function RedoseDialog({ state, oldRecordId, onClose, onSubmit }: Props) {
  const old = state.records.find((r) => r.id === oldRecordId);
  const [draft, setDraft] = useState<DoseDraft>(() =>
    old
      ? {
          patientName: old.patientName,
          patientNo: old.patientNo,
          age: old.age,
          eyes: old.eyes,
          batchId: old.batchId,
          droppedAt: nowLocalInputValue(),
          iop: { ...old.iop },
        }
      : {
          patientName: "",
          patientNo: "",
          age: 0,
          eyes: "OU",
          batchId: "",
          droppedAt: nowLocalInputValue(),
          iop: {},
        }
  );
  const [blockedReasons, setBlockedReasons] = useState<string[] | null>(null);

  if (!old) return null;

  const oldAppt = state.appointments.find(
    (a) => a.recordId === oldRecordId && a.status === "booked"
  );

  const submit = () => {
    // 危险原因由父层返回：已建档为危险病例，原排程保留
    const reasons = onSubmit(old.id, draft);
    if (reasons.length > 0) setBlockedReasons(reasons);
  };

  const setIop = (eye: "OD" | "OS", raw: string) => {
    const next: EyePressure = { ...draft.iop };
    if (raw.trim() === "") delete next[eye];
    else next[eye] = Number(raw);
    setDraft({ ...draft, iop: next });
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">补滴重新散瞳</p>
            <h2>
              {old.patientName} · {old.eyes}
            </h2>
          </div>
          <button className="ghost-action" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="void-notice">
          原滴药 {formatDateTime(old.droppedAt)}（批次 {old.batchId}）；
          {oldAppt
            ? `原排程 ${formatDateTime(oldAppt.slotStart)} 将被作废，仪器时段立即释放。`
            : "原档案将被作废。"}
          补滴判定通过后按新滴药时刻重新计算药效窗口并生成新时段。
        </div>

        <div className="exam-grid">
          <label>
            <span>药品批次</span>
            <select
              value={draft.batchId}
              onChange={(e) => setDraft({ ...draft, batchId: e.target.value })}
            >
              {state.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} · {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>本次滴眼时刻</span>
            <input
              type="datetime-local"
              value={draft.droppedAt}
              onChange={(e) => setDraft({ ...draft, droppedAt: e.target.value })}
            />
          </label>
          {BOTH_EYES.filter((eye) => draftCovers(draft.eyes, eye)).map((eye) => (
            <label key={eye}>
              <span>{eye === "OD" ? "右" : "左"}眼眼压（mmHg）</span>
              <input
                type="number"
                value={draft.iop[eye] ?? ""}
                onChange={(e) => setIop(eye, e.target.value)}
              />
            </label>
          ))}
        </div>

        {blockedReasons && (
          <div className="form-notice blocked">
            <p>本次补滴被判定为危险病例，输入已保留并建档，原排程未作废：</p>
            <ul className="reason-list">
              {blockedReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button className="primary-action" onClick={submit} disabled={!!blockedReasons}>
            判定并补滴
          </button>
          {blockedReasons && (
            <button className="ghost-action" onClick={onClose}>
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
