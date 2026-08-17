// ============================================================
// career/init.ts — 創部（新設私立校のゼロスタート）
// 1年目は創部メンバー＝全員1年生16人。評判0・設備全Lv1・スカウトなし。
// ============================================================

import { createRNG, hashSeed } from '../engine/rng'
import { defaultTactics } from '../engine/generate/team'
import { shortenSchoolName } from '../data/schools'
import { findPrefecture } from '../data/prefectures'
import { generateRecruit, buildFoundingSquad, FOUNDING_BOOST, FOUNDING_CLAMP } from './recruit'
import { autoAssignSquads } from './squad'
import { assignJerseyNumbers } from './jersey'
import { WEEKS_PER_YEAR, SAVE_VERSION, type CareerState } from './types'
import { phaseForWeek } from './calendar'

// seedOverride: デバッグ検証（?festival=123 等）で創部から完全再現するための固定シード。通常プレイでは渡さない。
export function createCareer(schoolName: string, prefecture: string, managerName?: string, tutorialMode: 'beginner' | 'expert' = 'beginner', seedOverride?: number): CareerState {
  const cleanName = schoolName.trim() || '蒼空学院'
  const cleanManager = (managerName ?? '').trim() || '名無し監督'
  const seed = seedOverride ?? ((hashSeed(cleanName) ^ (Date.now() & 0xffffff)) >>> 0)
  const rng = createRNG(seed)
  const pref = findPrefecture(prefecture)

  // 創部メンバー17人（1年8/2年6/3年3・評判0）。各学年から集まった部員。
  // ポジション構成は固定（4-4-2に合わせた配分）／強さ（tier）だけ学年内でシャッフル＝当たり選手のポジションは毎回変わる。
  const roster = buildFoundingSquad(rng).map((slot) =>
    generateRecruit(rng, {
      position: slot.position,
      reputation: 0,
      grade: slot.grade,
      // tier別の底上げ（強いのは3年スター＋2年good1人だけ＝#37）。
      // D群(2026-08-17): 1年=weak / 初年度2年=normal で学年差を付けた（詳細は recruit.ts のコメント）
      strengthBoost: FOUNDING_BOOST[slot.tier],
      // tier別の能力上限（star=60 / good=52 / normal=46 / weak=44）
      clampMax: FOUNDING_CLAMP[slot.tier],
      // 創部メンバーは指定ポジが本職になるよう強めのポジション補正（#36・初期段階のみ）
      biasMult: 1.9,
      // 入部年: 3年=2年前 / 2年=1年前 / 1年=今年 として卒業判定に整合させる
      joinedYear: 1 - (slot.grade - 1),
    }),
  )
  // A/B/Cチーム自動割当（創部は全員A）。位置は指定どおり維持（強バイアスで指定ポジが本職＝#36）。
  const assigned = assignJerseyNumbers(autoAssignSquads(roster))
  // キャプテンは3年生スターの中からIQ最高（チームの精神的支柱）
  const seniors = assigned.filter((p) => p.grade === 3)
  const captain = (seniors.length > 0 ? seniors : assigned).sort((a, b) => b.abilities.iq - a.abilities.iq)[0]
  captain.isCaptain = true
  const g1 = assigned.filter((p) => p.grade === 1).length
  const g2 = assigned.filter((p) => p.grade === 2).length
  const g3 = assigned.filter((p) => p.grade === 3).length

  return {
    version: SAVE_VERSION,
    rngSeed: seed,
    schoolName: cleanName,
    shortName: shortenSchoolName(cleanName),
    managerName: cleanManager,
    prefecture: pref.name,
    color: '#f4a261',

    year: 1,
    week: 1,
    phase: phaseForWeek(1),

    reputation: 0,
    budget: 200, // 万円（学校予算・初年度）
    atmosphere: 50,
    atmosphereB: 50,
    selectionEnabled: false,
    tutorialMode,
    // F3: 天候システム解放前は晴れ固定（解説イベント前に雨が降って混乱しないよう）。
    //     year1 week5の解説イベント時に engine.ts 側で確定で雨を発生させる。
    weather: '晴れ',

    facilities: { ground: 1, clubhouse: 1, training: 1, dorm: 1, extras: [] },
    staff: [],
    roster: assigned,
    tactics: defaultTactics('4-4-2'),

    scouting: { level: 0, sp: 0, spPerWeek: 0, candidates: [], shortlist: [] },
    season: {
      summerBest: null, winterReachedNational: false,
      summerLabel: null, winterLabel: null,
    },
    records: {
      summerTitles: 0, winterTitles: 0, nationalApps: 0,
      graduates: 0, proPlayers: 0, proAlumni: [], bestPlayerName: null, bestEleven: [], history: [],
    },

    lastPlan: null,
    lastGraduates: [],
    pendingEvents: [
      {
        id: 'founding',
        kind: 'flavor',
        title: '創部',
        body: `${cleanName}にサッカー部ができた！\n部員は${g1 + g2 + g3}人。内訳は1年${g1}人・2年${g2}人・3年${g3}人。\n${captain.name}たち3年生は、地域クラブ出身の即戦力だ。\n評判も設備もまだゼロ。まずは最初の1勝をめざそう！`,
      },
      // 初心者ガイド(#13)：サッカー/ゲームの基礎を最初に説明（経験者は表示しない）
      ...(tutorialMode === 'beginner' ? [{
        id: 'tutorial-basics',
        kind: 'flavor' as const,
        title: '🔰 はじめに（サッカーの基礎）',
        body: 'サッカーは11人。ポジションは GK・DF（CB・SB）・MF（DM・CM・AM・WB）・FW（WF・CF）に分かれる。\n選手にはそれぞれ得意なポジションがあり、合った場所に置けば力を出す。\n毎週の練習で選手を育て、週末に試合か休養を選び、年2回の大会に挑む。最初にできるのは練習と週送りだけだが、チームが育つにつれて手を出せることが増えていく。\nまずは1週、進めてみよう。',
      }] : []),
    ],
    log: [`${cleanName} サッカー部を創部（${pref.name}）`],
    founded: true,
    // 創部メンバーは入部式で1人ずつ顔合わせ（名前/ポジ/背番号を確認・設定できる＝愛着の起点）
    pendingIntake: assigned.map((p) => p.id),
  }
}

export const WEEKS = WEEKS_PER_YEAR
