import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import {
  CheckCircle2, Circle, Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  History, Users, FileText, CheckSquare, Sparkles, Search,
  Download, Printer, RotateCcw, FolderPlus, X, Check
} from 'lucide-react';

// --- Firebase Configuration (BandSyncと共通プロジェクト) ---
const firebaseConfig = {
  apiKey: "AIzaSyCJewcEeVpF83wLDuYnFljlH2b9RxVf9iI",
  authDomain: "wpb2025-d1432.firebaseapp.com",
  projectId: "wpb2025-d1432",
  storageBucket: "wpb2025-d1432.firebasestorage.app",
  messagingSenderId: "834123232552",
  appId: "1:834123232552:web:4acd559725a5892aa6cc1d"
};

let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase初期化エラー:", e);
}

const SYNC_COLLECTION = "kanbu_sync";
const SYNC_DOC_ID = "board_2026_11_v2";
const LOCAL_STORAGE_KEY = "wpb_kanbu_sync_backup_v2";
const USER_NAME_KEY = "wpb_kanbu_sync_username_v2";
const NEW_CAT_VALUE = "__CREATE_NEW_CATEGORY__";

// 2回生（同期・幹部代 20名）公式名簿
const MEMBERS_2KAISE = [
  "小川 美晴", "渡会 啓人", "安部 建人", "小島 大幹", "杉原 和貴",
  "溝上 萌乃佳", "森 柊実", "亀谷 博昭", "小林 秀星", "清水 康貴",
  "大橋 菜純", "朱 函悦", "滑川 優斗", "春日 京介", "弘田 隼大",
  "松尾 知律", "浦山 大樹", "平野 春音", "武捨 裕吏", "大場 怜"
];

// 1回生（後輩 21名）公式名簿
const MEMBERS_1KAISE = [
  "讃岐 衣純", "高橋 由都", "東そらユーゴ", "石坂 旭", "衣斐 真仁",
  "柴 敏皓", "豊川 陽", "成田 涼真", "若林 周", "東川 颯希",
  "二木 樺", "伊藤 大賀", "松村 恭佑", "YANG KERAN", "渡邉 晴人",
  "本山 莉彩", "岡井 涼太", "岡本 茉麻", "工藤 暢々花", "田中 杏奈", "前澤 恵恋"
];

// 旧表記・あだ名から公式氏名への自動置換ルール
const NAME_REPLACEMENTS = [
  ["渡会 侑希", "渡会 啓人"],
  ["渡会侑希", "渡会 啓人"],
  ["渡会（わたらい）", "渡会 啓人"],
  ["朝井 啓人（ちりつ）", "松尾 知律"],
  ["朝井啓人（ちりつ）", "松尾 知律"],
  ["朝井 啓人", "松尾 知律"],
  ["朝井啓人", "松尾 知律"],
  ["ちりつ", "松尾 知律"],
  ["こじだい（小時代）", "小島 大幹"],
  ["小時代", "小島 大幹"],
  ["こじだい", "小島 大幹"],
  ["大樹（たいき・機材統括）", "浦山 大樹（機材統括）"],
  ["大樹（機材統括）", "浦山 大樹（機材統括）"],
  ["大樹（たいき）", "浦山 大樹"],
  ["たいき", "浦山 大樹"],
  ["ほのか（庶務）", "溝上 萌乃佳（庶務）"],
  ["ほのか", "溝上 萌乃佳"],
  ["れん（照明設営）", "大場 怜（照明設営）"],
  ["蓮（照明設営）", "大場 怜（照明設営）"],
  ["照明（れん）", "大場 怜（照明）"],
  ["照明（蓮）", "大場 怜（照明）"],
  ["蓮（れん）", "大場 怜"],
  ["れん・みはる", "大場 怜・小川 美晴"],
  ["三春（みはる）", "小川 美晴"],
  ["三春", "小川 美晴"],
  ["みはる", "小川 美晴"],
  ["しゅうま・わたらい", "森 柊実・渡会 啓人"],
  ["しゅうま", "森 柊実"],
  ["舞台（亀谷）", "亀谷 博昭（舞台）"],
  ["亀谷（舞台）", "亀谷 博昭（舞台）"],
  ["小林 秀星・亀谷", "小林 秀星・亀谷 博昭"],
  ["小林秀星・亀谷", "小林 秀星・亀谷 博昭"],
  ["亀谷は冗談", "亀谷 博昭は冗談"],
  ["滑川優斗（なめこ）", "滑川 優斗"],
  ["滑川（なめこ）", "滑川 優斗"],
  ["かんえつ", "朱 函悦"],
  ["靖隆（やす）", "清水 康貴"],
  ["靖隆", "清水 康貴"],
  ["菜純（なすみ）", "大橋 菜純"],
  ["ゆうり", "武捨 裕吏"],
  ["さつき・りさ", "東川 颯希・本山 莉彩"],
  ["さつきちゃん", "東川 颯希"],
  ["いずみちゃん", "讃岐 衣純"],
  ["優斗とりさ", "高橋 由都と本山 莉彩"],
  ["兼任者ゆうご", "兼任者の東そらユーゴ"],
  ["兼任のゆうご", "兼任の東そらユーゴ"],
  ["小林 秀星（しゅうせい）", "小林 秀星"],
  ["小林秀星（こばしゅう）", "小林 秀星"],
  ["杉原 和貴（かずき）", "杉原 和貴"],
  ["弘田隼大（ひろはや）", "弘田 隼大"]
];

function normalizeText(str) {
  if (!str || typeof str !== "string") return str;
  let out = str;
  for (const [oldStr, newStr] of NAME_REPLACEMENTS) {
    out = out.split(oldStr).join(newStr);
  }
  if (out === "渡会" || out === "わたらい") out = "渡会 啓人";
  if (out === "亀谷" || out === "かめがい") out = "亀谷 博昭";
  if (out === "大樹") out = "浦山 大樹";
  if (out === "蓮" || out === "れん") out = "大場 怜";
  return out;
}

function normalizeStateNames(stateObj) {
  if (!stateObj) return stateObj;
  const tasks = Array.isArray(stateObj.tasks)
    ? stateObj.tasks.map((t) => ({
        ...t,
        who: normalizeText(t.who),
        when: normalizeText(t.when),
        what: normalizeText(t.what),
        updatedBy: normalizeText(t.updatedBy)
      }))
    : [];
  const decisions = Array.isArray(stateObj.decisions)
    ? stateObj.decisions.map((cat) => ({
        ...cat,
        category: normalizeText(cat.category),
        items: Array.isArray(cat.items)
          ? cat.items.map((it) => ({
              ...it,
              title: normalizeText(it.title),
              content: normalizeText(it.content),
              updatedBy: normalizeText(it.updatedBy)
            }))
          : []
      }))
    : [];
  return { ...stateObj, tasks, decisions };
}

const INITIAL_STATE = {
  tasks: [
    { id: "todo-1", who: "小林 秀星", when: "11/11会議後すぐ", what: "12月定例ライブでサポート出演（1曲免除対象）する人を把握するためのフォームを作成して流す。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-2", who: "動画編集に協力できる人（程よく仕事がない人）", when: "11/11会議後すぐ", what: "学祭・講習会・新歓動画の編集（朱 函悦の補助・あと2〜3名）について、小林 秀星へ個別LINEで連絡する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-3", who: "幹部代全員", when: "リンク共有後すぐ（次回会議まで）", what: "安部 建人から送られるリンクの手順に従い、Zoomアカウント申請（1時間制限解除のため）を行う。また会議時のマイク環境を改善する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-4", who: "現幹部（共有：安部 建人）", when: "早急に", what: "合宿先の「ゆうげん荘」へ未返却の消毒液を送り返す。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-5", who: "渡会 啓人", when: "次回（来週）の会議までに確認・順次修理", what: "2スタの壊れているマーシャルキャビネット1台目の部品（約1,000〜4,000円）を購入し修理を試みる。もう1台について先輩（こたさん）に見てもらう。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-6", who: "各パートリーダー（パトリ）", when: "順次（次回会議に向けて）", what: "各パートのグループLINE等に「壊れている箇所・不安な機材・欲しい機材」のアンケートフォームを作成して流す（ドラムはハイハットの注意喚起も実施）。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-7", who: "幹部代全員（＋杉原 和貴）", when: "来週（次回）の幹部代会議", what: "【次回会議で議論・決定すべき持ち越し事項】\n① 2月ライブの残課題：個人のバンド数上限、過去の企画落選バンドの優先、さつまりさんのバンド受け入れ（杉原 和貴が出席する回に実施）\n② ローディーの改善策：部ごとに固定するか、撤収ローディーによる次演者への声掛け、ステージ袖待機などのルール化\n③ タイムキーパーの割り振り：学祭等のタイムキーパーを1回生に振るか\n④ 台車の確保方法：文連部室のを使うか、借りるか、新規購入するか（および古い部室台車をブルーシート用等にするか）\n⑤ 各セクションの人員再配置：東川 颯希・本山 莉彩の抜けた穴埋め、舞台・格納庫・PA設営の人数不足解消（PA卓からの移動や兼任者の東そらユーゴの稼働徹底など）（11/11幹部代）\n⑥ 学祭反省＋α", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-8", who: "杉原 和貴", when: "11月中（180日前早割期限）", what: "5月（BlackHole）・6月（Flight）ライブの会場予約手配を進めるとともに、ライブハウス側でレンタル時間短縮（延長プラン組み合わせ等による費用圧縮）が可能か詳細条件を確認する。（10/14幹文連）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-9", who: "溝上 萌乃佳", when: "12月定例の1週間前まで", what: "12月定例ライブ当日のチケット代（ドリチケ）回収（受付）シフトを作成する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-10", who: "PA・照明・カメラ・機材購入担当", when: "順次（12月定例・次回イベントに向けて）", what: "大蛇用の箱、コード類整理用の箱、カメラケース、ベース返し（EV）、共用ピックホルダー3個、予備キャノン（長さ別5本ずつ）、六角レンチの選定・購入、および上手の横当ての修理手配を進める。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-11", who: "浦山 大樹", when: "次回ライブ・設営まで", what: "① PAシートのフォーマット修正（DI・同期の位置欄を追加）。\n② 先輩（けいたさん）と相談した電流不足対策（パワーディストリビューターからの電源確保）を整理・管轄する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-12", who: "大場 怜（照明設営）", when: "次回設営まで", what: "① 暗幕固定用の透明な安全ピンを購入する。\n② 強く光る照明ライトを特定して端に配置し、各ライトに番号・印をつけて管理する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-13", who: "安部 建人（部長）・亀谷 博昭（舞台）・大場 怜（照明）", when: "次回設営まで", what: "設営時のグリーンシートを敷く位置を安部 建人が管理・指揮し、舞台・照明間でステージの中心位置を統一したマニュアルを作成する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-14", who: "安部 建人・杉原 和貴", when: "順次（おいおい作成・連絡）", what: "バラバラになっている3台目のマーシャルの修理について先輩（けいたさん）に連絡を取る。またボーカルエフェクターの使用スケジュール表を作成する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-15", who: "幹文連・渉外", when: "順次", what: "3月第1週土日（3/6・3/7、府中Flight）の3月ライブについて、卒コン出演バンドの扱いや余った時間の活用方法（企画・時間延長）を検討する。（10/5幹文連）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-16", who: "幹部代全員（ALL）", when: "順次", what: "合宿の大まかな運営方針について各自考え、議論を進める。また出演キャンセル返金の細かい足切りラインを2月ライブ時等に再議論する。（10/5幹文連・11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-17", who: "幹部代メンバー", when: "春学期前（4月頃）", what: "5月・6月ライブの出演希望アンケート（事前調査）の形式を検討し、5月の応募バンド不足時における企画バンド募集に備える。（10/14幹文連）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-18", who: "幹部代全員（特にセクションリーダー）", when: "今後の全イベント・作業時（常時）", what: "設営・撤収等の現場に遅刻せず参加し、幹部代としての仕事を徹底する。（11/11幹部代）", completed: false, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-1", who: "全体（幹部代）", when: "11/6（枠決め）前まで【完了】", what: "枠決め・練習枠数の周知：名簿の案内と一緒に「今回は上限6枠です」という内容をLINE等で周知する。（10/14幹部代）", completed: true, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-2", who: "小林 秀星・亀谷 博昭（全体）", when: "11/6（金）19:00〜【完了】", what: "定例ライブ＆講習会の枠決め実施：11月6日19:00スタートで定例ライブの枠決めを先に行い、終わり次第、講習会の枠決めを実施する。（10/5・10/14議事録）", completed: true, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-3", who: "安部 建人・小林 秀星 ほか", when: "10/14次回会議〜学祭期間まで【完了】", what: "新歓・SNS用「5秒動画素材」の撮影指示依頼と学祭撮影：現幹部（こたさん等）に相談して各セクションへ撮影指示を出してもらい、学祭での短尺動画素材を撮影する。（10/14幹文連→11/11時点で学祭動画の編集が進行中）", completed: true, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-4", who: "平野 春音（配達先：安部 建人宅）", when: "学祭前まで【完了】", what: "生花（幹文連向け）の準備・保管：部費（予算3万円前後、割り勘なし）で幹文連向けの花を手配し、安部 建人の家へ配達・保管する（余ったら機材統括へ）。（10/5・10/14幹文連）", completed: true, updatedBy: "初期データ", updatedAt: "11/01" },
    { id: "done-5", who: "幹文連・全員（ALL）", when: "10/14会議まで【完了】", what: "5・6月ライブの会場（箱）検討と決定：10/5会議のToDoを受け、10/14幹文連会議にて「5月：BlackHole（1日間）」「6月：Flight（2日間）」に正式決定済み。（10/5・10/14幹文連）", completed: true, updatedBy: "初期データ", updatedAt: "10/14" },
    { id: "done-6", who: "次期幹文連メンバー・幹部代全員", when: "12月まで（11/11会議で実施済み）【完了】", what: "出演キャンセル時の対応・返金規定の全体投票：10/5・10/14会議のToDoを受け、11/11第1回幹部代会議で全体投票を実施。「15位以下の代替バンド繰り上げ」「一旦全額徴収（返金有無は事後会議で判断）」に正式決定済み。（10/5・10/14・11/11議事録）", completed: true, updatedBy: "初期データ", updatedAt: "11/11" }
  ],
  decisions: [
    {
      id: "cat-1",
      category: "■ 役職補佐・会議の役割分担と基本ルール",
      items: [
        { id: "dec-101", title: "幹部補佐の決定（10/5幹文連）", content: "総務補佐＝「小島 大幹」、渉外補佐＝「大場 怜・小川 美晴」、会計補佐＝「森 柊実・渡会 啓人」（森 柊実の差し入れ等の懸念も確認し問題なしと判断）。" },
        { id: "dec-102", title: "会議・枠決めの役割分担（10/14幹部代）", content: "枠決め司会＝「小林 秀星・亀谷 博昭」の2名体制、黒板（板書）係＝「滑川 優斗」、議事録係＝「小林 秀星・渡会 啓人」の2名体制、タイムキーパー＝会議進行役の「安部 建人」が兼任。" },
        { id: "dec-103", title: "会議の進行方法（10/14幹文連）", content: "全員が揃った上で、アジェンダの上から順番通りに議論を進める。" },
        { id: "dec-104", title: "欠席・遅刻の原則禁止と連絡先（11/11幹部代）", content: "人数が少なく投票の信憑性を保つため、また説明を二度行う負担を減らすため欠席・遅刻は原則禁止。やむを得ず休む場合は「弘田 隼大」へ連絡する。" },
        { id: "dec-105", title: "会議中のタバコ休憩禁止（11/11幹部代）", content: "会議中のタバコ休憩は全面禁止（事前に済ませてくること）。" },
        { id: "dec-106", title: "決定事項の不遡及と発言の徹底（11/11幹部代）", content: "一度決まったことは後から覆らないため、意見が固まっていなくても不満や疑問はその場で必ず「ちょっと待って」と発言する。" },
        { id: "dec-107", title: "投票ルール・ダブルスコア制（11/11幹部代）", content: "2択の投票で多数派が少数派の2倍以上（ダブルスコア）になった場合は協議なしで即決定。つかなければ1度だけ再協議を行い、2回目の投票で即決定（これも覆らない）。議論が停滞した際は一旦アンケートをとって整理する。" },
        { id: "dec-108", title: "幹部代フォルダの共有制限（11/11幹部代）", content: "法政大学アカウント全員に編集権限がついているため、リンクは他学年には絶対に共有せず幹部代のみに厳守する。" }
      ]
    },
    {
      id: "cat-2",
      category: "■ バンド練習枠・枠決め・ベース講習の優先練習枠",
      items: [
        { id: "dec-201", title: "枠決めの開始日時と順序（10/5・10/14議事録）", content: "11月6日（金）19:00スタート。昨年同様「定例ライブの枠決め」を先に行い、終わり次第「講習会の枠決め」を実施する。" },
        { id: "dec-202", title: "練習枠の上限数（10/14幹部代）", content: "バンド数が昨年（9バンド）から12バンドへ増加したことを踏まえ、Zoom投票（8対6）の結果、上限は「6枠」に決定。" },
        { id: "dec-203", title: "ベース講習の優先練習枠（11/11幹部代）", content: "課題曲のバンド合わせのため、12月定例後より取得可能な「ベース講習生も含めた優先練習枠（1枠：1週間後以降でも先に枠を取ってよい権利）」を与えることに決定（1回目12対6、2回目全会一致）。" }
      ]
    },
    {
      id: "cat-3",
      category: "■ 定例投票・12月定例ライブの運営ルール",
      items: [
        { id: "dec-301", title: "定例投票の同数時ルール（10/21幹文連）", content: "定例投票において1位や14位などの得票数が同数だった場合、投票権を持つ幹部代による「決選投票（自票なし）」を行う。合宿3日目の夜に開票作業を行うため、決選投票は「3日目の夜〜撤収日の昼」の間に実施して決定する。" },
        { id: "dec-302", title: "12月定例・サポート出演料免除（11/11幹部代）", content: "例年通り「1曲のみ出演のサポートメンバーは出演費免除」とする（小林 秀星が把握用フォームを作成）。" },
        { id: "dec-303", title: "12月定例・出演キャンセル時の対応（11/11幹部代）", content: "タイムテーブルを巻いて進行するのではなく、「15位以下の代わりのバンドを繰り上げて出す」ことに決定（1回目11対6 → 再協議後の2回目投票で14票のダブルスコアで決定）。" },
        { id: "dec-304", title: "出演キャンセル時の返金・料金規定（10/5・10/14・11/11議事録）", content: "10/14会議で「全体会議の投票で決める」と決定し、11/11幹部代会議で投票を行った結果、回収額決定後のキャンセル料は「一旦全額を徴収し、返金（キャッシュバック）するかは事後の会議で状況を見て判断する」方針に決定（細かい足切り基準は2月ライブ時等に再議論）。" },
        { id: "dec-305", title: "12月定例・チケット代（ドリチケ）回収シフト（11/11幹部代）", content: "当日の受付シフトは庶務の「溝上 萌乃佳」（および浦山 大樹・幹文連）が12月定例の1週間前までに作成する。" }
      ]
    },
    {
      id: "cat-4",
      category: "■ 2月・3月・春学期（5月・6月）ライブの会場・日程と運営方針",
      items: [
        { id: "dec-401", title: "2月ライブの日程・会場・4回生確定枠（11/11幹部代）", content: "日程は2月2日（火）〜4日（木）の3日間、9:00演者入り／21:00完全撤収、会場は「府中Flight」。4回生（今年24人）の確定枠は「あり（例年通り1人1枠まで、同バンド内に複数の4回生がいる場合は全員がその枠を消費する）」に決定。" },
        { id: "dec-402", title: "3月ライブの会場・日程（10/5幹文連）", content: "会場は「府中Flight」、日程は「3月第1週目の土日2日間（3月6日・7日）」に決定。昨年より出演増が予想されるため、卒コン出演バンドを抜くか、余った時間を企画や時間延長に充てるかを引き続き検討する。" },
        { id: "dec-403", title: "5月・6月ライブの会場（10/5・10/14幹文連）", content: "180日前早割（10%オフ）適用時の料金差がほぼないこと（BlackHole：1日25万円、Flight：12時間パック＋機材等から早割で約23万円）や双方の利点を踏まえ、「5月：BlackHole（1日間）」「6月：Flight（2日間）」に決定。" },
        { id: "dec-404", title: "5月・6月ライブの赤字対策（10/14幹文連）", content: "6月は通常どおり12時間パックで実施。5月は4月に事前アンケートを実施し、応募バンドが少なければ「5月企画バンド」を導入しつつ、レンタル時間短縮（8時間プラン＋延長等による費用圧縮）も含めて事前の赤字予防策を講じる。" }
      ]
    },
    {
      id: "cat-5",
      category: "■ 機材・備品の購入と修理・管理ルール（11/11幹部代）",
      items: [
        { id: "dec-501", title: "購入決定品（予算残高：計約230万〜240万円規模で余裕あり）", content: "①大蛇用収納箱、②照明・PAコード類区別用の箱、③カメラ隊のカメラケース、④ベース返し（EV）、⑤2スタ・マーシャル1台目の修理部品（渡会 啓人が修理）、⑥共用ピックホルダー（3個）、⑦予備キャノンケーブル（長さ別5本ずつ程度）、⑧ドラム台用六角レンチセット、⑨照明設営用の透明な安全ピン。" },
        { id: "dec-502", title: "修理・確認決定", content: "上手の横当ては修理へ。2スタ・マーシャル2台目は先輩（こたさん）に確認後修理へ。バラバラの3台目マーシャルは先輩（けいたさん）に連絡して確認。" },
        { id: "dec-503", title: "様子見・保留決定", content: "マークベースは12月定例まで様子見。ハイハット割れは現状維持（ドラムグルで注意喚起）。同期用オーディオインターフェース共有購入案は一旦保留（高額機材申請時に再検討）。" },
        { id: "dec-504", title: "管理ルールの新設", content: "OB企画等での使用希望を受け「ボーカルエフェクターの使用スケジュール表」を作成する。各パトリはパート内で必要機材の要望アンケートフォームを実施する。" }
      ]
    },
    {
      id: "cat-6",
      category: "■ 学祭・生花手配・新歓SNS広報・学祭反省を受けた改善策",
      items: [
        { id: "dec-601", title: "生花（なまばな）の手配と保管（10/5・10/14幹文連）", content: "割り勘なし・すべて部費（予算3万円前後）で幹文連向けに手配（余ったら機材統括へ）。配達・保管場所は「安部 建人の家」。" },
        { id: "dec-602", title: "新歓・SNS広報用の動画撮影と編集体制（10/14・11/11議事録）", content: "学祭の全エリアやパート別講習会の様子を「5秒程度（一瞬）の短い動画素材」として撮影・蓄積。編集は小林 秀星・朱 函悦に加え、程よく仕事がない人からあと2〜3名を追加募集する（亀谷 博昭は冗談のため不採用）。" },
        { id: "dec-603", title: "学祭の反省を受けた改善策（11/11幹部代）", content: "①グリーンシートを敷く位置は部長の「安部 建人」が管理・指揮、②舞台・照明間でステージ中心位置を統一しマニュアル化、③異常に強く光る照明個体を特定して端に配置・番号管理（照明設営：大場 怜管轄）、④電流不足対策としてパワーディストリビューター等から電源確保（機材統括：浦山 大樹管轄）、⑤ステージ上のケーブル整理徹底（PA設営管轄）、⑥浦山 大樹がPAシートを修正（DI・同期位置欄を追加）しシート通りの動きと「不要なコーラスマイク禁止」を徹底、⑦電ドラ受け渡し時の確認徹底、⑧幹部代（特にセクションリーダー）の現場遅刻厳禁。" }
      ]
    }
  ],
  logs: [
    { id: "log-init", user: "システム", action: "2回生（20名）・1回生（21名）の公式名簿に基づき、サイト内のすべての氏名を正式名称に修正しました", time: "2026/11/13" }
  ]
};

const formatNow = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
};

export default function App() {
  const [boardState, setBoardState] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return normalizeStateNames(JSON.parse(saved));
    } catch (e) {}
    return INITIAL_STATE;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    return normalizeText(localStorage.getItem(USER_NAME_KEY)) || "小林 秀星";
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [customUserName, setCustomUserName] = useState("");
  const [syncStatus, setSyncStatus] = useState("connecting");
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWho, setFilterWho] = useState("ALL");

  const [newTaskWho, setNewTaskWho] = useState("");
  const [newTaskWhen, setNewTaskWhen] = useState("");
  const [newTaskWhat, setNewTaskWhat] = useState("");

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({ who: "", when: "", what: "" });

  const [selectedCatId, setSelectedCatId] = useState("cat-1");
  const [showCustomCatBox, setShowCustomCatBox] = useState(false);
  const [newCustomCatName, setNewCustomCatName] = useState("");
  const [newDecTitle, setNewDecTitle] = useState("");
  const [newDecContent, setNewDecContent] = useState("");

  const [editingDecId, setEditingDecId] = useState(null);
  const [editDecForm, setEditDecForm] = useState({ title: "", content: "" });

  useEffect(() => {
    if (!db) {
      setSyncStatus("local");
      return;
    }
    const docRef = doc(db, SYNC_COLLECTION, SYNC_DOC_ID);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const rawData = snap.data();
          if (rawData && Array.isArray(rawData.tasks) && Array.isArray(rawData.decisions)) {
            const normalized = normalizeStateNames(rawData);
            setBoardState({
              tasks: normalized.tasks,
              decisions: normalized.decisions,
              logs: Array.isArray(rawData.logs) ? rawData.logs : []
            });
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
          }
        } else {
          setDoc(docRef, INITIAL_STATE).catch(() => {});
        }
        setSyncStatus("synced");
      },
      (err) => {
        console.warn("Firestore同期エラー（ローカル保存で動作中）:", err);
        setSyncStatus("local");
      }
    );
    return () => unsub();
  }, []);

  const commitState = async (nextState, logMessage) => {
    const normalized = normalizeStateNames(nextState);
    const newLog = {
      id: "log-" + Date.now(),
      user: currentUser,
      action: logMessage,
      time: formatNow()
    };
    const updated = {
      ...normalized,
      logs: [newLog, ...(normalized.logs || [])].slice(0, 60)
    };
    setBoardState(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    if (db) {
      try {
        setSyncStatus("saving");
        await setDoc(doc(db, SYNC_COLLECTION, SYNC_DOC_ID), updated);
        setSyncStatus("synced");
      } catch (e) {
        console.warn("Firestore保存エラー:", e);
        setSyncStatus("local");
      }
    }
  };

  const handleToggleTask = (taskId) => {
    const target = boardState.tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextCompleted = !target.completed;
    const nextTasks = boardState.tasks.map((t) =>
      t.id === taskId
        ? { ...t, completed: nextCompleted, updatedBy: currentUser, updatedAt: formatNow() }
        : t
    );
    const shortWhat = target.what.length > 22 ? target.what.slice(0, 22) + "…" : target.what;
    commitState(
      { ...boardState, tasks: nextTasks },
      nextCompleted
        ? `タスク「${shortWhat}」（担当: ${target.who}）を【完了済み】に移動しました`
        : `タスク「${shortWhat}」（担当: ${target.who}）を【やるべきこと（未完了）】に戻しました`
    );
  };

  const handleAddTask = (isCompleted = false) => {
    const what = newTaskWhat.trim();
    if (!what) {
      alert("「何をやるか（具体的な内容）」を入力してください。");
      return;
    }
    const who = newTaskWho.trim() || "未定（全体）";
    const when = newTaskWhen.trim() || "順次";
    const newTask = {
      id: "task-" + Date.now(),
      who,
      when,
      what,
      completed: isCompleted,
      updatedBy: currentUser,
      updatedAt: formatNow()
    };
    setNewTaskWho("");
    setNewTaskWhen("");
    setNewTaskWhat("");
    const shortWhat = what.length > 22 ? what.slice(0, 22) + "…" : what;
    commitState(
      { ...boardState, tasks: [newTask, ...boardState.tasks] },
      `${isCompleted ? "完了済みリスト" : "やるべきことリスト"}に「${shortWhat}」（担当: ${who}）を追加しました`
    );
  };

  const startEditTask = (t) => {
    setEditingTaskId(t.id);
    setEditTaskForm({ who: t.who, when: t.when, what: t.what });
  };

  const saveEditTask = (id) => {
    if (!editTaskForm.what.trim()) {
      alert("タスク内容を入力してください。");
      return;
    }
    const nextTasks = boardState.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            who: editTaskForm.who.trim() || "未定",
            when: editTaskForm.when.trim() || "順次",
            what: editTaskForm.what.trim(),
            updatedBy: currentUser,
            updatedAt: formatNow()
          }
        : t
    );
    setEditingTaskId(null);
    commitState(
      { ...boardState, tasks: nextTasks },
      `タスク（担当: ${editTaskForm.who}）の内容を編集しました`
    );
  };

  const deleteTask = (id) => {
    const target = boardState.tasks.find((t) => t.id === id);
    if (!target || !window.confirm("このチェックリスト項目を削除しますか？")) return;
    const nextTasks = boardState.tasks.filter((t) => t.id !== id);
    commitState(
      { ...boardState, tasks: nextTasks },
      `タスク（担当: ${target.who}）を削除しました`
    );
  };

  const moveTask = (id, direction) => {
    const idx = boardState.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const targetCompleted = boardState.tasks[idx].completed;
    let swapIdx = -1;
    if (direction === -1) {
      for (let i = idx - 1; i >= 0; i--) {
        if (boardState.tasks[i].completed === targetCompleted) {
          swapIdx = i;
          break;
        }
      }
    } else {
      for (let i = idx + 1; i < boardState.tasks.length; i++) {
        if (boardState.tasks[i].completed === targetCompleted) {
          swapIdx = i;
          break;
        }
      }
    }
    if (swapIdx === -1) return;
    const nextTasks = [...boardState.tasks];
    const tmp = nextTasks[idx];
    nextTasks[idx] = nextTasks[swapIdx];
    nextTasks[swapIdx] = tmp;
    commitState({ ...boardState, tasks: nextTasks }, `タスクの表示順を並び替えました`);
  };

  const formatCategoryTitle = (raw) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("■") ? trimmed : "■ " + trimmed;
  };

  const handleRegisterCategoryOnly = () => {
    const formatted = formatCategoryTitle(newCustomCatName);
    if (!formatted) {
      alert("新しく追加する選択肢（会議名やテーマ名）を入力してください。");
      return;
    }
    const newId = "cat-" + Date.now();
    const nextDecisions = [
      ...boardState.decisions,
      { id: newId, category: formatted, items: [] }
    ];
    setNewCustomCatName("");
    setShowCustomCatBox(false);
    setSelectedCatId(newId);
    commitState(
      { ...boardState, decisions: nextDecisions },
      `決定事項に新しい選択肢（見出し）「${formatted}」を追加しました`
    );
  };

  const handleAddDecision = () => {
    const customCatFormatted = formatCategoryTitle(newCustomCatName);
    const title = newDecTitle.trim();
    const content = newDecContent.trim();

    if ((selectedCatId === NEW_CAT_VALUE || showCustomCatBox) && customCatFormatted && !title && !content) {
      handleRegisterCategoryOnly();
      return;
    }

    if (!title && !content) {
      alert("追加する決定事項の「項目名」または「決まった内容」を入力してください。");
      return;
    }

    let nextDecisions = [...boardState.decisions];
    let targetCatId = selectedCatId;

    if (selectedCatId === NEW_CAT_VALUE || (showCustomCatBox && customCatFormatted)) {
      if (!customCatFormatted) {
        alert("新しく追加する選択肢（会議名やテーマ名）を入力してください。");
        return;
      }
      const existing = nextDecisions.find((c) => c.category === customCatFormatted);
      if (existing) {
        targetCatId = existing.id;
      } else {
        targetCatId = "cat-" + Date.now();
        nextDecisions.push({ id: targetCatId, category: customCatFormatted, items: [] });
      }
      setNewCustomCatName("");
      setShowCustomCatBox(false);
    }

    const cleanTitle = title.endsWith("：") || title.endsWith(":") ? title.slice(0, -1) : title || "決定事項";
    const newItem = {
      id: "dec-" + Date.now(),
      title: cleanTitle,
      content,
      updatedBy: currentUser,
      updatedAt: formatNow()
    };

    nextDecisions = nextDecisions.map((cat) =>
      cat.id === targetCatId ? { ...cat, items: [...cat.items, newItem] } : cat
    );

    setSelectedCatId(targetCatId);
    setNewDecTitle("");
    setNewDecContent("");
    commitState(
      { ...boardState, decisions: nextDecisions },
      `決定事項「${cleanTitle}」を追加入力しました`
    );
  };

  const startEditDecision = (item) => {
    setEditingDecId(item.id);
    setEditDecForm({ title: item.title, content: item.content });
  };

  const saveEditDecision = (catId, decId) => {
    if (!editDecForm.title.trim() && !editDecForm.content.trim()) {
      alert("内容を入力してください。");
      return;
    }
    const cleanTitle = editDecForm.title.trim().replace(/[：:]$/, "");
    const nextDecisions = boardState.decisions.map((cat) =>
      cat.id !== catId
        ? cat
        : {
            ...cat,
            items: cat.items.map((it) =>
              it.id === decId
                ? { ...it, title: cleanTitle, content: editDecForm.content.trim(), updatedBy: currentUser, updatedAt: formatNow() }
                : it
            )
          }
    );
    setEditingDecId(null);
    commitState(
      { ...boardState, decisions: nextDecisions },
      `決定事項「${cleanTitle}」を編集しました`
    );
  };

  const deleteDecision = (catId, decId, title) => {
    if (!window.confirm(`決定事項「${title}」を削除しますか？`)) return;
    const nextDecisions = boardState.decisions.map((cat) =>
      cat.id !== catId ? cat : { ...cat, items: cat.items.filter((it) => it.id !== decId) }
    );
    commitState(
      { ...boardState, decisions: nextDecisions },
      `決定事項「${title}」を削除しました`
    );
  };

  const editCategoryName = (catId, currentName) => {
    const nextName = window.prompt("選択肢（見出し・会議名）を編集してください：", currentName);
    if (!nextName || !nextName.trim()) return;
    const formatted = formatCategoryTitle(nextName);
    const nextDecisions = boardState.decisions.map((cat) =>
      cat.id === catId ? { ...cat, category: formatted } : cat
    );
    commitState(
      { ...boardState, decisions: nextDecisions },
      `カテゴリ見出しを「${formatted}」に変更しました`
    );
  };

  const deleteCategory = (catId, currentName) => {
    if (!window.confirm(`「${currentName}」とその中の決定事項をすべて削除しますか？`)) return;
    const nextDecisions = boardState.decisions.filter((cat) => cat.id !== catId);
    commitState(
      { ...boardState, decisions: nextDecisions },
      `カテゴリ「${currentName}」を削除しました`
    );
  };

  const exportWordDoc = () => {
    const todoList = boardState.tasks.filter((t) => !t.completed);
    const doneList = boardState.tasks.filter((t) => t.completed);
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

    let decHtml = "";
    boardState.decisions.forEach((cat) => {
      decHtml += `<h3 style="color:#2b579a;margin-top:12pt;margin-bottom:4pt;">${esc(cat.category)}</h3><ul>`;
      cat.items.forEach((it) => {
        decHtml += `<li style="margin-bottom:4pt;"><b>${esc(it.title)}：</b>${esc(it.content)}</li>`;
      });
      decHtml += `</ul>`;
    });

    const makeRows = (arr, symbol) =>
      arr
        .map(
          (t) =>
            `<tr><td style="text-align:center;width:36pt;">${symbol}</td><td style="font-weight:bold;width:110pt;">${esc(
              t.who
            )}</td><td style="width:95pt;">${esc(t.when)}</td><td>${esc(t.what)}</td></tr>`
        )
        .join("");

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>WPB 幹部代会議 統合まとめ</title>
      <style>body{font-family:"Meiryo",sans-serif;font-size:10pt;}h1{font-size:15pt;color:#1b365d;text-align:center;}h2{font-size:12.5pt;color:#1b365d;border-bottom:2px solid #1b365d;padding-bottom:3pt;margin-top:16pt;}table{border-collapse:collapse;width:100%;margin-top:6pt;}th,td{border:1px solid #888;padding:5pt;vertical-align:top;font-size:9.5pt;}th{background:#1b365d;color:#fff;}</style></head>
      <body>
        <h1>2026年10月〜11月11日 幹文連・幹部代会議 統合総括</h1>
        <h2>1. これから誰がいつまでに何をやるか（やるべきことリスト / ToDo）</h2>
        <table><tr><th>完了</th><th>誰が</th><th>いつまでに</th><th>何をやるか</th></tr>${makeRows(todoList, "☐")}</table>
        <h2>2. すでに終わっているはずのこと（完了済みリスト）</h2>
        <table><tr><th>完了</th><th>誰が</th><th>いつまでに</th><th>何をやったか</th></tr>${makeRows(doneList, "☑")}</table>
        <h2>3. 今まで決まったこと</h2>
        ${decHtml}
      </body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "2026_幹部代会議_決定事項・ToDoまとめ.doc";
    a.click();
  };

  const { todoList, doneList, totalDecisions } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchTask = (t) => {
      const matchWho = filterWho === "ALL" || t.who.includes(filterWho);
      const matchQ =
        !q ||
        t.who.toLowerCase().includes(q) ||
        t.when.toLowerCase().includes(q) ||
        t.what.toLowerCase().includes(q);
      return matchWho && matchQ;
    };
    const todos = boardState.tasks.filter((t) => !t.completed && matchTask(t));
    const dones = boardState.tasks.filter((t) => t.completed && matchTask(t));
    const decCount = boardState.decisions.reduce((acc, c) => acc + c.items.length, 0);
    return { todoList: todos, doneList: dones, totalDecisions: decCount };
  }, [boardState, searchQuery, filterWho]);

  const allUncompletedCount = boardState.tasks.filter((t) => !t.completed).length;
  const allCompletedCount = boardState.tasks.filter((t) => t.completed).length;
  const progressPercent =
    boardState.tasks.length > 0
      ? Math.round((allCompletedCount / boardState.tasks.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      <header className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold text-lg shadow-inner">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">WPB 幹部代Sync</h1>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  {syncStatus === "synced"
                    ? "🟢 リアルタイム同期中"
                    : syncStatus === "saving"
                    ? "🔄 クラウド保存中..."
                    : "🟡 自動保存中"}
                </span>
              </div>
              <p className="text-[11px] text-indigo-100 hidden sm:block">
                決定事項・やるべきこと（ToDo）・完了済みリスト 共同編集ボード
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-white/20 transition"
              title="自分の名前を設定すると変更履歴に記録されます"
            >
              <Users size={14} />
              <span>編集者: {currentUser}</span>
              <Edit2 size={12} className="opacity-80" />
            </button>
            <button
              onClick={exportWordDoc}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
              title="現在の内容をWordファイル(.doc)としてダウンロード"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Word保存</span>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl text-xs transition hidden sm:inline-flex"
              title="印刷 / PDF保存"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                やるべきこと (未完了): {allUncompletedCount}件
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                すでに終わっていること (完了): {allCompletedCount}件
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                今まで決まったこと: {totalDecisions}件
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>ToDo消化率: {progressPercent}%</span>
              <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="キーワードで検索（例：マーシャル、2月ライブ、溝上 萌乃佳...）"
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filterWho}
              onChange={(e) => setFilterWho(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="ALL">👤 担当者：すべて表示</option>
              <option value="全員">幹部代全員</option>
              {MEMBERS_2KAISE.map((name) => (
                <option key={name} value={name.split(" ")[0]}>{name}</option>
              ))}
              <option value="パトリ">各パートリーダー（パトリ）</option>
            </select>
            {(searchQuery || filterWho !== "ALL") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilterWho("ALL");
                }}
                className="text-xs text-indigo-600 font-bold px-2 py-1 hover:underline"
              >
                解除
              </button>
            )}
          </div>
        </div>

        {(activeTab === "all" || activeTab === "tasks") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b-2 border-blue-600 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-blue-600" size={22} />
                <h2 className="text-base sm:text-lg font-bold text-blue-900">
                  1. これから誰がいつまでに何をやるか（やるべきことリスト / ToDo）
                </h2>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                残り {todoList.length}件
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              💡 左側の丸いチェックボタン（<span className="text-blue-600 font-bold">○</span>）をタップすると、
              <strong>自動的に下の「2. すでに終わっているはずのこと（完了済みリスト）」へ移動</strong>します。
            </p>

            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-3.5 mb-4">
              <div className="text-xs font-bold text-indigo-950 mb-2 flex items-center gap-1.5">
                <Plus size={15} className="text-indigo-600" />
                <span>新しいチェックリスト（やるべきこと / 完了済み）を追加</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  list="roster-datalist"
                  value={newTaskWho}
                  onChange={(e) => setNewTaskWho(e.target.value)}
                  placeholder="誰が（選択または自由入力）"
                  className="sm:col-span-3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
                <datalist id="roster-datalist">
                  <option value="幹部代全員" />
                  {MEMBERS_2KAISE.map((m) => (
                    <option key={m} value={m} />
                  ))}
                  {MEMBERS_1KAISE.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <input
                  type="text"
                  value={newTaskWhen}
                  onChange={(e) => setNewTaskWhen(e.target.value)}
                  placeholder="いつまでに（例：11/18会議まで）"
                  className="sm:col-span-3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
                <input
                  type="text"
                  value={newTaskWhat}
                  onChange={(e) => setNewTaskWhat(e.target.value)}
                  placeholder="何をやるか（具体的なタスク内容を入力）"
                  className="sm:col-span-4 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
                <div className="sm:col-span-2 flex gap-1.5">
                  <button
                    onClick={() => handleAddTask(false)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition whitespace-nowrap"
                  >
                    ＋ ToDo追加
                  </button>
                  <button
                    onClick={() => handleAddTask(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-2.5 rounded-xl shadow-sm transition whitespace-nowrap"
                    title="完了済みリストへ直接追加"
                  >
                    ＋完了
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {todoList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  該当する未完了タスクはありません 🎉
                </div>
              ) : (
                todoList.map((t) => (
                  <div
                    key={t.id}
                    className="group bg-white hover:bg-blue-50/40 border border-slate-200 rounded-2xl p-3.5 transition shadow-xs flex items-start gap-3"
                  >
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-600 transition shrink-0"
                      title="クリックして完了済みに移動"
                    >
                      <Circle size={22} strokeWidth={2.2} />
                    </button>

                    {editingTaskId === t.id ? (
                      <div className="flex-1 space-y-2 bg-slate-50 p-3 rounded-xl border border-indigo-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            list="roster-datalist"
                            value={editTaskForm.who}
                            onChange={(e) => setEditTaskForm({ ...editTaskForm, who: e.target.value })}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                            placeholder="担当者"
                          />
                          <input
                            type="text"
                            value={editTaskForm.when}
                            onChange={(e) => setEditTaskForm({ ...editTaskForm, when: e.target.value })}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            placeholder="期限"
                          />
                        </div>
                        <textarea
                          rows={3}
                          value={editTaskForm.what}
                          onChange={(e) => setEditTaskForm({ ...editTaskForm, what: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingTaskId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => saveEditTask(t.id)}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                          >
                            💾 保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold text-xs px-2.5 py-0.5 rounded-lg">
                            👤 {t.who}
                          </span>
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px] px-2 py-0.5 rounded-lg">
                            ⏰ 期限: {t.when}
                          </span>
                          {t.updatedBy && t.updatedBy !== "初期データ" && (
                            <span className="text-[10px] text-slate-400">
                              （最終更新: {t.updatedBy} {t.updatedAt}）
                            </span>
                          )}
                        </div>
                        <p
                          onClick={() => startEditTask(t)}
                          className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-slate-100/70 rounded p-1 -m-1"
                          title="クリックして編集"
                        >
                          {t.what}
                        </p>
                      </div>
                    )}

                    {editingTaskId !== t.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditTask(t)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="編集"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => moveTask(t.id, -1)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg hidden sm:inline-flex"
                          title="上へ移動"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveTask(t.id, 1)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg hidden sm:inline-flex"
                          title="下へ移動"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {(activeTab === "all" || activeTab === "tasks") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-emerald-200">
            <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={22} />
                <h2 className="text-base sm:text-lg font-bold text-emerald-900">
                  2. すでに終わっているはずのこと（完了済みリスト）
                </h2>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
                完了 {doneList.length}件
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              💡 上のリストでチェックされた項目が自動でここに集まります。緑のチェック（✓）をタップすると未完了リストに戻せます。
            </p>

            <div className="space-y-2">
              {doneList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">完了済みのタスクはありません</div>
              ) : (
                doneList.map((t) => (
                  <div
                    key={t.id}
                    className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-3 flex items-start gap-3 transition"
                  >
                    <button
                      onClick={() => handleToggleTask(t.id)}
                      className="mt-0.5 text-emerald-600 hover:text-slate-500 transition shrink-0"
                      title="クリックして未完了に戻す"
                    >
                      <CheckCircle2 size={22} />
                    </button>

                    {editingTaskId === t.id ? (
                      <div className="flex-1 space-y-2 bg-white p-3 rounded-xl border border-emerald-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            list="roster-datalist"
                            value={editTaskForm.who}
                            onChange={(e) => setEditTaskForm({ ...editTaskForm, who: e.target.value })}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={editTaskForm.when}
                            onChange={(e) => setEditTaskForm({ ...editTaskForm, when: e.target.value })}
                            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={editTaskForm.what}
                          onChange={(e) => setEditTaskForm({ ...editTaskForm, what: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingTaskId(null)}
                            className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => saveEditTask(t.id)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                          >
                            💾 保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="bg-emerald-100 text-emerald-900 font-bold text-xs px-2 py-0.5 rounded-md">
                            👤 {t.who}
                          </span>
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {t.when}
                          </span>
                          {t.updatedBy && (
                            <span className="text-[10px] text-slate-400">
                              （確認: {t.updatedBy} {t.updatedAt}）
                            </span>
                          )}
                        </div>
                        <p
                          onClick={() => startEditTask(t)}
                          className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap cursor-pointer hover:text-slate-900"
                        >
                          {t.what}
                        </p>
                      </div>
                    )}

                    {editingTaskId !== t.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditTask(t)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"
                          title="編集"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                          title="削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {(activeTab === "all" || activeTab === "decisions") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-indigo-900 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-900" size={22} />
                <h2 className="text-base sm:text-lg font-bold text-indigo-950">
                  3. 今まで決まったこと（今後の会議の選択肢も自由に追加可能）
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedCatId(NEW_CAT_VALUE);
                  setShowCustomCatBox(true);
                }}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              >
                <FolderPlus size={14} />
                <span>＋ 新しい選択肢（会議名・見出し）を作成</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 mb-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles size={15} className="text-indigo-600" />
                  <span>「今まで決まったこと」に新しい決定事項を追加入力</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatId(NEW_CAT_VALUE);
                    setShowCustomCatBox(true);
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  ✏️ 選択肢にない新しい会議名・テーマを自分で追加する
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                <div className="sm:col-span-4 space-y-2">
                  <select
                    value={selectedCatId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCatId(val);
                      setShowCustomCatBox(val === NEW_CAT_VALUE);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {boardState.decisions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category}
                      </option>
                    ))}
                    <option value={NEW_CAT_VALUE}>
                      ➕ 新しい選択肢（会議名・テーマ）を自分で入力する...
                    </option>
                  </select>

                  {showCustomCatBox && (
                    <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                      <label className="block text-[11px] font-bold text-indigo-900">
                        ✨ 新しく追加する選択肢（会議名・テーマ名）：
                      </label>
                      <input
                        type="text"
                        value={newCustomCatName}
                        onChange={(e) => setNewCustomCatName(e.target.value)}
                        placeholder="例：11/18 第2回幹部代会議 / 合宿について"
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleRegisterCategoryOnly}
                          className="flex-1 bg-indigo-600 text-white text-[11px] font-bold py-1.5 px-2 rounded-lg"
                        >
                          選択肢だけ先に登録
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomCatBox(false);
                            if (boardState.decisions.length > 0) {
                              setSelectedCatId(boardState.decisions[0].id);
                            }
                          }}
                          className="bg-white text-slate-600 border border-slate-300 text-[11px] py-1.5 px-2 rounded-lg"
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={newDecTitle}
                  onChange={(e) => setNewDecTitle(e.target.value)}
                  placeholder="項目名（例：2月ライブの個人バンド上限）"
                  className="sm:col-span-3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />

                <input
                  type="text"
                  value={newDecContent}
                  onChange={(e) => setNewDecContent(e.target.value)}
                  placeholder="決まった内容（例：3回生以下は最大3バンドまでに決定）"
                  className="sm:col-span-3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />

                <button
                  onClick={handleAddDecision}
                  className="sm:col-span-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm transition"
                >
                  ＋ 決定事項を追加
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {boardState.decisions.map((cat) => (
                <div
                  key={cat.id}
                  className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                    <h3
                      onClick={() => editCategoryName(cat.id, cat.category)}
                      className="text-sm sm:text-base font-bold text-indigo-800 cursor-pointer hover:underline"
                      title="クリックして見出し名を編集"
                    >
                      {cat.category}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => editCategoryName(cat.id, cat.category)}
                        className="text-[11px] text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 font-medium"
                      >
                        ✏️ 見出し編集
                      </button>
                      <button
                        onClick={() => deleteCategory(cat.id, cat.category)}
                        className="text-[11px] text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {cat.items.length === 0 ? (
                      <li className="text-xs text-slate-400 py-2">
                        （まだ項目がありません。上のフォームから追加入力できます）
                      </li>
                    ) : (
                      cat.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 border-b border-slate-100 last:border-none"
                        >
                          {editingDecId === item.id ? (
                            <div className="flex-1 space-y-2 bg-slate-50 p-3 rounded-xl border border-indigo-200">
                              <input
                                type="text"
                                value={editDecForm.title}
                                onChange={(e) => setEditDecForm({ ...editDecForm, title: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                placeholder="項目名"
                              />
                              <textarea
                                rows={2}
                                value={editDecForm.content}
                                onChange={(e) => setEditDecForm({ ...editDecForm, content: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                placeholder="決まった内容"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingDecId(null)}
                                  className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={() => saveEditDecision(cat.id, item.id)}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                                >
                                  💾 保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div
                                onClick={() => startEditDecision(item)}
                                className="flex-1 text-xs sm:text-sm leading-relaxed cursor-pointer"
                                title="クリックして編集"
                              >
                                <span className="font-bold text-slate-900">{item.title}：</span>
                                <span className="text-slate-700 whitespace-pre-wrap">{item.content}</span>
                                {item.updatedBy && (
                                  <span className="ml-2 text-[10px] text-slate-400">
                                    (更新: {item.updatedBy} {item.updatedAt})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => startEditDecision(item)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                  title="編集"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => deleteDecision(cat.id, item.id, item.title)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded"
                                  title="削除"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeTab === "all" || activeTab === "logs") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <History className="text-indigo-600" size={20} />
                <h2 className="text-sm sm:text-base font-bold text-slate-800">
                  みんなの編集・変更履歴（誰がいつ何を変更したか）
                </h2>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("すべてのデータを初期状態（公式名簿氏名版）にリセットしますか？")) {
                    commitState(INITIAL_STATE, "データを初期状態（公式名簿氏名版）にリセットしました");
                  }
                }}
                className="text-[11px] text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg border border-red-200 flex items-center gap-1 font-bold"
              >
                <RotateCcw size={12} />
                <span>初期状態に戻す</span>
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {(boardState.logs || []).map((log) => (
                <div
                  key={log.id}
                  className="text-xs flex items-center justify-between gap-2 py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-indigo-700 mr-1.5">[{log.user}]</span>
                    <span className="text-slate-700">{log.action}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">{log.time}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 shadow-lg">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: "all", label: "すべて表示", icon: Sparkles },
            { id: "tasks", label: `ToDo (${allUncompletedCount})`, icon: CheckSquare },
            { id: "decisions", label: `決定事項 (${totalDecisions})`, icon: FileText },
            { id: "logs", label: "変更履歴", icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">👤 自分の名前（編集者名）を選択</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1 bg-slate-100 rounded-full text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              公式名簿（2回生20名・1回生21名）から選択できます。選んだ名前で編集履歴が記録されます。
            </p>
            <div className="overflow-y-auto space-y-3 pr-1">
              <div>
                <div className="text-xs font-bold text-indigo-800 mb-1.5">■ 2回生（同期・20名）</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MEMBERS_2KAISE.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setCurrentUser(name);
                        localStorage.setItem(USER_NAME_KEY, name);
                        setShowUserModal(false);
                      }}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border text-left truncate flex items-center justify-between ${
                        currentUser === name
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {currentUser === name && <Check size={13} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-800 mb-1.5">■ 1回生（後輩・21名）</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MEMBERS_1KAISE.map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setCurrentUser(name);
                        localStorage.setItem(USER_NAME_KEY, name);
                        setShowUserModal(false);
                      }}
                      className={`py-1.5 px-2.5 rounded-xl text-xs font-bold border text-left truncate flex items-center justify-between ${
                        currentUser === name
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {currentUser === name && <Check size={13} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={customUserName}
                onChange={(e) => setCustomUserName(e.target.value)}
                placeholder="その他の名前を直接入力..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs"
              />
              <button
                onClick={() => {
                  if (customUserName.trim()) {
                    setCurrentUser(customUserName.trim());
                    localStorage.setItem(USER_NAME_KEY, customUserName.trim());
                    setCustomUserName("");
                    setShowUserModal(false);
                  }
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
