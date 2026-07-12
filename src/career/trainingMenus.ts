// ============================================================
// career/trainingMenus.ts — 練習メニュー定義（18メニュー版）
// focus別重み: 特化 main 0.65/sub 0.15×1 / 標準 main 0.50/sub 0.20×2 / 万能 main 0.35/sub 0.25×3
// 神バランス: 7能力すべて 1.85〜2.00 帯（±4%）に着地
// 解放: Lv1=7+休養+GK1 / Lv2=+3+GK1 / Lv3=+3 / Lv4=+3
// ============================================================

import type { TrainingMenu } from './types'

export const TRAINING_MENUS: TrainingMenu[] = [
  // --- 攻撃（4） ---
  { id: 'pass',    name: 'パス練習',     main: ['kick'],      sub: ['technique', 'iq'],         fatigue: 5,  group: 'all', category: '攻撃',     focus: 'standard',    desc: 'パスの精度を磨く。連携の土台。' },
  { id: 'dribble', name: 'ドリブル練習', main: ['technique'], sub: ['speed'],                   fatigue: 8,  group: 'all', category: '攻撃',     focus: 'specialized', desc: '個人技で相手を抜く。テクニック特化。' },
  { id: 'shoot',   name: 'シュート練習', main: ['kick'],      sub: ['power', 'technique'],      fatigue: 8,  group: 'all', category: '攻撃',     focus: 'standard',    desc: '決定力を磨く。キック＋パワー＋テク。' },
  { id: 'combo',   name: 'コンビネーション練習', main: ['iq'], sub: ['kick', 'technique', 'stamina'], fatigue: 9, group: 'all', category: '攻撃', focus: 'broad',       requiresTraining: 3, desc: '崩しの形を作る。連携系の万能練習。' },

  // --- 守備（4） ---
  { id: 'defense1v1',  name: '守備練習(1対1)',     main: ['defense'],   sub: ['power', 'iq'],          fatigue: 8,  group: 'all', category: '守備',   focus: 'standard',    desc: 'マーキングと球際。守備の基礎。' },
  { id: 'heading',     name: 'ヘディング・空中戦', main: ['power'],     sub: ['defense'],              fatigue: 9,  group: 'all', category: '守備',   focus: 'specialized', requiresTraining: 2, desc: '空中戦の強さ。セットプレー対策。' },
  { id: 'linecontrol', name: 'ラインコントロール', main: ['iq'],        sub: ['defense'],              fatigue: 6,  group: 'all', category: '守備',   focus: 'specialized', requiresTraining: 3, weatherProof: true, desc: 'オフサイドラインと連携守備。座学中心。' },
  { id: 'pressing',    name: 'プレッシング戦術',   main: ['defense'],   sub: ['stamina', 'iq', 'speed'], fatigue: 11, group: 'all', category: '守備', focus: 'broad',       requiresTraining: 4, desc: '前線からの組織的守備。万能型ハード練習。' },

  // --- フィジカル（4） ---
  { id: 'run',          name: 'ランニング',         main: ['stamina'],   sub: ['defense', 'iq'],        fatigue: 8,  group: 'all', category: 'フィジカル', focus: 'standard',    desc: 'スタミナを底上げ。地味だが効く。' },
  { id: 'sprint',       name: 'スプリント特訓',     main: ['speed'],     sub: ['stamina'],              fatigue: 10, group: 'all', category: 'フィジカル', focus: 'specialized', requiresTraining: 2, desc: 'スピードを鍛える特化メニュー。' },
  { id: 'weight',       name: 'ウェイトトレーニング', main: ['power'],   sub: ['stamina'],              fatigue: 12, group: 'all', category: 'フィジカル', focus: 'specialized', requiresTraining: 3, weatherProof: true, desc: '室内の筋トレでパワー特化。天候非依存。' },
  { id: 'physical-all', name: '総合フィジカル',     main: ['power'],     sub: ['kick', 'technique', 'speed'], fatigue: 12, group: 'all', category: 'フィジカル', focus: 'broad', requiresTraining: 4, desc: '体作りから技まで全体的に底上げする万能ハード練習。' },

  // --- その他（4: 戦術・実戦・調整・休養） ---
  { id: 'tactics',      name: '戦術確認',           main: ['iq'],        sub: [],                       fatigue: 4,  group: 'all', category: 'その他', focus: 'specialized', weatherProof: true, desc: '室内で戦術理解。天候非依存・負荷小。' },
  { id: 'scrimmage',    name: '紅白戦',             main: ['iq'],        sub: ['technique', 'stamina'], fatigue: 11, group: 'all', category: 'その他', focus: 'standard',    requiresTraining: 2, desc: '実戦感覚と連携。雰囲気も動く。' },
  { id: 'conditioning', name: '調整トレーニング',   main: ['speed'],     sub: ['technique', 'stamina'], fatigue: 6,  group: 'all', category: 'その他', focus: 'standard',    requiresTraining: 4, weatherProof: true, desc: '試合前の調整。負荷控えめでバランスよく刺激。' },
  { id: 'rest',         name: 'ストレッチ・休養',   main: [],            sub: [],                       fatigue: -18,group: 'all', category: 'その他', weatherProof: true, desc: '屋内で疲労を抜く。成長はしないが怪我予防。' },

  // --- GK専用（2） ---
  { id: 'gk-saving',    name: 'セービング練習',     main: ['saving'],    sub: ['gkIq'],                 fatigue: 8,  group: 'gk', category: 'GK', focus: 'standard',    desc: 'シュートストップ。' },
  { id: 'gk-position',  name: 'GKポジショニング',   main: ['gkIq'],      sub: ['saving'],               fatigue: 5,  group: 'gk', category: 'GK', focus: 'standard',    requiresTraining: 2, weatherProof: true, desc: '室内で飛び出しと角度取りを座学確認。天候非依存。' },
]

export function getMenu(id: string): TrainingMenu {
  return TRAINING_MENUS.find((m) => m.id === id) ?? TRAINING_MENUS[1]
}

/** 設備Lvで利用可能なメニュー一覧 */
export function availableMenus(trainingLv: number): TrainingMenu[] {
  return TRAINING_MENUS.filter((m) => !m.requiresTraining || trainingLv >= m.requiresTraining)
}
