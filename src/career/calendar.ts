// ============================================================
// career/calendar.ts — 年間カレンダー（週→月→シーズンフェーズ）
// 48週/年。現実の高校サッカー日程に準拠（Section1）。
// ============================================================

import type { SeasonPhase } from './types'

// 1年を48週として、週番号(1-48)を月(4月始まり)に対応づける
// 週4つ ≒ 1ヶ月
export function weekToMonth(week: number): number {
  // week1 = 4月第1週。月 = 4 + floor((week-1)/4)、12を超えたら巻き戻し
  const m = 4 + Math.floor((week - 1) / 4)
  return ((m - 1) % 12) + 1
}

export function weekLabel(week: number): string {
  const month = weekToMonth(week)
  const wkOfMonth = ((week - 1) % 4) + 1
  return `${month}月 第${wkOfMonth}週`
}

/** 週番号からシーズンフェーズを判定 */
export function phaseForWeek(week: number): SeasonPhase {
  // 夏合宿は夏全国（暦消費）の後（#32）。week20-21をcampフェーズとして扱う。
  if (week === 20 || week === 21) return 'camp'
  const month = weekToMonth(week)
  switch (month) {
    case 4: return 'spring'
    case 5:
    case 6: return 'summer-qualify'
    case 7: return 'summer-national'
    case 8: return 'camp'
    case 9:
    case 10:
    case 11: return 'winter-qualify'
    case 12:
    case 1: return 'winter-national'
    case 2: return 'preseason'
    case 3: return 'graduation'
    default: return 'spring'
  }
}

export const PHASE_LABEL: Record<SeasonPhase, string> = {
  'preseason': '新チーム始動',
  'spring': '新入生入部・春',
  'summer-qualify': '夏季大会 県予選',
  'summer-national': '夏季大会 全国',
  'camp': '夏合宿',
  'winter-qualify': '冬季大会 県予選',
  'winter-national': '冬季大会 全国',
  'graduation': '卒業・進路',
}

// その週に発火する大会・節目イベント（週番号で固定）。大会は「県予選」と「全国」を
// 別の暦週に分け、その間は通常の週次メニュー（練習・休養・調整）に戻れる（#11・現実的な期間）。
export interface CalendarTrigger {
  kind: 'summer-tournament' | 'winter-tournament' | 'summer-national' | 'winter-national'
      | 'intake' | 'graduation' | 'scout-result' | 'camp' | 'festival' | 'year-end'
}

// 大会の開催週（県予選→数週空けて全国）。予選と全国の間に約4週の通常メニュー期間
// （練習・回復・調整）を置く（#11）。初戦の勝ちやすさは予選の弱敵→強敵rampが担保する。
// 大会は「大会モード」で1試合ずつ消化し、暦も2試合で約1週進む(#11)。各大会が数週に渡るため、
// 大会の消費でトリガーが飛ばないよう開催週を十分離す（夏予選11→全国15→合宿20、冬予選33→全国38）。
export const SUMMER_QUALIFY_WEEK = 11   // 6月: 夏季 県予選
export const SUMMER_NATIONAL_WEEK = 15  // 7月: 夏季 全国（予選突破時のみ）
export const SUMMER_CAMP_WEEK = 20      // 夏合宿（夏全国が暦数週を消費し終えた後・#32）
export const WINTER_QUALIFY_WEEK = 33   // 11月: 冬季 県予選
export const WINTER_NATIONAL_WEEK = 38  // 12-1月: 冬季 全国（予選突破時のみ）
export const FESTIVAL_WEEK = 28         // 10月: 文化祭（年1回・単発イベント・events.ts generateFestivalWeek で生成）

/** 特定週のトリガー（大会開催週など）を返す */
export function triggerForWeek(week: number): CalendarTrigger | null {
  // 入部: 4月第1週(week1)
  if (week === 1) return { kind: 'intake' }
  if (week === SUMMER_QUALIFY_WEEK) return { kind: 'summer-tournament' }
  if (week === SUMMER_NATIONAL_WEEK) return { kind: 'summer-national' }
  if (week === SUMMER_CAMP_WEEK) return { kind: 'camp' }
  if (week === FESTIVAL_WEEK) return { kind: 'festival' }
  if (week === WINTER_QUALIFY_WEEK) return { kind: 'winter-tournament' }
  if (week === WINTER_NATIONAL_WEEK) return { kind: 'winter-national' }
  // スカウト勧誘判定: 2月第4週(week44)
  if (week === 44) return { kind: 'scout-result' }
  // 卒業・進路: 3月第2週(week46)
  if (week === 46) return { kind: 'graduation' }
  // 年度末: week48
  if (week === 48) return { kind: 'year-end' }
  return null
}
