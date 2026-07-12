// ============================================================
// components/career/BottomNav.tsx — スマホゲーム風の下タブナビ
//   トップレベル画面（ホーム/選手/スカウト/設備/記録）を切り替える。
//   「練習＋週末＋週送り」はすべて“ホーム”に集約されているので、タブを移っても
//   練習し忘れて週送りする事故が起きない（週のループは1画面で完結）。
//   解放済みのタブだけ表示（年1は段階解放に追従）。試合/イベント等では非表示。
// ============================================================

import { useCareer, type CareerScreen } from '../../store/careerStore'
import { featureUnlocked } from '../../career/unlocks'
import { asset } from '../../ui/asset'

// このナビを出す画面（トップレベル）。サブ画面（戦術/ポジション/大会/入部式等）では出さない。
const NAV_SCREENS: CareerScreen[] = ['weekly', 'roster', 'scout', 'manage', 'records']

// 各タブのアイコン画像（GPT Image生成・かわいい統一アイコン）。モチーフは画面の中身に合わせて選定：
// ホーム=笛(練習・采配) / 選手=ユニフォーム / スカウト=双眼鏡 / 設備=クラブハウス+コイン / 記録=トロフィー。
const NAV_ICON: Record<string, string> = {
  weekly: 'ui/nav-home.webp', roster: 'ui/nav-players.webp', scout: 'ui/nav-scout.webp',
  manage: 'ui/nav-facility.webp', records: 'ui/nav-records.webp',
}

export function useBottomNavVisible(screen: CareerScreen): boolean {
  return NAV_SCREENS.includes(screen)
}

export function BottomNav() {
  const screen = useCareer((s) => s.screen)
  const go = useCareer((s) => s.go)
  const c = useCareer((s) => s.career)
  if (!c || !NAV_SCREENS.includes(screen)) return null

  // ロック中タブも表示（グレー＋🔒）＝「これから増える」と視覚的に伝え、序盤の離脱を防ぐ。
  const tabs: { scr: CareerScreen; label: string; locked: boolean }[] = [
    { scr: 'weekly', label: 'ホーム', locked: false },
    { scr: 'roster', label: '選手', locked: false },
    { scr: 'scout', label: 'スカウト', locked: c.scouting.level <= 0 || !featureUnlocked('scouting', c.year, c.week) },
    { scr: 'manage', label: '設備', locked: !featureUnlocked('facilities', c.year, c.week) },
    { scr: 'records', label: '記録', locked: false },
  ]

  return (
    <nav style={{
      flexShrink: 0, // 枠(.frame)の最下段に常駐＝PCのウィンドウ下端でもスマホ画面下端でも枠に収まる
      display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
      background: 'rgba(255,255,255,0.97)', borderTop: '1px solid var(--card-edge)',
      boxShadow: '0 -3px 14px rgba(70,50,30,0.12)', zIndex: 6,
    }}>
      {tabs.map((t) => {
        const active = screen === t.scr
        return (
          <button key={t.scr} onClick={() => { if (!t.locked) go(t.scr) }} disabled={t.locked} title={t.locked ? 'まだ解放されていません（進めると解放）' : t.label}
            style={{
              flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
              background: 'none', border: 'none', cursor: t.locked ? 'default' : 'pointer', padding: '5px 2px 5px', minHeight: 52,
              color: t.locked ? 'var(--ink-dim)' : active ? 'var(--orange-deep)' : 'var(--ink-dim)',
              borderTop: active && !t.locked ? '2px solid var(--orange-deep)' : '2px solid transparent', marginTop: -1,
              opacity: t.locked ? 0.45 : 1,
            }}>
            {/* 選択タブ＝フルカラー＋少し拡大、非選択＝減色＋半透明。ロックは更に淡く＋🔒。 */}
            <img src={asset(NAV_ICON[t.scr])} alt="" style={{
              width: 26, height: 26, objectFit: 'contain', transition: 'all 0.15s ease',
              filter: t.locked ? 'grayscale(1)' : active ? 'none' : 'grayscale(0.5)', opacity: t.locked ? 0.7 : active ? 1 : 0.6, transform: active && !t.locked ? 'scale(1.08)' : 'none',
            }} />
            {t.locked && <span style={{ position: 'absolute', top: 2, right: '50%', marginRight: -16, fontSize: 12 }}>🔒</span>}
            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
