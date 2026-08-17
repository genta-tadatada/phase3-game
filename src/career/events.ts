// ============================================================
// career/events.ts — 週次フレーバーイベント（補完N「あるある」）
// 季節・練習内容・状況に応じて時々発生し、雰囲気を少し動かす。
// ============================================================

import type { RNG } from '../engine/rng'
import type { Player } from '../engine/types'
import { weekToMonth } from './calendar'
import { playerOverallSum } from '../engine/match/teamQuality'
import type { CareerState, WeekEvent, WeeklyPlan } from './types'
import type { ManagerEventState } from './manager'
import { EXTRA_FACILITIES } from './facilities'

export interface FlavorResult {
  event: WeekEvent | null
  atmoDelta: number
  // #37: 名指し選手への副作用（代表選出など）。engine が working roster に適用する。
  rosterPatch?: (roster: Player[]) => Player[]
  // #37: 評判への即時加算（代表選出で部の評判↑）。
  repDelta?: number
  // G-32: マネージャー恋愛で manager.dating を更新する patch
  managerPatch?: (mgr: import('./manager').Manager) => import('./manager').Manager
  // G-22-④: 「3年最後の大会演出」発火時にこの年度をセット → engine.ts で persistent +1 雰囲気/週
  seniorBoostStartYear?: number
}

// --- 選択イベントの効果レジストリ（resolveEventが参照） ---
// 選手の能力を伸ばす（育成イベントの運）。n人の選手の能力をlo〜hiだけ上げる。
type Boost = { n: number; lo: number; hi: number; target?: 'random' | 'bc' }
// G-03/G-28: 選択後に必ず見せる「結果の地の文」を持つ。{name}/{name2}は出題時と同じ選手で置換。
export interface ChoiceOutcome {
  atmo?: number
  budget?: number
  fatigueAll?: number
  boost?: Boost
  result: string
}
// G-29: 選択肢は「不正解のない好みの問題」。各選択に良い結果があり、
//        一部は risk で確率分岐（成功＝大きなリターン／失敗も物語として前向き）。
export interface ChoiceEffect {
  atmo?: number
  budget?: number
  fatigueAll?: number
  boost?: Boost
  result?: string
  risk?: { p: number; success: ChoiceOutcome; fail: ChoiceOutcome }
}
// G-29: 不正解のない好みの問題＝各選択に異なる「良さ」を持たせる（受ける=雰囲気↑だが疲労／断る=休養・結束など）。
//       育成イベントは risk で確率分岐（成功＝大きく伸びる／失敗も前向きな物語）。result＝選択後に見せる地の文。
export const CHOICE_EFFECTS: Record<string, ChoiceEffect> = {
  pm_accept: { atmo: 4, fatigueAll: 6, result: '胸を借りるつもりで全力でぶつかった。実戦の緊張感が、チームを一段引き締める。' },
  pm_decline: { fatigueAll: -3, atmo: 1, result: '今は土台を固める時期。自分たちの練習にじっくり向き合った。足取りは軽い。' },
  donate_money: { budget: 35, atmo: 1, result: 'ありがたく心づけを受け取った。部費の足しになる。OBの気持ちが胸にしみた。' },
  donate_thanks: { atmo: 3, result: '「現役のために使ってくれ」と気持ちだけ受け取った。OBの心意気にチームが奮い立つ。' },
  scold_strict: { fatigueAll: -3, result: '時間は守る——短く、はっきり伝えた。ぴりっとした空気が、練習を締めた。' },
  scold_soft: { atmo: 2, result: '頭ごなしにはせず、まず事情を聞いた。その懐の深さに、選手たちは襟を正す。' },
  fix_gear: { budget: -25, atmo: 1, result: '破れたネットを直した。道具を大切にする姿勢が、部の空気をきれいにする。' },
  ignore_gear: { atmo: 2, result: '部員たちが自分でテープを巻いて応急処置した。工夫してしのぐたくましさが頼もしい。' },
  camp_extra: { atmo: 5, fatigueAll: 15, result: '週末の自主合宿。汗だくの二日間で、選手たちの目つきが変わった。' },
  camp_skip: { fatigueAll: -4, atmo: 1, result: '無理はさせず、しっかり休ませた。リフレッシュした体で次の練習に臨める。' },
  media_accept: { atmo: 3, result: '取材を受けた。記事を読んだ家族や後輩からの声に、選手たちは誇らしげだ。' },
  media_decline: { fatigueAll: -2, atmo: 1, result: '今は練習に集中したい、と丁重に断った。静かな環境でじっくり積み上げる。' },
  rival_accept: { atmo: 4, fatigueAll: 8, result: '格上の胸を借りた。完敗でも、世界が違うことを肌で知るのは大きい。' },
  rival_decline: { fatigueAll: -2, atmo: 1, result: '今は力をためる時、と見送った。自分たちのサッカーをもう一度見つめ直す。' },
  fund_buy: { budget: -40, atmo: 3, result: '練習着とボールを新調した。真新しい道具に、練習の士気が上がる。' },
  fund_save: { atmo: 1, result: '「まだ使える」と手入れして使い続けた。物を大事にする部の伝統が育つ。' },
  alumni_coach: { budget: -50, atmo: 4, result: '元プロOBの指導は刺激的だった。一流の基準に触れ、選手の意識が変わる。' },
  alumni_pass: { atmo: 1, result: '今は自分たちの形を固めたい、と丁重に断った。地に足のついた歩みを選ぶ。' },
  // 追加イベント（資源/士気/疲労のトレードオフ）
  volunteer_yes: { atmo: 3, result: '地域清掃に参加した。汗を流す部員の姿に、町の人の目があたたかい。' },
  volunteer_no: { fatigueAll: -2, atmo: 1, result: '今回は練習を優先し、体を休めた。次の機会には恩返ししよう。' },
  sponsor_take: { budget: 60, atmo: 1, result: '地元企業の支援を受けた。新しいユニフォームに袖を通す日が楽しみだ。' },
  sponsor_pass: { atmo: 3, result: '「自分たちの力で」と硬派に断った。その心意気が、かえって部を一つにする。' },
  nutrition_yes: { fatigueAll: -7, atmo: 1, result: '栄養士のサポートで食事が変わった。体の回復が目に見えて良くなる。' },
  nutrition_no: { atmo: 1, result: '気持ちだけありがたく受け取った。まずは自分たちで食生活を見直す。' },
  // G-45: 文化祭は「準備を手伝わせるか」の単発選択（当日は全員参加が前提）。
  //   手伝わせる＝力仕事や飾り付けで5人がランダムに伸びる（+1〜+3・期待値≈10＝旧6日モードと同等）。
  festival_help: { atmo: 3, fatigueAll: 6, boost: { n: 5, lo: 1, hi: 3 }, result: '準備はサッカー部の出番だらけ。机運びも飾り付けも引っ張りだこで、{name}たちはクラスの人気者になった。' },
  festival_skip: { fatigueAll: -2, atmo: 1, result: '準備はクラスのみんなに任せて、放課後は練習を続けた。少し申し訳なさそうだが、体はよく動いている。' },
  slump_meeting: { atmo: 4, result: '車座になって本音をぶつけ合った。重かった空気が、少しずつほぐれていく。' },
  slump_quiet: { atmo: 2, fatigueAll: -2, result: '多くは語らず、練習で背中を見せた。黙々と積む時間が、迷いを振り払う。' },
  trainer_hire: { budget: -40, fatigueAll: -8, atmo: 1, result: '専属トレーナーと契約した。ケアが行き届き、故障の不安が和らぐ。' },
  trainer_pass: { fatigueAll: -3, result: '体験だけで、あとは自分たちでケアを続けた。体の声を聞く習慣がついた。' },
  // --- 育成イベント（G-29: 確率で結果が分岐＝成功は大きく伸び、失敗も前向きな物語に）---
  special_yes: { fatigueAll: 4, atmo: 1, risk: {
    p: 0.7,
    success: { boost: { n: 1, lo: 6, hi: 12 }, atmo: 1, result: 'つきっきりの特訓が実を結んだ。{name}は確かな手応えを掴んだ表情だ。' },
    fail: { fatigueAll: 3, atmo: 1, result: '今日は手応えが薄かった。それでも{name}は前を向いている——伸びる芽は消えない。' },
  } },
  special_no: { atmo: 1, result: '全体練習を優先した。チーム全員で汗を流す時間も、確かな積み重ねになる。' },
  tresen_go: { atmo: 2, risk: {
    p: 0.75,
    success: { boost: { n: 1, lo: 4, hi: 9 }, result: 'トレセンでもまれた{name}が、ひと回り大きくなって帰ってきた。' },
    fail: { atmo: 2, result: '結果は振るわなかったが、上のレベルを知った{name}の目は明らかに変わった。' },
  } },
  tresen_skip: { atmo: 1, fatigueAll: -2, result: 'チーム練習を優先した。仲間と過ごす時間が、{name}の自信を静かに育てる。' },
  latenight_yes: { atmo: 2, risk: {
    p: 0.7,
    success: { boost: { n: 2, lo: 3, hi: 7, target: 'bc' }, atmo: 1, result: '{name}を中心にした居残り練習が実を結び、控え組がぐっと底上げされた。' },
    fail: { fatigueAll: 3, atmo: 2, result: '大きな伸びはなかったが、暗くなるまで励まし合う姿に、チームの絆が深まった。' },
  } },
  latenight_no: { fatigueAll: -3, atmo: 1, result: '怪我が心配で帰した。無理をさせない判断に、{name}も素直にうなずいた。' },
  // G-06: 個人能力成長系の選択肢（不正解のない好み問題＝両方に良さ）
  video_yes: { atmo: 1, risk: {
    p: 0.7,
    success: { boost: { n: 1, lo: 3, hi: 7 }, result: '映像研究で{name}の判断力が一気に磨かれた。試合の見え方が変わったらしい。' },
    fail: { atmo: 1, result: '直接的な成果は見えにくいが、{name}の言葉に深みが出てきた。' },
  } },
  video_no: { fatigueAll: 2, atmo: 1, result: '体で覚えるのが一番だ——練習場で動きを反復した。汗をかいた者にしか掴めないものがある。' },
  gym_yes: { fatigueAll: 5, risk: {
    p: 0.65,
    success: { boost: { n: 1, lo: 4, hi: 8 }, result: '計画的なウェイトで{name}の体つきが変わった。当たり負けが減っている。' },
    fail: { fatigueAll: 3, atmo: 1, result: 'すぐ結果は出なかったが、自分で考えて取り組む姿勢が頼もしい。' },
  } },
  gym_no: { atmo: 2, result: '無理せず家でできる範囲に。{name}は素直に従い、コンディションを保った。' },
  kick_yes: { atmo: 1, risk: {
    p: 0.75,
    success: { boost: { n: 1, lo: 3, hi: 6 }, result: '一緒にフォームを見直した。{name}のキックに迷いがなくなった。' },
    fail: { atmo: 1, result: '今日は掴めなかった。それでも{name}は試行錯誤を続けるだろう。' },
  } },
  kick_no: { atmo: 2, result: '自力で気付くのを待った。{name}は自分の感覚で乗り越えたようだ——その経験は財産になる。' },
  // G-29 第三波 新規エフェクト
  snow_team: { atmo: 4, fatigueAll: 4, result: 'みんなで雪かきをした後の練習は、空気が締まっていた。共同作業がチームの結束を強くする。' },
  // B-1: 体育館を持っている場合だけ選べる＝設備投資の見返りとして雪かき組より恩恵を大きくする。
  snow_gym: { fatigueAll: -4, atmo: 3, boost: { n: 3, lo: 1, hi: 3 }, result: '雪をかく時間を丸ごと練習に使えた。暖かい体育館で足元の技術を徹底的に反復し、外に出られない日を得に変えた。' },
  rival_take: { fatigueAll: 8, risk: {
    p: 0.6,
    success: { boost: { n: 2, lo: 3, hi: 6 }, atmo: 2, result: '完敗だったが、得たものは大きい。{name}たちの目の色が変わった。' },
    fail: { atmo: 1, result: '実力差を痛感した。それでも、上を知ったことは未来に効いてくる。' },
  } },
  rival_easy: { atmo: 2, result: '近場の相手と落ち着いて試合を組んだ。実戦の感覚を程よく取り戻せた。' },
  rep_yes: { atmo: 2, risk: {
    p: 0.65,
    success: { boost: { n: 1, lo: 2, hi: 5 }, atmo: 1, result: '学級委員の経験で{name}は一回り大きくなった。リーダーシップに磨きがかかる。' },
    fail: { fatigueAll: 3, atmo: 1, result: '両立に苦労する場面もあったが、{name}は最後までやり切った。' },
  } },
  rep_no: { atmo: 1, fatigueAll: -2, result: '部活に専念させた。{name}も覚悟を決めて練習に向き合っている。' },
  gift_yes: { atmo: 3, fatigueAll: -3, result: '差し入れに沸くベンチ。気持ちのこもった食べ物が、選手の体と心を癒す。' },
  gift_no: { atmo: 2, result: '気持ちだけ頂戴し、保護者会には別の形で感謝を伝えた。誠実さが信頼を育てる。' },
  press_yes: { atmo: 3, result: '記事が地元で話題になった。注目される責任感が、選手の背筋を伸ばす。' },
  press_no: { fatigueAll: -2, atmo: 1, result: '余計な注目を浴びず、静かに練習を積んだ。自分たちのリズムを崩さない判断。' },
  review_yes: { atmo: 4, fatigueAll: 2, result: '毎日の振り返りが習慣化し、選手の理解度が深まっていく。地味だが効く。' },
  review_once: { atmo: 1, result: '今日だけの試みだったが、{name}のメモを見て他の選手も触発された。' },
  fix_rotate: { atmo: 1, risk: {
    p: 0.6,
    success: { boost: { n: 2, lo: 2, hi: 5, target: 'bc' }, atmo: 1, result: 'スタメンを回したことで控えが伸び、チームに厚みが出てきた。' },
    fail: { fatigueAll: 2, atmo: -1, result: '結果は振るわなかったが、選手層の薄さは見えた。次に活きる。' },
  } },
  fix_keep: { atmo: 2, fatigueAll: 3, result: 'スタメンを固定し、戦力を最大化した。連携がかみ合っていく。' },
  mentor_yes: { atmo: 4, result: '先輩が後輩を見る時間が増え、部に縦の繋がりが生まれた。空気がよくなる。' },
  mentor_no: { fatigueAll: 2, result: '通常メニューを優先した。基礎の積み上げに揺らぎはない。' },
  film_yes: { atmo: 2, risk: {
    p: 0.7,
    success: { boost: { n: 1, lo: 3, hi: 6 }, result: '映像分析で相手の癖が見えた。{name}が中心になって戦術を組み立てる。' },
    fail: { atmo: 1, result: '分析の手応えは薄かったが、選手たちの観察眼が育った。' },
  } },
  film_no: { atmo: 2, fatigueAll: -1, result: '自分たちのサッカーに集中した。揺るがない姿勢が、迷いを断つ。' },
  rain_cheer: { atmo: 5, result: '応援練習で大盛り上がり。試合の声出しが格段に良くなった。チーム一丸の象徴。' },
  rain_drill: { fatigueAll: 3, atmo: 1, result: '室内で基礎を黙々と反復。地味だが、確かな積み上げが体に染み込む。' },
  // G-29 第三波 追加エフェクト（合計42件達成分）
  morn_team: { fatigueAll: 5, risk: {
    p: 0.6,
    success: { boost: { n: 2, lo: 2, hi: 5 }, atmo: 2, result: '朝練が習慣化し、選手の体つきが変わってきた。継続は力なり。' },
    fail: { fatigueAll: 4, atmo: 1, result: '効果は地味だったが、早起きの習慣が選手の生活を整えた。' },
  } },
  morn_solo: { atmo: 2, result: 'やりたい者だけが朝練に来た。少人数だが志は高い。空気にいい緊張感が生まれる。' },
  fan_read: { atmo: 5, result: '手紙を回し読みした選手たち。誰かのために戦う意味が、胸に染みる。' },
  fan_reply: { atmo: 3, result: '丁寧に返事を書いた。届けてくれた子どもたちが、また応援に来てくれそうだ。' },
  sns_rule: { atmo: 1, fatigueAll: -1, result: '部内ルールを作り、無用なトラブルを未然に防いだ。落ち着いて練習に集中できる。' },
  sns_free: { atmo: 2, result: '本人の判断を尊重した。{name}たちは自覚を持って投稿している。' },
  send_yes: { atmo: 4, fatigueAll: -2, result: '壮行会で全校から声援を受けた。背負うものの重さが、選手を奮い立たせる。' },
  send_no: { fatigueAll: 1, atmo: 1, result: '練習を最後まで貫いた。準備に集中する姿勢が、本番で活きる。' },
  field_fix: { atmo: 2, fatigueAll: -1, result: '整備された場での練習は、怪我のリスクも減り、動きが軽くなる。' },
  field_use: { atmo: 1, fatigueAll: 3, result: '荒れた場でも結果を出すしかない。逆境が選手の集中力を引き上げた。' },
  meal_help: { atmo: 3, fatigueAll: -4, result: '食事を見直したことで体の回復が早くなった。地味だが効くサポート。' },
  meal_self: { atmo: 1, result: '本人に任せた。自分で調べて取り組む姿勢が、{name}を自立させる。' },
  sheet_all: { atmo: 2, risk: {
    p: 0.65,
    success: { boost: { n: 3, lo: 2, hi: 4 }, atmo: 1, result: '全員が課題を意識して練習に臨むようになり、チーム全体に伸びが見えた。' },
    fail: { atmo: 2, result: '即効性は薄かったが、自分を見つめ直す習慣が選手の土台になる。' },
  } },
  sheet_solo: { atmo: 1, result: '{name}は自分のペースでシートを使いこなしている。地道な積み上げが頼もしい。' },
  kit_new: { budget: -30, atmo: 4, result: '新しい練習着に袖を通した選手たち。気分も新たに、練習の士気が上がる。' },
  kit_keep: { atmo: 1, result: '今ある練習着を大切に使い続けた。物を慈しむ姿勢が、部の伝統になっていく。' },
  // F8: 「強豪校の関心」イベント＝本作には転校先機構なし。視察に気を取られるか／泰然と構えるかの監督判断。
  poach_refuse: { atmo: 3, result: '雑音は気にせず、ただ鍛え抜いた。揺るがない姿勢が、かえって部を一つにする。' },
  poach_waver: { atmo: 1, result: '本人に状況を伝えた。注目されている自覚が、{name}の背筋を伸ばす。' },
  captain_talk: { atmo: 5, result: 'キャプテンが間に入り、二人は和解した。任せて良かった——チームが大人になる。' },
  captain_self: { atmo: 2, fatigueAll: -4, result: '自ら二人を呼んで、直接締めた。筋を通したことで、ざわついた空気が静まる。' },
  rest_day: { fatigueAll: -16, atmo: 1, result: '思い切って完全オフにした。心身ともにリフレッシュし、次への活力が満ちる。' },
  rest_push: { fatigueAll: 2, atmo: 2, result: 'あえて練習を続けた。きつい時間を共有したことが、チームの粘りを鍛える。' },
}

// #7: 選択肢ラベルに結果（ネタバレ）を出さない＝監督が選ぶ「行動」だけを示す。
// 効果はbodyの地の文でトレードオフを匂わせ、確定した数値は決定後の結果画面で見せる。
// 2026-08-17 B-1/B-2:
//   months      = その月にしか出ないイベント（雪かきが夏に出る等の季節ズレを防ぐ）。未指定＝通年。
//   requireExtra= その追加設備を持っていないと選べない選択肢（ロック表示）。設備投資の意味を作る。
interface ChoiceOption { label: string; effectId: string; requireExtra?: string }
interface ChoiceDef { id: string; title: string; body: string; months?: number[]; options: ChoiceOption[] }
// G-30: 文化祭の出店名（{stall}にランダム代入＝特定選手＋具体的な店名で愛着を高める）。
const FESTIVAL_STALLS = ['たこ焼き', '焼きそば', 'クレープ', 'お化け屋敷', '射的', 'フランクフルト', 'わたあめ', '喫茶店', 'チョコバナナ', '輪投げ']
const CHOICE_EVENTS: ChoiceDef[] = [
  { id: 'pm', title: '練習試合の誘い', body: '近隣校から練習試合の申し込みが来た。実戦経験を積めるが、疲労もたまる。', options: [{ label: '受ける', effectId: 'pm_accept' }, { label: '断る', effectId: 'pm_decline' }] },
  { id: 'donate', title: 'OBからの差し入れ', body: '卒業生が部に差し入れと心づけを持って訪ねてきた。', options: [{ label: 'ありがたく心づけを受け取る', effectId: 'donate_money' }, { label: '気持ちだけ受け取る', effectId: 'donate_thanks' }] },
  { id: 'late', title: '遅刻者', body: '何人かが朝練に遅刻した。どう対応する？', options: [{ label: '厳しく叱る', effectId: 'scold_strict' }, { label: '事情を聞いて大目に見る', effectId: 'scold_soft' }] },
  { id: 'gear', title: '用具の不具合', body: 'ゴールネットが破れているのが見つかった。修理には部費がかかる。', options: [{ label: '修理する（-25万）', effectId: 'fix_gear' }, { label: 'しばらく放置する', effectId: 'ignore_gear' }] },
  { id: 'camp', title: '自主合宿の提案', body: '選手たちが「週末に自主合宿をやりたい」と言い出した。気合いは十分だが体への負担も大きい。', options: [{ label: '認める', effectId: 'camp_extra' }, { label: '今回は見送る', effectId: 'camp_skip' }] },
  { id: 'media', title: '地元メディアの取材', body: '地元紙が部の取材を申し込んできた。注目度が上がるかもしれない。', options: [{ label: '取材を受ける', effectId: 'media_accept' }, { label: '練習に集中したい', effectId: 'media_decline' }] },
  { id: 'rival', title: '強豪校との練習試合', body: '県の強豪校から胸を借りる機会が。厳しい相手だが学べることは多い。', options: [{ label: '挑む', effectId: 'rival_accept' }, { label: '今は力をつける時', effectId: 'rival_decline' }] },
  { id: 'fund', title: '備品の新調', body: '練習着やボールがくたびれてきた。新調には部費がかかる。', options: [{ label: '新調する（-40万）', effectId: 'fund_buy' }, { label: 'もう少し使う', effectId: 'fund_save' }] },
  { id: 'alumni', title: 'OBコーチの申し出', body: '元プロのOBが「数週間だけ指導したい」と申し出てきた。謝礼は必要になる。', options: [{ label: '招く（-50万）', effectId: 'alumni_coach' }, { label: '丁重に断る', effectId: 'alumni_pass' }] },
  { id: 'volunteer', title: '地域の清掃活動', body: '町内会から、休日の清掃活動への参加を打診された。', options: [{ label: '部で参加する', effectId: 'volunteer_yes' }, { label: '今回は見送る', effectId: 'volunteer_no' }] },
  { id: 'sponsor', title: '地元企業の支援', body: '地元企業が「ユニフォーム代を援助したい」と申し出てきた。', options: [{ label: '支援を受ける', effectId: 'sponsor_take' }, { label: '自分たちの力でと断る', effectId: 'sponsor_pass' }] },
  { id: 'nutrition', title: '栄養サポートの申し出', body: '保護者の栄養士が「食事面をサポートしたい」と申し出てくれた。', options: [{ label: 'お願いする', effectId: 'nutrition_yes' }, { label: '丁重に断る', effectId: 'nutrition_no' }] },
  { id: 'slump', title: '連敗中のチーム', body: '負けが込んで、部の空気が重い。監督としてどう動く？', options: [{ label: 'ミーティングで立て直す', effectId: 'slump_meeting' }, { label: '黙って練習で見せる', effectId: 'slump_quiet' }] },
  { id: 'trainer', title: '専属トレーナーの体験', body: 'スポーツトレーナーが「無料体験で数週間ケアします」と提案。継続には費用がかかる。', options: [{ label: '契約する（-40万）', effectId: 'trainer_hire' }, { label: '体験だけで終える', effectId: 'trainer_pass' }] },
  { id: 'special', title: '特別特訓の志願', body: '{name}が「居残りで個別に鍛えてほしい」と志願してきた。本気の目だ。', options: [{ label: 'つきっきりで鍛える', effectId: 'special_yes' }, { label: '全体練習を優先する', effectId: 'special_no' }] },
  { id: 'tresen', title: '県トレセンの誘い', body: '{name}が県のトレセン（選抜練習）に誘われた。良い経験になる。', options: [{ label: '送り出す', effectId: 'tresen_go' }, { label: 'チーム練習を優先', effectId: 'tresen_skip' }] },
  { id: 'latenight', title: '控え組の居残り練習', body: 'B・Cチームの選手たちが、暗くなっても自主練を続けている。{name}が中心になって声をかけ合っているらしい。', options: [{ label: '付き合って後押しする', effectId: 'latenight_yes' }, { label: '怪我が心配なので帰す', effectId: 'latenight_no' }] },
  // F8: 旧「強豪校からの誘い（転校）」は本作に転校機構なし＝成立しないので、「視察に来た（注目されている）」物語に書き換え。
  { id: 'poach', title: '強豪校の関心', body: '{name}の活躍が広まり、県外の強豪校のスカウト関係者がベンチに姿を見せた。まだ正式な話ではないが、注目されているのは選手たちも感じている。', options: [{ label: '気にせず鍛え抜く', effectId: 'poach_refuse' }, { label: '本人に状況を伝える', effectId: 'poach_waver' }] },
  { id: 'discord', title: 'チーム内の衝突', body: 'レギュラー争いから、{name}と{name2}がぶつかった。空気がぴりついている。', options: [{ label: 'キャプテンに任せる', effectId: 'captain_talk' }, { label: '自分で直接締める', effectId: 'captain_self' }] },
  { id: 'restday', title: '疲労の蓄積', body: '連戦・連日の練習で、チーム全体に疲れが見える。', options: [{ label: '思い切って完全オフにする', effectId: 'rest_day' }, { label: '気を抜かず練習を続ける', effectId: 'rest_push' }] },
  // G-06: 個人能力成長イベントを追加（雰囲気系に偏らないように）
  { id: 'video-study', title: 'ビデオ研究の申し出', body: '{name}が「強豪の試合映像を見て勉強したい」と申し出てきた。', options: [{ label: '一緒に研究する', effectId: 'video_yes' }, { label: 'グラウンドで動きを覚えろと言う', effectId: 'video_no' }] },
  { id: 'gym-night', title: '夜のジム通い', body: '{name}が「夜にジムへ通って体作りをしたい」と相談に来た。怪我のリスクもあるが、自主性は尊重したい。', options: [{ label: 'メニューを組んでやる', effectId: 'gym_yes' }, { label: '自宅でできる範囲にとどめる', effectId: 'gym_no' }] },
  { id: 'kick-form', title: 'キックフォームの悩み', body: '{name}がキックの調子を崩している。フォームを見直したいという。', options: [{ label: '個別に見てやる', effectId: 'kick_yes' }, { label: '自分で気付くまで様子を見る', effectId: 'kick_no' }] },
  // G-29 第三波 追加：好み型/risk型/トレードオフ型を混ぜて多様性UP
  { id: 'snow-shovel', title: '朝の雪かき', body: '前夜の雪でグラウンドが埋まっている。練習前に雪かきが必要だ。', months: [12, 1, 2], options: [{ label: 'みんなで雪かきから始める', effectId: 'snow_team' }, { label: '体育館に移して練習する', effectId: 'snow_gym', requireExtra: 'gym' }] },
  { id: 'rival-friendly', title: '強豪校からの練習試合オファー', body: '隣県の強豪校から練習試合の打診が来た。長距離移動で疲労リスクあり。', options: [{ label: '受けて胸を借りる', effectId: 'rival_take' }, { label: '近場の相手で経験を積む', effectId: 'rival_easy' }] },
  { id: 'student-rep', title: '学級委員の打診', body: '{name}が学級委員に推薦された。練習量は少し減るが本人にとって貴重な経験だ。', months: [4, 5, 9], options: [{ label: '引き受けさせる', effectId: 'rep_yes' }, { label: '部活に集中させる', effectId: 'rep_no' }] },
  { id: 'parent-gift', title: '保護者からの差し入れ', body: '保護者会から「練習後の差し入れを用意したい」と申し出があった。', options: [{ label: 'ありがたく受ける', effectId: 'gift_yes' }, { label: '気持ちだけ受け取る', effectId: 'gift_no' }] },
  { id: 'press-talk', title: '地元紙の取材依頼', body: '地元の新聞社が選手インタビューをしたいと言ってきた。', options: [{ label: '受けて部の知名度を上げる', effectId: 'press_yes' }, { label: '練習に集中させる', effectId: 'press_no' }] },
  { id: 'review-meet', title: '練習後の振り返り会', body: '{name}が「終わったあとに5分だけ振り返りの時間がほしい」と提案してきた。', options: [{ label: '毎日続けてみる', effectId: 'review_yes' }, { label: '今日だけ試してみる', effectId: 'review_once' }] },
  { id: 'fixed-eleven', title: 'スタメン固定の悩み', body: '主力11人を固定するとチーム力は安定するが、控えが育たない。', options: [{ label: 'スタメンを少し回す', effectId: 'fix_rotate' }, { label: '勝ちにこだわって固定', effectId: 'fix_keep' }] },
  { id: 'mentor-pair', title: '先輩・後輩ペア練習', body: '3年生が「下級生と組んで基本練習を一緒にやりたい」と言ってきた。', months: [4, 5, 6, 7, 8, 9, 10, 11, 12], options: [{ label: 'ペアでじっくり', effectId: 'mentor_yes' }, { label: '通常メニューを優先', effectId: 'mentor_no' }] },
  { id: 'film-study', title: '相手チーム映像分析', body: '次の練習試合の相手映像が手に入った。分析するかは監督次第。', options: [{ label: 'みんなで研究する', effectId: 'film_yes' }, { label: '自分たちのサッカーを磨く', effectId: 'film_no' }] },
  { id: 'rain-day', title: '雨の日の応援練習', body: '雨で外練習ができない。室内で応援練習をやろうという提案が出た。', months: [6, 7, 9, 10], options: [{ label: '応援練習で結束を高める', effectId: 'rain_cheer' }, { label: '基礎をひたすら反復', effectId: 'rain_drill' }] },
  // G-29 第三波 さらに8件（合計42件達成）
  { id: 'morning-run', title: '朝練の習慣化', body: '{name}が「朝練を続けたい」と提案してきた。寒い時期は体力の消耗も激しい。', months: [11, 12, 1, 2], options: [{ label: '全員で続ける', effectId: 'morn_team' }, { label: 'やりたい者だけ自主練', effectId: 'morn_solo' }] },
  { id: 'fan-letter', title: 'ファンレターの届け', body: '小学生のサッカー少年団から「憧れています」という手紙が届いた。', options: [{ label: '皆で読んで励みにする', effectId: 'fan_read' }, { label: 'お礼の返事を書く', effectId: 'fan_reply' }] },
  { id: 'sns-rule', title: 'SNSの取り扱い', body: '部員のSNS投稿が話題になっている。校外でのふるまいにルールが必要か。', options: [{ label: '部内ルールを作る', effectId: 'sns_rule' }, { label: '本人の判断に任せる', effectId: 'sns_free' }] },
  { id: 'send-off', title: '大会前の壮行会', body: '学校全体で壮行会を開いてくれるという。練習時間は削られる。', months: [6, 12], options: [{ label: 'ありがたく参加する', effectId: 'send_yes' }, { label: '練習を優先させる', effectId: 'send_no' }] },
  { id: 'field-fix', title: 'グラウンドの整備', body: 'グラウンドの一部が荒れている。練習前に整備を入れるか。', options: [{ label: '時間を割いて整備', effectId: 'field_fix' }, { label: 'そのまま使い込む', effectId: 'field_use' }] },
  { id: 'meal-plan', title: '食事メニューの相談', body: '部員から「練習に合った食事のアドバイスがほしい」と相談された。', options: [{ label: '一緒に考える時間を取る', effectId: 'meal_help' }, { label: '本人に任せる', effectId: 'meal_self' }] },
  { id: 'self-sheet', title: '自己分析シートの提案', body: '{name}が「毎週、自分の課題を書き出すシートを使いたい」と言ってきた。', options: [{ label: 'チーム全員で取り組む', effectId: 'sheet_all' }, { label: '本人だけで試させる', effectId: 'sheet_solo' }] },
  { id: 'kit-design', title: '練習着のデザイン変更', body: '部員から「練習着を新しいデザインに」という声が上がっている。', options: [{ label: '部費から新調', effectId: 'kit_new' }, { label: '今あるものを大切に', effectId: 'kit_keep' }] },
]

// 汎用「あるある」（低頻度）
const GENERIC: { body: string; atmo: number }[] = [
  { body: '1年生が進んでグラウンド整備とボール磨きを引き受けた。先輩たちの空気が和らぐ。', atmo: 2 },
  { body: '練習後、何人かが残って自主練していた。良い雰囲気だ。', atmo: 2 },
  { body: 'ビブスの洗濯当番でちょっとした言い合いが。よくあることだ。', atmo: -1 },
  { body: '差し入れのスポーツドリンクで部員たちが盛り上がった。', atmo: 1 },
  { body: '近所の小学生が練習を見学に来た。選手たちは少し誇らしげ。', atmo: 1 },
  { body: '部室の電球が切れた。誰も気づかないふりをしている。', atmo: 0 },
  { body: '紅白戦が思いのほか白熱し、ベンチも盛り上がった。', atmo: 2 },
  { body: 'グラウンドの隅で{name}がリフティングの新記録を出したらしい。', atmo: 1 },
  { body: '雨上がり、ぬかるんだグラウンドの整備をみんなで手分けした。', atmo: 1 },
  { body: 'キャプテンが全体に短いミーティングを開いた。締まった空気になる。', atmo: 2 },
  { body: '練習用ボールが1個、フェンスの向こうに消えた。回収係はじゃんけんで決定。', atmo: 0 },
  { body: '先輩が後輩にシュートのコツを教えていた。良い連鎖だ。', atmo: 2 },
  { body: '地域の清掃活動に部で参加した。地元の評判は悪くない。', atmo: 1 },
  { body: '{name}の誕生日をこっそり祝った。たまにはこういうのもいい。', atmo: 2 },
  { body: 'OBが差し入れを持って練習を見に来た。現役に良い刺激だ。', atmo: 2 },
  { body: '練習メニューの順番でちょっとした口論。すぐに収まった。', atmo: -1 },
  { body: '新しい戦術の手応えを掴んだ選手が、嬉しそうに話していた。', atmo: 2 },
  { body: 'グラウンドに猫が迷い込み、練習が一瞬中断。みんな笑顔に。', atmo: 1 },
  { body: 'マネージャーが手作りの練習記録ノートを配ってくれた。', atmo: 1 },
  { body: '隣の部活と用具置き場のことで小さなもめ事。話し合いで解決。', atmo: 0 },
  { body: '雨で外練習が中止。室内で基礎トレと映像分析に切り替えた。', atmo: 0 },
  { body: '卒業生の試合結果がSNSで話題に。後輩たちも刺激を受けた。', atmo: 1 },
  { body: '部員同士でフォームを撮り合い、改善点を指摘し合っていた。', atmo: 2 },
  { body: '練習試合の相手校と、終了後に交流して打ち解けた。', atmo: 1 },
  { body: '部室にOBが寄せ書きを残していった。歴代の思いが壁に増えていく。', atmo: 2 },
  { body: '雨で流れた練習の代わりに、全員で戦術ボードを囲んだ。', atmo: 1 },
  { body: 'ベンチ組が声を枯らして応援していた。チームは一体だ。', atmo: 2 },
  { body: 'グラウンド整備のトンボがけを1年生が競争にしていた。微笑ましい。', atmo: 1 },
  { body: '練習後のミーティングが思いのほか長引いた。語りたいことが多い証拠だ。', atmo: 1 },
  { body: '近隣の幼稚園児がサッカー教室を見学。選手たちが手本を見せた。', atmo: 1 },
  { body: '部費のやりくりをマネージャーがきっちり管理してくれている。', atmo: 1 },
  { body: '試合直前に{name}のスパイクの紐が切れ、控えが自分のを差し出した。', atmo: 2 },
  { body: '部の目標を書いた紙が部室に貼り直された。気持ちが引き締まる。', atmo: 1 },
  // #22/#23 名指しの一コマ（{name}＝在籍選手をランダム代入）。日々の小さな物語で愛着を育てる。
  { body: '練習後、{name}が居残りで黙々とシュートを打ち続けていた。声をかけると照れくさそうに笑った。', atmo: 1 },
  { body: '{name}が新しいスパイクを嬉しそうに見せてきた。バイト代で買ったらしい。', atmo: 1 },
  { body: '雨の日、{name}が後輩のために部室の窓を全部閉めて回っていた。気が利く子だ。', atmo: 2 },
  { body: '{name}がノートに相手チームの分析を書き込んでいた。サッカーが好きなんだな、と思う。', atmo: 1 },
  { body: '紅白戦で{name}が会心のループシュートを決め、ベンチが総立ちになった。', atmo: 2 },
  { body: '{name}が朝練に一番乗りで来ていた。グラウンドにはまだ朝露が残っていた。', atmo: 1 },
  { body: 'テスト返却の日、{name}が浮かない顔をしていた。勉強と部活の両立は大変だ。', atmo: -1 },
  { body: '{name}が下級生に基礎練のコツを身振り手振りで教えていた。良い先輩になってきた。', atmo: 2 },
  { body: '遠征バスの中、{name}が窓に頭をもたせかけて寝ていた。よく頑張っている。', atmo: 1 },
  { body: '{name}が試合のビデオを何度も巻き戻して自分のプレーを見直していた。', atmo: 1 },
  { body: '昼休み、{name}たちがグラウンドの隅でリフティングの回数を競っていた。', atmo: 1 },
  { body: '{name}が「監督、次はスタメンで使ってください」と真っ直ぐな目で言ってきた。', atmo: 1 },
]

// 季節連動フレーバー（月で出し分け＝完全ランダムより「生きている」）。{name}=在籍選手。
const SEASONAL: { months: number[]; body: string; atmo: number }[] = [
  // 春（4-5月・新学期）
  { months: [4, 5], body: 'グラウンド脇の桜が満開だ。{name}が花びらの舞う中でボールを蹴っていた。', atmo: 2 },
  { months: [4, 5], body: '新年度の身体測定。{name}が「また背が伸びた」と少し誇らしげだった。', atmo: 1 },
  { months: [4, 5], body: '新入生が先輩のプレーに見とれていた。憧れは上達の第一歩だ。', atmo: 1 },
  { months: [5], body: '五月晴れの下、{name}を中心に伸び伸びとしたいい練習ができた。', atmo: 2 },
  // 梅雨（6-7月）
  { months: [6], body: '梅雨の晴れ間、{name}が「今のうちに！」と外練を全力で楽しんでいた。', atmo: 1 },
  { months: [6, 7], body: '長雨で室内練習が続く。{name}が黙々と体幹トレに打ち込んでいた。', atmo: 0 },
  // 夏（7-8月）
  { months: [7, 8], body: '猛暑日。{name}が後輩に塩タブレットを配って回っていた。', atmo: 1 },
  { months: [7, 8], body: '猛暑日。水分補給はこまめに、と全員に声をかけた。', atmo: 0 },
  { months: [8], body: '蝉しぐれの夕方、{name}が一人だけ残ってシュート練を続けていた。', atmo: 1 },
  // 秋（9-11月）
  { months: [8, 9], body: '夏の終わり、引退した先輩がふらりと顔を出した。後輩たちが沸く。', atmo: 2 },
  { months: [9, 10], body: '涼しくなってきた。{name}の動きが一段と軽くなったように見える。', atmo: 1 },
  { months: [9, 10], body: '体育祭の練習で部員が駆り出され、サッカー部の練習は半分に。', atmo: -1 },
  { months: [10, 11], body: '文化祭の準備で校内が賑やか。{name}たちも合間に顔を出して楽しんでいた。', atmo: 1 },
  { months: [11], body: '落ち葉の散るグラウンドで、{name}が黙々とロングキックの精度を確かめていた。', atmo: 1 },
  // 冬（12-2月）
  { months: [12, 1], body: '吐く息も白い早朝練習。{name}が一番に声を出してチームを引っ張った。', atmo: 2 },
  { months: [12, 1, 2], body: '寒い朝、白い息を吐きながらの全体ランニング。妙に一体感がある。', atmo: 1 },
  { months: [1], body: '正月明け、{name}が「今年こそ」と新しい目標を口にしていた。', atmo: 2 },
  { months: [2], body: '底冷えする体育館。{name}が寒さに負けず基礎を反復していた。', atmo: 1 },
]

export function generateWeeklyFlavor(state: CareerState, plan: WeeklyPlan, rng: RNG): FlavorResult {
  const month = weekToMonth(state.week)
  // 1年目の序盤（week<10＝チュートリアル解放期間）はイベントを抑制し機能習熟に集中。
  // それ以降（夏大会後〜合宿の“中だるみ”を含む）は、むしろ賑やかにして離脱を防ぐ。
  if (state.year <= 1 && state.week < 10) return { event: null, atmoDelta: 0 }
  // 1年目の後半と3年目以降はイベント発生率を上げる（マンネリ・中だるみ防止）。
  const eventMult = state.year >= 3 ? 1.9 : state.year === 1 ? 2.3 : 1.0

  // #31 定期考査（年4回）。テスト月に入った最初の週に「監督の選択」を最優先で出す。
  //   📚勉強優先＝赤点回避・安定だが成長↓ ／ ⚽練習続行＝成長維持だが赤点リスク。
  //   結果（赤点→補習／好成績→調子↑）は resolveEvent('exam_study'|'exam_train') で処理。
  const prevMonth = weekToMonth(Math.max(1, state.week - 1))
  if ((month === 6 || month === 11 || month === 1 || month === 3) && month !== prevMonth) {
    return {
      event: {
        id: `exam-${state.year}-${month}`, kind: 'choice', title: '定期考査が近い',
        body: 'テスト週間が近づいてきた。部員たちの様子も、どこか落ち着かない。\n勉強を優先すれば赤点は出にくいが、今週の練習の成果は控えめになる。練習を続ければ成長はそのまま、ただし赤点のリスクは残る。\n監督として、今週はどう構える？',
        options: [
          { label: '📚 勉強を優先させる', effectId: 'exam_study' },
          { label: '⚽ 練習を続行する', effectId: 'exam_train' },
        ],
      },
      atmoDelta: 0,
    }
  }

  // G-32: マネージャー恋愛 発火判定（5月=week5・年1回・15%）
  //   条件: マネージャー在籍2年目以降 + 部室Lv3以上 + マネ未交際 + 候補選手が居る
  //   候補: 雰囲気貢献+1以上の性格 + 非引退 + Aチーム + マネと未交際 + 既に「文化祭の彼女」フラグ無し
  if (state.week === 5 && state.manager && !state.manager.dating
    && state.year > state.manager.joinedYear
    && state.facilities.clubhouse >= 3) {
    if (rng.chance(0.15)) {
      const candidates = state.roster.filter((p) => !p.retired && (p.squad ?? 'A') === 'A'
        && !p.hasGirlfriend // 彼女持ちは除外（二股防止・2026-07-07修正）
        && ['leader', 'hardworker', 'genius', 'fighter', 'moodmaker'].includes(p.personality))
      if (candidates.length > 0) {
        const target = rng.pick(candidates)
        const mgrName = state.manager.name
        return {
          event: {
            id: `mgr-love-${state.year}`, kind: 'flavor',
            title: '💕 マネージャーが急接近',
            body: `マネージャーの${mgrName}が、${target.name}に何かと声をかけている。\n部室で2人で話し込んでいる姿が部員たちの間で噂になっている——どうやら本人たちも自覚しているようだ。`,
          },
          atmoDelta: 1,
          rosterPatch: (roster) => roster.map((p) => p.id === target.id
            ? { ...p, abilities: { ...p.abilities, iq: Math.min(99, p.abilities.iq + 1) } }
            : p),
          managerPatch: (mgr) => ({ ...mgr, dating: { playerId: target.id, startYear: state.year } }),
        }
      }
    }
  }
  // G-32: 交際継続フレーバー（年2-3回・低頻度・状態変化なし）
  if (state.manager?.dating && rng.chance(0.04 * eventMult)) {
    const dater = state.roster.find((p) => p.id === state.manager!.dating!.playerId)
    if (dater && !dater.retired) {
      const flavor = rng.pick([
        `マネージャーが${dater.name}の試合をいつにも増して熱心に応援していた。`,
        `${dater.name}とマネージャーが部室で談笑している。穏やかな空気が部に流れる。`,
        `${dater.name}を見送るマネージャーの表情に、いつにない優しさがあった。`,
      ])
      return { event: { id: `mgr-flavor-${state.year}-${state.week}`, kind: 'flavor', title: '💕 部室の片隅で', body: flavor }, atmoDelta: 1 }
    }
  }
  // G-32: 破局イベント（年5%・季節無関係）。dater は雰囲気貢献-1相当の状態異常はつかないが、雰囲気-2で再現
  if (state.manager?.dating && state.week === 25 && rng.chance(0.05)) {
    const dater = state.roster.find((p) => p.id === state.manager!.dating!.playerId)
    if (dater && !dater.retired) {
      return {
        event: { id: `mgr-breakup-${state.year}`, kind: 'flavor', title: '💔 マネージャーと別れたらしい', body: `マネージャーと${dater.name}が距離を取るようになった。気まずさが部室の空気に響く。` },
        atmoDelta: -2,
        managerPatch: (mgr) => ({ ...mgr, dating: undefined }),
      }
    }
  }

  // 年代別代表選出（#37）: 代表候補レベル(能力合計630/tier8)に到達した未選出の現役が呼ばれる。
  //   選出は「代表合宿で本人が伸び・部の評判が上がり・調子が上向く」実利あるイベントに。一度きり(初選出)。
  if (rng.chance(0.05 * eventMult)) {
    const eligible = [...state.roster]
      .filter((p) => !p.retired && !p.nationalRep && playerOverallSum(p) >= 630)
      .sort((a, b) => playerOverallSum(b) - playerOverallSum(a))
    const star = eligible[0]
    if (star) {
      // 代表合宿で各能力 +2〜4（決定的: 選手IDで散らす）。GKはGK能力も伸びる。
      const gain = (i: number) => 2 + ((star.id.charCodeAt((i + star.id.length - 1) % star.id.length) + i) % 3)
      const patch = (roster: Player[]): Player[] => roster.map((p) => {
        if (p.id !== star.id) return p
        const a = p.abilities
        const grown = {
          kick: a.kick + gain(0), power: a.power + gain(1), speed: a.speed + gain(2),
          technique: a.technique + gain(3), stamina: a.stamina + gain(4),
          iq: a.iq + gain(5), defense: a.defense + gain(6),
        }
        const gk = p.gk ? { saving: p.gk.saving + gain(7), gkIq: p.gk.gkIq + gain(8) } : p.gk
        return { ...p, abilities: grown, gk, nationalRep: true, condition: Math.min(5, p.condition + 1) as typeof p.condition }
      })
      return {
        event: { id: `rep-${state.week}`, kind: 'news', title: '代表選出',
          body: `${star.name}が年代別日本代表に選出された！代表合宿でもまれて一回り成長し、本人も自信をつけて帰ってきた。学校の名も上がり、いい選手が集まりやすくなった。` },
        atmoDelta: 3,
        repDelta: 3,
        rosterPatch: patch,
      }
    }
  }

  // OB後日談ニュース（補完R-2-4・情緒/リテンションの核）: 出身プロの活躍
  if (state.records.proAlumni.length > 0 && rng.chance(0.05)) {
    const ob = rng.pick(state.records.proAlumni)
    const news = rng.pick([
      `元${state.schoolName}の${ob.name}が、プロの舞台で活躍しているらしい。`,
      `OBの${ob.name}がリーグ戦で初ゴール！ニュースを見た後輩たちが沸いた。`,
      `${ob.name}が試合後のインタビューで母校に触れたという。部に誇らしい空気が流れる。`,
      `${ob.name}の活躍が地元紙に載った。「あの子がなあ」と職員室も盛り上がる。`,
      `プロで活躍する${ob.name}が、オフに母校へ顔を出してくれた。`,
    ])
    return { event: { id: `ob-${state.week}`, kind: 'news', title: 'OBの活躍', body: news }, atmoDelta: 1 }
  }

  // 選択イベント（効果は選択時にresolveで適用するのでatmoDelta=0）
  // 本文に{name}/{name2}が含まれていれば名指し置換（少人数イベントを匿名にしない）。
  if (rng.chance(0.06 * eventMult)) {
    // G-45: 文化祭の選択は week28 固定イベント（generateFestivalWeek）に一本化済み。
    //   ここのランダムプールには文化祭を含めない（旧G-44の週制限フィルタも不要になった）。
    // B-2(2026-08-17): months 指定のあるイベントは該当月しか出さない（夏に雪かきが出る等の季節ズレを防ぐ）。
    const pool = CHOICE_EVENTS.filter((e) => !e.months || e.months.includes(month))
    const ce = rng.pick(pool)
    // G-03/G-28: 本文の{name}置換と同じ選手名を保存し、選択後の結果の地の文にも同じ選手を差し込む。
    const active = state.roster.filter((p) => !p.retired)
    const a1 = active.length ? rng.pick(active) : null
    const others = active.filter((p) => p.id !== a1?.id)
    const a2 = others.length ? rng.pick(others) : a1
    // G-30: {stall}（文化祭の出店名）もランダム代入して具体性を出す。
    const stall = rng.pick(FESTIVAL_STALLS)
    const fill = (s: string) => s.replace(/\{stall\}/g, stall).replace(/\{name2\}/g, a2 ? a2.name : '別の選手').replace(/\{name\}/g, a1 ? a1.name : '選手')
    // B-1(2026-08-17): 設備が要る選択肢は「持っていなければ選べない」形で見せる。
    //   隠さずロック表示にすることで、設備投資すると選べる手が増えることが player に伝わる。
    const extras = state.facilities.extras ?? []
    let options = ce.options.map((o) => {
      if (!o.requireExtra || extras.includes(o.requireExtra)) return { label: o.label, effectId: o.effectId }
      const name = EXTRA_FACILITIES.find((e) => e.id === o.requireExtra)?.name ?? o.requireExtra
      return { label: o.label, effectId: o.effectId, locked: `${name}が必要` }
    })
    // 全部ロックされたら詰むので、その場合だけロックを外す（選択肢設計のセーフティ）
    if (options.every((o) => o.locked)) options = ce.options.map((o) => ({ label: o.label, effectId: o.effectId }))
    return {
      event: { id: `ch-${ce.id}-${state.week}`, kind: 'choice', title: ce.title, body: fill(ce.body), options, actorName: a1?.name, actorName2: a2?.name },
      atmoDelta: 0,
    }
  }

  // 走り込みの日は空気が重い（あるある）
  if (plan.lanes.some((l) => l.menuId === 'run') && rng.chance(0.25)) {
    return { event: { id: `fl-run-${state.week}`, kind: 'flavor', title: '走り込みの日', body: 'メニューが「走り込み」と知れ渡った瞬間、グラウンドの空気が少し凍った。', }, atmoDelta: -2 }
  }
  // G-45: 文化祭は week28 進入時の固定イベント（generateFestivalWeek・本ファイル末尾）で出す。
  //   旧6日サブモード（G-22-A改・festival.ts/FestivalScreen）は廃止した。

  // G-39: 彼女システム継続化（hasGirlfriend 持ち選手へのフレーバー＋稀な破局）
  //   発火条件: 彼女持ち選手が存在 + 文化祭以外の週 + 低頻度（年2-3回）
  //   ※week27処理分は week28（文化祭週）の頭に表示されるため、27・28の両方を除外して恋愛イベントと重ねない。
  if (state.week !== 27 && state.week !== 28 && rng.chance(0.04 * eventMult)) {
    const datings = state.roster.filter((p) => !p.retired && p.hasGirlfriend)
    if (datings.length > 0) {
      const dater = rng.pick(datings)
      const flav = rng.pick([
        `${dater.name}が休日にデートしたらしい。練習に戻ってきた表情はどこか柔らかい。`,
        `${dater.name}の彼女が応援に顔を出した。{name2}にぎこちなく挨拶している姿に和む。`,
        `${dater.name}が試験前、勉強会で彼女に教えてもらったらしい。文武両道とはこのことか。`,
        `${dater.name}が部室で彼女からの差し入れを照れくさそうに分け合っていた。`,
      ])
      // 名指し補助
      const others = state.roster.filter((p) => !p.retired && p.id !== dater.id)
      const a2 = others.length ? rng.pick(others) : dater
      const body = flav.replace(/\{name2\}/g, a2.name)
      return { event: { id: `gf-${state.year}-${state.week}`, kind: 'flavor', title: '💑 部活のあとで', body }, atmoDelta: 1 }
    }
  }
  // G-39: 破局（稀・年1%程度・週単位で見ると 0.0003）
  if (state.week !== 27 && state.week !== 28 && rng.chance(0.003)) {
    const datings = state.roster.filter((p) => !p.retired && p.hasGirlfriend)
    if (datings.length > 0) {
      const dater = rng.pick(datings)
      return {
        event: { id: `gf-breakup-${state.year}-${state.week}`, kind: 'flavor', title: '💔 ぎくしゃく', body: `${dater.name}と彼女がうまくいっていないらしい。練習中もどこか心ここにあらず。` },
        atmoDelta: -2,
        rosterPatch: (roster) => roster.map((p) => p.id === dater.id ? { ...p, hasGirlfriend: false, condition: Math.max(1, p.condition - 1) as typeof p.condition } : p),
      }
    }
  }
  // G-39: 文化祭外での彼女発生（稀・年1-2回程度・部活以外の場で出会う）
  if (state.week !== 27 && state.week !== 28 && rng.chance(0.006)) {
    const free = state.roster.filter((p) => !p.retired && !p.hasGirlfriend && (p.squad ?? 'A') === 'A')
    if (free.length > 0) {
      const target = rng.pick(free)
      return {
        event: { id: `gf-meet-${state.year}-${state.week}`, kind: 'flavor', title: '🍀 気になる出会い', body: `${target.name}に気になる相手ができたらしい。塾の帰りか、別のクラスの友達経由か——詳細は本人のみぞ知る。` },
        atmoDelta: 1,
        rosterPatch: (roster) => roster.map((p) => p.id === target.id
          ? { ...p, hasGirlfriend: true, abilities: { ...p.abilities, iq: Math.min(99, p.abilities.iq + 1) }, fatigue: Math.max(0, p.fatigue - 5) }
          : p),
      }
    }
  }

  // G-22-④: 3年最後の大会演出（冬予選Week33の直前=Week32に固定発火）。
  //   3年生がいるときだけ。背番号10の3年生がいればパターンA優先（背負う重み）。
  //   他チームの存在を反映してチーム雰囲気+3（一時的・大会直前のひと押し）。
  if (state.week === 32 && state.year >= 1) {
    const seniors = state.roster.filter((p) => !p.retired && p.grade === 3 && (p.squad ?? 'A') === 'A')
    if (seniors.length > 0) {
      const ten = seniors.find((p) => p.number === 10)
      let body: string
      if (ten) {
        body = `3年生にとって最後の大会が始まる。背番号10の重みを噛みしめる${ten.name}。`
      } else {
        const focus = rng.pick(seniors)
        const otherPattern = rng.next() < 0.5
          ? `最後の冬。${focus.name}たち3年生は、特別な想いでグラウンドに立つ。`
          : `これが最後だ。3年生全員が、その意味を分かっている。`
        body = otherPattern
      }
      // G-22-④: persistent multi-week 効果のため seniorBoostYear をセット（engine.ts側で読む）
      return { event: { id: `final-tournament-${state.year}`, kind: 'flavor', title: '3年生・最後の冬', body }, atmoDelta: 3, seniorBoostStartYear: state.year }
    }
  }
  // G-22-③ 廃止（#62 で新キャプテンはユーザーが NewCaptainScreen で選ぶ方式に変更）。
  //   旧仕様で week39 に自動発火していた就任フレーバーは「ユーザー選択の直後に重複表示・
  //   かつ 4週間の慣れ期間など現行と食い違う説明」になるため削除した。
  // （夏合宿は week20 の専用サブモードで描くので、ここでの「合宿の余韻」フレーバーは出さない＝開始前に終了感が出るのを防ぐ）
  const sub = (body: string): string => {
    if (!body.includes('{name}')) return body
    const active = state.roster.filter((p) => !p.retired)
    return body.replace(/\{name\}/g, active.length ? rng.pick(active).name : '選手')
  }
  // 季節連動フレーバー（月で出し分け＝完全ランダムより生きている）。先に判定して稀に発火。
  const seasonal = SEASONAL.filter((s) => s.months.includes(month))
  if (seasonal.length > 0 && rng.chance(0.06 * eventMult)) {
    const f = rng.pick(seasonal)
    return { event: { id: `fl-season-${state.week}`, kind: 'flavor', title: '部活の一コマ', body: sub(f.body) }, atmoDelta: f.atmo }
  }
  // 汎用あるある（#23: {name}付きは匿名「誰か」をやめ実在選手を名指しに）
  if (rng.chance(0.10 * eventMult)) {
    const f = rng.pick(GENERIC)
    return { event: { id: `fl-gen-${state.week}`, kind: 'flavor', title: '部活の一コマ', body: sub(f.body) }, atmoDelta: f.atmo }
  }
  return { event: null, atmoDelta: 0 }
}

// ============================================================
// マネージャー専用ミニイベント（trait別4種 + 共通2種）
//   恋愛系（mgr-love/mgr-flavor/mgr-breakup）とは別系統の「マネージャー業」
//   イベント。練習効率や受動効果に直接作用するため、engine.ts で training
//   より前に評価する必要がある（FlavorResult ではなく専用結果型を返す）。
// ============================================================
export interface ManagerWeekResult {
  event: WeekEvent | null
  atmoDelta: number              // 雰囲気即時加算（engine 側で加算される）
  practiceEffMult: number        // この週の練習効率倍率（1.0=変化なし）
  skipPassive: boolean           // この週は受動効果オフ（疲労回復+/雰囲気底上げを止める）
  rosterPatch?: (r: Player[]) => Player[]  // 全員/特定選手の fatigue/condition 変化
  counterPatch?: Partial<ManagerEventState> // managerEvents の年間カウンタ更新
}

const EMPTY_MGR_RESULT: ManagerWeekResult = {
  event: null, atmoDelta: 0, practiceEffMult: 1, skipPassive: false,
}

/**
 * 週次マネージャー専用イベントの抽選。state.manager と state.managerEvents は呼び出し側で保証する。
 * 発火優先度: 風邪欠席 > caring/共通の確率発火 > trait専用の年初プラン
 */
export function generateManagerWeekEvent(
  state: CareerState, mgrEv: ManagerEventState, weather: string | undefined, rng: RNG,
): ManagerWeekResult {
  const mgr = state.manager
  if (!mgr) return EMPTY_MGR_RESULT
  const week = state.week
  const mgrName = mgr.name

  // === 風邪欠席（共通・最優先・年1回） ===
  // 年初に absentWeek を抽選し、その週が来たら必ず発火。受動効果オフ＋練習効率-15%
  if (!mgrEv.coldUsed && mgrEv.absentWeek === week) {
    return {
      event: {
        id: `mgr-cold-${state.year}`, kind: 'flavor',
        title: '🤧 マネージャーが風邪で欠席',
        body: `${mgrName}が体調を崩したらしく、今週は部活を休んでいる。\n頼りにしていた人がいないと、なんとなく練習の手応えも薄い。マネがいることのありがたさを実感する一週間。`,
      },
      atmoDelta: 0,
      practiceEffMult: 0.85,
      skipPassive: true,
      counterPatch: { coldUsed: true },
    }
  }

  // === caring専用: ○○くんの体調に気付く（週次・確率発火・年4回上限） ===
  if (mgr.trait === 'caring' && mgrEv.caringFired < 4) {
    if (rng.chance(0.12)) {
      const tired = state.roster.filter((p) => !p.retired && p.fatigue >= 70)
      if (tired.length > 0) {
        const target = rng.pick(tired)
        return {
          event: {
            id: `mgr-care-${state.year}-${week}`, kind: 'flavor',
            title: `💖 ${target.name}の疲れに気付く`,
            body: `「${target.name}くん、最近ちょっと疲れてない？無理しないでね」\n面倒見のいい${mgrName}が、誰よりも早く${target.name}の疲れに気付いた。気づかいの言葉だけで、ふっと体が軽くなる。`,
          },
          atmoDelta: 0,
          practiceEffMult: 1,
          skipPassive: false,
          rosterPatch: (roster) => roster.map((p) => p.id === target.id ? { ...p, fatigue: Math.max(0, p.fatigue - 15) } : p),
          counterPatch: { caringFired: mgrEv.caringFired + 1 },
        }
      }
    }
  }

  // === 共通: スポドリ差し入れ（週14-34・晴/猛暑・8%/週・全員疲労-5） ===
  if (week >= 14 && week <= 34 && (weather === '晴れ' || weather === '猛暑')) {
    if (rng.chance(0.08)) {
      return {
        event: {
          id: `mgr-drink-${state.year}-${week}`, kind: 'flavor',
          title: '🥤 スポーツドリンクの差し入れ',
          body: `「みんなお疲れさま！冷えてるよー」\n${mgrName}が、クーラーボックスごとスポーツドリンクを差し入れてくれた。汗だくの部員たちが、思わず顔をほころばせる。`,
        },
        atmoDelta: 0,
        practiceEffMult: 1,
        skipPassive: false,
        rosterPatch: (roster) => roster.map((p) => p.retired ? p : { ...p, fatigue: Math.max(0, p.fatigue - 5) }),
      }
    }
  }

  // === organized専用: 用具整理・修復（年初プランで指定週に発火・練習効率+15%×1週） ===
  if (mgr.trait === 'organized' && mgrEv.plan.organized.includes(week)) {
    return {
      event: {
        id: `mgr-tools-${state.year}-${week}`, kind: 'flavor',
        title: '🧹 用具を整えてくれた',
        body: `気づけば部室の用具がきれいに整理されていた。\nボロボロだったビブスも丁寧に繕われている。${mgrName}の仕事だ。今週は、練習の段取りが一気にスムーズになる。`,
      },
      atmoDelta: 0,
      practiceEffMult: 1.15,
      skipPassive: false,
    }
  }

  // === cheerful専用: お菓子の差し入れ（年初プランで指定週に発火・雰囲気+3/恋愛中+5） ===
  if (mgr.trait === 'cheerful' && mgrEv.plan.cheerful.includes(week)) {
    const dating = !!mgr.dating
    let body: string
    if (dating) {
      const partner = state.roster.find((p) => p.id === mgr.dating!.playerId)
      const partnerName = partner ? partner.name : '部員の誰か'
      body = `「みんな、食べてー！」\n${mgrName}が、お手製のクッキーを部室に持ってきた。\n${partnerName}に最初に渡した一枚が、ひときわ大きいのは気のせいだろうか——部室がいつにも増して明るくなる。`
    } else {
      body = `「みんな、食べてー！」\n${mgrName}が、お手製のクッキー（らしきもの）を部室に持ってきた。\nおいしいかどうかは別として、部員たちの表情がぱっと明るくなる。`
    }
    return {
      event: {
        id: `mgr-sweets-${state.year}-${week}`, kind: 'flavor',
        title: '🍪 お菓子の差し入れ',
        body,
      },
      atmoDelta: dating ? 5 : 3,
      practiceEffMult: 1,
      skipPassive: false,
    }
  }

  // === analytical専用: カメラで3人撮影（年初プランで指定週に発火・3人 condition+1） ===
  if (mgr.trait === 'analytical' && mgrEv.plan.analytical.includes(week)) {
    const active = state.roster.filter((p) => !p.retired)
    if (active.length >= 3) {
      const pool = active.slice()
      const picks: Player[] = []
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = Math.floor(rng.next() * pool.length)
        picks.push(pool.splice(idx, 1)[0])
      }
      const names = picks.map((p) => p.name)
      const targetIds = new Set(picks.map((p) => p.id))
      return {
        event: {
          id: `mgr-photo-${state.year}-${week}`, kind: 'flavor',
          title: '📷 マネージャーの一枚',
          body: `「${names[0]}、${names[1]}、${names[2]}！さっきのプレー、すごく良かったよ」\n${mgrName}が、練習中の一瞬を切り取った写真を見せてくれた。自分の動きを客観的に見られて、3人の表情がほころぶ。`,
        },
        atmoDelta: 0,
        practiceEffMult: 1,
        skipPassive: false,
        rosterPatch: (roster) => roster.map((p) => targetIds.has(p.id)
          ? { ...p, condition: Math.min(5, p.condition + 1) as typeof p.condition }
          : p),
      }
    }
  }

  return EMPTY_MGR_RESULT
}

// ============================================================
// G-45: 文化祭ウィーク（week28進入時の固定イベント・単発形式）
// 旧6日サブモード（G-22-A改）を廃止し、①準備の選択 ②当日フレーバー
// ③恋愛イベント(0-3件・従来確率) を週次イベントとして返す。
// バランス: festival_help選択時の成長は実測平均+8.9（300シード・scripts/festival-balance-check.ts）。
//   抽選は resolveEvent の boost 機構（重複ピックはスキップ）のため名目5人×+1〜+3より少し下がる。
//   旧6日モード（期待値≈10.5）よりわずかに低いが、全員疲労も+15→+6に軽くなっており年間影響は微小
//   （同一シードA/B: 年末能力合計の差 ≈ +6/4100・雰囲気+0.2・疲労差は年末までに消滅）。
// 恋愛の確率と効果は旧6日モードから変更なし（0=20%/1=50%/2=25%/3=5%・
// 成功:失敗=7:3・成功=彼女+IQ+1+疲労-5・失敗=調子-1）。
// B-3(2026-08-17): 「告白された:6:4」の分岐は廃止＝告白する側のみ（断ったのに落ち込む矛盾を解消）。
// ============================================================

const FESTIVAL_PARTNER_TYPES = [
  'クラスメイト',
  '同じ委員会の子',
  '隣のクラスの子',
  '文化祭に来てた他校の子',
  '中学からの幼なじみ',
  '部活見学に来てた子',
  '図書室でよく会う子',
] as const

/** 文化祭での恋愛イベント1件分。
 *  B-3(2026-08-17): 「告白された→断った」のに本人が落ち込むのは筋が通らないので、
 *  告白する側だけに一本化した（成功＝付き合う／失敗＝振られて落ち込む）。 */
function buildLoveLine(name: string, partnerType: string, result: 'success' | 'reject'): string {
  return result === 'success'
    ? `${name}が${partnerType}に告白して彼女ができたみたいだ。`
    : `${name}が${partnerType}に告白したけど振られたらしい。`
}

export interface FestivalWeekResult {
  events: WeekEvent[]
  rosterPatch: (roster: Player[]) => Player[]
  atmoDelta: number
}

export function generateFestivalWeek(state: CareerState, rng: RNG): FestivalWeekResult {
  const events: WeekEvent[] = []
  const active = state.roster.filter((p) => !p.retired)

  // ① 準備の選択（手伝わせるか・練習優先か）。当日は全員参加が前提＝不参加の選択肢は置かない。
  const a1 = active.length ? rng.pick(active) : null
  const stall = rng.pick(FESTIVAL_STALLS)
  events.push({
    id: `festival-prep-${state.year}`,
    kind: 'choice',
    title: '🎪 文化祭ウィーク',
    body: `今週末は文化祭。どのクラスも出店の準備で大忙しだ。${a1 ? a1.name : '部員'}のクラスは${stall}を出すらしい。部員たちに準備を手伝わせるか？`,
    options: [
      { label: '準備を手伝わせる', effectId: 'festival_help' },
      { label: '練習を優先させる', effectId: 'festival_skip' },
    ],
    actorName: a1?.name,
  })

  // ② 当日（全員参加・固定フレーバー）
  events.push({
    id: `festival-day-${state.year}`,
    kind: 'flavor',
    title: '🎪 文化祭当日',
    body: '本番は大にぎわい。校門の前まで行列ができて、部員たちもそれぞれのクラスで祭りを楽しんだ。',
    effect: { atmo: 2 },
  })

  // ③ 恋愛イベント（従来確率のまま・彼女なしの選手から抽選）
  //    マネージャーと交際中の選手も除外（二股防止・2026-07-07修正）
  const r = rng.next()
  const loveCount = r < 0.20 ? 0 : r < 0.70 ? 1 : r < 0.95 ? 2 : 3
  const gfPool = active.filter((p) => !p.hasGirlfriend && p.id !== state.manager?.dating?.playerId)
  const gfShuffled = [...gfPool].sort(() => rng.next() - 0.5)
  const patches: ((roster: Player[]) => Player[])[] = []
  for (let i = 0; i < loveCount && i < gfShuffled.length; i++) {
    const p = gfShuffled[i]
    const partnerType = rng.pick(FESTIVAL_PARTNER_TYPES)
    const result = rng.next() < 0.7 ? 'success' : 'reject'        // 成功:失敗 = 7:3
    const line = buildLoveLine(p.name, partnerType, result)
    if (result === 'success') {
      patches.push((roster) => roster.map((q) => q.id === p.id
        ? { ...q, hasGirlfriend: true, abilities: { ...q.abilities, iq: Math.min(99, q.abilities.iq + 1) }, fatigue: Math.max(0, q.fatigue - 5) }
        : q))
      events.push({ id: `festival-love-${state.year}-${i}`, kind: 'flavor', title: '💘 恋の噂', body: `${line}\n（${p.name}のIQ +1・疲労 -5）` })
    } else {
      patches.push((roster) => roster.map((q) => q.id === p.id
        ? { ...q, condition: Math.max(1, q.condition - 1) as typeof q.condition }
        : q))
      events.push({ id: `festival-love-${state.year}-${i}`, kind: 'flavor', title: '💔 恋の噂', body: `${line}\n（${p.name}は落ち込み気味・調子 -1）` })
    }
  }

  return {
    events,
    rosterPatch: (roster) => patches.reduce((acc, f) => f(acc), roster),
    atmoDelta: 2, // 当日フレーバー分（effect表示と一致させる）
  }
}
