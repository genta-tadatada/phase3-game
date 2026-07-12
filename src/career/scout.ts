// ============================================================
// career/scout.ts — スカウト
// 候補生成・発見度ゲージ(SP)・勧誘判定。潜在(才能)は廃止＝候補の差は「初期能力」。
// スカウトは strengthBoost で一般入部より高い初期能力の素材を狙える（アンダー代表＝逸材）。
// 代表歴バッジは高い初期能力の早期シグナル。
// ============================================================

import type { Player } from '../engine/types'
import type { RNG } from '../engine/rng'
import { generateRecruit, INTAKE_POSITIONS } from './recruit'
import { scoutReachBonus } from './facilities'
import { grantStartingSkills, pickBiasedPersonality } from './skillGrant'
import type { CareerState, Facilities, ScoutCandidate } from './types'

const DISTRICTS = ['北部', '南部', '東部', '西部', '中央', '臨海', '山間']

// 発見度の累計SP閾値（C-3）
export const DISCOVERY_COST = [0, 4, 10, 18] // index=目標発見度

// 「チョー優秀」＝この初期能力以上の逸材は、評判・お金に加え設備が無いと来ない（施設ゲート）
const ELITE_STRENGTH = 57

/** 候補の初期能力（平均）。潜在の代わりに「格」を表す指標。 */
export function candStrength(p: Player): number {
  const a = p.abilities
  const vals = [a.kick, a.power, a.speed, a.technique, a.stamina, a.iq, a.defense]
  if (p.gk) { vals.push(p.gk.saving, p.gk.gkIq) }
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/**
 * 追える候補数。#41: 初期は数人に絞り、スカウトスタッフ雇用で段階拡大する。
 * 基礎 = 4 + Lv×2（Lv1=6…Lv4=12）。staffReach はスカウトスタッフの上乗せ（各+4・最大+8）。
 */
export function candidateCount(level: number, staffReach = 0): number {
  return Math.min(24, 4 + level * 2 + staffReach)
}

/** 年度の候補プールを生成 */
export function generateCandidates(state: CareerState, rng: RNG): ScoutCandidate[] {
  const n = candidateCount(state.scouting.level, scoutReachBonus(state))
  const out: ScoutCandidate[] = []
  // スカウトは一般入部より良い素材に出会える＝初期能力の底上げ(strengthBoost)。
  // 範囲(Lv)が広いほど上乗せが大きく、稀に「逸材(アンダー代表級＝チョー優秀)」に出会う。
  const scoutReach = 3 + state.scouting.level * 3
  for (let i = 0; i < n; i++) {
    const pos = rng.pick(INTAKE_POSITIONS)
    const special = rng.chance(0.12)
    // 稀に逸材（スカウトLvが高いほど確率UP）＝初期能力が突出。設備が無いと来ない。
    const gem = rng.chance(0.02 * state.scouting.level)
    // 候補に大きな幅を持たせる：弱い子(雀の涙)〜強い子まで±18のばらつき。逸材は更に突出。
    const variance = Math.round((rng.next() - 0.5) * 36)
    const boost = scoutReach + variance + (gem ? 26 : 0)
    const player = generateRecruit(rng, { position: pos, reputation: state.reputation, grade: 1, special, strengthBoost: boost, joinedYear: state.year + 1 })
    // 代表歴バッジ（初期能力に応じた早期シグナル）
    const cs = candStrength(player)
    let badge: ScoutCandidate['repBadge'] = null
    if (cs >= ELITE_STRENGTH) badge = rng.chance(0.6) ? 'u15' : 'national-tresen'
    else if (cs >= 49) badge = rng.chance(0.5) ? 'national-tresen' : 'pref-tresen'
    else if (cs >= 43) badge = rng.chance(0.35) ? 'pref-tresen' : null
    // #scout改修: 優秀候補(バッジ持ち)のみ「あたり性格」寄り＋初期スキルが付きやすい。
    //   バッジ無し候補も僅かに初期スキルあり。能力以外でスカウトの優秀選手を差別化する。
    const elite = badge !== null
    if (elite) player.personality = pickBiasedPersonality(rng)
    grantStartingSkills(player, rng, elite ? 'elite' : 'scout')
    out.push({
      id: `cand_${state.year}_${i}`,
      district: rng.pick(DISTRICTS) + '地区',
      position: pos,
      discovery: 0,
      spInvested: 0,
      player,
      repBadge: badge,
      recruited: false,
      rivalSnatched: false,
    })
  }
  return out
}

/** 候補の発見度を1段階上げる（SPを消費）。可否と消費SPを返す */
export function investInCandidate(cand: ScoutCandidate, availableSP: number): { ok: boolean; cost: number } {
  if (cand.discovery >= 3) return { ok: false, cost: 0 }
  const nextLevel = cand.discovery + 1
  const cost = DISCOVERY_COST[nextLevel] - DISCOVERY_COST[cand.discovery]
  if (availableSP < cost) return { ok: false, cost }
  cand.discovery = nextLevel
  cand.spInvested += cost
  return { ok: true, cost }
}

function facilityAvg(f: Facilities): number {
  return (f.ground + f.clubhouse + f.training + f.dorm) / 4
}

/** チョー優秀な逸材が求める設備が揃っているか（ground/training/dorm がLv2以上） */
export function eliteFacilitiesOk(f: Facilities): boolean {
  return f.ground >= 2 && f.training >= 2 && f.dorm >= 2
}

export const OFFER_LABEL = ['通常', '特待', '特別特待']

/**
 * 勧誘成功率。**評判が最重要**で、設備・選手の格（競合）が続く。
 * 特待オファー(offer)は「お金で競り勝つ」要素だが、効果は評判が高いほど大きい
 * ＝低評判校はいくら積んでも逸材は取れない（お金だけでは選手は取れない）。
 * チョー優秀な逸材は、評判・お金に加えて設備が無いとそもそも来ない（施設ゲート）。
 * G-19: 調査回数（discovery）が成功率にも影響する。2回調査は -0.06、3回（最大）は +0.08。
 *       「最後まで調べた方が来やすい」を体感させ、3回調査の価値を明示する。
 */
export function successRateAtOffer(state: CareerState, cand: ScoutCandidate, offer: number): number {
  const cs = candStrength(cand.player)
  // チョー優秀の施設ゲート：設備が足りなければ来ない
  if (cs >= ELITE_STRENGTH && !eliteFacilitiesOk(state.facilities)) return 0.02
  // 評判が主役（0→100で +0.0〜+0.50）。設備が補助。
  let rate = 0.22 + state.reputation * 0.005 + facilityAvg(state.facilities) * 0.045
  // G-19: 調査回数による補正（discovery 2 は控えめ・3 は強い）
  if (cand.discovery >= 3) rate += 0.08
  else if (cand.discovery >= 2) rate -= 0.06
  if (cs >= 52) rate += 0.06
  // 競合ペナルティ: 初期能力が高い素材ほど強豪が獲りに来る（取り合い）
  if (cs >= 48) rate -= (cs - 46) * 0.014
  // 代表歴ペナルティ（強豪も熱望する逸材）。
  //   ① 評判が低いほど強豪に競り負けて取れない（弱小校は通常オファーではほぼ取れない）
  //   ② バッジ付きは「お金を積んで初めて取れる」＝通常オファー(0円)は大ペナルティ・特待で軽減・特別特待でさらに軽減
  //   評判と特待の両方を上げて初めてバッジ付き候補を口説ける現実的なバランス。
  const repFrac = state.reputation / 100 // 0..1
  const offerRelief = offer === 0 ? 0 : offer === 1 ? 0.10 : 0.22 // 通常=0 / 特待+0.10 / 特別特待+0.22
  if (cand.repBadge === 'u15') rate -= (0.40 - 0.20 * repFrac) - offerRelief            // 評判0通常=-0.40・特別特待=-0.18／評判100特別特待=+0.02
  else if (cand.repBadge === 'national-tresen') rate -= (0.28 - 0.12 * repFrac) - offerRelief // 評判0通常=-0.28・特別特待=-0.06
  else if (cand.repBadge === 'pref-tresen') rate -= (0.18 - 0.07 * repFrac) - offerRelief     // 評判0通常=-0.18・特別特待=+0.04
  // 特待オファーのお金効果は「評判が高いほど効く」（無名校の大金は響きにくい）
  const repFactor = 0.35 + state.reputation / 100 * 0.65
  rate += offer * 0.14 * repFactor
  return Math.max(0.03, Math.min(0.95, rate))
}

/** 勧誘成功率（現在のオファー段階で評価） */
export function recruitSuccessRate(state: CareerState, cand: ScoutCandidate): number {
  return successRateAtOffer(state, cand, cand.offer ?? 0)
}

/**
 * 勧誘費（万円・オファー段階別）。通常オファーはほぼ無償（宿泊費撤廃）。
 * 弱い素材でも特待/特別特待には最低費用がかかる（口約束だけの特待は無し）＝0円なのは通常段階のみ。
 * 強い素材は base プレミアムで段階が上がるほど高額になる。
 */
export function costAtOffer(cand: ScoutCandidate, offer: number): number {
  const base = Math.max(0, candStrength(cand.player) - 48) // 素材プレミアム（初期能力・48超で発生）
  const scholarshipMult = [0, 2.4, 4.4][offer] ?? 0 // 通常=0（宿泊費撤廃）／特待・特別特待に集約
  const minCost = [0, 8, 16][offer] ?? 0           // 弱い素材でも特待は最低8万・特別特待16万（口約束を防止）
  // 弱小校は通常オファー(0円)でしか取れない＝現実と同じ。評判を上げると特待が打てるようになる。
  return Math.round(base * scholarshipMult + minCost)
}

/** 現在のオファー段階での勧誘費 */
export function recruitCost(cand: ScoutCandidate): number {
  return costAtOffer(cand, cand.offer ?? 0)
}

/**
 * 勧誘判定（C-1 2月）。shortlist の候補を判定し、成功者をPlayer配列で返す。
 * 失敗した格上候補は rivalSnatched=true（強豪に獲られた演出）。
 * G-43: 結果に「どこへ進学」の架空文言を追加（県内/県外）。プロフィール情報も付与。
 */
export interface RecruitResultDetail {
  name: string
  ok: boolean
  position: string
  badge: ScoutCandidate['repBadge']
  strength: number
  destinationLabel?: string // 失敗時のみ「県内/県外の高校に入学」
  personalityKey?: string
}
export function runRecruitment(state: CareerState, rng: RNG): { recruited: Player[]; results: RecruitResultDetail[]; cost: number } {
  const recruited: Player[] = []
  const results: RecruitResultDetail[] = []
  let cost = 0
  for (const id of state.scouting.shortlist) {
    const cand = state.scouting.candidates.find((c) => c.id === id)
    if (!cand || cand.discovery < 2) continue // 能力不明では勧誘不可
    const rate = recruitSuccessRate(state, cand)
    const ok = rng.next() < rate
    cand.recruited = ok
    if (ok) {
      recruited.push({ ...cand.player })
      results.push({
        name: cand.player.name, ok: true, position: cand.player.position,
        badge: cand.repBadge, strength: candStrength(cand.player), personalityKey: cand.player.personality,
      })
      cost += recruitCost(cand) // 成功した勧誘にのみ費用が発生（特待・宿泊費）
    } else {
      if (candStrength(cand.player) >= 50) cand.rivalSnatched = true
      // G-43: 失敗先は「県内/県外」の架空文言。特定校名は使わない（対戦時の違和感防止・仕様準拠）
      const destination = rng.next() < 0.55 ? '県内の高校' : '県外の高校'
      results.push({
        name: cand.player.name, ok: false, position: cand.player.position,
        badge: cand.repBadge, strength: candStrength(cand.player),
        destinationLabel: `${destination}に入学を決めたようです。`,
        personalityKey: cand.player.personality,
      })
    }
  }
  return { recruited, results, cost }
}
