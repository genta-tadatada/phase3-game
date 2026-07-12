// ============================================================
// ui/sfx.ts — 効果音（WebAudioでの手続き的合成・音源ファイル不要）
//   ホイッスル・ゴール歓声・タップ音をその場で生成する。
//   BGMや本格的な歓声サンプルは別途音源が必要（タスク管理に記録）。
//   ブラウザの自動再生制限のため、最初のユーザー操作後に鳴る。
// ============================================================

let ctx: AudioContext | null = null
let enabled = typeof localStorage !== 'undefined' ? localStorage.getItem('tts-sfx') !== 'off' : true

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

export function sfxEnabled(): boolean { return enabled }
export function setSfxEnabled(v: boolean): void {
  enabled = v
  try { localStorage.setItem('tts-sfx', v ? 'on' : 'off') } catch { /* noop */ }
  if (v) ac() // 初回ONでオーディオを起こす（ユーザー操作内で呼ばれる前提）
}

// 単音をエンベロープ付きで鳴らす
function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** 主審のホイッスル（キックオフ・試合終了） */
export function sfxWhistle(): void {
  if (!enabled) return
  tone(2350, 0.16, 'square', 0.09, 0)
  tone(2500, 0.22, 'square', 0.09, 0.12)
}

/** ゴール！（明るい上昇アルペジオ＝歓声の代わり） */
export function sfxGoal(): void {
  if (!enabled) return
  const notes = [523, 659, 784, 1046] // C5 E5 G5 C6
  notes.forEach((f, i) => tone(f, 0.26, 'triangle', 0.13, i * 0.08))
}

/** 失点（落ち込む下降音） */
export function sfxConcede(): void {
  if (!enabled) return
  tone(392, 0.22, 'sine', 0.08, 0)
  tone(294, 0.30, 'sine', 0.08, 0.12)
}

/** 好セーブ／ブロック（弾く短い音） */
export function sfxSave(): void {
  if (!enabled) return
  tone(330, 0.10, 'square', 0.07, 0)
}

/** カード・反則の笛（短い2連） */
export function sfxCard(): void {
  if (!enabled) return
  tone(2100, 0.10, 'square', 0.08, 0)
  tone(2100, 0.12, 'square', 0.08, 0.13)
}

/** ボール奪取・締まったプレー（短い低音アクセント） */
export function sfxTackle(): void {
  if (!enabled) return
  tone(180, 0.08, 'sawtooth', 0.05, 0)
}

/** 汎用タップ音（軽いクリック） */
export function sfxClick(): void {
  if (!enabled) return
  tone(880, 0.06, 'triangle', 0.05, 0)
}
