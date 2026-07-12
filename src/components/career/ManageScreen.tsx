import { useCareer } from '../../store/careerStore'
import { FACILITIES, EXTRA_FACILITIES, STAFF, nextUpgradeCost, canUpgrade, MAX_FACILITY_LV, staffHireGate } from '../../career/facilities'
import { OB_INSTRUCTION, obTierUnlocked, obCanRun } from '../../career/obInstruction'
import { SPONSORS, sponsorUnlocked, activeSponsorMonthly } from '../../career/sponsor'
import { computeIncome, computeExpense } from '../../career/economy'
import { createRNG } from '../../engine/rng'
import { MANAGER_TRAIT } from '../../career/manager'
import { ManagerAvatar } from '../../ui/ManagerAvatar'

export function ManageScreen() {
  const c = useCareer((s) => s.career)
  const upgrade = useCareer((s) => s.upgrade)
  const buyExtra = useCareer((s) => s.buyExtra)
  const hireStaff = useCareer((s) => s.hireStaff)
  const toggleSelection = useCareer((s) => s.toggleSelection)
  const runObInstruction = useCareer((s) => s.runObInstruction)
  const signSponsor = useCareer((s) => s.signSponsor)
  if (!c) return null
  // 表示用の収支見込み（寄付の±変動は固定シードで概算表示）
  const inc = computeIncome(c, createRNG(c.year * 7 + 1))
  const exp = computeExpense(c)

  return (
    <div className="screen">
      <div className="app-title">経営</div>
      <h1 className="h1">設備・経営</h1>

      <div className="panel tint-orange" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{c.budget}</div><div className="dim" style={{ fontSize: 11 }}>予算(万)</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--good, #2e9e5b)' }}>+{inc.total}</div><div className="dim" style={{ fontSize: 11 }}>年間収入</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bad)' }}>-{exp.total}</div><div className="dim" style={{ fontSize: 11 }}>年間支出</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: inc.total - exp.total >= 0 ? 'var(--good, #2e9e5b)' : 'var(--bad)' }}>{inc.total - exp.total >= 0 ? '+' : ''}{inc.total - exp.total}</div><div className="dim" style={{ fontSize: 11 }}>収支</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 10, padding: '8px 12px', fontSize: 11, lineHeight: 1.7 }}>
        <div><b>収入</b>　学校予算 {inc.allocation}／部費 {inc.fees}／後援会・OB寄付 {inc.donations}{inc.subsidy ? `／大会補助金 ${inc.subsidy}` : ''}{inc.sponsor ? `／スポンサー ${inc.sponsor}` : ''}</div>
        <div><b>支出</b>　設備維持 {exp.upkeep}／部員運営 {exp.operating}{exp.salaries ? `／スタッフ年俸 ${exp.salaries}` : ''}<span className="dim">（＋勧誘費は実績払い）</span></div>
        <div className="dim" style={{ marginTop: 3 }}>評判が上がると寄付・補助金が増える。部員やスタッフを増やすほど支出も増える＝赤字に注意。</div>
      </div>

      {/* G-44: 📊 年次収支グラフを <details> で折りたたみ化（経営画面の主役は設備投資なので、収支は任意開示に） */}
      {c.budgetHistory && c.budgetHistory.length >= 1 && (() => {
        const hist = c.budgetHistory!
        const W = 300
        const H = 110
        const PAD_L = 8, PAD_R = 8, PAD_T = 10, PAD_B = 18
        const innerW = W - PAD_L - PAD_R
        const innerH = H - PAD_T - PAD_B
        const maxVal = Math.max(...hist.map((h) => Math.max(h.income, h.expense)), 1)
        const minNet = Math.min(...hist.map((h) => h.net), 0)
        const range = maxVal - minNet
        const xAt = (i: number) => PAD_L + (hist.length === 1 ? innerW / 2 : (i / (hist.length - 1)) * innerW)
        const yAt = (v: number) => PAD_T + innerH - ((v - minNet) / Math.max(1, range)) * innerH
        const path = (key: 'income' | 'expense' | 'net') =>
          hist.map((h, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(h[key]).toFixed(1)}`).join(' ')
        const zeroY = yAt(0)
        const last = hist[hist.length - 1]
        return (
          <details className="panel" style={{ marginBottom: 10, padding: '6px 12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
              <span>📊 年次収支（直近{hist.length}年）</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: last.net >= 0 ? 'var(--good, #2e9e5b)' : 'var(--bad, #d04646)' }}>
                {last.year}年: {last.net >= 0 ? '+' : ''}{last.net}万
              </span>
            </summary>
            <div style={{ marginTop: 6 }}>
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="110" style={{ display: 'block' }}>
                {minNet < 0 && (
                  <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="rgba(0,0,0,0.25)" strokeDasharray="2 2" strokeWidth="0.5" />
                )}
                <path d={path('expense')} fill="none" stroke="var(--bad, #d04646)" strokeWidth="1.6" opacity="0.85" />
                <path d={path('income')} fill="none" stroke="var(--good, #2e9e5b)" strokeWidth="1.6" opacity="0.85" />
                <path d={path('net')} fill="none" stroke="var(--accent, #ff9d4d)" strokeWidth="2.2" />
                {hist.map((h, i) => (
                  <g key={i}>
                    {hist.length === 1 && (
                      <>
                        <circle cx={xAt(i)} cy={yAt(h.income)} r="2" fill="var(--good, #2e9e5b)" />
                        <circle cx={xAt(i)} cy={yAt(h.expense)} r="2" fill="var(--bad, #d04646)" />
                      </>
                    )}
                    <circle cx={xAt(i)} cy={yAt(h.net)} r="2" fill="var(--accent, #ff9d4d)" />
                    <text x={xAt(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--ink-soft, #888)">{h.year}年</text>
                  </g>
                ))}
              </svg>
              <div style={{ display: 'flex', gap: 12, fontSize: 10.5, marginTop: 2, justifyContent: 'center' }}>
                <span style={{ color: 'var(--good, #2e9e5b)', fontWeight: 700 }}>● 収入</span>
                <span style={{ color: 'var(--bad, #d04646)', fontWeight: 700 }}>● 支出</span>
                <span style={{ color: 'var(--accent, #ff9d4d)', fontWeight: 700 }}>● 収支</span>
              </div>
            </div>
          </details>
        )
      })()}

      {/* G-41 §11: 🔓 機能解放状況（次の解放まで何が必要か明示） */}
      <div className="panel" style={{ marginBottom: 10, padding: '8px 12px', fontSize: 11, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 800, marginBottom: 3 }}>🔓 機能解放状況</div>
        {(() => {
          const lines: string[] = []
          // Bチーム
          const hasB = (c.staff ?? []).includes('bcoach')
          if (!hasB) {
            const needRoster = Math.max(0, 25 - c.roster.length)
            const needDorm = Math.max(0, 2 - c.facilities.dorm)
            lines.push(`Bチーム: Bチームコーチ雇用 ${needRoster ? `+部員${needRoster}人` : ''}${needDorm ? `+寮Lv${2}以上` : ''}`.replace(/\s+$/, ''))
          }
          // Cチーム
          const hasC = (c.staff ?? []).includes('ccoach')
          if (!hasC) {
            const needRoster = Math.max(0, 45 - c.roster.length)
            const needDorm = Math.max(0, 4 - c.facilities.dorm)
            lines.push(`Cチーム: Cチームコーチ雇用 ${hasB ? '' : '+Bコーチ雇用済'} ${needRoster ? `+部員${needRoster}人` : ''}${needDorm ? `+寮Lv${4}以上` : ''}`.replace(/\s+$/, ''))
          }
          // スカウト主任（年2 week5）
          const hasScoutChief = (c.staff ?? []).includes('scout-chief')
          if (!hasScoutChief) {
            if (c.year < 2 || (c.year === 2 && c.week < 5)) {
              lines.push(`スカウト主任: 年2の5月(week5)以降に雇用可（現在 年${c.year} 週${c.week}）`)
            } else {
              lines.push(`スカウト主任: 採用可（経営画面で雇用）`)
            }
          }
          // 部室Lv効果
          if (c.facilities.clubhouse < 5) {
            lines.push(`部室Lv${c.facilities.clubhouse}→Lv${c.facilities.clubhouse + 1}: 雰囲気平衡点UP${c.facilities.clubhouse >= 2 ? `・マネージャー加入条件改善` : ''}`)
          }
          // スポンサー段階（#72で 30/50/75 → 25/45/70 に緩和）
          if (c.reputation < 100) {
            const nextRep = c.reputation < 10 ? 10 : c.reputation < 25 ? 25 : c.reputation < 45 ? 45 : c.reputation < 70 ? 70 : 100
            lines.push(`スポンサー次段階: 評判${nextRep}（あと${nextRep - c.reputation}）`)
          }
          if (lines.length === 0) return <div className="dim">主要機能は解放済。次は経営の安定運用フェーズ。</div>
          return <div className="dim">{lines.map((l, i) => <div key={i}>・{l}</div>)}</div>
        })()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FACILITIES.map((f) => {
          const lv = c.facilities[f.key]
          const cost = nextUpgradeCost(c, f.key)
          const maxed = lv >= MAX_FACILITY_LV
          const affordable = canUpgrade(c, f.key)
          return (
            <div className="panel" style={{ padding: '10px 12px' }} key={f.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{f.name} <span className="dim" style={{ fontSize: 11 }}>Lv{lv}</span></div>
                  <div className="dim" style={{ fontSize: 11 }}>{f.levelNames[lv - 1]}・{f.effect}</div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: 8 }}>
                  {maxed ? (
                    <span className="dim" style={{ fontSize: 12 }}>MAX</span>
                  ) : (
                    <button className={`btn ${affordable ? '' : 'ghost'}`} style={{ padding: '8px 12px', width: 'auto' }}
                      disabled={!affordable} onClick={() => upgrade(f.key)}>
                      Lv{lv + 1}へ {cost}万
                    </button>
                  )}
                </div>
              </div>
              {!maxed && <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>次Lv: {f.levelNames[lv]}</div>}
            </div>
          )
        })}
      </div>

      <div className="gap-sm" />
      <h2 className="h2">追加設備</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {EXTRA_FACILITIES.map((e) => {
          const owned = c.facilities.extras.includes(e.id)
          const affordable = !owned && c.budget >= e.cost
          return (
            <div className="panel" style={{ padding: '10px 12px' }} key={e.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.name}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{e.desc}</div>
                </div>
                <div style={{ flexShrink: 0, marginLeft: 8 }}>
                  {owned ? <span className="dim" style={{ fontSize: 12 }}>導入済</span>
                    : <button className={`btn ${affordable ? '' : 'ghost'}`} style={{ padding: '8px 12px', width: 'auto' }} disabled={!affordable} onClick={() => buyExtra(e.id)}>{e.cost}万</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* #42 マネージャー（3年目あたり加入・受動効果でチームを支える。立ち絵=ManagerAvatar 手続き生成） */}
      {c.manager && (() => {
        const tr = MANAGER_TRAIT[c.manager.trait]
        return (
          <>
            <div className="gap-sm" />
            <h2 className="h2">マネージャー</h2>
            <div className="panel tint-orange" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <ManagerAvatar manager={c.manager} size={56} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{c.manager.name}<span className="dim" style={{ fontSize: 11, fontWeight: 700, marginLeft: 6 }}>{c.manager.joinedYear}年目〜</span></div>
                <div style={{ color: 'var(--orange-deep)', fontWeight: 800, fontSize: 12.5 }}>「{tr.label}」</div>
                <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.55, marginTop: 2 }}>{tr.desc}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 4 }}>効果：毎週 疲労-3／雰囲気の底上げ／練習のマンネリをやわらげる</div>
              </div>
            </div>
          </>
        )
      })()}

      <div className="gap-sm" />
      <h2 className="h2">専属スタッフ</h2>
      <p className="dim" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
        採用費に加えて毎年の年俸がかかるが、育成・経営を底上げする。設備が上がり切った後の資金の使い道。
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STAFF.map((st) => {
          const owned = (c.staff ?? []).includes(st.id)
          const gate = staffHireGate(c, st.id)
          const affordable = !owned && c.budget >= st.hire && gate.ok
          return (
            <div className="panel" style={{ padding: '10px 12px' }} key={st.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{st.name} <span className="dim" style={{ fontSize: 11 }}>年俸{st.salary}万</span></div>
                  <div className="dim" style={{ fontSize: 11 }}>{st.desc}</div>
                  {!owned && !gate.ok && (
                    <div style={{ fontSize: 11, color: 'var(--accent, #ff9d4d)', marginTop: 2 }}>🔒 {gate.reason}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, marginLeft: 8 }}>
                  {owned ? <span className="dim" style={{ fontSize: 12 }}>雇用中</span>
                    : <button className={`btn ${affordable ? '' : 'ghost'}`} style={{ padding: '8px 12px', width: 'auto' }} disabled={!affordable} onClick={() => hireStaff(st.id)}>採用 {st.hire}万</button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* G-44 / #72: 💰 スポンサー（評判10または大会初勝利で解放）
          見やすさ重視で再設計: ①契約状況を2枚のカードで明示 ②候補は段階（評判tier）ごとにグループ表示
          ③空き枠がある時だけ候補を出す（期間中変更不可のため）④未解放段階は🔒1行で次の目標を見せる */}
      {(c.reputation >= 10 || (c.records.firstCompWinYear ?? 0) > 0) && (() => {
        const contracts = c.sponsorContracts ?? []
        const emptySlot: 'main' | 'uniform' | null =
          !contracts.some((x) => x.slot === 'main') ? 'main'
            : !contracts.some((x) => x.slot === 'uniform') ? 'uniform' : null
        const monthly = activeSponsorMonthly(c)
        const displayName = (name: string) => name.replace(/（.+?契約）$/, '')
        const periodLabel = (m: number) => (m === 6 ? '半年' : m === 12 ? '1年' : '2年')
        const specialLabel = (kind: string) =>
          kind === 'growth' ? '練習効率+5%' : kind === 'fatigue' ? '疲労回復+10%'
            : kind === 'scoutRep' ? 'スカウト評判+10' : '設備費15%引き'
        const groups: { tier: 10 | 25 | 45 | 70 | 100 | -1; label: string; lock: string }[] = [
          { tier: 10, label: '地元スポンサー（評判10〜）', lock: `評判10で解放（あと${10 - c.reputation}）※大会初勝利でも解放` },
          { tier: 25, label: '地域スポンサー（評判25〜）', lock: `評判25で解放（あと${25 - c.reputation}）` },
          { tier: 45, label: '広域スポンサー（評判45〜）', lock: `評判45で解放（あと${45 - c.reputation}）` },
          { tier: 70, label: '大手スポンサー（評判70〜）', lock: `評判70で解放（あと${70 - c.reputation}）` },
          { tier: 100, label: '特別スポンサー（評判100）', lock: `評判100で解放（あと${100 - c.reputation}）` },
          { tier: -1, label: '特別スポンサー（全国優勝）', lock: '全国大会優勝で解放' },
        ]
        return (
          <>
            <div className="gap-sm" />
            <h2 className="h2">💰 スポンサー</h2>
            <p className="dim" style={{ fontSize: 11.5, lineHeight: 1.6, margin: '4px 0 8px' }}>
              メイン・ユニフォームの2枠に契約して毎月の収入を得る。契約は期間が終わるまで変更できない（違約金なし）。
              {monthly > 0 && <b style={{ color: 'var(--good, #2e9e5b)' }}>　現在 月+{monthly}万</b>}
            </p>

            {/* 契約状況カード（2枠） */}
            {(['main', 'uniform'] as const).map((slot) => {
              const cur = contracts.find((x) => x.slot === slot)
              const curDef = cur ? SPONSORS.find((s) => s.id === cur.defId) : null
              const slotName = slot === 'main' ? 'メインスポンサー' : 'ユニフォームスポンサー'
              if (cur && curDef) {
                return (
                  <div className="panel tint-green" style={{ padding: '10px 12px', marginBottom: 6 }} key={slot}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="dim" style={{ fontSize: 11, fontWeight: 700 }}>{slotName}</div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{displayName(curDef.name)}</div>
                        {curDef.special && (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--orange-deep)' }}>特典: {specialLabel(curDef.special.kind)}</div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--good, #2e9e5b)' }}>月{curDef.monthly}万</div>
                        <div className="dim" style={{ fontSize: 11.5 }}>残り{Math.ceil(cur.weeksLeft / 4)}ヶ月</div>
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div className="panel" style={{ padding: '10px 12px', marginBottom: 6 }} key={slot}>
                  <div className="dim" style={{ fontSize: 11, fontWeight: 700 }}>{slotName}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)' }}>空き枠 — 下の候補から契約できる</div>
                </div>
              )
            })}

            {/* 候補一覧（空き枠がある時のみ・tierごとにグループ表示） */}
            {emptySlot ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 12.5, margin: '10px 0 6px' }}>
                  候補一覧 <span className="dim" style={{ fontSize: 11, fontWeight: 700 }}>（{emptySlot === 'main' ? 'メイン' : 'ユニフォーム'}枠に契約する）</span>
                </div>
                {groups.map((g) => {
                  const defs = SPONSORS.filter((s) => s.tier === g.tier)
                  if (!defs.length || !sponsorUnlocked(c, defs[0])) return null
                  return (
                    <div className="panel" style={{ padding: '4px 12px 6px', marginBottom: 6 }} key={g.tier}>
                      <div className="dim" style={{ fontSize: 11, fontWeight: 800, padding: '6px 0 2px' }}>{g.label}</div>
                      {defs.map((s, i) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: i ? '1px dashed rgba(74,64,54,0.15)' : 'none' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{displayName(s.name)}</div>
                            <div style={{ fontSize: 11.5, marginTop: 1 }}>
                              <b style={{ color: 'var(--good, #2e9e5b)' }}>月{s.monthly}万</b>
                              <span className="dim">・契約{periodLabel(s.months)}</span>
                              {s.special && <span style={{ color: 'var(--orange-deep)', fontWeight: 700 }}>・{specialLabel(s.special.kind)}</span>}
                            </div>
                          </div>
                          <button className="btn ghost" style={{ padding: '7px 14px', fontSize: 12.5, width: 'auto', flexShrink: 0 }} onClick={() => signSponsor(emptySlot, s.id)}>契約</button>
                        </div>
                      ))}
                    </div>
                  )
                })}
                {(() => {
                  const lockedLines = groups.filter((g) => {
                    const defs = SPONSORS.filter((s) => s.tier === g.tier)
                    return defs.length > 0 && !sponsorUnlocked(c, defs[0])
                  })
                  if (!lockedLines.length) return null
                  return (
                    <div className="panel" style={{ padding: '8px 12px', marginBottom: 6 }}>
                      {lockedLines.map((g) => (
                        <div className="dim" style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.9 }} key={g.tier}>🔒 {g.label.replace(/（.+）$/, '')}: {g.lock}</div>
                      ))}
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>両枠とも契約中。期間が満了した枠から、新しい契約を結べる。</div>
            )}
          </>
        )
      })()}

      {/* G-41 §5: プロOB指導（高評判校専用「お金の使い道」） */}
      {OB_INSTRUCTION.some((o) => obTierUnlocked(c, o.tier)) && (
        <>
          <div className="gap-sm" />
          <h2 className="h2">🌟 プロOB指導</h2>
          <p className="dim" style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 6 }}>
            出身プロのレベルに応じて解放。各レベル毎年1回。チームの強化に直結する高額イベント。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OB_INSTRUCTION.map((ob) => {
              const unlocked = obTierUnlocked(c, ob.tier)
              if (!unlocked) return null
              const gate = obCanRun(c, ob.tier)
              return (
                <div className="panel" style={{ padding: '10px 12px' }} key={ob.tier}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{ob.name} <span className="dim" style={{ fontSize: 11 }}>-{ob.cost}万</span></div>
                      <div className="dim" style={{ fontSize: 11 }}>{ob.desc}</div>
                      {!gate.ok && (
                        <div style={{ fontSize: 11, color: 'var(--accent, #ff9d4d)', marginTop: 2 }}>🔒 {gate.reason}</div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: 8 }}>
                      <button className={`btn ${gate.ok ? '' : 'ghost'}`} style={{ padding: '8px 12px', width: 'auto' }} disabled={!gate.ok} onClick={() => runObInstruction(ob.tier)}>実施</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="gap-sm" />
      <h2 className="h2">入部セレクション</h2>
      <div className="panel" style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>セレクション {c.selectionEnabled ? '実施中' : '無し'}</div>
            <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>
              {c.reputation >= 50
                ? '弱い応募者を不合格にして少数精鋭にできる（最低10人は合格）。応募者の数は実施の有無で変わらない。部員が減るぶんBC層が薄くなり、覚醒の機会も減る。'
                : '評判50以上の強豪校で実施可能（現在の評判: ' + c.reputation + '）'}
            </div>
          </div>
          <button className={`btn ${c.selectionEnabled ? '' : 'ghost'}`} style={{ width: 'auto', padding: '8px 14px', flexShrink: 0, marginLeft: 8 }}
            disabled={c.reputation < 50} onClick={toggleSelection}>
            {c.selectionEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

    </div>
  )
}
