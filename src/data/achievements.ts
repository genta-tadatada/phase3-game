// ============================================================
// data/achievements.ts — 実績（アカウント永続・「はじめから」でも残る）
// 達成は account レイヤー(localStorage・キャリアsaveとは別)に記録され、新規キャリアでも消えない。
// ============================================================

export type AchCategory = '大会' | '育成' | '人材' | '挑戦'

export interface AchievementDef {
  id: string
  name: string
  desc: string
  category: AchCategory
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- 大会 ---
  { id: 'national-entry', name: '全国の舞台へ', desc: '初めて全国大会に出場した', category: '大会' },
  { id: 'pref-champ', name: '県を制す', desc: '県予選で優勝した', category: '大会' },
  { id: 'national-best4', name: '全国ベスト4', desc: '全国大会でベスト4に入った', category: '大会' },
  { id: 'national-runnerup', name: '全国準優勝', desc: '全国大会で準優勝した', category: '大会' },
  { id: 'national-champ', name: '日本一', desc: '全国大会で優勝した', category: '大会' },
  // --- 育成・人材 ---
  { id: 'pro-1', name: 'プロを輩出', desc: '教え子が初めてプロになった', category: '人材' },
  { id: 'pro-10', name: 'プロの名門', desc: '教え子のプロが通算10人に到達', category: '人材' },
  { id: 'national-rep', name: '日の丸を背負う', desc: '教え子が年代別代表に選ばれた', category: '人材' },
  { id: 'ur-skill', name: '化学反応', desc: 'UR（組み合わせ）特殊能力を持つ選手が生まれた', category: '育成' },
  { id: 'gem', name: '県の逸材', desc: '「○○県の逸材」レベルの選手を育てた', category: '育成' },
  { id: 'treasure', name: '日本の至宝', desc: '「日本の至宝」レベルの選手を育てた', category: '育成' },
  { id: 'gen-historic', name: '歴史に残る世代', desc: 'チームが「歴史に残る世代」に到達した', category: '育成' },
  { id: 'gen-legend', name: '伝説の世代', desc: 'チームが「伝説の世代」に到達した', category: '育成' },
  // --- 挑戦 ---
  { id: 'pref-2peat', name: '県の覇者', desc: '県予選を2連覇した', category: '挑戦' },
  { id: 'national-2peat', name: '連覇の王者', desc: '全国大会を2連覇した', category: '挑戦' },
  { id: 'national-3peat', name: '王朝', desc: '全国大会を3連覇した', category: '挑戦' },
  { id: 'hard-pref-champ', name: '激戦区の頂点', desc: '激戦区（強豪県）で県予選を制した', category: '挑戦' },
]

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

// 実績数に応じてアカウントアイコン(やや少なめ)・称号(かなり少なめ)を解禁する閾値。
export const ICON_UNLOCKS: { at: number; id: string; name: string }[] = [
  { at: 1, id: 'icon-ball', name: 'サッカーボール' },
  { at: 3, id: 'icon-boots', name: 'スパイク' },
  { at: 5, id: 'icon-whistle', name: 'ホイッスル' },
  { at: 8, id: 'icon-trophy-s', name: '小さなトロフィー' },
  { at: 11, id: 'icon-medal', name: 'メダル' },
  { at: 14, id: 'icon-trophy-g', name: '金のトロフィー' },
]
export const TITLE_UNLOCKS: { at: number; id: string; name: string }[] = [
  { at: 4, id: 'title-coach', name: '指導者' },
  { at: 9, id: 'title-meikan', name: '名将' },
  { at: 15, id: 'title-legend', name: '伝説の名将' },
]
