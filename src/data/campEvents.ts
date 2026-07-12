// ============================================================
// data/campEvents.ts — 夏合宿の出来事プール（#34）
// スキル開花・練習試合・帰宅イベントは camp.ts が動的に生成する。
// ここでは「能力上昇／絆＝雰囲気／性格の芽／フレーバー」の素材を authored で持つ。
// 効果は試合スコアバランス(互角1.2-1.5)に影響しない育成/雰囲気/調子に限定し、
// 合宿は「少しチームが強く・空気が良くなる」程度に留める（盛りすぎ防止）。
// {name}=対象選手名。pers指定があればその性格の選手が優先的に登場する（物語の説得力）。
// ============================================================

import type { Personality } from '../engine/types'

export interface CampEventTemplate {
  id: string
  tag: 'boost' | 'bond' | 'personality' | 'flavor'
  weight: number
  title: string
  body: string          // {name} を含みうる
  detail?: string       // 効果の補足（{name}/{ability}含みうる）
  pers?: Personality[]  // この出来事が似合う性格（優先的に対象選手を選ぶ）
  // #10: 時間帯・合宿段階。指定があれば、その日の中で朝→昼→夜に整列し、段階に合う日に出す。
  //   time 未指定＝昼相当（中間に並ぶ） / phase 未指定＝どの段階でも可。
  time?: 'morning' | 'noon' | 'night'
  phase?: 'early' | 'mid' | 'late'
  effect?: {
    boost?: { ability: 'random' | 'kick' | 'power' | 'speed' | 'technique' | 'stamina' | 'iq' | 'defense' | 'saving'; lo: number; hi: number; pair?: boolean } // 対象の能力を lo〜hi（pair=2人）。本文と整合させるため特定能力を指定可。
    atmo?: number          // チームの雰囲気
    condition?: number     // 対象の調子（合宿明けの好調/不調の芽）
    fatigueAll?: number    // 全体の疲労（過酷な合宿＝疲労、温泉＝回復）
  }
}

// --- 能力上昇（汗の成果）。対象1人のランダム能力が小さく伸びる。 ---
const BOOST: CampEventTemplate[] = [
  { id: 'b-dawn', tag: 'boost', weight: 3, title: '夜明けの自主練', body: '誰よりも早くグラウンドに出た{name}。朝の霧の中、黙々とボールを蹴り続けていた。', detail: '{name}の{ability}が伸びた', pers: ['hardworker', 'leader'], time: 'morning', effect: { boost: { ability: 'random', lo: 2, hi: 3 } } },
  { id: 'b-mountain', tag: 'boost', weight: 3, title: '山道ダッシュ', body: '合宿名物の山道ダッシュ。{name}が歯を食いしばって先頭を駆け上がった。', detail: '{name}の{ability}が伸びた', pers: ['fighter', 'hotblood'], effect: { boost: { ability: 'random', lo: 2, hi: 4 }, fatigueAll: 6 } },
  { id: 'b-wall', tag: 'boost', weight: 3, title: '壁当て1000本', body: '宿舎の裏の壁で、{name}が黙々と壁当てを続けていた。指先の感覚が研ぎ澄まされていく。', detail: '{name}の{ability}が伸びた', pers: ['hardworker', 'mypace'], effect: { boost: { ability: 'random', lo: 2, hi: 3 } } },
  { id: 'b-video', tag: 'boost', weight: 2, title: '映像分析の夜', body: 'ミーティングルームで、{name}がプロの試合映像を食い入るように見ていた。「この動き、盗みます」', detail: '{name}の理解が深まった', pers: ['genius', 'leader'], effect: { boost: { ability: 'random', lo: 2, hi: 3 } } },
  { id: 'b-onevone', tag: 'boost', weight: 2, title: '1対1の鬼', body: '紅白戦の合間、{name}が「もう一本！」と1対1をせがみ続けた。負けず嫌いが力に変わる。', detail: '{name}が一回り成長した', pers: ['fighter', 'egoist', 'hotblood'], effect: { boost: { ability: 'random', lo: 3, hi: 4 } } },
  { id: 'b-rival', tag: 'boost', weight: 2, title: 'ライバルとの居残り', body: '{name}と{name2}が、暗くなるまで居残って競い合っていた。互いを高め合う関係だ。', pers: ['fighter', 'genius'], effect: { boost: { ability: 'random', lo: 2, hi: 4, pair: true } } },
  { id: 'b-coach', tag: 'boost', weight: 2, title: 'コーチのマンツーマン', body: 'コーチが{name}を呼び止め、フォームを一から作り直した。地味だが効く反復だ。', detail: '{name}の{ability}が伸びた', effect: { boost: { ability: 'random', lo: 3, hi: 4 } } },
  { id: 'b-river', tag: 'boost', weight: 1, title: '川での体幹トレ', body: '近くの川で、流れに逆らって踏ん張る体幹トレ。{name}の軸が一段としっかりした。', detail: '{name}のパワーが伸びた', effect: { boost: { ability: 'power', lo: 2, hi: 3 } } },
  { id: 'b-latenight', tag: 'boost', weight: 2, title: '消灯後の居残り', body: '消灯後もこっそり抜け出してリフティング。バレたが、コーチは見て見ぬふりをした。{name}の本気が伝わる。', detail: '{name}の技術が伸びた', pers: ['hardworker', 'troublemaker'], time: 'night', effect: { boost: { ability: 'technique', lo: 2, hi: 4 } } },
  { id: 'b-form', tag: 'boost', weight: 2, title: 'フォーム開眼', body: '何百本目かのシュートで、{name}が「あ、これだ」とつぶやいた。つかみかけていた感覚が形になる。', detail: '{name}のキックが伸びた', pers: ['genius', 'mypace'], effect: { boost: { ability: 'kick', lo: 3, hi: 5 } } },
  { id: 'b-mud', tag: 'boost', weight: 1, title: '泥んこの守備練', body: '雨上がりの泥のグラウンドで、{name}が転びながらも食らいついた。守備は気持ちだ。', detail: '{name}の守備が伸びた', pers: ['fighter', 'hotblood'], effect: { boost: { ability: 'defense', lo: 2, hi: 4 }, fatigueAll: 4 } },
  { id: 'b-scout', tag: 'boost', weight: 1, title: 'プロのスカウト来訪', body: 'プロのスカウトが視察に来ているらしい。「見てもらうチャンスだ」——{name}のプレーがひと際光った。', detail: '{name}が殻を破った', pers: ['genius', 'egoist', 'fighter'], effect: { boost: { ability: 'random', lo: 3, hi: 5 } } },
]

// --- 絆＝雰囲気（チームがひとつになる） ---
const BOND: CampEventTemplate[] = [
  { id: 'bo-bonfire', tag: 'bond', weight: 3, title: 'キャンプファイヤー', body: '最終夜のキャンプファイヤー。炎を囲み、本音をぶつけ合った夜は、チームの絆を一段深めた。', detail: 'チームの雰囲気が上がった', time: 'night', phase: 'late', effect: { atmo: 5 } },
  { id: 'bo-meal', tag: 'bond', weight: 3, title: '大盛り飯の戦い', body: 'デカ盛りの合宿飯を全員で完食。「食うのも練習だ！」笑いが絶えない食堂だった。', detail: 'チームの雰囲気が上がった', effect: { atmo: 4 } },
  { id: 'bo-onsen', tag: 'bond', weight: 2, title: '温泉でひと息', body: '練習後の温泉。湯船で肩を並べ、たわいない話で疲れが抜けていく。', detail: '雰囲気↑・全体の疲労が回復', effect: { atmo: 3, fatigueAll: -10 } },
  { id: 'bo-room', tag: 'bond', weight: 2, title: '消灯後の部屋トーク', body: '消灯後、布団の中で語り合うサッカー談義。「全国、本気で行こうぜ」誰かが言った。', detail: 'チームの雰囲気が上がった', time: 'night', effect: { atmo: 4 } },
  { id: 'bo-clean', tag: 'bond', weight: 1, title: '宿舎の大掃除', body: '発つ前、全員で宿舎をピカピカに磨き上げた。当たり前を丁寧にやれるチームは強い。', detail: 'チームの雰囲気が上がった', time: 'morning', phase: 'late', effect: { atmo: 3 } },
  { id: 'bo-cheer', tag: 'bond', weight: 2, title: '新しいチャント', body: '{name}が口ずさんだ即興の応援歌が、いつの間にかチーム全員の合言葉になった。', detail: 'チームの雰囲気が上がった', pers: ['moodmaker', 'leader'], effect: { atmo: 4 } },
  { id: 'bo-bbq', tag: 'bond', weight: 2, title: '河原でバーベキュー', body: '休養日の河原バーベキュー。{name}が率先して火をおこし、みんなの腹を満たした。', detail: '雰囲気↑・疲労が少し回復', pers: ['moodmaker', 'leader'], effect: { atmo: 4, fatigueAll: -6 } },
  { id: 'bo-courage', tag: 'bond', weight: 1, title: '深夜の肝試し', body: '消灯後の肝試し。怖がりの{name}が一番に悲鳴を上げ、みんなで大笑いした夜。', detail: 'チームの雰囲気が上がった', pers: ['timid', 'shy', 'moodmaker'], time: 'night', effect: { atmo: 4 } },
  // --- 稀な特別イベント（合宿の「忘れられない一日」） ---
  { id: 'bo-ob', tag: 'bond', weight: 1, title: 'OBの激励', body: 'プロや大学で戦うOBたちが合宿に顔を出した。「俺たちもここで強くなった」——その言葉に、全員が胸を熱くした。', detail: 'チームの士気が大きく高まった', effect: { atmo: 6 } },
  { id: 'bo-joint', tag: 'bond', weight: 1, title: '強豪校との合同合宿', body: '全国常連の強豪校と合同合宿。格の違いを見せつけられたが、「いつか必ず」と全員の目つきが変わった。', detail: '刺激を受けてチームが引き締まった', effect: { atmo: 4, fatigueAll: 5 } },
]

// --- 性格の芽（合宿でしか見えない一面）。雰囲気/調子の小さな揺れ＋物語。 ---
const PERSONALITY: CampEventTemplate[] = [
  { id: 'p-grit', tag: 'personality', weight: 2, title: '弱音と本音', body: 'きつい練習に{name}が初めて弱音を吐いた。だが翌朝、誰より早くグラウンドに立っていた。', detail: '{name}の調子が上向いた', pers: ['lazy', 'mypace', 'timid'], effect: { condition: 1 } },
  { id: 'p-clash', tag: 'personality', weight: 2, title: 'ぶつかり合い', body: 'プレーを巡って{name}が先輩と本気で衝突。気まずさの後、互いを認め合った。', detail: 'チームの雰囲気が上がった', pers: ['troublemaker', 'hotblood', 'egoist'], effect: { atmo: 3 } },
  { id: 'p-lead', tag: 'personality', weight: 2, title: '背中で語る', body: '誰も見ていない時間に、{name}が黙々とグラウンド整備をしていた。こういう奴が信頼を集める。', detail: 'チームの雰囲気が上がった', pers: ['leader', 'hardworker'], effect: { atmo: 3, condition: 1 } },
  { id: 'p-homesick', tag: 'personality', weight: 1, title: 'ホームシック', body: '夜、{name}が少し元気がない。仲間が冗談で笑わせると、ようやくいつもの顔に戻った。', detail: '{name}の調子が整った', pers: ['shy', 'timid'], effect: { condition: 1 } },
  { id: 'p-prank', tag: 'personality', weight: 1, title: 'いたずらの代償', body: '{name}のいたずらがコーチにバレ、チーム全員で罰走に。だが不思議と恨む者はいなかった。', detail: '雰囲気↑・少し疲労', pers: ['troublemaker', 'moodmaker'], effect: { atmo: 2, fatigueAll: 4 } },
  { id: 'p-awaken', tag: 'personality', weight: 1, title: '殻を破る', body: '大人しかった{name}が、紅白戦で人が変わったように声を出した。何かが吹っ切れたようだ。', detail: '{name}の調子が大きく上向いた', pers: ['shy', 'timid', 'mypace'], effect: { condition: 1, atmo: 1 } },
]

// --- フレーバー（#6で再設計）。半分は微効果（調子/雰囲気）、半分は{name}入りの愛着イベントに。 ---
const FLAVOR: CampEventTemplate[] = [
  // 微効果（小さな調子/雰囲気の揺れ）
  { id: 'f-rain', tag: 'flavor', weight: 2, title: '土砂降りの紅白戦', body: '突然のスコール。それでも誰一人グラウンドを去らず、泥まみれでボールを追った。', detail: '泥まみれの一体感（雰囲気↑）', effect: { atmo: 1 } },
  { id: 'f-cicada', tag: 'flavor', weight: 2, title: 'セミ時雨', body: '蝉の声が降り注ぐ真夏のグラウンド。汗が流れ落ちる。{name}が黙って水を飲み干し、また走り出した。', detail: '{name}の調子が整った', effect: { condition: 1 } },
  { id: 'f-blister', tag: 'flavor', weight: 1, title: 'マメだらけの足', body: '足の裏はマメだらけ。それを見せ合って笑うのが、合宿を越えた証だった。', detail: 'きつさを笑いに（雰囲気↑）', phase: 'late', effect: { atmo: 1 } },
  { id: 'f-radio', tag: 'flavor', weight: 1, title: 'ラジオ体操', body: '朝6時、宿舎の前で全員ラジオ体操。{name}が眠い目をこすりながら、夏の一日が始まる。', detail: '{name}の調子が整った', time: 'morning', effect: { condition: 1 } },
  // 愛着（{name}が登場する小さな物語・効果なし）
  { id: 'f-bus', tag: 'flavor', weight: 1, title: '長いバス移動', body: '宿舎までの長いバス。{name}は早くも夢の中で、口を開けて眠っている。これから始まる一週間に、起きている者は胸を高鳴らせた。', time: 'morning', phase: 'early' },
  { id: 'f-stars', tag: 'flavor', weight: 1, title: '満天の星', body: '都会では見えない星空。「プロになっても、この夏を思い出すんだろうな」と{name}がぽつりとつぶやいた。', time: 'night' },
  { id: 'f-noodle', tag: 'flavor', weight: 1, title: '夜食のカップ麺', body: '{name}がこっそり持ち込んだカップ麺を、布団に集まって分け合う夜。バレたら全員で追加ランだが、その価値はあった。', time: 'night' },
  { id: 'f-watermelon', tag: 'flavor', weight: 1, title: 'スイカ割り', body: '練習後のスイカ割り。目隠しの{name}が、なぜか監督めがけて全力で歩いてくる。' },
]

export const CAMP_POOL: Record<'boost' | 'bond' | 'personality' | 'flavor', CampEventTemplate[]> = {
  boost: BOOST, bond: BOND, personality: PERSONALITY, flavor: FLAVOR,
}

// --- 監督の選択を迫る合宿イベント（#選択制）。プレイヤーが2択を選ぶ。 ---
export interface CampChoiceTemplate {
  id: string
  title: string
  body: string
  options: { label: string; effectId: string }[]
}
// 選択肢の効果（合宿用）。boost=対象1人の能力／atmo=雰囲気／fatigueAll=全体疲労／condition=全体の調子。
// 方針：①どちらを選んでも必ず何か起きる（0影響なし）②通常イベントより影響を大きくする。
export interface CampChoiceEffect { atmo?: number; fatigueAll?: number; condition?: number; boost?: { lo: number; hi: number; ability?: 'random' | 'kick' | 'power' | 'speed' | 'technique' | 'stamina' | 'iq' | 'defense' | 'saving' }; text: string }
export const CAMP_CHOICE_EFFECTS: Record<string, CampChoiceEffect> = {
  cc_push_hard: { atmo: -3, fatigueAll: 13, boost: { lo: 5, hi: 9 }, text: '猛練習でひとり大きく伸びた。だが疲労と不満も残った。' },
  cc_push_balance: { atmo: 6, condition: 1, text: 'ほどよく追い込み、チームは前向きさを増した。' },
  cc_night_allow: { atmo: 6, fatigueAll: 9, boost: { lo: 4, hi: 7 }, text: '夜の自主練を黙認。熱気は上がったが寝不足気味に。' },
  cc_night_stop: { atmo: -3, fatigueAll: -12, condition: 1, text: '消灯を徹底。不満は出たが、疲れはしっかり抜けた。' },
  cc_bbq_yes: { atmo: 8, fatigueAll: -7, text: 'バーベキューで一気に打ち解け、チームが一つになった。' },
  cc_bbq_no: { boost: { lo: 5, hi: 8 }, fatigueAll: 7, atmo: -2, text: '休まず練習。力はついたが、不満の声も。' },
  cc_match_strong: { atmo: 5, fatigueAll: 11, condition: 1, boost: { lo: 3, hi: 6 }, text: '格上に揉まれ、選手の目の色が変わった。代償は疲労。' },
  cc_match_easy: { atmo: 4, fatigueAll: 3, condition: 1, text: '格下相手に自信を深め、余力も残せた。' },
  cc_onsen_yes: { atmo: 6, fatigueAll: -18, text: '温泉でリフレッシュ。疲れがごっそり抜けた。' },
  cc_onsen_no: { boost: { lo: 5, hi: 8 }, fatigueAll: 8, atmo: -2, text: '休まず追加練習。きついが確かな収穫があった。' },
  cc_clash_captain: { atmo: 9, text: '衝突をキャプテンが見事にまとめ、結束が一段強まった。' },
  cc_clash_coach: { atmo: 4, condition: 1, fatigueAll: -5, text: '自ら間に入って話をつけ、わだかまりが解けて落ち着いた。' },
}
export const CAMP_CHOICES: CampChoiceTemplate[] = [
  { id: 'cc_push', title: '追い込みの加減', body: '選手たちはまだやれる顔をしている。監督として、今日はどこまで追い込む？', options: [{ label: 'とことん追い込む', effectId: 'cc_push_hard' }, { label: 'ほどよく追い込む', effectId: 'cc_push_balance' }] },
  { id: 'cc_night', title: '消灯後の自主練', body: '消灯後、こっそり自主練に抜け出す者がいる。監督としてどうする？', options: [{ label: '大目に見る', effectId: 'cc_night_allow' }, { label: '消灯を徹底する', effectId: 'cc_night_stop' }] },
  { id: 'cc_bbq', title: '休養日の使い方', body: '合宿の中日。河原でバーベキューにするか、もうひと練習組むか。', options: [{ label: 'バーベキューで息抜き', effectId: 'cc_bbq_yes' }, { label: '練習を優先する', effectId: 'cc_bbq_no' }] },
  { id: 'cc_match', title: '練習試合の相手', body: '練習試合の相手を選べる。格上に胸を借りるか、格下で確認するか。', options: [{ label: '格上に挑む', effectId: 'cc_match_strong' }, { label: '格下で確認する', effectId: 'cc_match_easy' }] },
  { id: 'cc_onsen', title: '近くの温泉', body: '宿の近くに温泉がある。練習の合間に連れて行くか？', options: [{ label: '温泉に行く', effectId: 'cc_onsen_yes' }, { label: '追加練習に充てる', effectId: 'cc_onsen_no' }] },
  { id: 'cc_clash', title: '部屋でのいさかい', body: '相部屋でちょっとした衝突が起きた。監督としてどう収める？', options: [{ label: 'キャプテンに任せる', effectId: 'cc_clash_captain' }, { label: '監督が話をつける', effectId: 'cc_clash_coach' }] },
]

export const CAMP_EVENT_TOTAL =
  BOOST.length + BOND.length + PERSONALITY.length + FLAVOR.length // 素材数（+ skill/match/homecoming動的）
