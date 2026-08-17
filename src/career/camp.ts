// ============================================================
// career/camp.ts — 夏合宿（7日サブモード・#34）の進行ロジック
// 大会モードと同じく careerに永続(activeCamp)し、1日ずつ解決する。
//   Day1-5 = 練習日（合宿イベント：スキル開花/能力上昇/性格の芽/絆/フレーバー）
//   Day6   = 練習試合（手応え＝雰囲気＋調子。スキル開花も起こりうる）
//   Day7   = 帰宅イベント（締めの物語。スキル開花も起こりうる）
// スキルは「狙える数=skillTarget」を運(campSkillCount)で決め、skillDaysの日に1つずつ開花。
// 週の通常練習(成長/バランス)は advanceWeek 側で既に処理済み＝合宿は物語＋小さな上乗せ。
// ============================================================

import type { Player } from '../engine/types'
import { createRNG, hashSeed, type RNG } from '../engine/rng'
import type { CareerState, CampState, CampShownEvent } from './types'
import { campSkillCount, grantCampSkills } from './skillsAcquire'
import { CAMP_POOL, CAMP_CHOICES, CAMP_CHOICE_EFFECTS, type CampEventTemplate } from '../data/campEvents'
import { playerTag } from '../lib/labels'

const CAMP_DAYS = 7

function campRng(state: CareerState, salt: string): RNG {
  return createRNG(hashSeed(`${state.rngSeed}-${state.year}-camp-${salt}`))
}

/** 合宿開始：狙えるスキル数を運で決め、開花日(skillDays)を抽選する。 */
export function startCamp(state: CareerState): CampState {
  const rng = campRng(state, 'start')
  const target = campSkillCount(rng)
  // 1〜6日目のうち target 日を「スキル開花日」に（7日目=帰宅は締めなので原則含めない）。
  const pool = [1, 2, 3, 4, 5, 6]
  const skillDays: number[] = []
  for (let i = 0; i < target && pool.length > 0; i++) {
    const idx = Math.floor(rng.next() * pool.length)
    skillDays.push(pool.splice(idx, 1)[0])
  }
  skillDays.sort((a, b) => a - b)
  return { year: state.year, day: 0, skillTarget: target, skillDays, skillsGained: 0, used: [], queue: [], shown: [], done: false }
}

const AB_LABEL: Record<string, string> = {
  kick: 'キック', power: 'パワー', speed: 'スピード', technique: '技術',
  stamina: 'スタミナ', iq: 'IQ', defense: '守備', saving: 'セービング',
}

function fill(text: string, name: string, ability?: string, name2?: string): string {
  return text.replace(/\{name2\}/g, name2 ?? 'もう一人').replace(/\{name\}/g, name).replace(/\{ability\}/g, ability ? AB_LABEL[ability] ?? ability : '')
}
function abLabel(k: string): string { return AB_LABEL[k] ?? k }

function weightedPick<T extends { weight: number }>(arr: T[], rng: RNG): T {
  const tot = arr.reduce((s, x) => s + x.weight, 0)
  let r = rng.next() * tot
  for (const x of arr) { r -= x.weight; if (r <= 0) return x }
  return arr[arr.length - 1]
}

// イベントに似合う性格の選手を優先的に選ぶ（物語の説得力）。該当者がいなければ全員から。
function pickPlayerForEvent(roster: Player[], pers: string[] | undefined, rng: RNG): Player | null {
  const pool = roster.filter((p) => !p.retired)
  if (pool.length === 0) return null
  if (pers && pers.length > 0) {
    const matched = pool.filter((p) => pers.includes(p.personality))
    // 該当者がいれば7割の確率で性格マッチを優先（たまに意外な人物でも起こる＝硬直しない）
    if (matched.length > 0 && rng.next() < 0.7) return matched[Math.floor(rng.next() * matched.length)]
  }
  return pool[Math.floor(rng.next() * pool.length)]
}

// boost対象の能力を選ぶ。テンプレで特定能力を指定（kick/defense等）したらそれを使う＝本文と能力の整合性を保つ。
// 'random' or 未指定 はGK考慮のランダム選択にフォールバック。
function pickBoostAbility(p: Player, rng: RNG, prefer?: string): string {
  if (prefer && prefer !== 'random') return prefer
  if (p.isGK) return rng.next() < 0.6 ? 'saving' : (['power', 'speed', 'stamina', 'iq'][Math.floor(rng.next() * 4)])
  return (['kick', 'power', 'speed', 'technique', 'stamina', 'iq', 'defense'][Math.floor(rng.next() * 7)])
}

function applyBoost(roster: Player[], id: string, ability: string, amt: number): Player[] {
  return roster.map((p) => {
    if (p.id !== id) return p
    if (ability === 'saving') return p.gk ? { ...p, gk: { ...p.gk, saving: Math.min(99, p.gk.saving + amt) } } : p
    const k = ability as keyof Player['abilities']
    return { ...p, abilities: { ...p.abilities, [k]: Math.min(99, p.abilities[k] + amt) } }
  })
}

/** 指定した日(day)の出来事を生成し、能力等の効果を反映する（選択イベントの効果は選択時に別途適用）。
 *  shown/queue/day の管理はストア側で行う＝1イベントずつ表示するため。 */
export interface DayGen { roster: Player[]; atmosphere: number; skillsGained: number; used: string[]; events: CampShownEvent[] }
export function genCampDay(state: CareerState, day: number): DayGen {
  const camp = state.activeCamp!
  const rng = campRng(state, `day-${day}`)
  let roster = state.roster
  let atmosphere = state.atmosphere
  const events: CampShownEvent[] = []
  let usedOut = camp.used // 同一合宿の既出テンプレ（day1-5で更新）
  let skillsGained = camp.skillsGained
  // Z-2: 寮Lv5「合宿効率+10%」— 完備寮の達成感ご褒美。1人=年5万 fees増では永遠にペイしない
  //   超高額投資(×1.35補正後 18900万)に、最終盤の「夢」を与える小さなボーナス。
  const dormBonus = state.facilities.dorm >= 5 ? 1.10 : 1.0

  // --- スキル開花日なら、まず1つ開花させる（events直挿しは day6/7 のみ。
  //     練習日(day1-5)では下のdayEventsに「昼」枠として混ぜ、朝→昼→夜の時系列を維持する。） ---
  let skillEv: CampShownEvent | null = null
  if (camp.skillDays.includes(day) && skillsGained < camp.skillTarget) {
    const granted = grantCampSkills(roster, 1, campRng(state, `skill-${day}`))
    if (granted.gains.length > 0) {
      roster = granted.roster
      const g = granted.gains[0]
      // #8: そのスキル専用の開花エピソードを優先（無ければ汎用にフォールバック）
      const flavor = SKILL_EPISODE[g.id] ?? SKILL_FLAVOR[Math.floor(rng.next() * SKILL_FLAVOR.length)]
      skillEv = { tag: 'skill', title: flavor.title, body: fill(flavor.body, g.name), detail: `${playerTag(g.grade, g.pos, g.name)}が「${g.skill}」のコツを掴んだ！` }
      skillsGained++
    }
  }

  // day6/day7 のときはスキル開花を先頭に挿入（試合日/帰宅日の特例）
  if (skillEv && (day === 6 || day === 7)) events.push(skillEv)

  // --- 日タイプ別の出来事 ---
  if (day === 6) {
    // #13: 試合前の円陣（{name}入り・雰囲気を少し上げる）
    const preName = pickPlayerForEvent(roster, ['leader', 'fighter', 'hotblood'], rng)?.name ?? 'キャプテン'
    const pre = MATCHDAY_PRE[Math.floor(rng.next() * MATCHDAY_PRE.length)]
    atmosphere = Math.max(0, Math.min(100, atmosphere + 1))
    events.push({ tag: 'flavor', title: pre.title, body: fill(pre.body, preName), detail: '試合前の士気が高まった' })

    // 練習試合の日（手応え＝雰囲気＋全体の調子が少し上向く）
    const oppRoll = rng.next()
    const opp = oppRoll < 0.45 ? '格上の強豪校' : oppRoll < 0.8 ? '互角の好チーム' : '格下校'
    // 勝率は相手の強さ＋自チームの地力（評判）で決まる＝強いチームほど格上にも勝てる。
    const repEdge = (state.reputation - 40) / 220 // 評判が高いほど+（最大~0.27）
    const baseWin = opp === '格上の強豪校' ? 0.38 : opp === '互角の好チーム' ? 0.55 : 0.78
    const won = rng.next() < Math.max(0.1, Math.min(0.92, baseWin + repEdge))
    const a = won ? 2 + Math.floor(rng.next() * 2) : Math.floor(rng.next() * 2)
    const b = won ? Math.floor(rng.next() * 2) : 1 + Math.floor(rng.next() * 2)
    const mark = a > b ? '○' : a < b ? '●' : '△'
    const atmo = won ? (opp === '格上の強豪校' ? 6 : 4) : (opp === '格上の強豪校' ? 2 : -2)
    atmosphere = Math.max(0, Math.min(100, atmosphere + atmo))
    // 出場メンバー（A相当・先頭14人）の調子を少し動かす
    const cond = won ? 1 : -1
    const lineIds = new Set(roster.filter((p) => !p.retired).slice(0, 14).map((p) => p.id))
    roster = roster.map((p) => lineIds.has(p.id)
      ? { ...p, condition: Math.max(1, Math.min(5, p.condition + cond)) as 1 | 2 | 3 | 4 | 5 } : p)
    events.push({
      tag: 'match',
      title: '合宿最終日の練習試合',
      body: won
        ? `${opp}との練習試合に ${a}-${b} で勝利！ 一週間の手応えを結果で示した。`
        : `${opp}との練習試合は ${a}-${b}（${mark}）。悔しさが、最後のひと押しの糧になる。`,
      detail: won ? 'チームに自信がついた（雰囲気↑・調子↑）' : '課題が見えた（雰囲気・調子に影響）',
    })

    // #13: 試合後のミーティング（勝敗で内容が変わる・{name}入り）
    const postName = pickPlayerForEvent(roster, ['leader', 'genius', 'hardworker'], rng)?.name ?? 'キャプテン'
    const postPool = won ? MATCHDAY_POST_WIN : MATCHDAY_POST_LOSE
    const post = postPool[Math.floor(rng.next() * postPool.length)]
    events.push({ tag: 'flavor', title: post.title, body: fill(post.body, postName), detail: '反省会で次への課題を共有した' })
  } else if (day === 7) {
    // 帰宅イベント（締め）。疲労が少し抜け、やり切った充実感。
    roster = roster.map((p) => p.retired ? p : ({ ...p, fatigue: Math.max(0, p.fatigue - 6) }))
    atmosphere = Math.max(0, Math.min(100, atmosphere + 3))
    // #13: 帰宅日も3件程度に。荷造りの朝 → 締めのHOMECOMING → 来季への誓い。
    const r1Name = pickPlayerForEvent(roster, ['shy', 'timid', 'mypace'], rng)?.name ?? '一人'
    const r1 = RETURN_EXTRA[Math.floor(rng.next() * RETURN_EXTRA.length)]
    events.push({ tag: 'flavor', title: r1.title, body: fill(r1.body, r1Name), detail: undefined })
    const home = HOMECOMING[Math.floor(rng.next() * HOMECOMING.length)]
    events.push({ tag: 'flavor', title: home.title, body: home.body, detail: 'やり切った充実感（雰囲気↑・疲労が少し回復）' })
    const r2Name = pickPlayerForEvent(roster, ['leader', 'fighter'], rng)?.name ?? 'キャプテン'
    const r2 = RETURN_EXTRA.filter((e) => e.title !== r1.title)[Math.floor(rng.next() * (RETURN_EXTRA.length - 1))]
    events.push({ tag: 'flavor', title: r2.title, body: fill(r2.body, r2Name), detail: undefined })
  } else {
    // Day1-5 練習日：複数の出来事（#13で各日最低3・最大5に）。能力上昇は控えめ、絆/性格/フレーバー（＝キャラ愛着）を厚めに。
    // スキル開花がある日はそれも1件に数え合計3〜4件に（昼枠として下のdayEventsに混ぜる）。
    const want = skillEv ? 3 : 4
    const used = new Set(camp.used)
    // #10: 合宿の段階（序盤Day1-2／中盤Day3-4／終盤Day5）。段階に合うイベントだけを抽選し、
    //      その日の中では 朝→昼→夜 の順に並べる（「マメだらけの足が初日に出る」等の違和感を解消）。
    const segment: 'early' | 'mid' | 'late' = day <= 2 ? 'early' : day <= 4 ? 'mid' : 'late'
    const timeOrd = (t?: 'morning' | 'noon' | 'night') => (t === 'morning' ? 0 : t === 'night' ? 2 : 1)
    const dayEvents: { ord: number; ev: CampShownEvent }[] = []
    for (let i = 0; i < want; i++) {
      const tagRoll = rng.next()
      // boost(伸び)は控えめ、bond/personality/flavor(愛着)を厚く＝出来事数を増やしても伸びすぎない
      const tag: 'boost' | 'bond' | 'personality' | 'flavor' =
        tagRoll < 0.24 ? 'boost' : tagRoll < 0.48 ? 'bond' : tagRoll < 0.72 ? 'personality' : 'flavor'
      // 初年度はまだ卒業生がいない＝OB来訪は矛盾するので除外(#15)。#10: 段階(phase)に合うものだけ。
      const fresh = CAMP_POOL[tag].filter((t) => !used.has(t.id) && !(state.year === 1 && t.id === 'bo-ob') && (!t.phase || t.phase === segment))
      const tmpl: CampEventTemplate = weightedPick(fresh.length > 0 ? fresh : CAMP_POOL[tag], rng)
      used.add(tmpl.id)
      const target = pickPlayerForEvent(roster, tmpl.pers, rng)
      let ability: string | undefined
      let name2: string | undefined
      let builtDetail: string | undefined
      if (tmpl.effect?.boost && target) {
        ability = pickBoostAbility(target, rng, tmpl.effect.boost.ability)
        // Z-2: 寮Lv5なら +10% 効率（Math.round で 2→2, 3→3, 4→4, 5→6 etc. 切り上げ寄り）
        const amt = Math.round((tmpl.effect.boost.lo + Math.round(rng.next() * (tmpl.effect.boost.hi - tmpl.effect.boost.lo))) * dormBonus)
        roster = applyBoost(roster, target.id, ability, amt)
        builtDetail = `✨ ${playerTag(target.grade, target.slot ?? target.position, target.name)}の${abLabel(ability)} +${amt}`
        if (tmpl.effect.boost.pair) {
          // ペアイベント：もう一人も具体名で登場し、その選手も伸びる
          const pool2 = roster.filter((p) => !p.retired && p.id !== target.id)
          const second = pool2.length ? pool2[Math.floor(rng.next() * pool2.length)] : null
          if (second) {
            const ab2 = pickBoostAbility(second, rng, tmpl.effect.boost.ability)
            const amt2 = Math.round((tmpl.effect.boost.lo + Math.round(rng.next() * (tmpl.effect.boost.hi - tmpl.effect.boost.lo))) * dormBonus)
            roster = applyBoost(roster, second.id, ab2, amt2)
            name2 = second.name
            builtDetail += `／✨ ${playerTag(second.grade, second.slot ?? second.position, second.name)}の${abLabel(ab2)} +${amt2}`
          }
        }
      }
      if (tmpl.effect?.atmo) atmosphere = Math.max(0, Math.min(100, atmosphere + tmpl.effect.atmo))
      if (tmpl.effect?.condition && target) {
        roster = roster.map((p) => p.id === target.id
          ? { ...p, condition: Math.max(1, Math.min(5, p.condition + tmpl.effect!.condition!)) as 1 | 2 | 3 | 4 | 5 } : p)
      }
      if (tmpl.effect?.fatigueAll) {
        roster = roster.map((p) => p.retired ? p : ({ ...p, fatigue: Math.max(0, Math.min(100, p.fatigue + tmpl.effect!.fatigueAll!)) }))
      }
      const name = target?.name ?? 'チーム'
      dayEvents.push({
        ord: timeOrd(tmpl.time),
        ev: {
          tag: tmpl.tag,
          title: tmpl.title,
          body: fill(tmpl.body, name, ability, name2),
          detail: builtDetail ?? (tmpl.detail ? fill(tmpl.detail, name, ability, name2) : undefined),
        },
      })
    }
    // スキル開花は「昼練習の前後」に位置するのが自然＝ord=1 (noon) として混ぜる。
    if (skillEv) dayEvents.push({ ord: 1, ev: skillEv })
    // #10: その日の出来事を 朝→昼→夜 の順に整列して表示（安定ソート＝同時間帯は抽選順を保持）
    dayEvents
      .map((d, i) => ({ d, i }))
      .sort((a, b) => a.d.ord - b.d.ord || a.i - b.i)
      .forEach(({ d }) => events.push(d.ev))
    // この練習日に「監督の選択」を迫るイベントを末尾に出す（約55%・最大1件）。あなたは監督＝判断を下す。
    const freshCh = CAMP_CHOICES.filter((c) => !used.has(c.id))
    if (freshCh.length > 0 && rng.next() < 0.55) {
      const ch = freshCh[Math.floor(rng.next() * freshCh.length)]
      used.add(ch.id)
      events.push({ tag: 'choice', title: `🧭 監督の判断：${ch.title}`, body: ch.body, choice: { options: ch.options } })
    }
    usedOut = Array.from(used)
  }

  return { roster, atmosphere, skillsGained, used: usedOut, events }
}

// 監督の選択を適用：選んだ効果を反映し、結果テキストを当日のイベントに追記。pendingChoiceを解除。
export function applyCampChoice(state: CareerState, effectId: string): CareerState {
  const camp = state.activeCamp
  if (!camp) return state
  const eff = CAMP_CHOICE_EFFECTS[effectId]
  if (!eff) return { ...state, activeCamp: { ...camp, pendingChoice: false } }
  const rng = campRng(state, `choice-${camp.day}-${effectId}`)
  let roster = state.roster
  let atmosphere = Math.max(0, Math.min(100, state.atmosphere + (eff.atmo ?? 0)))
  // Z-2: 寮Lv5 の +10% 効率はここの選択イベントにも適用（runCampDay と一貫）
  const dormBonus = state.facilities.dorm >= 5 ? 1.10 : 1.0
  const parts: string[] = []
  if (eff.boost) {
    const target = pickPlayerForEvent(roster, undefined, rng)
    if (target) { const ab = pickBoostAbility(target, rng, eff.boost.ability); const amt = Math.round((eff.boost.lo + Math.round(rng.next() * (eff.boost.hi - eff.boost.lo))) * dormBonus); roster = applyBoost(roster, target.id, ab, amt); parts.push(`✨ ${playerTag(target.grade, target.slot ?? target.position, target.name)}の${abLabel(ab)} +${amt}`) }
  }
  if (eff.fatigueAll) { roster = roster.map((p) => p.retired ? p : ({ ...p, fatigue: Math.max(0, Math.min(100, p.fatigue + eff.fatigueAll!)) })); parts.push(eff.fatigueAll < 0 ? '💤 全体の疲労が回復' : '😓 全体の疲労+') }
  if (eff.condition) {
    const ids = new Set(roster.filter((p) => !p.retired).slice(0, 14).map((p) => p.id))
    roster = roster.map((p) => ids.has(p.id) ? { ...p, condition: Math.max(1, Math.min(5, p.condition + eff.condition!)) as 1 | 2 | 3 | 4 | 5 } : p)
    parts.push(eff.condition > 0 ? '😊 主力の調子↑' : '主力の調子↓')
  }
  if (eff.atmo) parts.push(eff.atmo > 0 ? '🔥 チームの雰囲気↑' : '💧 チームの雰囲気↓')
  // 直近の日のイベント末尾に「監督の判断」の結果（具体的な変化）を追記
  const result: CampShownEvent = { tag: eff.boost ? 'boost' : 'bond', title: '監督の判断 → 結果', body: eff.text, detail: parts.join('／') || undefined }
  const shown = camp.shown.map((d, i) => i === camp.shown.length - 1 ? { ...d, events: [...d.events, result] } : d)
  return { ...state, roster, atmosphere, activeCamp: { ...camp, pendingChoice: false, shown } }
}

const DAY_LABEL: Record<number, string> = {
  1: '1日目', 2: '2日目', 3: '3日目', 4: '4日目', 5: '5日目', 6: '6日目（練習試合）', 7: '7日目（帰宅）',
}
export function campDayLabel(day: number): string { return DAY_LABEL[day] ?? `${day}日目` }
export const CAMP_TOTAL_DAYS = CAMP_DAYS

// スキル開花の演出文（{name}）。能力名は出さず「掴んだ」物語に寄せる。
const SKILL_FLAVOR = [
  { title: '掴んだ！', body: '反復の末、{name}の中で何かがつながった瞬間だった。' },
  { title: '開眼', body: 'コーチも目を見張った。{name}が殻を破った。' },
  { title: '夏の置き土産', body: 'この一週間がなければ届かなかった。{name}が新しい武器を手にした。' },
  { title: '汗の結晶', body: '誰よりも残って練習した{name}に、ご褒美のようなひらめきが訪れた。' },
  { title: 'ひと皮むけた', body: '紅白戦で見せた{name}のプレーに、仲間から歓声が上がった。' },
]

// #8: スキルごとの専用開花エピソード（{name}）。そのスキルに合った物語で、汎用文を置き換える。
//     能力名は出さず情景で語る。該当が無いスキルはSKILL_FLAVORにフォールバック。
const SKILL_EPISODE: Record<string, { title: string; body: string }> = {
  'free-kick':   { title: '居残りの壁打ち', body: '日が暮れても{name}はFKの練習をやめなかった。狙った隅へ、ボールが吸い込まれ始めた。' },
  ck:            { title: '精密なキック', body: '何百本目のCKだろうか。{name}の蹴る軌道が、ピタリと味方の頭に合うようになった。' },
  crosser:       { title: 'サイドの精度', body: '走り込みながらの折り返しを反復した{name}。クロスが面白いように合い始めた。' },
  pk:            { title: '腹をくくる', body: '最後はメンタルだと{name}は言った。GKと向き合っても、もう目線は揺れない。' },
  finisher:      { title: '一瞬の冷静さ', body: '決めきれなかった悔しさを糧に、{name}はゴール前で落ち着きを覚えた。' },
  dribbler:      { title: '緩急を掴む', body: 'マーカー役を相手に抜き続けた{name}。仕掛けの緩急が、相手の重心を外していく。' },
  'counter-ace': { title: '裏への一歩', body: '誰よりも速く走り込む{name}。スペースへ抜け出す一歩目が、別物になった。' },
  header:        { title: '空中戦の支配者', body: '居残りのヘディング練習。{name}が競り合いで競り負けなくなった。' },
  tackler:       { title: '球際の執念', body: '泥だらけになって1対1を繰り返した{name}。ボールへの寄せが一段と鋭くなった。' },
  'press-master':{ title: '奪い返すカン', body: '前から追い続けた{name}。奪いどころを察知して、高い位置でボールを刈り取り始めた。' },
  anchor:        { title: '最終ラインの声', body: '紅白戦で最後尾から指示を出し続けた{name}。守備に一本、芯が通った。' },
  playmaker:     { title: '広い視野', body: '一歩引いて全体を見るようになった{name}。次の次が見える司令塔の兆しを見せた。' },
  'pk-stopper':  { title: '読みの一歩', body: 'GKの{name}が延々とPKを受け続けた。蹴り手の重心から、跳ぶ方向が読めるようになってきた。' },
  'shot-stopper':{ title: '壁になる', body: 'シュートを浴び続けたGKの{name}。どんな角度からも、まず体を運べるようになった。' },
  captaincy:     { title: '夜のミーティング', body: '消灯後、{name}が部屋を回って仲間に声をかけていた。背中でチームを引っ張る覚悟が芽生えた。' },
  mentor:        { title: '後輩の輪の中で', body: '下級生に囲まれて笑う{name}。最上級生として、チームの空気を支える存在になった。' },
  'mood-maker':  { title: 'ムードの中心', body: 'きつい練習も{name}の一声で笑いに変わる。チームの太陽のような存在になった。' },
  spark:         { title: '火がついた', body: '紅白戦の悔しい負けに、{name}が人知れず拳を握っていた。試合で燃える闘志が宿った。' },
  'big-game':    { title: '大舞台を想う', body: '満員のスタンドを想像しながら{name}はシュートを打ち続けた。大一番でこそ燃える心臓を手に入れた。' },
  'hard-trainer':{ title: '誰よりも長く', body: '全体練習が終わっても{name}はグラウンドに残っていた。練習で伸びる才能が花開いた。' },
  'iron-body':   { title: 'タフネス', body: '二部練を平然とこなす{name}。連戦でも崩れない丈夫な身体を手に入れた。' },
  'stamina-king':{ title: '止まらない', body: '最後の走り込みでも先頭を譲らなかった{name}。終盤も運動量が落ちない無尽蔵のスタミナを得た。' },
  'quick-heal':  { title: '回復の早さ', body: 'ケアを欠かさない{name}は、翌朝にはケロリとしていた。疲れを残さない体質が身についた。' },
  'early-bird':  { title: '早咲きの芽', body: '下級生ながら堂々とプレーする{name}。早くから大きく伸びる素質が顔を出した。' },
  'late-bloomer':{ title: '最終日の覚醒', body: '合宿最終日、ふと殻を破ったように{name}の動きが変わった。これから一気に伸びる予感がした。' },
}

const HOMECOMING = [
  { title: '帰りのバス', body: '行きより少したくましくなった顔ぶれ。窓の外を流れる景色を見ながら、それぞれが秋を思った。' },
  { title: '解散、そして', body: '「お疲れ様でした！」校門前で解散。この夏が、チームを一段上へ押し上げた。' },
  { title: '日に焼けた背中', body: '真っ黒に日焼けした背中が並ぶ。誰もが、確かな手応えを持って帰路についた。' },
]

// #13: 試合日(Day6)の前後を厚く。試合前の円陣／試合後のミーティング。{name}入り。
const MATCHDAY_PRE = [
  { title: '試合前の円陣', body: '練習試合を前に、{name}を中心に円陣を組む。「一週間の成果、ぶつけよう」声に熱がこもる。' },
  { title: '最終調整', body: '朝の軽めの調整。{name}が入念にストレッチをしながら、静かに闘志を燃やしていた。' },
]
const MATCHDAY_POST_WIN = [
  { title: '試合後のミーティング', body: 'ベンチ前に集まっての反省会。「ここまでやれた」——{name}の表情に、確かな自信がにじんでいた。' },
  { title: '手応えの共有', body: '勝因をみんなで話し合う。{name}が掴んだ感覚を、チーム全員で言葉にしていった。' },
]
const MATCHDAY_POST_LOSE = [
  { title: '試合後のミーティング', body: '悔しい結果を全員で受け止める。「何が足りなかったか」——{name}が真っ先に口を開いた。' },
  { title: '課題の洗い出し', body: '負けの中にこそ学びがある。{name}が気づいた課題を、チームで共有した。' },
]
// #13: 帰宅日(Day7)の締めを厚く。荷造りの朝／来季への誓い。{name}入り。
const RETURN_EXTRA = [
  { title: '荷造りの朝', body: '宿舎を発つ朝。{name}が忘れ物がないか、部屋を何度も見回していた。名残惜しい一週間だった。' },
  { title: '来季への誓い', body: '帰りのバスで、{name}がぽつりと「次は全国だ」とつぶやいた。その一言に、何人かが静かにうなずいた。' },
  { title: '見送りの一礼', body: '世話になった宿舎の人たちへ、{name}を先頭に全員で深く一礼。礼を欠かさないチームだ。' },
]
