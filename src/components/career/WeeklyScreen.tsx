import { useEffect, useState } from 'react'
import { useCareer } from '../../store/careerStore'
import { EventBubble } from './EventBubble'
import { HowToPlay } from './HowToPlay'
import { useTutorial, tutorialDone } from '../../store/tutorialStore'
import { asset } from '../../ui/asset'
import { PracticePlanner } from './PracticePlanner'
import { featureUnlocked } from '../../career/unlocks'
import { SUMMER_QUALIFY_WEEK, SUMMER_NATIONAL_WEEK, SUMMER_CAMP_WEEK, WINTER_QUALIFY_WEEK, WINTER_NATIONAL_WEEK, FESTIVAL_WEEK } from '../../career/calendar'
import { WEEKS_PER_YEAR } from '../../career/types'
import { WEATHER_ICON_IMG, type Weather } from '../../career/weather'
import { careerToTeam } from '../../career/lineup'
import { RankBadge } from '../shared'
import { playerOverallSum } from '../../engine/match/teamQuality'

export function WeeklyScreen() {
  const c = useCareer((s) => s.career)
  const plan = useCareer((s) => s.plan)
  const setWeekend = useCareer((s) => s.setWeekend)
  const setPracticeOpponent = useCareer((s) => s.setPracticeOpponent)
  const setManagerAction = useCareer((s) => s.setManagerAction)
  const setMeetingTargets = useCareer((s) => s.setMeetingTargets)
  const advance = useCareer((s) => s.advance)
  const resolveEvent = useCareer((s) => s.resolveEvent)
  const go = useCareer((s) => s.go)
  const [showHelp, setShowHelp] = useState(false)
  const tutStep = useTutorial((s) => s.step)
  const tutStart = useTutorial((s) => s.start)
  const ev = c?.pendingEvents[0]
  // 初回起動チュートリアル（創部イベントを閉じてイベントが無くなったら1度だけ自動起動）。
  // 操作（練習・週送り）の説明＝ゲームシステムの基本なので初心者・経験者の両方に出す(#13)。
  // サッカーの基礎用語は init.ts の「🔰はじめに」イベントで初心者のみに案内する。
  useEffect(() => { if (c && !tutorialDone() && !ev && tutStep < 0) tutStart() }, [c, ev, tutStep, tutStart])
  // #62: 3年引退後の翌週 → 新キャプテン選択画面へ強制遷移（pendingEventsを片付け終わってから）。
  useEffect(() => { if (c?.pendingCaptainChoice && !ev) go('new-captain') }, [c?.pendingCaptainChoice, ev, go])
  if (!c) return null

  const team = careerToTeam(c)
  const teamSum = team.players.slice(0, 11).reduce((s, p) => s + playerOverallSum(p), 0) / 11

  // 次の節目まで。夏大会→合宿→冬大会→新入部員入部→（翌年）夏大会…の周期で「次に来るもの」を出す。
  // 県予選を突破済み(pendingNational)なら次は全国（後日開催・#11）。
  const W = c.week
  const nextComp: { label: string; w: number; icon: string; isMatch: boolean } =
      c.pendingNational === 'summer' ? { label: '夏季全国', w: SUMMER_NATIONAL_WEEK - W, icon: '🏆', isMatch: true }
    : c.pendingNational === 'winter' ? { label: '冬季全国', w: WINTER_NATIONAL_WEEK - W, icon: '🏆', isMatch: true }
    : W < SUMMER_QUALIFY_WEEK ? { label: '夏季県予選', w: SUMMER_QUALIFY_WEEK - W, icon: '⚽', isMatch: true }
    : W < SUMMER_CAMP_WEEK ? { label: '夏合宿', w: SUMMER_CAMP_WEEK - W, icon: '🏕', isMatch: false }          // 夏大会後→合宿まで
    : W < FESTIVAL_WEEK && c.year >= 1 ? { label: '文化祭', w: FESTIVAL_WEEK - W, icon: '🎪', isMatch: false } // 合宿後→文化祭まで (年1以降)
    : W < WINTER_QUALIFY_WEEK ? { label: '冬季県予選', w: WINTER_QUALIFY_WEEK - W, icon: '⚽', isMatch: true } // 文化祭後→冬大会まで
    : { label: '新入部員入部', w: (WEEKS_PER_YEAR - W) + 1, icon: '🌸', isMatch: false }                        // 冬大会後→入部（翌年）まで
  // 試合（大会）が近いときだけスタメン・戦術の準備を促す（合宿・入部は試合ではない）。
  const matchSoon = nextComp.isMatch && nextComp.w <= 2
  const tired = c.roster.filter((p) => p.fatigue >= 70).length
  // 段階的機能解放（#29）：未解放の機能はUIに出さない（年2以降はすべて解放）
  const unlocked = (f: Parameters<typeof featureUnlocked>[0]) => featureUnlocked(f, c.year, c.week)

  return (
    <div className="screen">
      {/* イベントは前面の吹き出し＋イラストで表示 */}
      {ev && <EventBubble ev={ev} onResolve={resolveEvent} />}
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      {/* 成長モーダルは CareerApp でグローバル表示（公式戦後も出すため）。 */}

      {/* 一目で今の状況：次の大会まで・総合力・天候・疲労（情報の散在を解消＝意思決定を速く） */}
      <div className="panel tint-orange" style={{ padding: '8px 12px', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 12.5 }}>{nextComp.icon} {nextComp.label}</span>
            <span style={{ fontWeight: 900, fontSize: 19, color: 'var(--orange-deep)', fontFamily: 'var(--font-num)' }}>あと{nextComp.w}週</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {c.weather && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 700 }}>
              <img src={asset(WEATHER_ICON_IMG[c.weather as Weather])} alt="" style={{ width: 19, height: 19 }} />{c.weather}
            </span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span className="dim" style={{ fontSize: 11, fontWeight: 800 }}>チーム力</span>
              <RankBadge sum={teamSum} full kind="school" />
            </span>
            {tired > 0 && <span className="tag" style={{ background: tired >= 5 ? '#ffe0e0' : 'var(--orange-pastel)', color: tired >= 5 ? 'var(--bad)' : 'var(--orange-edge)' }}>😓 疲労{tired}人</span>}
          </div>
        </div>
        {c.pendingNational && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange-deep)', marginTop: 4 }}>🎉 県予選突破！全国までに疲労を抜き、戦術を仕上げよう。</div>}
      </div>

      <div className="cols c2-31">
        {/* === 左: 今週の練習 === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div data-tut="train-slots">
            <PracticePlanner />
          </div>

          {unlocked('weekend') && <>
          <h2 className="h2" style={{ marginTop: 2 }}>週末</h2>
          <div className="chip-row">
            {([['rest', '完全休養'], ['practice-match', '練習試合'], ['extra-training', '追加練習']] as const).map(([v, t]) => (
              <button key={v} className={`chip ${plan.weekend === v ? 'active' : ''}`} onClick={() => setWeekend(v)}>{t}</button>
            ))}
          </div>
          {/* 練習試合は相手の強さを事前に選ぶ（#22c）。格上は負けやすいが手応え＝雰囲気が大きく上がる。 */}
          {plan.weekend === 'practice-match' && (
            <div style={{ margin: '6px 0 2px' }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>対戦相手の強さ</div>
              <div className="chip-row">
                {([['weak', '格下校'], ['even', '互角校'], ['strong', '格上校']] as const).map(([v, t]) => (
                  <button key={v} className={`chip ${(plan.practiceOpponent ?? 'even') === v ? 'active' : ''}`} onClick={() => setPracticeOpponent(v)}>{t}</button>
                ))}
              </div>
            </div>
          )}
          <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            {plan.weekend === 'rest' ? '疲労を大きく回復（-25）＋調子が上向く。雰囲気も少し上がる。'
              : plan.weekend === 'practice-match' ? '出場選手の能力が全体的に少し伸びる（特に苦手が埋まる）。相手が強い・勝つほど得るものが大きい。先発は試合勘（調子）も上がるが疲労+10。'
              : '練習①をもう一度行い追加で成長。ただし詰め込みで雰囲気-1。'}
          </div>
          </>}

          {unlocked('manager') && <>
          <h2 className="h2" style={{ marginTop: 2 }}>監督アクション <span className="dim" style={{ fontSize: 11, fontWeight: 600 }}>週1回・どれか1つ</span></h2>
          <div className="chip-row">
            <button className={`chip ${!plan.managerAction ? 'active' : ''}`} onClick={() => setManagerAction(null)}>なし</button>
            <button className={`chip ${plan.managerAction === 'meeting' && !plan.meetingTarget ? 'active' : ''}`} onClick={() => setManagerAction('meeting', null)}>🗣 全体ミーティング</button>
            <button className={`chip ${plan.managerAction === 'meeting' && !!plan.meetingTarget ? 'active' : ''}`} onClick={() => setManagerAction('meeting', plan.meetingTarget ?? c.roster.find((p) => !p.retired)?.id ?? null)}>🧑‍🏫 個別面談</button>
            {c.scouting.level > 0 && (
              <button className={`chip ${plan.managerAction === 'scout' ? 'active' : ''}`} onClick={() => setManagerAction('scout')}>🔍 スカウト視察</button>
            )}
          </div>
          {plan.managerAction === 'meeting' && plan.meetingTarget && (() => {
            // G-41 §4 (Q-001 B案): 部室Lvに応じた複数面談。Lv1=1人/Lv2-3=2人/Lv4+=3人。
            const cap = c.facilities.clubhouse >= 4 ? 3 : c.facilities.clubhouse >= 2 ? 2 : 1
            const current: string[] = plan.meetingTargets && plan.meetingTargets.length > 0
              ? plan.meetingTargets
              : (plan.meetingTarget ? [plan.meetingTarget] : [])
            const active = c.roster.filter((p) => !p.retired)
            const setNth = (i: number, id: string) => {
              const next = [...current]
              next[i] = id
              setMeetingTargets(next.slice(0, cap).filter(Boolean))
            }
            const removeNth = (i: number) => {
              const next = current.filter((_, idx) => idx !== i)
              setMeetingTargets(next)
            }
            const canAdd = current.length < cap && active.length > current.length
            const firstUnused = active.find((p) => !current.includes(p.id))?.id ?? null
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {current.map((id, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select className="input" style={{ padding: '8px 10px', fontSize: 14, flex: 1 }} value={id}
                      onChange={(e) => setNth(i, e.target.value)}>
                      {active.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.slot ?? p.position}）</option>)}
                    </select>
                    {current.length > 1 && (
                      <button className="btn ghost sm" style={{ flex: '0 0 36px', padding: '6px 0' }}
                        onClick={() => removeNth(i)} aria-label="この対象を外す">×</button>
                    )}
                  </div>
                ))}
                {canAdd && firstUnused && (
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start', padding: '6px 12px' }}
                    onClick={() => setMeetingTargets([...current, firstUnused])}>+ 対象を追加（あと{cap - current.length}人）</button>
                )}
                <div className="dim" style={{ fontSize: 11 }}>
                  部室Lv{c.facilities.clubhouse} → 同時に最大 {cap} 人まで面談できる
                </div>
              </div>
            )
          })()}
          <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>全体＝チームの雰囲気↑（高いほど効果小）。個別＝その選手の調子↑・疲労回復。視察＝スカウトSP↑。練習・休養とは別の「人と戦略」の判断。</div>
          </>}
        </div>

        {/* === 右: ナビ・助言 === */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* コア動線：戦術・スタメンを最優先（大会2週前は強調）。解放後に表示（#29） */}
          {unlocked('lineup') && (
            <button className={`btn ${matchSoon ? '' : 'secondary'} sm`} data-tut="nav-lineup" style={{ width: '100%' }} onClick={() => go('lineup')}>
              ⚽ {unlocked('tactics') ? '戦術・スタメン' : 'スタメン'}{matchSoon ? '（大会直前！確認を）' : ''}
            </button>
          )}
          {/* 選手/スカウト/設備/記録は下タブへ移動。ここはサブ画面（ポジ/編成）とヘルプのみ。 */}
          {(unlocked('position-change')) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <button className="btn ghost sm" data-tut="nav-positions" onClick={() => go('positions')}>📍 ポジション</button>
              <button className="btn ghost sm" onClick={() => go('squad')}>📋 編成</button>
            </div>
          )}
          {/* 初回ガイドは創部1週目に自動で起動する（L33の useEffect）。
              手動ボタンは「2週目以降押しても即終了する」死に機能だったため削除（2026-06-28）。 */}
          <button className="btn ghost sm" style={{ width: '100%', fontSize: 12.5 }} onClick={() => setShowHelp(true)}>❔ 遊び方</button>

          {/* 監督補佐のひとこと（状況に応じた助言＋戦略を教える週替わりヒント）＋ 部のうごき */}
          {(() => {
            const warn = tired >= 5 || c.atmosphere < 40
            // F9: 一言アドバイス改善。週替わりで「次の一手」を具体的に示すヒント。
            //     重複削除＋実プレイの判断材料になる具体性（数値・ボタン名・優先度）を含む。
            const TIPS = [
              '⚽ 試合では「一番低い能力」が壁になる。武器は練習でとことん伸ばして、穴は実戦で塞ぐ。両輪で回すのが一番強くなるな。',
              '🏃 練習・試合・休養のリズムは大事だ。同じメニューを続けすぎると選手たちも飽きてくる。たまには違うことをやらせよう。',
              '🌦 天気でその日に伸びる能力が変わる。雨の日は技術や判断力、夏は走力、雪なら踏ん張る力——練習を天気に合わせると無駄がない。',
              '🌏 地元の気候に慣れている選手は、その天候の試合で本来の力を出しやすい。雪国なら冬、南国なら夏、雨の多い土地なら雨の試合だな。',
              '📍 まず本職どおりに並べてみよう。「おすすめ配置」を押せば自動でやってくれる。コンバートは1年目の終わりから検討すればいい。',
              '🏗 設備にお金を回すなら、まずは練習設備（メニューと枠が増える）、次にグラウンド（伸びと到達点が変わる）。賞金は寝かせず使うのが鉄則だ。',
              '🌬 雰囲気が良いと練習も試合も伸びる。ムードメーカーやリーダーは積極的に使い、問題児は同じ組に集めないこと。',
              '🔍 試合前は必ず相手を偵察しよう。布陣と警戒すべき選手が分かる。相手の出方に合わせて姿勢を少し攻撃寄り・守備寄りに変えるだけで、流れがこっちに来る。',
              '⏱ ハーフタイムは監督の見せ場だ。負けてるなら攻めに出る、勝ってるなら守りを固める——迷わずに決めよう。',
              '⚡ 同じ系統の特殊能力を2つ持つ選手は、ふとした瞬間に最上級の力（虹色の表示）を発揮することがある。スカウトで素材を集めておくと面白い。',
              '🔵 選手の総合値を上げて「代表候補」レベルまで育てると、年代別代表に呼ばれることがある。代表を経験した選手はプロへの道もぐっと近くなる。',
              '🏆 まずは全国だ。プロ入りはその先のさらに上、3年に1人輩出できれば監督として大成功と言っていい。',
              '👥 部員が増えればB・Cチームを練習試合に出せる。控え組が伸びれば、大会の連戦も乗り切れるチームになる。',
              '🥅 GKはフィールドの選手とは別の能力で動いている。専用メニューで集中して鍛えると、守備が一気に落ち着くぞ。',
              '👤 性格は成長にも試合にも効く。誰を中心に据えるか、誰を組ませるかで、チームの空気はがらりと変わる。詳細画面で各選手の特徴を見ておこう。',
              '💴 部の評判が上がると、いい選手が向こうから来てくれるようになる。勝つこと、育てること——両方が回り始めると一気に強くなれる。',
              '🛌 疲労が溜まった選手は試合で本来の力を出せない。完全休養を挟んでコンディションを整えてやろう。',
              '🎯 大会前の練習試合で対戦相手のレベルを選んでおくと、本番の手応えに近い形で実戦感覚を磨ける。',
            ]
            const advice = tired >= 5 ? '疲労がたまっている選手が多い。完全休養を挟んで調整しよう。'
              : c.atmosphere < 40 ? 'チームの雰囲気が低め。全体ミーティングで立て直したい。'
              : matchSoon ? `まもなく${nextComp.label}。スタメンと戦術、相手の偵察を確認しておこう。`
              : nextComp.isMatch === false && nextComp.w <= 1 ? `まもなく${nextComp.label}。`
              : (c.scouting.level === 0 && c.year === 1) ? 'まずは目の前の選手を育てよう。スカウトは2年目から解禁。'
              : `💡 ${TIPS[(c.year * 48 + c.week) % TIPS.length]}`
            return (
              <div className="panel" style={{ padding: '10px 12px' }}>
                <div className="mascot-row">
                  <img className="mascot-img" src={asset(`mascot/${warn ? 'coach-sad' : 'coach'}.webp`)} alt="" style={{ width: 56, height: 56 }} />
                  <div className="bubble">{advice}</div>
                </div>
                {c.log.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="section-label" style={{ marginBottom: 5 }}>📰 部のうごき</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {c.log.slice(0, 3).map((l, i) => <div key={i} className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>・{l}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </aside>
      </div>

      <div className="footer-cta">
        <button className="btn" data-tut="advance-btn" onClick={advance}>▶ 1週間すすめる</button>
      </div>
    </div>
  )
}
