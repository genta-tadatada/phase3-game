// ============================================================
// components/career/HowToPlay.tsx — 遊び方（前面オーバーレイ・アコーディオン式）
// 設計方針：
//  - 長い「（…）」補足は表組み・別行に分解して、目で追える長さに保つ
//  - 文字色は4色に統一して、視線が止まる場所を明確化
//      🟢緑(GOOD)＝有利・伸びる ／ 🔴赤(BAD)＝注意・リスク
//      🟠橙(KEY)＝項目の主役/最重要キーワード ／ 🔵青(INFO)＝補足知識
//  - 各セクション冒頭に1行リード「ひと言で言うと」を置く
// ============================================================

import { useState, type ReactNode } from 'react'
import { SKILLS, RARITY_COLOR, RARITY_LABEL, COMBO_GRADIENT } from '../../data/skills'
import { COMBOS } from '../../data/combos'
import { asset } from '../../ui/asset'

// ---- 色（共通パレット） ------------------------------------------------
const C = {
  GOOD: '#2f8a52',  // 有利・伸びる
  BAD: '#c0392b',   // 注意・難しい・リスク
  KEY: '#d96b1f',   // 最重要キーワード（橙）
  INFO: '#2f6fb0',  // 補足知識（青）
} as const

// 色付き太字（インライン）。<HL c="KEY">特殊能力</HL> のように使う
const HL = ({ c, children }: { c: keyof typeof C; children: ReactNode }) => (
  <b style={{ color: C[c] }}>{children}</b>
)

// セクション冒頭の「ひと言で言うと」リード
const Lead = ({ children }: { children: ReactNode }) => (
  <div style={{
    fontSize: 13, lineHeight: 1.7, padding: '8px 11px', borderRadius: 10,
    background: 'rgba(255,184,120,0.14)', border: '1px solid rgba(217,107,31,0.22)',
    color: 'var(--ink)', marginBottom: 10,
  }}>
    <span style={{ color: C.KEY, fontWeight: 900, marginRight: 4 }}>POINT</span>
    {children}
  </div>
)

// 年表の1行（月・タグ・出来事）
const YearRow = ({ when, tag, tagColor, text }: { when: string; tag: string; tagColor: string; text: ReactNode }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '60px 90px 1fr', gap: 8, alignItems: 'center',
    padding: '6px 0', borderBottom: '1px dashed rgba(74,64,54,0.12)',
    fontSize: 13, lineHeight: 1.6,
  }}>
    <div style={{ fontWeight: 800, color: 'var(--ink-dim)', fontSize: 12 }}>{when}</div>
    <div style={{
      fontSize: 10.5, fontWeight: 900, color: '#fff', background: tagColor,
      borderRadius: 6, textAlign: 'center', padding: '3px 4px',
    }}>{tag}</div>
    <div>{text}</div>
  </div>
)

// 「いつ起きる / 何が起きる / どう選ぶ」3列の小さなカード
const InfoBox = ({ title, color, children }: { title: string; color: string; children: ReactNode }) => (
  <div style={{
    border: `2px solid ${color}`, borderRadius: 10, padding: '8px 10px',
    background: '#fff', marginTop: 6,
  }}>
    <div style={{ fontWeight: 900, fontSize: 13, color, marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 13, lineHeight: 1.7 }}>{children}</div>
  </div>
)

// ---- 能力値 ------------------------------------------------------------
const ABILITIES: [string, string][] = [
  ['キック', 'シュート・パス・FK/CKの精度。決定力と展開力。'],
  ['パワー', '競り合いと空中戦の強さ（身長も効く）。'],
  ['スピード', '走る速さ。カウンター・裏抜け・守備の戻り。'],
  ['技術', 'ドリブルとボールさばき。中盤の前進と個人突破。'],
  ['スタミナ', '運動量。高いほど終盤までバテない。'],
  ['IQ', '判断力と戦術理解。授けた戦術が効くかを左右する。'],
  ['守備', '球際・対人・パスカット。'],
  ['GK：セービング', 'シュートを止める力（GK専用）。'],
  ['GK：GK-IQ', '飛び出し・角度・判断（GK専用）。'],
]

// ---- 性格 --------------------------------------------------------------
const PERSONA: [string, [string, string, 'good' | 'mid' | 'bad'][]][] = [
  ['社会性', [
    ['リーダー', 'チームをまとめ、雰囲気を保つ。周りにも良い影響を与える。', 'good'],
    ['ムードメーカー', '場を明るくし、空気を上げる。負けても引きずらない。', 'mid'],
    ['問題児', '規律を乱しがちで、周りの空気を下げる。扱いに注意。', 'bad']]],
  ['メンタル', [
    ['天才肌', '才能豊かで大舞台ほど輝く。ただし気分にムラが出ることも。', 'good'],
    ['内気', '物静かで出来にムラが少なく、安定して力を発揮できる。', 'mid'],
    ['ビビり', '大一番や全国で固くなり、本来の力を出しにくい。', 'bad']]],
  ['情熱', [
    ['闘志家', '負けている時ほど奮起する。劣勢の試合で頼りになる。', 'good'],
    ['熱血漢', '勢いがある一方で出来の波が大きい。ハマれば強い。', 'mid'],
    ['エゴイスト', '自分本位になりがちで空気を下げる。勝負強さもある。', 'bad']]],
  ['勤勉さ', [
    ['努力家', 'まじめによく伸び、怪我にも強い。長く戦力になる。', 'good'],
    ['マイペース', '周りに流されず動じない。良くも悪くも自分のペース。', 'mid'],
    ['怠け者', '練習にムラがあり伸び悩む。やる気を引き出す工夫が要る。', 'bad']]],
]
const P_COLOR = { good: C.GOOD, mid: '#7a6f63', bad: C.BAD }

// ---- 育成のコツ --------------------------------------------------------
const TIPS: ReactNode[] = [
  <>疲労がたまると<HL c="BAD">成長と試合の出来が落ちる</HL>。休養日・メニュー・週末で管理しよう。</>,
  <>チームの<HL c="KEY">雰囲気</HL>が高いと、選手は好調になりやすい。ミーティングや勝利で上がる。</>,
  <>相手との<HL c="KEY">戦術相性</HL>が勝敗を分ける。<HL c="INFO">リード時・ビハインド時</HL>の戦術も別に組める。</>,
  <>選手にはそれぞれ<HL c="INFO">得意ポジション（希望★）</HL>がある。能力＋★で配置を決めよう。</>,
  <><HL c="GOOD">才能（潜在）は無い</HL>。誰でも育成・覚醒・試合経験で能力99まで伸びる。ただし初期能力が高い子は最初からリードしている。</>,
  <><HL c="KEY">スカウト</HL>でアンダー世代代表級の選手を勧誘できる（2年目〜）＝大きなアドバンテージ。</>,
  <>当たり性格は稀。育成や経験で<HL c="GOOD">性格が良い方向へ変わる</HL>こともある。</>,
]

// ---- 共通：セクション小見出し ----------------------------------------
const label = (t: string): ReactNode => (
  <div style={{ fontSize: 12, fontWeight: 900, color: C.KEY, letterSpacing: '0.04em', marginBottom: 4 }}>{t}</div>
)

interface Section { id: string; icon: string; title: string; body: ReactNode }

// ---- セクション本体 ----------------------------------------------------
const SECTIONS: Section[] = [
  // ============================================================
  // 1) 基本の流れ
  // ============================================================
  {
    id: 'basic', icon: '🎯', title: '基本の流れ',
    body: (
      <div>
        <Lead>
          あなたは新設高校サッカー部の<HL c="KEY">監督</HL>。
          毎週「練習」で選手を育て、年2回の「大会」で全国を狙い、3年で送り出す——その繰り返し。
        </Lead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13.5, lineHeight: 1.7 }}>
          <div><HL c="KEY">① 練習</HL>　メニュー枠に選手を配置して育成（1人につき週1メニュー）。枠は<HL c="INFO">基本3＋コーチで最大5</HL>。</div>
          <div><HL c="KEY">② ポジション・戦術</HL>　基本／リード時／ビハインド時の3パターンを組める。スタメンも手動指定可。</div>
          <div><HL c="KEY">③ 大会</HL>　夏と冬の<HL c="INFO">年2回</HL>。県予選を勝てば全国へ。</div>
          <div><HL c="KEY">④ 経営</HL>　勝つと<HL c="GOOD">評判と賞金</HL>が増え、入部希望者・寄付・スポンサーが増えていく。</div>
          <div><HL c="KEY">⑤ スカウト</HL>　有望な新入生を勧誘（2年目〜）。設備投資で育成効率と部員枠を強化。</div>
          <div><HL c="KEY">⑥ 卒業</HL>　3年は冬大会後に引退。<HL c="GOOD">プロ入りすれば長期の寄付増収</HL>に直結する。</div>
        </div>
      </div>
    ),
  },

  // ============================================================
  // 2) 1年の流れ（全48週）
  // ============================================================
  {
    id: 'year', icon: '🗓', title: '1年の流れ（全48週）',
    body: (
      <div>
        <Lead>
          1年は<HL c="KEY">48週</HL>。4月始まりで翌3月終わり。大きな節目は
          <HL c="INFO"> 夏大会 → 夏合宿 → 文化祭 → 冬大会 → スカウト結果 → 卒業</HL> の順。
        </Lead>
        <div style={{ marginTop: 4 }}>
          <YearRow when="4月" tag="入部" tagColor={C.GOOD} text={<><HL c="GOOD">新入生が入部</HL>。新チームが始動する。</>} />
          <YearRow when="5–6月" tag="育成期" tagColor="#7a8b9c" text="春の練習期間。土台を作る大事な時期。" />
          <YearRow when="6月" tag="📚 考査" tagColor={C.INFO} text={<>定期考査。<HL c="INFO">「勉強優先」or「練習続行」</HL>を選ぶ。</>} />
          <YearRow when="6–7月" tag="🏆 夏大会" tagColor={C.KEY} text={<><HL c="KEY">夏季大会</HL>（県予選→勝てば全国）。3年生は本気の夏。</>} />
          <YearRow when="8月" tag="🏕 合宿" tagColor={C.KEY} text={<><HL c="KEY">7日間の夏合宿</HL>。<HL c="GOOD">特殊能力が芽生える</HL>最大の機会。</>} />
          <YearRow when="9–10月" tag="育成期" tagColor="#7a8b9c" text="秋の練習期間。冬大会に向けた調整。" />
          <YearRow when="10月" tag="🎪 文化祭" tagColor="#9b59b6" text={<><HL c="KEY">準備を手伝わせるかを選ぶ</HL>。<HL c="GOOD">雰囲気アップ</HL>、<HL c="KEY">恋の噂</HL>が流れる年も。</>} />
          <YearRow when="11月" tag="📚 考査" tagColor={C.INFO} text="2回目の定期考査。" />
          <YearRow when="11月" tag="🏆 冬大会" tagColor={C.KEY} text={<><HL c="KEY">冬季大会</HL> 県予選。<HL c="BAD">3年生はこの大会で引退</HL>。</>} />
          <YearRow when="12–1月" tag="🏆 全国" tagColor={C.KEY} text="冬季大会 全国。勝てば全国制覇。" />
          <YearRow when="1月" tag="📚 考査" tagColor={C.INFO} text="3回目の定期考査（3年は除外）。" />
          <YearRow when="2月" tag="🔍 スカウト" tagColor={C.INFO} text={<>勧誘した候補の<HL c="INFO">結果が確定</HL>。ライバル校に取られる事も。</>} />
          <YearRow when="3月" tag="🎓 卒業" tagColor={C.GOOD} text={<>3年生が卒業。<HL c="GOOD">稀にプロ入り</HL>＝以後ずっと寄付増収。</>} />
          <YearRow when="3月" tag="📚 考査" tagColor={C.INFO} text="最後の定期考査。" />
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>
          ホーム画面に <HL c="KEY">「次の節目まであと◯週」</HL> が出る。節目の前に編成・戦術を見直そう。
        </div>
      </div>
    ),
  },

  // ============================================================
  // 3) 試合・大会のルール
  // ============================================================
  {
    id: 'rules', icon: '⚽', title: '試合・大会のルール',
    body: (
      <div>
        <Lead>大会は<HL c="KEY">トーナメント</HL>。負けたら終わり。県予選を勝ち上がれば全国へ進める。</Lead>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.85 }}>
          <li>試合は前半・後半。大会で同点なら<HL c="INFO">延長 → PK戦</HL>で決着。</li>
          <li>公式戦の<HL c="KEY">招集メンバーは最大20人</HL>（先発11＋ベンチ9）。登録は最大30人。</li>
          <li><HL c="KEY">交代は1試合5人</HL>まで。<HL c="GOOD">ハーフタイムは戦術もフォーメーションも丸ごと変更可</HL>（ピッチ図から交代）。</li>
          <li><HL c="GOOD">強豪県は全国出場枠が2</HL>＝準優勝でも全国へ（激戦区の救済）。それ以外の県は優勝のみ。</li>
          <li><HL c="KEY">賞金・補助金は大会終了時にすぐ入る</HL>。資金の使い道（設備）をいつでも進められる。</li>
          <li>大会週も選手は試合の合間に軽く練習する。練習が完全に止まるわけではない。</li>
        </ul>
      </div>
    ),
  },

  // ============================================================
  // 4) 夏合宿
  // ============================================================
  {
    id: 'camp', icon: '🏕', title: '夏合宿（7日間）',
    body: (
      <div>
        <Lead>
          能力を詰め込む特訓ではなく、<HL c="KEY">7日間のドラマ</HL>。
          選手たちの<HL c="GOOD">特殊能力が目覚める</HL>最大の機会で、年ごとに何が起きるか全然違う。
        </Lead>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 10px', fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontWeight: 800, color: C.KEY }}>Day 1–5</div>
          <div>練習日。1日ごとに「ちがう物語」が起きる。スキル開花・能力UP・絆・性格の芽など。</div>
          <div style={{ fontWeight: 800, color: C.KEY }}>Day 6</div>
          <div>合宿の練習試合。手応えで雰囲気・調子が動く。山場でスキルが開花することも。</div>
          <div style={{ fontWeight: 800, color: C.KEY }}>Day 7</div>
          <div>帰宅。締めの物語と、最後のスキル開花のチャンス。</div>
        </div>
        <InfoBox title="🎲 スキル開花数は「運」で決まる" color={C.INFO}>
          1個（最低保証）〜<HL c="KEY">最大7個</HL>。2〜3個の年が最も多く、<HL c="GOOD">5個以上は5年に1回</HL>の豊作。
          設備や努力家・天才肌の選手が多いほど、確率が底上げされる。
        </InfoBox>
        <InfoBox title="🅱 B/Cチームの裏合宿" color={C.GOOD}>
          B/Cチームが解放されていれば、<HL c="GOOD">同時に裏でも合宿</HL>が走り、軽い成長＋覚醒が起きる。
          表のA合宿が終わると、まとめが「裏合宿レポート」として届く。
        </InfoBox>
      </div>
    ),
  },

  // ============================================================
  // 5) 学校生活（定期考査・文化祭）
  // ============================================================
  {
    id: 'school', icon: '🎓', title: '学校生活（考査・文化祭）',
    body: (
      <div>
        <Lead>サッカーだけじゃない。<HL c="KEY">学校行事</HL>も雰囲気と成長を左右する。</Lead>
        <InfoBox title="📚 定期考査（年4回）" color={C.INFO}>
          <div style={{ marginBottom: 6 }}><HL c="INFO">6月・11月・1月・3月</HL>に来る。テスト週に監督が方針を選ぶ：</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 45%', minWidth: 130, padding: '6px 9px', borderRadius: 8, background: 'rgba(47,138,82,0.10)', border: `1px solid ${C.GOOD}` }}>
              <b style={{ color: C.GOOD }}>📚 勉強優先</b><br />
              <span style={{ fontSize: 12.5 }}><HL c="GOOD">赤点リスク↓</HL>／その週の成長↓</span>
            </div>
            <div style={{ flex: '1 1 45%', minWidth: 130, padding: '6px 9px', borderRadius: 8, background: 'rgba(192,57,43,0.08)', border: `1px solid ${C.BAD}` }}>
              <b style={{ color: C.BAD }}>⚽ 練習続行</b><br />
              <span style={{ fontSize: 12.5 }}>成長維持／<HL c="BAD">赤点リスクあり</HL></span>
            </div>
          </div>
          <div style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
            性格でテスト適性が決まる：<HL c="GOOD">テストに強い</HL>＝天才肌・努力家／<HL c="BAD">赤点注意</HL>＝怠け者・問題児・闘志家。
          </div>
        </InfoBox>
        <InfoBox title="🎪 文化祭（10月）" color="#9b59b6">
          文化祭の週に、部員たちに<HL c="KEY">出店の準備を手伝わせるか・練習を優先させるか</HL>を選ぶ。
          手伝わせると<HL c="GOOD">チームの雰囲気アップ＋何人かの能力が伸びる</HL>が、疲労もたまる。練習優先なら<HL c="GOOD">疲労が回復</HL>する。
          当日は全員で祭りを楽しみ、クラスメイトや他校生との<HL c="KEY">恋の噂</HL>が流れる事も（年0〜3件）。
        </InfoBox>
      </div>
    ),
  },

  // ============================================================
  // 6) 能力値
  // ============================================================
  {
    id: 'ability', icon: '📊', title: '能力値',
    body: (
      <div>
        <Lead>9つの能力値。数値が高いほど得意。選手一覧では値ごとに色がつくので、強み弱みを一目で見られる。</Lead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {ABILITIES.map(([n, d]) => (
            <div key={n} style={{ fontSize: 13.5, lineHeight: 1.65 }}>
              <b style={{ color: C.KEY }}>{n}</b>：{d}
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ============================================================
  // 7) 性格
  // ============================================================
  {
    id: 'personality', icon: '😊', title: '性格',
    body: (
      <div>
        <Lead>
          性格は<HL c="KEY">伸び・士気・テスト適性</HL>に効く。
          <HL c="GOOD">緑＝良い傾向</HL>／<HL c="BAD">赤＝注意</HL>。詳細は選手画面で確認できる。
        </Lead>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PERSONA.flatMap(([, list]) => list).map(([n, d, k]) => (
            <div key={n} style={{ fontSize: 13.5, lineHeight: 1.65 }}>
              <b style={{ color: P_COLOR[k] }}>{n}</b>：{d}
            </div>
          ))}
        </div>
        <InfoBox title="🌬 チームの空気は組み合わせ" color={C.KEY}>
          <HL c="BAD">問題児が多い</HL>と空気が荒れる一方で相手を威圧。<HL c="GOOD">リーダー・ムードメーカー</HL>がいれば悪影響をやわらげる。
          <HL c="BAD">怠け者が多い</HL>と緩い空気に。編成画面の<HL c="KEY">「🌬チームの空気」メーター</HL>で全体の助言が読める。
        </InfoBox>
      </div>
    ),
  },

  // ============================================================
  // 8) 特殊能力
  // ============================================================
  {
    id: 'skill', icon: '⚡', title: '特殊能力',
    body: (
      <div>
        <Lead>
          選手が持つ<HL c="KEY">武器</HL>。普段の練習では身につかない。
          主に<HL c="GOOD">夏合宿</HL>で開花し、卒業継承・大会の山場・セレクションでも稀に掴む。<HL c="INFO">1人最大3つ</HL>。
        </Lead>
        <div style={{ display: 'flex', gap: 8, fontSize: 11.5, fontWeight: 700, marginBottom: 6, flexWrap: 'wrap' }}>
          {[1, 2, 3].map((r) => (
            <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: RARITY_COLOR[r], borderRadius: 5, padding: '1px 5px' }}>{RARITY_LABEL[r]}</span>
              {r === 1 ? 'コモン' : r === 2 ? 'レア' : '激レア'}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...SKILLS].sort((a, b) => a.rarity - b.rarity).map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: RARITY_COLOR[s.rarity], borderRadius: 5, padding: '1px 5px', minWidth: 24, textAlign: 'center' }}>{RARITY_LABEL[s.rarity]}</span>
              <b style={{ color: 'var(--ink)', minWidth: 96 }}>{s.name}</b>
              <span style={{ color: 'var(--ink-soft)', fontWeight: 600, fontSize: 12 }}>{s.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 9, background: COMBO_GRADIENT }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>🌈 {RARITY_LABEL[4]}（組み合わせ）</div>
          <div style={{ fontSize: 11.5, color: '#fff', opacity: 0.95, fontWeight: 600, marginTop: 2, lineHeight: 1.6 }}>
            特定の2つを1人が併せ持つと、自動で最上位「{RARITY_LABEL[4]}」に進化＝合算よりさらに強い。
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {COMBOS.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#c026d3', background: '#fff', border: '1.5px solid #c026d3', borderRadius: 5, padding: '0 5px', minWidth: 24, textAlign: 'center' }}>{RARITY_LABEL[4]}</span>
              <b style={{ color: 'var(--ink)', minWidth: 96 }}>{c.name}</b>
              <span style={{ color: 'var(--ink-soft)', fontWeight: 600, fontSize: 11 }}>{c.components.join('＋')}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ============================================================
  // 9) 経営
  // ============================================================
  {
    id: 'economy', icon: '💰', title: '経営（お金の流れ）',
    body: (
      <div>
        <Lead>
          <HL c="KEY">評判 → 寄付・スポンサー → 資金 → 設備強化 → 強くなる → 評判</HL>
          ——この好循環が経営の核。設備投資が最優先、上がりきったら専属スタッフへ。
        </Lead>

        <div style={{ marginTop: 4 }}>
          {label('💰 収入')}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}>
            <li><HL c="GOOD">学校予算配分</HL>：評判が上がるほど増える（毎年4月）。</li>
            <li><HL c="GOOD">部費</HL>：部員数に比例（毎年4月）。</li>
            <li><HL c="GOOD">後援会・OB寄付</HL>：評判＋<HL c="KEY">出身プロの数</HL>で増える長期収入。プロを輩出するほど毎年の寄付が厚くなる。</li>
            <li><HL c="GOOD">大会賞金</HL>：県突破・全国出場・優勝で<HL c="KEY">大会終了時にすぐ加算</HL>。</li>
            <li><HL c="KEY">スポンサー</HL>：大会初勝利か評判10で解放。メイン＋ユニフォームの<HL c="INFO">2枠</HL>に契約できる。期間は6ヶ月／1年／2年から選択。</li>
          </ul>
        </div>

        <div style={{ marginTop: 10 }}>
          {label('💸 支出')}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.75 }}>
            <li><HL c="BAD">設備維持費</HL>：設備Lvが上がるほど増える。</li>
            <li><HL c="BAD">部員運営費</HL>：用具・遠征・食費。部員が多いほど増える。</li>
            <li><HL c="BAD">スタッフ年俸</HL>：専属スタッフを雇うと毎年かかる。</li>
            <li><HL c="BAD">勧誘費</HL>：スカウト獲得の特待費・宿泊/寮費（有望株ほど高い）。</li>
          </ul>
          <div style={{ fontSize: 12, marginTop: 5, color: 'var(--ink-soft)' }}>
            支出が収入＋貯蓄を上回ると<HL c="BAD">財政難</HL>でチームの雰囲気が下がる。
          </div>
        </div>
      </div>
    ),
  },

  // ============================================================
  // 10) 設備・スタッフ・チーム枠
  // ============================================================
  {
    id: 'facilities', icon: '🏗', title: '設備・スタッフ・チーム枠',
    body: (
      <div>
        <Lead>
          設備とスタッフは<HL c="KEY">育成効率と部員上限</HL>を底上げする土台。
          チーム規模が大きくなると<HL c="GOOD">B/Cチーム</HL>が解放され、控えも実戦経験を積める。
        </Lead>

        {label('🏟 設備（最大Lv5）')}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px 10px', fontSize: 13, lineHeight: 1.75 }}>
          <b style={{ color: C.KEY }}>グラウンド</b><div>練習効率と練習試合の質。</div>
          <b style={{ color: C.KEY }}>部室</b><div>個別面談の人数（Lv1=1人／Lv2-3=2人／Lv4=3人）。</div>
          <b style={{ color: C.KEY }}>トレーニング</b><div>解放メニュー＋疲労回復。</div>
          <b style={{ color: C.KEY }}>寮</b><div>遠方の選手を受け入れ。<HL c="INFO">B/Cチーム解放条件</HL>。</div>
        </div>

        <InfoBox title="👥 練習枠＝コーチの数で決まる" color={C.INFO}>
          基本<HL c="KEY">3枠</HL>。専属コーチを雇うごとに+1（アシスタント含め<HL c="GOOD">最大5枠</HL>）。
          枠が多いほど一週で多くの選手を伸ばせる。
        </InfoBox>

        <InfoBox title="🅱 B/Cチーム（控えに実戦の場を）" color={C.GOOD}>
          <b>Bチーム解放</b>：部員<HL c="KEY">25人</HL>＋寮Lv2＋Bチームコーチ<br />
          <b>Cチーム解放</b>：部員<HL c="KEY">45人</HL>＋寮Lv4＋Cチームコーチ（＋Bも必要）<br />
          解放後はB/Cも裏で練習・夏合宿に参加し、控え選手が試合経験を積む。
        </InfoBox>

        <InfoBox title="👧 マネージャー（3年目あたり加入）" color="#d96b9f">
          受動効果で<HL c="GOOD">毎週の疲労回復＋3</HL>、雰囲気の<HL c="GOOD">底上げ+2</HL>。
          個性は「面倒見」「しっかり者」「ムードメーカー」「分析好き」の4種で、それぞれ専用ミニイベントが起きる。
        </InfoBox>

        <InfoBox title="🎖 OB指導（プロを輩出すると解放）" color={C.KEY}>
          卒業生がプロになると、その<HL c="KEY">tierに応じた特別指導</HL>が呼べる。
          プロを多く出した部ほど、また強くなれる——それが伝統校になっていく。
        </InfoBox>
      </div>
    ),
  },

  // ============================================================
  // 11) 育成のコツ
  // ============================================================
  {
    id: 'tips', icon: '💡', title: '調子・育成のコツ',
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Lead>
          <HL c="KEY">練習で武器を磨き、試合で穴を埋める</HL>——両方を回すのが育成の核心。
        </Lead>

        <div>
          {label('🌡 調子（コンディション）')}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <b style={{ color: '#e8554f' }}>↑↑ 絶好調</b> 〜 <b style={{ color: '#3f6fb0' }}>↓↓ 絶不調</b>。試合の出来に影響する。
            休養・個別面談・勝敗で変わる。
          </div>
        </div>

        <div>
          {label('🌱 初期能力と成長')}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <HL c="GOOD">才能（潜在）は無い</HL>。誰でも能力99まで伸ばせる。
            ただし<HL c="KEY">初期能力</HL>が高い選手は最初からリードしているので、スカウトで良い素材を集めるのが大きな差になる。
          </div>
        </div>

        <div>
          {label('🎯 育成の核心')}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            <HL c="BAD">苦手能力があると試合で力を出しきれない。</HL><br />
            ・<HL c="KEY">練習</HL>＝メニューで特定能力を集中的に伸ばし「武器」を尖らせる。<br />
            ・<HL c="KEY">試合</HL>＝出場選手の能力が全体的に底上げされ、<HL c="GOOD">低い能力ほど伸びて穴が埋まる</HL>。
          </div>
        </div>

        <div>
          {label('🌦 練習と天候')}
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            天候で<HL c="KEY">伸びる能力が変化</HL>する：
            <span style={{ color: C.INFO }}> 雨＝技術・判断</span> ／
            <span style={{ color: C.BAD }}> 猛暑＝スタミナ</span> ／
            <span style={{ color: C.INFO }}> 雪・寒波＝パワー</span>。<br />
            <HL c="GOOD">体育館</HL>があれば悪天候でも効率が保たれる。
            また<HL c="INFO">所在地で慣れた天候</HL>がある（沖縄＝暑さ／北海道＝寒さ）＝慣れた天候の日は強い。
          </div>
        </div>

        <div>
          {label('💡 おさえておくコツ')}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
            {TIPS.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      </div>
    ),
  },
]

// ---- 本体 --------------------------------------------------------------
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string>('basic')
  const [headerOk, setHeaderOk] = useState(true)
  return (
    <div className="event-overlay" onClick={onClose}>
      <div className="event-card pop-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(94vw, 720px)', maxHeight: '90%', overflowY: 'auto', alignItems: 'stretch' }}>
        {headerOk && (
          <img src={asset('howtoplay-header.webp')} alt="" onError={() => setHeaderOk(false)}
            style={{ width: '100%', display: 'block', borderRadius: 12, marginTop: -8, marginBottom: -4 }} />
        )}
        <div className="event-title" style={{ textAlign: 'center' }}>⚽ 遊び方</div>
        <div className="dim" style={{ fontSize: 11.5, textAlign: 'center', marginBottom: 8 }}>項目をタップで開閉</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map((s) => {
            const isOpen = open === s.id
            return (
              <div key={s.id} style={{ border: '1px solid var(--card-edge)', borderRadius: 11, overflow: 'hidden', background: isOpen ? '#fffdf8' : '#fff' }}>
                <button onClick={() => setOpen(isOpen ? '' : s.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', cursor: 'pointer',
                  background: isOpen ? 'rgba(255,150,90,0.12)' : 'transparent', border: 'none', textAlign: 'left',
                  fontSize: 14.5, fontWeight: 800, color: 'var(--ink)',
                }}>
                  <span style={{ fontSize: 17 }}>{s.icon}</span>
                  <span style={{ flex: 1 }}>{s.title}</span>
                  <span style={{ color: 'var(--ink-dim)', fontSize: 13, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                </button>
                {isOpen && <div style={{ padding: '4px 14px 14px', fontSize: 14, lineHeight: 1.8, color: 'var(--ink)' }}>{s.body}</div>}
              </div>
            )
          })}
        </div>

        <button className="btn sm" style={{ marginTop: 12 }} onClick={onClose}>とじる</button>
        <div className="dim" style={{ fontSize: 9.5, marginTop: 8, opacity: 0.7, textAlign: 'center' }}>地図データ: svg-maps (Victor Cazanave, CC BY 4.0)</div>
      </div>
    </div>
  )
}
