// ============================================================
// data/prefectures.ts — 47都道府県 + 抽象「サッカーどころ」強度
// 都道府県名は事実（著作権対象外・rights-ledger 2026-06-11）。
// 強度は競技人口等の公開傾向を参考にした自作の抽象値（実在校とは無関係）。
// ============================================================

export interface Prefecture {
  name: string
  region: string // 地方区分（校名生成のフレーバー）
  strength: number // 40〜78の抽象強度（有望新入生の出やすさ）
}

export const PREFECTURES: Prefecture[] = [
  { name: '北海道', region: '北海道', strength: 54 },
  { name: '青森県', region: '東北', strength: 75 }, // 現実反映: 全国屈指の強豪（青森山田）
  { name: '岩手県', region: '東北', strength: 50 },
  { name: '宮城県', region: '東北', strength: 58 },
  { name: '秋田県', region: '東北', strength: 48 },
  { name: '山形県', region: '東北', strength: 50 },
  { name: '福島県', region: '東北', strength: 58 },
  { name: '茨城県', region: '関東', strength: 62 },
  { name: '栃木県', region: '関東', strength: 60 },
  { name: '群馬県', region: '関東', strength: 70 }, // 現実反映: 前橋育英など強豪
  { name: '埼玉県', region: '関東', strength: 70 },
  { name: '千葉県', region: '関東', strength: 70 },
  { name: '東京都', region: '関東', strength: 74 },
  { name: '神奈川県', region: '関東', strength: 74 },
  { name: '新潟県', region: '中部', strength: 56 },
  { name: '富山県', region: '中部', strength: 50 },
  { name: '石川県', region: '中部', strength: 54 },
  { name: '福井県', region: '中部', strength: 50 },
  { name: '山梨県', region: '中部', strength: 62 }, // 現実反映: 山梨学院
  { name: '長野県', region: '中部', strength: 54 },
  { name: '岐阜県', region: '中部', strength: 56 },
  { name: '静岡県', region: '中部', strength: 76 },
  { name: '愛知県', region: '中部', strength: 70 },
  { name: '三重県', region: '近畿', strength: 54 },
  { name: '滋賀県', region: '近畿', strength: 56 },
  { name: '京都府', region: '近畿', strength: 62 },
  { name: '大阪府', region: '近畿', strength: 74 },
  { name: '兵庫県', region: '近畿', strength: 66 },
  { name: '奈良県', region: '近畿', strength: 52 },
  { name: '和歌山県', region: '近畿', strength: 48 },
  { name: '鳥取県', region: '中国', strength: 46 },
  { name: '島根県', region: '中国', strength: 50 },
  { name: '岡山県', region: '中国', strength: 56 },
  { name: '広島県', region: '中国', strength: 64 },
  { name: '山口県', region: '中国', strength: 52 },
  { name: '徳島県', region: '四国', strength: 50 },
  { name: '香川県', region: '四国', strength: 52 },
  { name: '愛媛県', region: '四国', strength: 54 },
  { name: '高知県', region: '四国', strength: 48 },
  { name: '福岡県', region: '九州', strength: 68 },
  { name: '佐賀県', region: '九州', strength: 56 },
  { name: '長崎県', region: '九州', strength: 64 }, // 現実反映: 国見・長崎総科大附
  { name: '熊本県', region: '九州', strength: 58 },
  { name: '大分県', region: '九州', strength: 54 },
  { name: '宮崎県', region: '九州', strength: 60 },
  { name: '鹿児島県', region: '九州', strength: 66 }, // 現実反映: 鹿児島実業・神村学園
  { name: '沖縄県', region: '九州', strength: 52 },
]

export function findPrefecture(name: string): Prefecture {
  return PREFECTURES.find((p) => p.name === name) ?? PREFECTURES[12] // 既定: 東京都
}
