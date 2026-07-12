// ============================================================
// ui/celebrate.tsx — 祝祭演出（紙吹雪）＋数値カウントアップ
// ============================================================

import { useEffect, useRef, useState } from 'react'

const COLORS = ['#ff9f53', '#ffd23f', '#5cb98b', '#6cc5f0', '#ff7eb0', '#9b6cf0']

/** 画面上から降る紙吹雪。count個・一定時間で自然に止まる（CSSアニメ）。 */
export function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.4,
      dur: 2.6 + Math.random() * 1.8,
      size: 6 + Math.random() * 7,
      color: COLORS[i % COLORS.length],
      rot: Math.random() * 360,
      round: Math.random() > 0.5,
    })),
  ).current
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 40 }}>
      {pieces.map((p) => (
        <span key={p.id} style={{
          position: 'absolute', top: '-6%', left: `${p.left}%`,
          width: p.size, height: p.size * (p.round ? 1 : 0.5),
          background: p.color, borderRadius: p.round ? '50%' : 2,
          transform: `rotate(${p.rot}deg)`,
          animation: `confetti-fall ${p.dur}s cubic-bezier(0.3,0.5,0.6,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

/** 0→target へなめらかにカウントアップする数値 */
export function useCountUp(target: number, ms = 800): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      setV(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export function CountUp({ value, ms, prefix }: { value: number; ms?: number; prefix?: string }) {
  const v = useCountUp(value, ms)
  return <>{prefix}{v}</>
}
