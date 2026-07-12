// ============================================================
// engine/types.ts — Phase3 高校サッカー監督シム 中核型定義
// GDD 補完A / I / R-1 準拠。エンジンは React 非依存・決定的。
// ============================================================

// --- 能力値（フィールドプレイヤー7項目・GDD Section 2.1） ---
export interface Abilities {
  kick: number      // キック精度
  power: number     // パワー
  speed: number     // スピード
  technique: number // 技術
  stamina: number   // スタミナ
  iq: number        // サッカーIQ
  defense: number   // 守備
}

export type AbilityKey = keyof Abilities

// --- GK固有2能力（GDD Section 2.2） ---
export interface GKAbilities {
  saving: number // セービング
  gkIq: number   // GK-IQ
}

// --- 性格12種（GDD Section 2.4・4軸×3段階） ---
export type Personality =
  // 軸1 社会性
  | 'leader' | 'moodmaker' | 'troublemaker'
  // 軸2 メンタル
  | 'genius' | 'shy' | 'timid'
  // 軸3 情熱
  | 'fighter' | 'hotblood' | 'egoist'
  // 軸4 勤勉さ
  | 'hardworker' | 'mypace' | 'lazy'

// --- 身長の成熟タイプ（隠しパラメータ・MVPでは生成のみ） ---
export type MaturityType = 'early' | 'normal' | 'late'

// --- 調子（5段階・GDD Section 2.12） ---
export type Condition = 1 | 2 | 3 | 4 | 5 // 1=絶不調 ... 5=絶好調

// --- ポジション種別（GDD 補完A-2の7ポジション + GK） ---
export type PositionType = 'GK' | 'CB' | 'SB' | 'WB' | 'DM' | 'CM' | 'AM' | 'WF' | 'CF'

// --- フォーメーション（GDD Section 3.1） ---
export type Formation =
  | '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '3-4-3'

// --- 戦術プリセット項目（GDD Section 3.1） ---
export type Mentality = 'ultra-attack' | 'attack' | 'balance' | 'defense' | 'ultra-defense'
export type PressIntensity = 'high' | 'mid' | 'low'
export type DefenseLine = 'high' | 'mid' | 'low'
export type AttackWidth = 'wide' | 'mid' | 'central'
export type BuildUpSpeed = 'fast' | 'mid' | 'slow'

export interface Tactics {
  formation: Formation
  mentality: Mentality
  press: PressIntensity
  defenseLine: DefenseLine
  width: AttackWidth
  buildUp: BuildUpSpeed
  setPiece: boolean
}

// --- 選手 ---
export interface Player {
  id: string
  name: string
  grade: 1 | 2 | 3          // 学年
  abilities: Abilities
  isGK: boolean
  gk: GKAbilities | null    // GKのみ
  heightTier: number        // 1〜9（GDD 2.3.1）
  maturity: MaturityType
  personality: Personality
  number?: number           // 背番号（自動割当＋手動変更可・名前と併記）
  fatigue: number           // 0〜100
  condition: Condition
  position: PositionType     // 生来の得意ポジション（能力傾向・表示用のヒント）
  slot?: PositionType        // 試合での配置スロット（採点はこれを優先。未指定ならpositionに従う）
  // --- キャリアモード用の任意拡張（試合エンジンは未使用） ---
  skills?: string[]         // 習得スキルid（補完2.11）
  isCaptain?: boolean
  seasonGoals?: number      // 今季得点
  seasonApps?: number       // 今季出場数
  joinedYear?: number       // 入部年（卒業判定用）
  squad?: 'A' | 'B' | 'C'   // 所属チーム（A=公式戦招集 / B・C=育成）
  awakened?: boolean        // 覚醒経験フラグ（多重覚醒の抑制）
  retired?: boolean         // 3年が冬大会終了で引退（#33・在籍はするが試合/練習に出ない。年度末に卒業）
  cramWeeks?: number        // #31: 赤点の補習で練習に出られない残り週数（>0の間は練習スキップ・試合には出られる）
  injuryWeeks?: number      // G-24: 練習で痛めた怪我の残り週数（練習も試合も出られない・主に練習スタミナ管理ミスで発生）
  nationalRep?: boolean     // #37: 年代別代表選出歴（代表合宿で成長・プロ率UPの早期シグナル）
  classroom?: 1 | 2 | 3 | 4 | 5 | 6 // G-22-A: 学年内の所属クラス（入部時にランダム配属・進級時持ち上がり）
  hasGirlfriend?: boolean   // G-22-A: 文化祭で彼女ができたフラグ（G-39 で継続/破局を扱う）
}

// --- チーム ---
export interface Team {
  id: string
  name: string              // 架空校名
  shortName: string         // 略称（ブラケット表示用）
  prefecture: string        // 都道府県（実在名OK）
  color: string             // ブランドカラー（HEX）
  players: Player[]         // スタメン11 + 控え
  tactics: Tactics          // 基本（互角時）プリセット
  tacticsLead?: Tactics     // リード時プリセット（省略時は基本を使用）
  tacticsBehind?: Tactics   // ビハインド時プリセット（省略時は基本を使用）
  managerSkill: number      // 監督能力 0〜100（敵AIの試合中対応に影響）
  reputation: number        // 評判 0〜100
  isPlayer: boolean         // プレイヤーチームか
  setPieceTakerId?: string  // セットプレーキッカー（指定時はこの選手が蹴る）
  pkTakerId?: string        // PKキッカー（指定時は最初に蹴る）
  feature?: string          // #30/#45: チームの特色タグ（堅守速攻・大型FW 等・表示用）
  seeded?: boolean          // #30: 全国シード校（一回戦免除）か
}

// --- 試合中のチーム状態（揮発・1試合内） ---
export interface MatchTeamState {
  team: Team
  score: number
  atmosphere: number        // 0〜100（雰囲気・試合中変動）
  // 出場中11人の揮発スタミナ（player.id -> 残スタミナ0〜100）
  liveStamina: Record<string, number>
}

// --- 試合内イベントの種類 ---
export type MatchEventKind =
  | 'kickoff' | 'midfield' | 'chance' | 'half-chance' | 'set-piece'
  | 'foul' | 'foul-yellow' | 'foul-red' | 'foul-none' | 'injury' | 'flavor'
  | 'goal' | 'half-time' | 'full-time'

// --- 1ステップの結果（観戦UI・実況に使う） ---
export interface StepResult {
  step: number              // 0〜17（前半0-8・後半9-17）
  minute: number            // 表示用の分
  side: 'home' | 'away' | null // どちらの攻撃か
  kind: MatchEventKind
  text: string              // 実況テキスト
  scored: boolean           // このステップで得点が入ったか
  homeScore: number
  awayScore: number
  // 2Dアニメ用の簡易ボール位置（0=自陣ゴール 〜 1=敵ゴール、home視点）
  ballX: number
  ballY: number
}

// --- 新試合エンジン（ポゼッション・チェーン型）: 選手が絡む1プレー = MatchBeat ---
export type BeatAction =
  | 'kickoff' | 'pass' | 'dribble' | 'carry'
  | 'tackle' | 'intercept' | 'clearance' | 'gk-claim'
  | 'shot-goal' | 'shot-saved' | 'shot-off' | 'shot-blocked' | 'corner'
  | 'foul-none' | 'foul-yellow' | 'foul-red' | 'throw-in' | 'goal-kick'
  | 'injury' | 'flavor' | 'half-time' | 'full-time' | 'extra-start' | 'pk' | 'pk-goal' | 'pk-save'
  // F7: 試合中の任意采配ポイント（前半中盤・後半中盤）。試合進行ループが停止する目印。
  | 'sub-window'

export interface MatchBeat {
  i: number                 // 連番
  minute: number            // 表示用の分
  side: 'home' | 'away' | null // どちらの攻撃か
  zone: number              // 0..4（攻撃側視点。4=シュートゾーン）
  lane: 'L' | 'C' | 'R'
  ballX: number             // 0..1（左右）
  ballY: number             // 0..1（home視点: 0=自陣ゴール / 1=敵ゴール）
  action: BeatAction
  actorName?: string        // ボールに絡んだ選手
  actorId?: string
  targetName?: string       // パスの受け手
  targetId?: string
  text: string              // 実況
  homeScore: number
  awayScore: number
}

export interface MatchStats {
  possessionHome: number    // 0〜100（home支配率）
  shots: { home: number; away: number }
  sot: { home: number; away: number }     // 枠内シュート
  corners: { home: number; away: number }
  fouls: { home: number; away: number }
}

// --- 試合の最終結果 ---
export interface MatchResult {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  beats?: MatchBeat[]       // 新エンジンのプレー列（観戦リプレイ用・新エンジンのみ）
  stats?: MatchStats        // 試合スタッツ（新エンジンのみ）
  steps: StepResult[]       // 互換: beatsから導出した簡易ステップ（旧UI用）
  winnerId: string | null   // null = 引き分け（PK前）
  decidedByPK: boolean
  homePK?: number
  awayPK?: number
  scorers: { teamId: string; playerId: string; playerName: string; minute: number }[]
}
