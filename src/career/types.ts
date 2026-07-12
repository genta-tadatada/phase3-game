// ============================================================
// career/types.ts — フル版キャリアモードの状態定義
// 試合エンジンの Player/Tactics/Team を再利用しつつ、育成・経営・
// スカウト・複数年キャリアの状態を持つ。乱数は (rngSeed, year, week, 用途)
// から導出するので、セーブ/再開で完全に再現される（カーソル保持不要）。
// ============================================================

import type { Player, Tactics } from '../engine/types'
import type { AnnualBudget } from './economy'
import type { Tournament } from '../lib/tournament'

export const SAVE_VERSION = 1
export const WEEKS_PER_YEAR = 48

// --- 設備（補完D-1・各カテゴリ1〜4） ---
export interface Facilities {
  ground: 1 | 2 | 3 | 4 | 5      // グラウンド
  clubhouse: 1 | 2 | 3 | 4 | 5   // 部室・更衣室
  training: 1 | 2 | 3 | 4 | 5    // トレーニング（1=なし）
  dorm: 1 | 2 | 3 | 4 | 5        // 寮（1=なし・上限18）
  extras: string[]           // 追加設備id（補完D-2）
}

// --- スカウト候補（補完C） ---
export interface ScoutCandidate {
  id: string
  district: string           // 「○○地区」
  position: string           // 噂段階はポジションのみ
  discovery: number          // 発見度 0〜3
  spInvested: number
  // 発見度に応じて段階開示
  player: Player             // 実体（開示度で表示を絞る）
  repBadge: 'u15' | 'national-tresen' | 'pref-tresen' | null // 代表歴バッジ
  offer?: number             // 特待オファー段階 0=通常 / 1=特待 / 2=特別特待（お金で勧誘成功率UP）
  recruited: boolean
  rivalSnatched: boolean     // 逃してライバル校入り
}

export interface ScoutState {
  level: number              // 0=未解禁 1=県内 2=近県 3=地方 4=全国
  sp: number                 // 今季残スカウトポイント
  spPerWeek: number
  candidates: ScoutCandidate[]
  shortlist: string[]        // 勧誘リスト（候補id）
}

// --- 年間カレンダーのフェーズ ---
export type SeasonPhase =
  | 'preseason'        // 2-3月 新チーム始動・スカウト勧誘
  | 'spring'           // 4月 入部・始動
  | 'summer-qualify'   // 5-6月 夏季予選
  | 'summer-national'  // 7月 夏季全国
  | 'camp'             // 8月 合宿
  | 'winter-qualify'   // 9-11月 冬季予選
  | 'winter-national'  // 12-1月 冬季全国
  | 'graduation'       // 3月 卒業・進路

// --- 大会の進行状態（年間の各大会） ---
export interface SeasonState {
  summerBest: number | null  // 到達ラウンド（0=初戦敗退..）/ null=未実施
  winterReachedNational: boolean
  summerLabel: string | null
  winterLabel: string | null
  // アクティブな大会のトーナメントID（lib/tournament を使う際の参照）
}

// --- 卒業・進路（補完R-2／#53 進路ラダー・全名称架空） ---
// 7段ラダー: 海外プロ→プロ1部→プロ2部→プロ3部→社会人/大学強豪→一般大学→競技引退。
// 実在リーグ/クラブ名(J1/J2/J3/JFL等)は使わない（一般名詞のみ）。
export type Destiny =
  | 'pro-overseas' | 'pro-d1' | 'pro-d2' | 'pro-d3'  // プロ4階層（能力＋実績で上振れ）
  | 'semi-pro'      // 社会人サッカー／大学強豪（全国〜全国上位）
  | 'univ-soccer'   // 一般大学サッカー（県上位〜都道府県）
  | 'retire'        // 一般進路＝競技引退（市区町村以下）
/** プロ4階層のいずれかか（評判・殿堂カウント用）。 */
export function isProDestiny(d: Destiny): boolean {
  return d === 'pro-overseas' || d === 'pro-d1' || d === 'pro-d2' || d === 'pro-d3'
}
export interface GraduateResult {
  name: string
  position: string
  destiny: Destiny
  destinyLabel: string
  overall: number
}

// --- キャリア通算記録（補完R-1） ---
export interface CareerRecords {
  summerTitles: number
  winterTitles: number
  nationalApps: number
  graduates: number
  proPlayers: number         // プロ入りOB数
  proAlumni: { name: string; year: number; tier?: Destiny }[] // 出身プロ一覧（殿堂）。G-41 §5: tierで OB指導 を解放
  // G-41 §5: tier別のプロ排出累計。OB指導の解放判定に使用（プロ排出無しなら指導不可）
  proCountByTier?: { d3?: number; d2?: number; d1?: number; overseas?: number }
  bestPlayerName: string | null
  bestEleven: { pos: string; name: string; overall: number }[] // 歴代ベストイレブン（R-8）
  history: SeasonHistory[]
  // #72: 大会で初めて勝った年（次の大会終了でtier10スポンサー解放トリガー）。
  firstCompWinYear?: number
  // #72: スポンサー解放チュートリアルを既に1回見せたか
  sponsorIntroSeen?: boolean
}

export interface SeasonHistory {
  year: number
  summer: string
  winter: string
  reputationEnd: number
}

// --- 週次の練習プラン（メニュー枠＋選手割当） ---
// 各選手は週に1つのメニュー枠にだけ参加する（＝育成は取捨選択）。
// どの枠にも割り当てられなかった選手は「完全休養」（疲労回復のみ・成長なし）。
// G-41 §2: 練習枠は「基本3＋コーチ最大2＝最大5」に変更（トレ施設+1を削除しコーチの重要性UP）。
export const MIN_PRACTICE_LANES = 3
export const MAX_PRACTICE_LANES = 5
// G-41 §2: 練習枠は「コーチ陣」で決まる（トレ設備Lv2の+1効果は削除）。
//   基本3／コーチ1人につき+1（専属＋アシスタントで最大+2）。上限5。
export function practiceLaneCount(_facilitiesTraining: number, coaches: number): number {
  let n = MIN_PRACTICE_LANES                  // 3
  n += Math.max(0, coaches)                   // +コーチ数（最大2）
  return Math.min(MAX_PRACTICE_LANES, n)
}
export interface WeeklyPlan {
  lanes: { menuId: string }[]          // 練習メニュー枠（3〜6個・規模と設備で増える）
  assign: Record<string, number>       // playerId -> 枠index（未登録=完全休養）
  weekend: 'practice-match' | 'extra-training' | 'rest'
  practiceOpponent?: 'weak' | 'even' | 'strong' // 練習試合の相手強さ（事前選択・#22c）
  managerAction: 'meeting' | 'scout' | 'manage' | 'rest' | null
  meetingTarget: string | null // 面談対象playerId（後方互換・単数）
  meetingTargets?: string[]    // G-41 §4: 部室Lv連動の複数面談（Lv1=1人/Lv2-3=2人/Lv4=3人）。未指定なら meetingTarget をフォールバック
}

// 選手の所属グループ（クイック割当・表示用）
export type PracticeGroup = 'gk' | 'df' | 'mf' | 'fw'

// --- 夏合宿（7日サブモード・#34） ---
// 大会モードと同じく1タップ=1日進行。Day1-5=練習日／Day6=練習試合／Day7=帰宅。
// 各日に合宿イベント（スキル開花/能力上昇/性格の芽/絆=雰囲気/フレーバー）が発生する。
// 特殊能力(スキル)は「狙える数=skillTarget」を運で決め、skillDaysの日に1つずつ開花させる。
export type CampEventTag = 'skill' | 'boost' | 'bond' | 'personality' | 'match' | 'flavor' | 'choice'
export interface CampShownEvent {
  tag: CampEventTag
  title: string
  body: string
  detail?: string   // 効果の補足（「○○のスキル「△△」開花！」など）
  choice?: { options: { label: string; effectId: string }[] } // 監督の選択を迫るイベント（未解決なら選択待ち）
}
export interface CampState {
  year: number
  day: number               // 1..7（次に解決する日）。7を超えたら done
  skillTarget: number       // その年の合宿で「狙える」スキル習得数（運・campSkillCount で決定）
  skillDays: number[]        // スキル開花を発生させる日（1..6からskillTarget日を抽選）
  skillsGained: number       // これまで合宿で付与した数
  used: string[]             // この合宿で既出のイベントテンプレートid（同一合宿内の重複を防ぐ）
  pendingChoice?: boolean    // 現在「監督の選択待ち」か（reload復元用）
  queue: CampShownEvent[]    // 現在の日の「未表示」イベント（1イベントずつ表示するため）
  shown: { day: number; events: CampShownEvent[] }[] // 表示済みの各日イベント（まとめ・reload復元用）
  done: boolean
}

// （G-45: 文化祭の6日サブモード FestivalState は廃止。week28進入時の単発イベント
//   generateFestivalWeek（events.ts）に置き換えた。）

// --- 週次イベント ---
export interface WeekEvent {
  id: string
  kind: 'forced' | 'choice' | 'flavor' | 'news'
  title: string
  body: string
  // 選択肢（choice時）
  options?: { label: string; effectId: string }[]
  // G-03/G-28: 選択イベントで{name}置換した選手名を保持し、選択後の結果の地の文に同じ選手を差し込む
  actorName?: string
  actorName2?: string
  // フレーバー/ニュースの即時効果（UIで「影響」を明示するため。0や未指定は表示しない）
  effect?: { atmo?: number; rep?: number }
}

// --- キャリア全体の状態 ---
export interface CareerState {
  version: number
  rngSeed: number
  schoolName: string
  shortName: string
  managerName: string        // 監督名（プレイヤー）
  prefecture: string
  color: string

  year: number               // 1,2,3...
  week: number               // 1..WEEKS_PER_YEAR
  phase: SeasonPhase

  reputation: number         // 0〜100
  repTier?: number           // #53 直近に通知した評判ティア（昇格祝福の重複防止）
  budget: number             // 万円
  lastBudget?: AnnualBudget  // 直近の年間収支内訳（年度サマリー・経営画面の表示用）
  // G-41 §11: 年次収支履歴（経営画面のグラフ表示用・直近10年）。年度更新時に push。
  budgetHistory?: { year: number; income: number; expense: number; net: number }[]
  atmosphere: number         // 0〜100（Aチーム＝公式戦招集メンバーの雰囲気）
  atmosphereB?: number       // B/Cチーム（育成）の雰囲気
  weather?: string           // 今週の天候（補完L）
  selectionEnabled?: boolean // 入部セレクション（強豪校のみ・弱い応募者を不合格に）
  tutorialMode?: 'beginner' | 'expert' // チュートリアル量(#13)。初心者=基礎+丁寧な解放解説 / 経験者=簡潔
  pendingIntake?: string[] // 入部式で1人ずつ確認・設定する新入部員のplayer.id（名前/ポジ/背番号の確認導線）

  facilities: Facilities
  staff?: string[]            // 雇用中の専属スタッフid（採用費＋毎年の年俸＝恒常的なお金の使い道）
  manager?: import('./manager').Manager // #42 マネージャー（3年目あたり加入・疲労回復+/雰囲気底上げ/マンネリ緩和）
  // 2026-06-26: マネージャー専用ミニイベント状態（trait別4種+共通2種）。年初に発火プラン抽選、年内消費を追跡。
  managerEvents?: import('./manager').ManagerEventState
  roster: Player[]
  tactics: Tactics           // 基本（互角時）戦術
  tacticsLead?: Tactics       // リード時の戦術プリセット
  tacticsBehind?: Tactics     // ビハインド時の戦術プリセット
  lineup?: string[]           // 手動スタメン（フォーメーションスロット順の11 player.id。未設定/無効なら自動選出）
  setPieceTaker?: string      // セットプレー(FK/CK)キッカーの player.id
  pkTaker?: string            // PKキッカーの player.id

  scouting: ScoutState
  season: SeasonState
  records: CareerRecords
  lastQualifyChamp?: { summer: number; winter: number } // 直近で県予選優勝した年（前年王者シード判定用）
  natTitleYears?: number[] // 全国優勝した年の一覧（連覇の厳密判定用）
  lastNatPot?: number      // 直近の全国でのpot番号（potトレンド表示用＝全国の立ち位置の変化）
  pendingNational?: 'summer' | 'winter' // 県予選を突破し、全国大会が後日（別の暦週）に控えている状態(#11)
  // 開催中の大会（大会モード・#11完全版）。careerに永続しreloadでも再開可。暦は2試合で約1週進む。
  activeComp?: { kind: 'summer' | 'winter'; stage: 'qualify' | 'national'; tournament: Tournament; matchTick: number } | null
  // 開催中の夏合宿（7日サブモード・#34）。careerに永続しreloadでも再開可。日進行で物語イベント＋スキル開花。
  activeCamp?: CampState | null

  lastPlan: WeeklyPlan | null // 「先週と同じ↻」用
  menuStreak?: Record<string, number> // #28: メニューIDごとの連続採用週数（マンネリ判定用）
  pendingEvents: WeekEvent[]  // 週開始時に表示
  // #62: 3年引退後の翌週に表示する「新キャプテン選択画面」のためのフラグ。
  //   true の間は WeeklyScreen の代わりに new-captain 画面へ強制遷移。pickInitialCaptain でクリア。
  pendingCaptainChoice?: boolean
  // 定期考査の結果を翌週に出すための保留フラグ。選択週に即結果ではなく一週進んでから返却。
  pendingExam?: { study: boolean; askedYear: number; askedWeek: number } | null
  lastGraduates: GraduateResult[] // 直近の卒業生（年度サマリ表示用）
  pendingApplicants?: Player[] // セレクションON時の応募者プール（プレイヤーが選抜）
  admitCap?: number           // 合格させられる最大人数
  log: string[]               // 直近ニュース（最大40件）
  founded: boolean            // 創部済みフラグ
  // G-34: 招集メンバー超過チュートリアルを一度だけ出すフラグ（部員21人以上で発火）
  shownAFullTutorial?: boolean
  // G-41 §5: プロOB指導の使用記録（tierごとに今年使ったか）。年が変われば再使用可。
  //   キー: 'd3' | 'd2' | 'd1' | 'overseas'。値: 最後に使った year。
  obInstructionLast?: { d3?: number; d2?: number; d1?: number; overseas?: number }
  // G-44: スポンサー契約（main/uniform 2枠）。週進行で weeksLeft 減少・0で自動解約
  sponsorContracts?: { slot: 'main' | 'uniform'; defId: string; signedYear: number; signedWeek: number; weeksLeft: number }[]
  // G-22-④: 3年最後の大会演出が発火した年。week 32-38 の冬大会期間中、3年生は雰囲気+1（persistent multi-week 効果）
  seniorBoostYear?: number
}

// --- 練習メニュー定義（補完2.9） ---
// 練習メニューの分類タグ（UIのグルーピング用）。
//   攻撃＝得点に直結／守備＝守る練習／フィジカル＝体作り／その他＝戦術・実戦・調整・休養／GK＝GK専用。
export type TrainingCategory = '攻撃' | '守備' | 'フィジカル' | 'その他' | 'GK'

// メニュー型: 特化(0.65/0.15×1) / 標準(0.50/0.20×2) / 万能(0.35/0.25×3)
export type MenuFocus = 'specialized' | 'standard' | 'broad'

export interface TrainingMenu {
  id: string
  name: string
  // 主対象能力・副対象能力（重み係数は focus で自動決定）
  main: (keyof Player['abilities'] | 'saving' | 'gkIq')[]
  sub: (keyof Player['abilities'] | 'saving' | 'gkIq')[]
  fatigue: number            // この練習1スロットの疲労増（負=回復）
  group: 'all' | 'gk' | 'fw' | 'mf' | 'df'
  category: TrainingCategory // UI分類タグ
  focus?: MenuFocus          // 型(成長配分プロファイル)
  requiresTraining?: 1 | 2 | 3 | 4 | 5 // 必要トレーニング設備Lv
  weatherProof?: boolean     // 屋内/座学＝天候非依存
  quality?: number           // 設備解放メニューの効率係数（基本1.00／解放で上乗せ）
  desc: string
}
