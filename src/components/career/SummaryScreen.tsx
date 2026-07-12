import { useCareer } from '../../store/careerStore'
import { Confetti, CountUp } from '../../ui/celebrate'
import { asset } from '../../ui/asset'
import { playerOverallSum } from '../../engine/match/teamQuality'
import { overallLabel, POSITION_LABEL } from '../../lib/labels'
import { isProDestiny } from '../../career/types'

// #53 進路ラダーの表示スタイル（海外プロは特別）
const DESTINY_STYLE: Record<string, { icon: string; color: string }> = {
  'pro-overseas': { icon: '🌍', color: 'var(--orange-deep)' },
  'pro-d1': { icon: '⭐', color: 'var(--orange-deep)' },
  'pro-d2': { icon: '⭐', color: 'var(--orange-deep)' },
  'pro-d3': { icon: '⭐', color: 'var(--orange-deep)' },
  'semi-pro': { icon: '🎓', color: 'var(--good)' },
  'univ-soccer': { icon: '🎓', color: 'var(--ink-soft)' },
  retire: { icon: '💼', color: 'var(--ink-dim)' },
}

export function SummaryScreen() {
  const c = useCareer((s) => s.career)
  const dismiss = useCareer((s) => s.dismissSummary)
  if (!c) return null
  const lastHistory = c.records.history[c.records.history.length - 1]
  const grads = [...c.lastGraduates].sort((a, b) => b.overall - a.overall)
  const proCount = grads.filter((g) => isProDestiny(g.destiny)).length
  const labels = `${lastHistory?.summer ?? ''}${lastHistory?.winter ?? ''}`
  const champion = /優勝/.test(labels)
  const wentNational = /全国/.test(labels)
  const celebrated = proCount > 0 || champion || wentNational
  // 今年のエース（育成の成果＝最も能力の高い在籍選手）を称える
  const ace = c.roster.length ? [...c.roster].sort((a, b) => playerOverallSum(b) - playerOverallSum(a))[0] : null

  return (
    <div className="screen" style={{ position: 'relative' }}>
      {celebrated && <Confetti count={champion ? 70 : 50} />}
      <div className="app-title">シーズン終了</div>
      <h1 className="h1 center">{c.year - 1}年目を終えて</h1>

      {/* コーチの一言 */}
      <div className="mascot-row">
        <img className="mascot-img" src={asset(`mascot/${celebrated ? 'coach-happy' : 'coach'}.webp`)} alt="" />
        <div className="bubble">
          {proCount > 0
            ? `今年は${proCount}人をプロへ送り出した…！監督、胸を張れ。これが育成の到達点だ。`
            : champion
              ? '全国制覇——よくやった！この景色を、選手たちと掴んだんだ。'
              : wentNational
                ? '全国の舞台に立てた。大きな一歩だ。来年はもっと上へ行こう。'
                : grads.length > 0
                  ? `また${grads.length}人が巣立っていったな。彼らの土台を作ったのは間違いなく君だ。`
                  : '新しいシーズンが始まる。さあ、今年もいいチームを作ろう。'}
        </div>
      </div>

      <div className="cols c2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lastHistory && (
            <div className="panel">
              <div className="section-label" style={{ marginBottom: 6 }}>📊 {lastHistory.year}年目の成績</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                夏季大会: <b>{lastHistory.summer}</b><br />
                冬季大会: <b>{lastHistory.winter}</b><br />
                シーズン終了時の評判: <b>{lastHistory.reputationEnd}</b>
              </div>
            </div>
          )}

          {c.lastBudget && (
            <div className="panel">
              <div className="section-label" style={{ marginBottom: 6 }}>💰 今年度の収支{c.lastBudget.deficit ? ' ・財政難！' : ''}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
                <div style={{ color: 'var(--good, #2e9e5b)' }}>収入 +{c.lastBudget.income.total}<span className="dim" style={{ fontSize: 11 }}>（予算{c.lastBudget.income.allocation}・部費{c.lastBudget.income.fees}・寄付{c.lastBudget.income.donations}{c.lastBudget.income.subsidy ? `・補助${c.lastBudget.income.subsidy}` : ''}）</span></div>
                <div style={{ color: 'var(--bad)' }}>支出 -{c.lastBudget.expense.total}<span className="dim" style={{ fontSize: 11 }}>（維持{c.lastBudget.expense.upkeep}・運営{c.lastBudget.expense.operating}{c.lastBudget.expense.salaries ? `・年俸${c.lastBudget.expense.salaries}` : ''}{c.lastBudget.expense.recruiting ? `・勧誘${c.lastBudget.expense.recruiting}` : ''}）</span></div>
                <div style={{ fontWeight: 800, marginTop: 2, color: c.lastBudget.net >= 0 ? 'var(--good, #2e9e5b)' : 'var(--bad)' }}>収支 {c.lastBudget.net >= 0 ? '+' : ''}{c.lastBudget.net} → 予算残 {c.budget}万</div>
                {c.lastBudget.deficit && <div className="dim" style={{ fontSize: 11, color: 'var(--bad)' }}>支出超過でチームの雰囲気が下がった。設備・部員・スタッフの規模を見直そう。</div>}
              </div>
            </div>
          )}

          {ace && (
            <div className="panel">
              <div className="section-label" style={{ marginBottom: 4 }}>⭐ 今年のエース</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  <span className="dim" style={{ fontSize: 11 }}>{POSITION_LABEL[ace.slot ?? ace.position]}</span> {ace.name}
                </div>
                <div style={{ color: 'var(--orange-deep)', fontWeight: 800 }}>{overallLabel(playerOverallSum(ace)).label}<span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>{Math.round(playerOverallSum(ace) / 7)}</span></div>
              </div>
              <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>君の育成が、この選手をここまで伸ばした。</div>
            </div>
          )}

          <div className="panel tint-orange">
            <div className="section-label" style={{ marginBottom: 6 }}>🏅 通算記録</div>
            <div className="row center">
              <div><div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-num)' }}><CountUp value={c.records.summerTitles + c.records.winterTitles} /></div><div className="dim" style={{ fontSize: 11 }}>優勝</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-num)' }}><CountUp value={c.records.graduates} /></div><div className="dim" style={{ fontSize: 11 }}>卒業生</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange-deep)', fontFamily: 'var(--font-num)' }}><CountUp value={c.records.proPlayers} /></div><div className="dim" style={{ fontSize: 11 }}>プロ輩出</div></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grads.length > 0 && (
            <div className="panel">
              <img src={asset('events/graduation.webp')} alt="" className="pop-in" style={{ width: 130, display: 'block', margin: '0 auto 4px', filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.16))' }} />
              <div className="section-label" style={{ marginBottom: 8 }}>🎓 卒業生の進路</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grads.map((g, i) => {
                  const st = DESTINY_STYLE[g.destiny] ?? DESTINY_STYLE.retire
                  const isPro = isProDestiny(g.destiny)
                  return (
                    <div key={i} className="float-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 9px', borderRadius: 10, background: isPro ? 'var(--orange-pastel)' : 'rgba(74,64,54,0.04)' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13 }}>
                        <span className="dim" style={{ fontSize: 11 }}>{g.position}</span> <b>{g.name}</b>
                      </span>
                      <span style={{ color: st.color, fontWeight: isPro ? 800 : 600, flexShrink: 0, fontSize: 12.5 }}>
                        {st.icon} {g.destinyLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="panel tint-green">
        <div style={{ fontWeight: 800, color: 'var(--green-deep)' }}>🌱 {c.year}年目が始まる</div>
        <p className="dim" style={{ fontSize: 13, lineHeight: 1.7, marginTop: 4 }}>{c.pendingEvents[0]?.body || '新しい一年が動き出す。今年のチームを、一歩ずつつくっていこう。'}</p>
      </div>

      <div className="footer-cta">
        <button className="btn" onClick={dismiss}>{c.year}年目へ ▶</button>
      </div>
    </div>
  )
}
