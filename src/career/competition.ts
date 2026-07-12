// ============================================================
// career/competition.ts — 大会（夏季/冬季・県予選→全国）
// 既存 lib/tournament（8校シングルエリミ）を再利用。県予選で優勝すると
// 全国へ。結果に応じて評判・賞金・記録を更新（補完D-4）。
// ============================================================

import { createRNG, hashSeed } from '../engine/rng'
import { generateTeam } from '../engine/generate/team'
import { PREFECTURES } from '../data/prefectures'
import { prefectureSchools, nationalQualifiers, prefBerthsLedger, prefDifficulty, type LedgerSchool } from '../data/schoolLedger'
import { createTournament, createSeededTournament, type Tournament } from '../lib/tournament'
import { careerToTeam } from './lineup'
import type { CareerState } from './types'
import type { Team } from '../engine/types'

export type CompKind = 'summer' | 'winter'
export type CompStage = 'qualify' | 'national'

const AI_COLORS = ['#457b9d', '#9b5de5', '#06d6a0', '#ef476f', '#118ab2', '#ffd166', '#8338ec']

/** LedgerSchool から大会用 Team を生成（固有名・固有強さ・特色を反映）。 */
function teamFromLedger(rng: ReturnType<typeof createRNG>, s: LedgerSchool, i: number): Team {
  return generateTeam(rng, {
    id: `nat_${s.prefecture}_${s.rank}`, name: s.name, prefecture: s.prefecture,
    color: AI_COLORS[i % AI_COLORS.length], strength: s.strength, isPlayer: false, feature: s.feature,
  })
}

/**
 * #30 全国本戦フィールド（60校＝プレイヤー＋59CPU）。
 *  各県の固有台帳の全国出場校(nationalQualifiers)を集約し、プレイヤーは自県の代表枠を1つ占める。
 *  シード（一回戦免除）と配置は createSeededTournament が強さ順で決める（プレイヤーは絶対非シード）。
 */
function nationalField(state: CareerState, seed: number, strengthDelta = 0): Team[] {
  const rng = createRNG(seed)
  // 全国出場校を全県から集約（プレイヤーの県は代表1枠をプレイヤーが奪うため最上位を1校除く）。
  const all: LedgerSchool[] = []
  for (const p of PREFECTURES) {
    const q = nationalQualifiers(p.name)
    if (p.name === state.prefecture) all.push(...q.slice(1)) // 県王者＝プレイヤー。残り枠のみCPU
    else all.push(...q)
  }
  // 全国の相手バフは「勝ち進むほど増す」＝強い校(決勝級)ほど大きくバフ・弱い校(一回戦級)はごく僅か。
  //   strengthDelta は最強校への最大バフ。各校は自分の強さ順位(frac)に比例して受ける。
  const ss = all.map((s) => s.strength)
  const minS = Math.min(...ss), maxS = Math.max(...ss)
  return all.map((s, i) => {
    const frac = maxS > minS ? (s.strength - minS) / (maxS - minS) : 0 // 0(最弱)〜1(最強)
    const buff = Math.round(strengthDelta * frac)
    return teamFromLedger(rng, { ...s, strength: s.strength + buff }, i)
  })
}

/** プレイヤー＋敵校の大会ブラケットを構築（県予選=可変校数 / 全国=60+シード4）。 */
export function buildField(state: CareerState, kind: CompKind, stage: CompStage): Tournament {
  const seed = (hashSeed(`${state.rngSeed}-${state.year}-${kind}-${stage}`)) >>> 0
  const rng = createRNG(seed)
  const playerTeam = careerToTeam(state)

  // #30 全国＝県別固有台帳の全国出場校で60校ブラケット（強さシード＋上位4はバイ）。
  // 全国の相手は「県を勝ち上がった代表が、大会までの期間で成長して登場」＝台帳より少し強い(+4)。
  // さらに夏<冬（冬は成長時間が長い）＝冬の全国は+3上乗せ。
  if (stage === 'national') {
    // 勝ち進むほどバフが増す設計＝最強校(決勝級)への最大バフ。弱い校(一回戦級)はnationalField内でほぼ0に。
    const natDelta = (kind === 'winter' ? 1 : 0) // 県ceiling引き上げで全国の場が強化された分、バフは撤廃（冬のみ+1）。
    return createSeededTournament(playerTeam, nationalField(state, seed, natDelta), [], seed)
  }

  // #30 Step C 県予選＝自県の固有台帳の高校で構成（強豪県32校/他16校）。プレイヤーは台帳外の自校。
  //   最弱1校を落として残りを「弱い順」に並べ、createTournament で プレイヤー(slot0)が
  //   弱小から当たり勝ち上がるほど強い校＝決勝が県最強(ceiling)。強さシードは使わない：
  //   育成途上の弱いチームでも初戦は必ず弱小相手＝勝って育つ余地を残す（県脱出を現実的な年数に）。
  // 前年王者シード（組み合わせ優遇）は廃止＝県予選の難易度は前年の成績に関係なく一定（げんた様方針）。
  const ledger = prefectureSchools(state.prefecture)
  const ascending = ledger.slice(0, ledger.length - 1).sort((a, b) => a.strength - b.strength) // 弱→強
  // 夏<冬: 冬の県予選は成長時間ぶん相手が少し強い（現実反映）。
  const winterDelta = kind === 'winter' ? 3 : 0
  // ブラケットは (player, ai[0])(ai[1],ai[2])… でプレイヤーは「前半の山(弱い側)」を勝ち上がる。
  //   ＝決勝相手(ascending末尾)は反対の山。全国出場(準優勝=決勝到達)を難しくするには、
  //   プレイヤーの山の上位(=実際に当たる準決勝/準々決勝相手)を強化する必要がある（げんた様案の正しい配線）。
  const isHard = prefDifficulty(state.prefecture) === 'hard'
  const last = ascending.length - 1   // 最強(決勝の相手・反対の山)
  const mid = Math.floor(ascending.length / 2) // プレイヤーの山の上位境界
  const ceil = ascending[last]?.strength ?? 80
  const hardBoost = (i: number): number => {
    if (!isHard) return 0
    const cur = ascending[i].strength
    if (i === last) return 3                              // 決勝(反対山の最強)＝強化＝難県優勝≈9年(激戦区王者は全国トップ＝げんた様OK)
    if (i === mid - 1) return Math.max(0, ceil - 2 - cur) // プレイヤーの準決勝相手＝県最強-2の壁（全国出場を難しく）
    if (i === mid - 2) return Math.max(0, ceil - 5 - cur) // 準々決勝
    if (i === mid - 3) return Math.max(0, ceil - 9 - cur)
    return 0
  }
  const others = ascending.map((s, i) => teamFromLedger(rng, { ...s, strength: s.strength + winterDelta + hardBoost(i) }, i))
  return createTournament(playerTeam, others, seed)
}

/** 県予選の参加校数（県の固有台帳の校数＝強豪県32/他16）。 */
export function qualifyBracketSize(prefName: string): number {
  return prefectureSchools(prefName).length
}

/** 大会の到達段階を 0=ベスト8以下 / 1=ベスト4 / 2=準優勝 / 3=優勝 で返す。
 *  ブラケットが大きく(16/32校)ても「決勝からの距離」で判定するので0〜3に正規化される。 */
export function playerPlacement(t: Tournament): number {
  const L = t.rounds.length
  for (let r = 0; r < L; r++) {
    const m = t.rounds[r].find((mm) => mm.homeId === t.playerId || mm.awayId === t.playerId)
    if (m && m.winnerId && m.winnerId !== t.playerId) {
      const fromEnd = L - 1 - r // 0=決勝で敗退, 1=準決勝, 2=準々決勝, 3+=それ以前
      return Math.max(0, 2 - fromEnd) // 準優勝2 / ベスト4=1 / ベスト8以下=0
    }
  }
  // 全勝＝優勝
  const final = t.rounds[L - 1][0]
  return final.winnerId === t.playerId ? 3 : 0
}

const PLACEMENT_LABEL = ['ベスト8', 'ベスト4', '準優勝', '優勝']

/** 県の全国出場枠。#30: 強豪13県＝2枠（準優勝でも全国）／他34県＝1枠。
 *  台帳(schoolLedger)の強豪13判定に統一＝全国フィールド(60校)と県予選の枠数を一致させる。 */
export function prefBerths(prefName: string): number {
  return prefBerthsLedger(prefName)
}

/** #48: 評判逓減係数。現評判が高いほど、同じ成績で得られる評判の伸びが小さくなる。
 *  連続関数＝評判1ポイントごとに変化（10刻みの目安）:
 *  0→1.00 / 10→0.93 / 20→0.86 / 30→0.79 / 40→0.72 / 50→0.65 / 60→0.58 /
 *  70→0.51 / 80→0.45 / 90→0.45 / 100→0.45。下限0.45。
 *  設計: 中盤(30-70)の傾きは原案どおり保ち「腕の差(育成の良し悪し)」を評判の伸び差に残す＝
 *  ここを緩めると平均プレイヤーが評判で追いつき全国優勝の倍率が潰れる(実測1.29→1.03で確認)。
 *  一方で高評判(80+)の落ち込みは下限0.45で緩和＝名門でも評判が伸び続ける手応えを残す(げんた様要望)。 */
export function repGainDamping(reputation: number): number {
  return Math.max(0.45, 1.0 - reputation * 0.007)
}

export interface CompOutcome {
  state: CareerState
  label: string         // 「夏季・県予選 準優勝」等
  reputationDelta: number
  prize: number
  qualifiedNational: boolean // 県予選優勝で全国へ
  championNational: boolean
}

/** 大会1ステージの結果を反映。reachedLabel＝実際の到達段階の正確ラベル（大ブラケット用）。 */
export function applyCompResult(
  state: CareerState, kind: CompKind, stage: CompStage, placement: number, reachedLabel?: string,
): CompOutcome {
  let repDelta = 0
  let prize = 0
  // 表示は正確な到達ラベル（ベスト16等）／無ければ正規化placementのラベルにフォールバック。
  const placeLabel = reachedLabel ?? PLACEMENT_LABEL[placement]
  let qualifiedNational = false
  let championNational = false

  if (stage === 'qualify') {
    // 県予選: 上位が全国出場。強豪県は2枠＝準優勝でも全国へ（激戦区の救済＝現実準拠）。
    // 深い勝ち上がりは評判を着実に押し上げ、良い新入生→強化の好循環を回す。
    repDelta = [0, 2, 4, kind === 'winter' ? 10 : 8][placement]
    // 県の難易度で評判の上がり方が変わる（げんた様方針）: 難県は準優勝/ベスト4でも評判が上がり(×1.4)、
    //   易県は優勝の価値が低め(×0.85)＝難県は勝てなくても注目され全国までの差が縮む／易県は早く優勝して早く伸びる。
    const diff = prefDifficulty(state.prefecture)
    // 難県の評判補償は中立(1.0)＝育成を普通より速くしない。難県は「県優勝が遅い＋全国も簡単でない」真に難しい県に。
    repDelta = Math.round(repDelta * (diff === 'hard' ? 1.0 : diff === 'easy' ? 0.9 : 1.0))
    const berths = prefBerths(state.prefecture)
    qualifiedNational = placement >= 4 - berths // 1枠=優勝のみ / 2枠=準優勝以上
    // 全国出場の補助金は「即時」支給（年度末まとめ払いをやめ、設備投資の時期を自由に）。
    if (qualifiedNational) prize += kind === 'summer' ? 50 : 90
  } else {
    // 全国（高校サッカーとして現実的な規模に。主収入は補助金・後援会/OB寄付に分散）
    if (kind === 'summer') {
      repDelta = [6, 10, 14, 20][placement]
      prize = [15, 30, 45, 70][placement] // 大会協賛・記念品相当（8強〜優勝）
    } else {
      repDelta = [16, 24, 32, 45][placement]
      prize = [50, 100, 150, 250][placement] // 冬の全国はやや手厚い協賛
    }
    championNational = placement === 3
    // 全国優勝の補助金も即時支給（旧・年度末のseasonSubsidy分を即時化）。
    if (placement === 3) prize += kind === 'summer' ? 60 : 140
  }

  // #48: 評判逓減 — 低評判校は大きく伸び、高評判の名門は伸びが鈍る（青天井を抑制）。
  repDelta = Math.round(repDelta * repGainDamping(state.reputation))

  const kindLabel = kind === 'summer' ? '夏季' : '冬季'
  const stageLabel = stage === 'qualify' ? '県予選' : '全国'
  const label = `${kindLabel}・${stageLabel} ${placeLabel}`

  // 記録・season更新
  const records = { ...state.records }
  const season = { ...state.season }
  if (stage === 'national') {
    records.nationalApps += 1
    if (kind === 'summer') { season.summerLabel = `全国${placeLabel}`; season.summerBest = placement; if (placement === 3) records.summerTitles += 1 }
    else { season.winterReachedNational = true; season.winterLabel = `全国${placeLabel}`; if (placement === 3) records.winterTitles += 1 }
  } else {
    if (kind === 'summer') { season.summerLabel = `県${placeLabel}`; season.summerBest = placement }
    else { season.winterLabel = `県${placeLabel}` }
  }

  // 県予選優勝を記録（翌年の「前年王者シード」判定用）
  const lastQualifyChamp = { summer: 0, winter: 0, ...state.lastQualifyChamp }
  if (stage === 'qualify' && placement === 3) lastQualifyChamp[kind] = state.year

  const newState: CareerState = {
    ...state,
    reputation: Math.max(0, Math.min(100, state.reputation + repDelta)),
    budget: state.budget + prize,
    records,
    season,
    lastQualifyChamp,
    log: [`${kindLabel}大会 ${stageLabel} ${placeLabel}（評判+${repDelta}${prize ? ` 賞金+${prize}万` : ''}）`, ...state.log].slice(0, 40),
  }

  return { state: newState, label, reputationDelta: repDelta, prize, qualifiedNational, championNational }
}
