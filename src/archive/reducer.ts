// 档案层：档案状态变更。reducer 只做结构性变更，
// 危险判定与“能否排程”由判定层在派发前给出结论；
// 此处对仪器占用保留一道防御性复核，避免任何路径产生双人同时段。

import type {
  Appointment,
  ArchiveState,
  DoseRecord,
  EyePressure,
} from "./types";
import { occupancyKey, activeAppointments } from "../rules/schedule";

export type ArchiveAction =
  | { type: "register"; record: DoseRecord }
  | { type: "book"; appointment: Appointment }
  | { type: "cancelBooking"; recordId: string }
  | {
      type: "completeExam";
      appointmentId: string;
      pupilMm: EyePressure;
      refraction: Partial<Record<"OD" | "OS", string>>;
      examiner: string;
      examinedAt: string;
    }
  | {
      type: "redose";
      oldRecordId: string;
      newRecord: DoseRecord;
    }

function activeAppointmentFor(
  state: ArchiveState,
  recordId: string
): Appointment | undefined {
  return state.appointments.find(
    (a) => a.recordId === recordId && a.status === "booked"
  );
}

export function archiveReducer(
  state: ArchiveState,
  action: ArchiveAction
): ArchiveState {
  switch (action.type) {
    case "register":
      return { ...state, records: [action.record, ...state.records] };

    case "book": {
      const record = state.records.find(
        (r) => r.id === action.appointment.recordId
      );
      // 危险病例 / 非等待状态不释放仪器
      if (!record || record.status !== "waiting") return state;

      const slotStart = new Date(action.appointment.slotStart).getTime();
      const key = occupancyKey(action.appointment.instrumentId, slotStart);
      const clash = activeAppointments(state.appointments).some(
        (a) =>
          occupancyKey(a.instrumentId, new Date(a.slotStart).getTime()) === key
      );
      if (clash) return state; // 同一仪器同一时段只留一人

      return {
        ...state,
        records: state.records.map((r) =>
          r.id === record.id ? { ...r, status: "booked" as const } : r
        ),
        appointments: [action.appointment, ...state.appointments],
      };
    }

    case "cancelBooking": {
      const appt = activeAppointmentFor(state, action.recordId);
      if (!appt) return state;
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === action.recordId
            ? { ...r, status: "waiting" as const }
            : r
        ),
        appointments: state.appointments.map((a) =>
          a.id === appt.id ? { ...a, status: "cancelled" as const } : a
        ),
      };
    }

    case "completeExam": {
      const appt = state.appointments.find(
        (a) => a.id === action.appointmentId && a.status === "booked"
      );
      if (!appt) return state;
      return {
        ...state,
        records: state.records.map((r) =>
          r.id === appt.recordId ? { ...r, status: "done" as const } : r
        ),
        appointments: state.appointments.map((a) =>
          a.id === appt.id
            ? {
                ...a,
                status: "done" as const,
                pupilMm: action.pupilMm,
                refraction: action.refraction,
                examiner: action.examiner,
                examinedAt: action.examinedAt,
              }
            : a
        ),
      };
    }

    case "redose": {
      const old = state.records.find((r) => r.id === action.oldRecordId);
      if (!old || old.status === "void" || old.status === "blocked")
        return state;
      const oldAppt = activeAppointmentFor(state, action.oldRecordId);
      return {
        ...state,
        records: [
          action.newRecord,
          ...state.records.map((r) =>
            r.id === old.id
              ? {
                  ...r,
                  status: "void" as const,
                  supersededById: action.newRecord.id,
                }
              : r
          ),
        ],
        appointments: oldAppt
          ? state.appointments.map((a) =>
              a.id === oldAppt.id
                ? { ...a, status: "cancelled" as const }
                : a
            )
          : state.appointments,
      };
    }

    default:
      return state;
  }
}
