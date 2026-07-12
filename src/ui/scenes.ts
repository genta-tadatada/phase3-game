// ============================================================
// ui/scenes.ts — 画面ごとの背景シーン解決
//   本番素材は public/bg/{scene}.webp（GPT Image 2.0 生成）。
//   個別に差し替えたい場合は SCENE_FILE を編集する。
// ============================================================

import type { CareerScreen } from '../store/careerStore'
import { BASE } from './asset'

export type SceneId = 'ground' | 'gym' | 'locker' | 'stadium' | 'stadium-grand' | 'clubroom' | 'title'

// 本番のGPT生成PNGを使用。
const BG_EXT = '.webp'

// シーンID → 実ファイル名（拡張子なし）。
const SCENE_FILE: Record<SceneId, string> = {
  ground: 'ground',
  gym: 'gym',
  locker: 'locker', // GPT Image生成のロッカールーム背景（名簿/編成/ポジション/入部式で使用）
  stadium: 'stadium',
  'stadium-grand': 'stadium-grand',
  clubroom: 'clubroom',
  title: 'title',
}

// 画面 → シーン。グラウンド/体育館/ロッカールームを中心に割り当て。
const SCREEN_SCENE: Record<CareerScreen, SceneId> = {
  title: 'title',         // タイトル専用背景
  weekly: 'ground',       // 週次練習（晴天時）
  roster: 'locker',       // 部員名簿＝ロッカールーム
  squad: 'locker',        // メンバー編成
  selection: 'locker',    // 入部セレクション
  intake: 'locker',       // 入部式＝ロッカールーム（新入部員の顔合わせ）
  tactics: 'gym',         // 戦術ボード＝体育館（室内）
  lineup: 'ground',       // スタメン・フォーメーション＝ピッチ
  positions: 'locker',    // ポジション配属＝ロッカールーム
  scout: 'clubroom',      // スカウト＝監督室
  manage: 'clubroom',     // 経営・設備
  summary: 'ground',      // 年度サマリー・卒業
  camp: 'ground',         // 夏合宿＝真夏のグラウンド
  'new-captain': 'locker',// 新キャプテン選択＝ロッカールーム（部活らしい節目）
  records: 'stadium',     // 記録・殿堂＝栄光の舞台
  'comp-bracket': 'stadium',
  'comp-match': 'stadium',
  'comp-result': 'stadium',
}

/** 週次画面は悪天候かつ体育館がある時だけ室内へ。体育館が無ければ屋外（天候別背景が出る） */
export function sceneForScreen(screen: CareerScreen, weather?: string | null, hasGym = false): SceneId {
  if (screen === 'weekly' && hasGym && weather && /雨|雪|嵐|台風|寒波|荒/.test(weather)) return 'gym'
  return SCREEN_SCENE[screen] ?? 'ground'
}

// 天候別の背景バリエーション（無ければ sceneBaseUrl にフォールバック）。
// ground: 晴れ→ground-sunny / 雨→ground-rain / 雪・寒波→ground-snow
// stadium: 雨→stadium-rain / 雪・寒波→stadium-night
function weatherVariant(scene: SceneId, weather?: string | null): string | null {
  if (!weather) return null
  if (scene === 'ground') {
    if (weather === '晴れ') return 'ground-sunny'
    if (weather === '雨') return 'ground-rain'
    if (weather === '雪' || weather === '寒波') return 'ground-snow'
  }
  if (scene === 'stadium') {
    if (weather === '雨') return 'stadium-rain'
    if (weather === '雪' || weather === '寒波') return 'stadium-snow'
  }
  return null
}

/** シーンID → 背景画像URL（天候バリエーション優先・vite base 対応） */
export function sceneUrl(scene: SceneId, weather?: string | null): string {
  const v = weatherVariant(scene, weather)
  return `${BASE}bg/${v ?? SCENE_FILE[scene]}${BG_EXT}`
}

/** フォールバック用のベース背景URL（天候バリエーション画像が無い場合に使用） */
export function sceneBaseUrl(scene: SceneId): string {
  return `${BASE}bg/${SCENE_FILE[scene]}${BG_EXT}`
}
