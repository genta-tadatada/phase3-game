// 既定＝本番フル版（キャリアモード）。?mvp を付けるとMVP（クイック大会）を表示。
import { useEffect } from 'react'
import { CareerApp } from './components/career/CareerApp'
import { GameShell } from './components/GameShell'
import { useGame } from './store/gameStore'
import { useCareer } from './store/careerStore'
import { useAuth } from './store/authStore'
import { TitleScreen } from './components/TitleScreen'
import { SquadScreen } from './components/SquadScreen'
import { TacticsScreen } from './components/TacticsScreen'
import { BracketScreen } from './components/BracketScreen'
import { MatchScreen } from './components/MatchScreen'
import { EndScreen } from './components/EndScreen'

// 🛠 devサーバ限定の検証ブート: ?festival で使い捨てキャリアを文化祭2週間前(week26)で起動する（G-45）。
//    「週を進める」2回で week28 の文化祭イベント（準備選択→当日→恋の噂）が確認でき、前後の通常週も見られる。
//    ?festival=123 のようにシード指定で再現可。セーブは disableSave() で無効化済み＝本物のセーブに触れない。
function DebugFestivalBoot({ seed }: { seed: number | undefined }) {
  useEffect(() => { useCareer.getState().debugStartFestival(seed) }, [seed])
  return null
}

// 🛠 devサーバ限定の検証ブート: ?selection で使い捨てキャリアを3月第1週(week45)・セレクションON・評判60で起動する。
//    「週を進める」で 卒業(week46)→年度末(week48)→年度替わりにセレクション画面（応募者から合格者を選ぶ）が出る。
//    ?selection=123 のようにシード指定で再現可。セーブは disableSave() で無効化済み＝本物のセーブに触れない。
function DebugSelectionBoot({ seed }: { seed: number | undefined }) {
  useEffect(() => { useCareer.getState().debugStartSelection(seed) }, [seed])
  return null
}

// 起動時に1回だけアカウント状態を確認する（本番キャリアモードのみ）。
// ログインは任意＝未ログインでもそのまま遊べる。失敗時は静かに「未ログイン」扱い。
function AuthBoot() {
  useEffect(() => { void useAuth.getState().init() }, [])
  return null
}

function MvpApp() {
  const screen = useGame((s) => s.screen)
  switch (screen) {
    case 'title': return <TitleScreen />
    case 'squad': return <SquadScreen />
    case 'tactics': return <TacticsScreen />
    case 'bracket': return <BracketScreen />
    case 'match': return <MatchScreen />
    case 'end': return <EndScreen />
    default: return <TitleScreen />
  }
}

export function App() {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  // 🛠 devビルド限定（本番では無効）: 旧お試し版（クイック大会編）。公開後に ?mvp で起動できると
  //    ①EndScreenの「フル版では実装予定」文言が虚偽になる ②MVPの成績が本編の通算成績に混ざる
  //    ③QA対象外の隠し経路になる、の3点が問題なので ?festival と同じくDEVゲートに揃える。
  if (import.meta.env.DEV && params?.has('mvp')) return <MvpApp />
  // devビルド限定（本番では無効）: ?festival で文化祭週イベント、?selection で入部セレクションを即検証
  const festivalDebug = import.meta.env.DEV && params?.has('festival')
  const festivalSeedRaw = festivalDebug ? params!.get('festival') : null
  const festivalSeed = festivalSeedRaw && /^\d+$/.test(festivalSeedRaw) ? Number(festivalSeedRaw) : undefined
  const selectionDebug = import.meta.env.DEV && !festivalDebug && params?.has('selection')
  const selectionSeedRaw = selectionDebug ? params!.get('selection') : null
  const selectionSeed = selectionSeedRaw && /^\d+$/.test(selectionSeedRaw) ? Number(selectionSeedRaw) : undefined
  return (
    <GameShell>
      <AuthBoot />
      {festivalDebug && <DebugFestivalBoot seed={festivalSeed} />}
      {selectionDebug && <DebugSelectionBoot seed={selectionSeed} />}
      <CareerApp />
    </GameShell>
  )
}
