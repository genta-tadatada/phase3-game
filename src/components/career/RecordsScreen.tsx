import { useCareer } from '../../store/careerStore'
import { loadHallOfFame } from '../../career/hallOfFame'
import { reputationTierName } from '../../lib/labels'
import { ACHIEVEMENTS } from '../../data/achievements'
import { getAccount, unlockedIcons, unlockedTitles } from '../../lib/account'
import { AccountRecordsCard } from './AccountPanel'

export function RecordsScreen() {
  const c = useCareer((s) => s.career)
  if (!c) return null
  const r = c.records
  const hof = loadHallOfFame() // #55 プレイをまたぐ永続殿堂

  return (
    <div className="screen">
      <div className="app-title">部の歩み</div>
      <h1 className="h1">{c.schoolName} 記録</h1>

      {/* C群(2026-08-17): 記録の保存先をここで伝える。
          未ログインなら「この端末にしか残っていない」→ アカウントを作る理由として提示する。 */}
      <AccountRecordsCard />

      {/* #53 現在の「格」（評判ティア）を常時可視化＝マイルストーンが見える */}
      <div className="panel tint-orange center" style={{ marginBottom: 10, padding: '8px 12px' }}>
        <div className="dim" style={{ fontSize: 11 }}>現在の格</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--orange-deep)', marginTop: 1 }}>{reputationTierName(c.reputation)}</div>
        <div className="dim" style={{ fontSize: 11, marginTop: 1 }}>評判 {c.reputation} / 100</div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row center">
          <div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{r.summerTitles + r.winterTitles}</div><div className="dim" style={{ fontSize: 11 }}>全国制覇</div></div>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{r.nationalApps}</div><div className="dim" style={{ fontSize: 11 }}>全国出場</div></div>
          <div><div style={{ fontSize: 22, fontWeight: 800 }}>{r.graduates}</div><div className="dim" style={{ fontSize: 11 }}>卒業生</div></div>
        </div>
        {r.bestPlayerName && (
          <div className="center dim" style={{ fontSize: 12, marginTop: 8 }}>
            近年の中心選手: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{r.bestPlayerName}</span>
          </div>
        )}
      </div>

      {/* 🏅 実績（アカウント永続・はじめからでも残る） */}
      {(() => {
        const acc = getAccount()
        const icons = unlockedIcons(), titles = unlockedTitles()
        const n = Object.keys(acc.achievements).length
        return (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>🏅 実績 <span style={{ fontFamily: 'var(--font-num)' }}>{n}/{ACHIEVEMENTS.length}</span></div>
            <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>アカウントに永続（「はじめから」でも残る）{titles.length > 0 && <> ・ 称号 <b style={{ color: 'var(--accent)' }}>{titles[titles.length - 1].name}</b></>}{icons.length > 0 && <> ・ アイコン{icons.length}種解禁</>}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {ACHIEVEMENTS.map((a) => {
                const got = !!acc.achievements[a.id]
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, opacity: got ? 1 : 0.4 }}>
                    <span>{got ? '🏅' : '🔒'}</span>
                    <b style={{ minWidth: 132 }}>{a.name}</b>
                    <span className="dim" style={{ fontSize: 11 }}>{a.desc}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* 今季得点ランキング */}
      {(() => {
        const scorers = c.roster.filter((p) => (p.seasonGoals ?? 0) > 0).sort((a, b) => (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0)).slice(0, 5)
        if (scorers.length === 0) return null
        return (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>⚽ 今季得点ランキング</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {scorers.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <span><b style={{ color: 'var(--orange-deep)', marginRight: 6 }}>{i + 1}</b>{p.name}</span>
                  <span style={{ fontWeight: 800, fontFamily: 'var(--font-num)' }}>
                    {p.seasonGoals}<span className="dim" style={{ fontSize: 11, fontWeight: 700 }}> 点</span>
                    {/* 今季出場数を併記（これまで追跡のみで未表示だったデータを活用） */}
                    {(p.seasonApps ?? 0) > 0 && <span className="dim" style={{ fontSize: 11, fontWeight: 700, marginLeft: 6 }}>/ {p.seasonApps}試合</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* 称号（記録から導出・補完R-3） */}
      {(() => {
        const titles = r.summerTitles + r.winterTitles
        const achievements: string[] = []
        if (c.year >= 5) achievements.push('🏗 創部を軌道に乗せた')
        if (c.year >= 15) achievements.push('🏛 一時代を築いた監督')
        if (titles >= 1) achievements.push('🏆 全国初制覇')
        if (titles >= 3) achievements.push('👑 全国の覇者')
        if (titles >= 10) achievements.push('⭐ 不滅の名門')
        if (r.nationalApps >= 10) achievements.push('🎫 全国の常連')
        if (r.proPlayers >= 1) achievements.push('⚽ プロを輩出した')
        if (r.proPlayers >= 5) achievements.push('🌟 プロ製造機')
        if (r.graduates >= 50) achievements.push('🎓 育成の名将')
        if (achievements.length === 0) return null
        return (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>獲得した称号</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {achievements.map((a, i) => (
                <span key={i} style={{ fontSize: 12, fontWeight: 700, background: 'rgba(244,162,97,0.18)', border: '1px solid var(--accent)', borderRadius: 999, padding: '4px 10px' }}>{a}</span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* 歴代ベストイレブン（R-8） */}
      {r.bestEleven && r.bestEleven.length > 0 && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>🏅 歴代ベストイレブン</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['GK', 'CB', 'SB', 'WB', 'CM', 'AM', 'WF', 'CF'].map((pos) => {
              const e = r.bestEleven.find((x) => x.pos === pos)
              if (!e) return null
              return (
                <span key={pos} style={{ fontSize: 11, background: '#faf6ee', border: '1px solid var(--card-edge)', borderRadius: 8, padding: '4px 8px' }}>
                  <b style={{ color: 'var(--accent)' }}>{pos}</b> {e.name}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* 殿堂: 出身プロ */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}>⭐ 出身プロ選手（{r.proPlayers}人）</div>
        {r.proAlumni.length === 0 ? (
          <div className="dim" style={{ fontSize: 12 }}>まだプロ選手は輩出していない。日々の育成の先に、その瞬間は訪れる。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...r.proAlumni].reverse().map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{a.name}</span><span className="dim">{a.year}年度卒</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* #55 歴代の殿堂（全プレイ通算・ローカル保存） */}
      {(hof.pros.length > 0 || hof.champions.length > 0 || hof.careers.length > 0) && (
        <div className="panel tint-orange" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: 'var(--orange-deep)', marginBottom: 6 }}>🏛 歴代の殿堂<span className="dim" style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>全プレイ通算</span></div>
          {hof.careers.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>名キャリア（ベスト5）</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {hof.careers.map((cr, i) => (
                  <div key={cr.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span><b style={{ color: 'var(--accent)', marginRight: 5 }}>{i + 1}</b>{cr.school}</span>
                    <span className="dim">🏆{cr.titles}・{cr.years}年・プロ{cr.proCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {hof.pros.length > 0 && (
            <div>
              <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>歴代の名選手（{hof.pros.length}/23人）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {hof.pros.map((p, i) => (
                  <span key={i} style={{ fontSize: 11, background: '#fff', border: '1px solid var(--card-edge)', borderRadius: 8, padding: '3px 8px' }}>
                    ⭐{p.name}<span className="dim" style={{ marginLeft: 4 }}>{p.school}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* G-32 §8: 殿堂入りマネージャー（MAX 23人・キャリア終了時に登録） */}
          {hof.managers && hof.managers.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>歴代の名マネージャー（{hof.managers.length}/23人）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {hof.managers.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, background: '#fff', border: '1px solid var(--card-edge)', borderRadius: 8, padding: '3px 8px' }}>
                    💼{m.name}<span className="dim" style={{ marginLeft: 4 }}>{m.school}・{m.trait}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 最近のできごと（ニュースログ） */}
      {c.log.length > 0 && (
        <>
          <h2 className="h2">最近のできごと</h2>
          <div className="panel" style={{ marginBottom: 12, padding: '8px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {c.log.slice(0, 10).map((line, i) => (
                <div key={i} className="dim" style={{ fontSize: 12, lineHeight: 1.5 }}>・{line}</div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* シーズン履歴 */}
      <h2 className="h2">シーズン履歴</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {r.history.length === 0 ? (
          <div className="panel dim center">まだ記録がない（1年目進行中）。</div>
        ) : (
          [...r.history].reverse().map((h, i) => (
            <div className="panel" style={{ padding: '8px 12px' }} key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <b>{h.year}年目</b><span className="dim">評判 {h.reputationEnd}</span>
              </div>
              <div className="dim" style={{ fontSize: 12 }}>夏: {h.summer}　／　冬: {h.winter}</div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
