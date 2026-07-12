// ============================================================
// components/WeatherFX.tsx — 天候の視覚エフェクト（素材不要・CSS）
//   今週の天候に応じて雨/雪/猛暑/寒波/晴れ/曇りを画面全体に薄く重ねる。
//   pointer-events:none で操作の邪魔をしない。
// ============================================================

import type { Weather } from '../career/weather'

export function WeatherFX({ weather }: { weather?: Weather | null }) {
  if (!weather) return null
  return (
    <div className="wfx" aria-hidden>
      {weather === '雨' && <><div className="wfx-tint wfx-rainT" /><div className="wfx-layer wfx-rain" /></>}
      {weather === '雪' && <><div className="wfx-tint wfx-cold" /><div className="wfx-layer wfx-snow1" /><div className="wfx-layer wfx-snow2" /></>}
      {weather === '寒波' && <><div className="wfx-tint wfx-cold" /><div className="wfx-layer wfx-snow2" /></>}
      {weather === '猛暑' && <div className="wfx-tint wfx-hot" />}
      {weather === '晴れ' && <div className="wfx-tint wfx-sun" />}
      {weather === '曇り' && <div className="wfx-tint wfx-cloud" />}
    </div>
  )
}
