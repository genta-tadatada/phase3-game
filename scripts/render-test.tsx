// 描画安全性: 全画面を react-dom/server で文字列化し、レンダリング時の
// クラッシュ（undefinedアクセス等）を検出する。ロジックテストでは拾えない
// UIのランタイムエラーを捕捉する。
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { CareerApp } from '../src/components/career/CareerApp'
import { useCareer, type CareerScreen } from '../src/store/careerStore'
import { playerMatchIndex } from '../src/lib/tournament'

let fail = 0
function render(label: string) {
  try {
    const html = renderToString(createElement(CareerApp))
    if (!html || html.length < 10) throw new Error('空の描画')
    console.log(`  ✅ ${label}`)
  } catch (e) {
    console.log(`  ❌ ${label}: ${(e as Error).message}`)
    fail++
  }
}

console.log('=== 描画安全性テスト ===')

// タイトル
useCareer.setState({ screen: 'title', career: null })
render('title (セーブなし)')

// 新規キャリア → 各画面
useCareer.getState().newCareer('描画検証高', '東京都')
const screens: CareerScreen[] = ['weekly', 'roster', 'tactics', 'lineup', 'positions', 'scout', 'manage', 'records', 'summary', 'squad', 'intake']
for (const s of screens) {
  useCareer.setState({ screen: s })
  render(s)
}

// 数年進めてスカウト・記録が充実した状態でも描画
for (let i = 0; i < 3; i++) {
  // 大会を挟まずに年度をまたぐため、weeklyでfastForwardしつつcompを消化
  let guard = 0
  while (useCareer.getState().screen !== 'summary' && guard++ < 200) {
    const st = useCareer.getState()
    if (st.screen === 'weekly') st.fastForward()
    else if (st.screen === 'comp-bracket') {
      playerMatchIndex(st.comp!.tournament) >= 0 ? st.startCompMatch() : st.continueAfterComp()
    } else if (st.screen === 'comp-match') st.finishCompMatch()
    else if (st.screen === 'comp-result') st.continueAfterComp()
    else break
  }
  useCareer.setState({ screen: 'summary' }); render(`summary (${useCareer.getState().career!.year}年目)`)
  useCareer.getState().dismissSummary()
}

// スカウト解禁後の scout 画面（候補あり）
useCareer.setState({ screen: 'scout' }); render(`scout (Lv${useCareer.getState().career!.scouting.level}・候補${useCareer.getState().career!.scouting.candidates.length})`)
useCareer.setState({ screen: 'roster' }); render(`roster (${useCareer.getState().career!.roster.length}人)`)
useCareer.setState({ screen: 'records' }); render('records (履歴あり)')

// 大会画面（bracket/match/result）
{
  // weeklyからfastForwardで大会へ
  let guard = 0
  useCareer.setState({ screen: 'weekly' })
  while (useCareer.getState().screen !== 'comp-bracket' && guard++ < 200) {
    const st = useCareer.getState()
    if (st.screen === 'weekly') st.fastForward()
    else if (st.screen === 'summary') st.dismissSummary()
    else break
  }
  if (useCareer.getState().screen === 'comp-bracket') {
    render('comp-bracket')
    useCareer.getState().startCompMatch()
    render('comp-match')
    useCareer.getState().finishCompMatch()
    render(`comp-${useCareer.getState().screen}`)
  }
}

console.log(fail === 0 ? '\n✅ 全画面が例外なく描画（UIランタイム健全）' : `\n❌ ${fail}画面で描画エラー`)
process.exit(fail === 0 ? 0 : 1)
