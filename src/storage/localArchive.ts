// 本机留档层：仅负责浏览器本机存取，不包含任何业务判定。
// 档案层与判定层都不感知 localStorage 的存在。

import type { ArchiveState } from "../archive/types";

const STORAGE_KEY = "hxwl-11.mydriasis.archive.v1";

export function loadArchive(): ArchiveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArchiveState;
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.appointments)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveArchive(state: ArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 本机存储不可用时静默降级，界面仍可使用内存档案
  }
}

export function clearArchive(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
