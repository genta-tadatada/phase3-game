// ============================================================
// store/tutorialStore.ts — 操作式チュートリアルの進行状態
//   step = -1 で非表示。実際のボタンを光らせ、操作で進む（Coachmark.tsx）。
// ============================================================

import { create } from 'zustand'

const KEY = 'tts-tutorial-done'

export function tutorialDone(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
function markDone(): void {
  try { localStorage.setItem(KEY, '1') } catch { /* noop */ }
}

interface TutStore {
  step: number
  start: () => void
  next: () => void
  skip: () => void
  finish: () => void
}

export const useTutorial = create<TutStore>((set, get) => ({
  step: -1,
  start: () => set({ step: 0 }),
  next: () => set({ step: get().step + 1 }),
  skip: () => { markDone(); set({ step: -1 }) },
  finish: () => { markDone(); set({ step: -1 }) },
}))
