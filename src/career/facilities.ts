// ============================================================
// career/facilities.ts — 設備のアップグレード定義・費用・効果（補完D-1）
// 効果（成長係数・部員上限・練習解放・入部数）は既に各エンジンに配線済み。
// ここでは費用・維持費・アップグレード操作を定義する。
// ============================================================

import type { CareerState, Facilities } from './types'

export type FacilityKey = 'ground' | 'clubhouse' | 'training' | 'dorm'

export interface FacilityDef {
  key: FacilityKey
  name: string
  // Lv2/3/4 への費用（万円）。index0,1未使用→[_, _, Lv2, Lv3, Lv4]
  upgradeCost: number[]
  // 各Lvの月維持費（万円）
  upkeep: number[]
  levelNames: string[]
  effect: string
}

// Lv5 は「設備が上がり切った後」の超高額な最終投資＝長期プレイのお金の使い道(#21/#26)。
export const MAX_FACILITY_LV = 5

export const FACILITIES: FacilityDef[] = [
  {
    key: 'ground', name: 'グラウンド',
    upgradeCost: [0, 0, 150, 800, 3000, 9000],
    upkeep: [0, 0, 1, 5, 8, 15],
    levelNames: ['土・共用', '専用+照明', '整備+散水', '人工芝', '最新人工芝+ナイター設備'],
    effect: '練習の成長効率が上がる（全体）',
  },
  {
    key: 'clubhouse', name: '部室・更衣室',
    upgradeCost: [0, 0, 50, 150, 500, 1800],
    upkeep: [0, 0, 0.5, 1, 3, 7],
    levelNames: ['小部室', '更衣室+シャワー', '広い部室', '選手専用棟', 'クラブハウス'],
    effect: 'チームの雰囲気が上がりやすくなる（居心地）',
  },
  {
    key: 'training', name: 'トレーニング',
    upgradeCost: [0, 0, 60, 300, 1200, 4000],
    upkeep: [0, 0, 0.5, 3, 6, 13],
    levelNames: ['なし', '基礎器具', '筋トレルーム', '総合+陸上トラック', '高地トレ+測定ラボ'],
    effect: 'Lvアップで練習メニュー3種ずつ解放＆全練習の成長効率+4%/Lv',
  },
  {
    key: 'dorm', name: '寮',
    // Z-2: Lv3 を 1500→1200 に緩和（×1.35 補正後 2025→1620）。Lv2→Lv3 のコスト断崖（×5）が
    //   Cコーチ要件(寮Lv4)までの道のりを険しくしすぎていた。fees回収は永遠に追いつかないため
    //   経済性ではなく「Bチーム展開→Cチーム展開」のステップを進めやすくする狙い。
    upgradeCost: [0, 0, 300, 1200, 5000, 14000],
    upkeep: [0, 0, 5, 10, 25, 50],
    // G-36: 上限を 20/30/40/50/60 → 24/33/42/51/60（全て3の倍数）。
    //   学年ハードキャップ floor(cap/3) = 8/11/14/17/20 が綺麗な整数になり、GK段階配分と噛み合う。
    // Z-2: Lv5 の効果に「合宿効率+10%」を追加（後述 dormCampBonus）。Lv5 は fees回収不可能な
    //   超高額投資のため、達成感としてのご褒美を付ける。
    levelNames: ['なし(上限24)', '合宿所(上限33)', '校内寮(上限42)', '本格寮(上限51)', '完備寮(上限60・合宿効率+10%)'],
    effect: '部員の上限と入部数が増える（Lv5で合宿効率+10%）',
  },
]

export function facilityDef(key: FacilityKey): FacilityDef {
  return FACILITIES.find((f) => f.key === key)!
}

// --- 追加設備（独立購入・補完D-2の一部）---
export interface ExtraDef { id: string; name: string; cost: number; desc: string }
export const EXTRA_FACILITIES: ExtraDef[] = [
  { id: 'gym', name: '体育館（室内練習場）', cost: 200, desc: '雨・雪・猛暑など悪天候でも練習効率を維持する' },
]

// --- 専属スタッフ（雇用once＝採用費／毎年=年俸）。設備が上がり切っても続く「お金の使い道」。
//     恒常的なsinkを作りつつ、雇うほど育成・経営が強くなる「意味のある選択」を提供する。---
// G-41 §3: B/Cコーチを追加（Bチーム解放/Cチーム解放トリガ）。analystは効果地味で廃止予定→
//   既存セーブとの互換性のため型は残すがSTAFF一覧から外し、新規雇用不可。
export type StaffId =
  | 'coach' | 'coach2' | 'trainer'
  | 'scout-net' | 'scout-chief'
  | 'bcoach' | 'ccoach'
  | 'analyst' // deprecated（G-41 §3 で廃止・既存セーブ互換のため型に残置）
export interface StaffDef { id: StaffId; name: string; hire: number; salary: number; desc: string }
export const STAFF: StaffDef[] = [
  // G-41 §3 並び順: 重要度順（スカウト主任→練習コーチ→広域スカウト→Bコーチ→Cコーチ→トレーナー）
  { id: 'scout-chief',name: 'スカウト主任',         hire: 520, salary: 90, desc: 'スカウト機能本体を解放・毎週のスカウトSP+3・追える候補が4人増える（年2の5月から雇用可）' },
  { id: 'coach',      name: '専属フィジカルコーチ', hire: 320, salary: 60, desc: '練習枠+1・練習での成長効率が上がる（+12%）' },
  { id: 'coach2',     name: 'アシスタントコーチ',   hire: 280, salary: 55, desc: '練習枠+1・成長効率がさらに上がる（+8%）' },
  { id: 'scout-net',  name: '広域スカウト',         hire: 400, salary: 70, desc: '毎週のスカウトSP+2・追える候補が4人増える（スカウト範囲拡大）' },
  { id: 'bcoach',     name: 'Bチームコーチ',        hire: 380, salary: 65, desc: 'Bチームを解放（部員25人+寮Lv2以上が必要）。B合宿とB練習試合で育成を回せる' },
  { id: 'ccoach',     name: 'Cチームコーチ',        hire: 380, salary: 65, desc: 'Cチームを解放（部員45人+寮Lv4以上+Bチームコーチ雇用済が必要）。3チーム制の終盤レア体験' },
  { id: 'trainer',    name: '専属トレーナー',       hire: 260, salary: 50, desc: '疲労の回復が早まり、選手が好調を保ちやすい' },
]
// G-41 §3: analyst は廃止対象でSTAFFから外れるため undefined を返し得る。呼び出し側で
//   ?. 付きアクセス or `?? null` ガードすること。雇用フロー（UI）はSTAFFのみ列挙するため新規雇用不可。
export function staffDef(id: StaffId): StaffDef | undefined { return STAFF.find((s) => s.id === id) }
export function hasStaff(state: CareerState, id: StaffId): boolean { return (state.staff ?? []).includes(id) }
/** G-41 §4 (Q-001 B案): 部室Lvに応じた個別面談の同時対象上限。
 *   Lv1=1人 / Lv2-3=2人 / Lv4+=3人。雰囲気・休養効果は各人に同じ効率で適用。
 */
export function meetingTargetsCap(clubhouseLevel: number): 1 | 2 | 3 {
  if (clubhouseLevel >= 4) return 3
  if (clubhouseLevel >= 2) return 2
  return 1
}
/** #29: 雇用中のコーチ数（専属コーチ＋アシスタント）。練習枠と成長効率に効く。 */
export function coachCount(state: CareerState): number {
  return (hasStaff(state, 'coach') ? 1 : 0) + (hasStaff(state, 'coach2') ? 1 : 0)
}
/** #29: コーチ陣による成長効率倍率（専属+12%・アシスタント+8%）。 */
export function coachGrowthMult(state: CareerState): number {
  return 1 + (hasStaff(state, 'coach') ? 0.12 : 0) + (hasStaff(state, 'coach2') ? 0.08 : 0)
}
/** #41: スカウトスタッフによる毎週の追加SP（広域スカウト網+2・統括スカウト+3）。 */
export function scoutSpBonus(state: CareerState): number {
  return (hasStaff(state, 'scout-net') ? 2 : 0) + (hasStaff(state, 'scout-chief') ? 3 : 0)
}
/** #41: スカウトスタッフによる「追える候補数」の上乗せ（各+4人）。 */
export function scoutReachBonus(state: CareerState): number {
  return (hasStaff(state, 'scout-net') ? 4 : 0) + (hasStaff(state, 'scout-chief') ? 4 : 0)
}
/** 雇用中スタッフの年俸合計（万円）。経済の恒常sink。 */
export function annualSalaries(staff: string[] | undefined): number {
  return (staff ?? []).reduce((sum, id) => sum + (STAFF.find((s) => s.id === id)?.salary ?? 0), 0)
}
// G-41 §3: スタッフ雇用条件チェック（採用ボタン enabled の判定で使う）
//   scout-chief: 年2の5月（week5）以降
//   scout-net  : スカウト主任雇用済（広域は主任ありき）
//   bcoach     : 部員25人+寮Lv2以上
//   ccoach     : 部員45人+寮Lv4以上+bcoach雇用済
//   coach/coach2/trainer: 制限なし
//   analyst    : 廃止（STAFFに無いので採用画面に出ない）
export function staffHireGate(state: CareerState, id: StaffId): { ok: boolean; reason?: string } {
  const has = (x: StaffId) => (state.staff ?? []).includes(x)
  if (id === 'scout-chief') {
    if (state.year < 2 || (state.year === 2 && state.week < 5)) return { ok: false, reason: '年2の5月（week5）から雇用可' }
  }
  if (id === 'scout-net') {
    if (!has('scout-chief')) return { ok: false, reason: 'スカウト主任の雇用が必要' }
  }
  if (id === 'bcoach') {
    if (state.roster.length < 25) return { ok: false, reason: '部員25人以上が必要' }
    if (state.facilities.dorm < 2) return { ok: false, reason: '寮Lv2以上が必要' }
  }
  if (id === 'ccoach') {
    if (state.roster.length < 45) return { ok: false, reason: '部員45人以上が必要' }
    if (state.facilities.dorm < 4) return { ok: false, reason: '寮Lv4以上が必要' }
    if (!has('bcoach')) return { ok: false, reason: 'Bチームコーチの雇用が必要' }
  }
  return { ok: true }
}

export function hireStaff(state: CareerState, id: StaffId): CareerState {
  const def = staffDef(id)
  if (!def || (state.staff ?? []).includes(id) || state.budget < def.hire) return state
  if (!staffHireGate(state, id).ok) return state
  return {
    ...state,
    staff: [...(state.staff ?? []), id],
    budget: state.budget - def.hire,
    log: [`${def.name}を採用（採用費-${def.hire}万／年俸${def.salary}万）`, ...state.log].slice(0, 40),
  }
}

export function buyExtra(state: CareerState, id: string): CareerState {
  const def = EXTRA_FACILITIES.find((e) => e.id === id)
  if (!def || state.facilities.extras.includes(id) || state.budget < def.cost) return state
  return {
    ...state,
    facilities: { ...state.facilities, extras: [...state.facilities.extras, id] },
    budget: state.budget - def.cost,
    log: [`${def.name}を導入（-${def.cost}万）`, ...state.log].slice(0, 40),
  }
}

/** 次のアップグレード費用（最大Lvなら0）。G-44: スポンサー詳細により基準×1.35（建設会社で-15%）。 */
export function nextUpgradeCost(state: CareerState, key: FacilityKey): number {
  const lv = state.facilities[key]
  if (lv >= MAX_FACILITY_LV) return 0
  const base = facilityDef(key).upgradeCost[lv + 1]
  // G-44: スポンサー収入とゼロサム化のため基準×1.35。建設会社契約中は15%割引で打ち消し
  // 動的import回避＝ inlineで sponsorContracts を見て割引判定（sponsor.tsの公開定数に依存しないシンプルな実装）
  let discount = 0
  for (const c of (state.sponsorContracts ?? [])) {
    if (c.defId === 'sponsor-champ-b') { discount = 0.15; break }
  }
  return Math.round(base * 1.35 * (1 - discount))
}

/** 年間の設備維持費（万円）。部員数に比例する運営費は economy.ts 側で別計上する。 */
export function annualUpkeep(f: Facilities): number {
  let monthly = 0
  for (const def of FACILITIES) {
    monthly += def.upkeep[f[def.key]]
  }
  // 基礎運営費（コーチ・光熱・事務）。設備に依らず常にかかる固定費。
  return Math.round(monthly * 12 + 60)
}

/** アップグレード可能か */
export function canUpgrade(state: CareerState, key: FacilityKey): boolean {
  const lv = state.facilities[key]
  return lv < MAX_FACILITY_LV && state.budget >= nextUpgradeCost(state, key)
}

/** アップグレードを実行して新しい facilities と budget を返す */
export function upgradeFacility(state: CareerState, key: FacilityKey): CareerState {
  if (!canUpgrade(state, key)) return state
  const cost = nextUpgradeCost(state, key)
  const facilities: Facilities = { ...state.facilities, [key]: (state.facilities[key] + 1) as 1 | 2 | 3 | 4 | 5 }
  return {
    ...state,
    facilities,
    budget: state.budget - cost,
    log: [`${facilityDef(key).name}をLv${facilities[key]}に強化（-${cost}万）`, ...state.log].slice(0, 40),
  }
}
