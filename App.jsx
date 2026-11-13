import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot
} from "firebase/firestore";
import {
  CheckCircle2, Circle, Plus, Edit2, Trash2, ArrowUp, ArrowDown,
  History, Users, FileText, CheckSquare, Sparkles, Search,
  Download, RotateCcw, FolderPlus, X, Check,
  Calendar, LogOut, User, StickyNote, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, Shield, Star, ArrowUpDown
} from 'lucide-react';

// --- Firebase Configuration (即時同期最適化) ---
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
  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true
    });
  } catch (innerErr) {
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase初期化エラー:", e);
}

const SYNC_COLLECTION = "kanbu_sync";
const SYNC_DOC_ID = "board_2026_11";
const LOCAL_STORAGE_KEY = "wpb_kanbu_sync_backup_v5";
const AUTH_STORAGE_KEY = "wpb_kanbu_sync_auth_v1";
const LOGIN_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 1ヶ月（30日間）
const NEW_CAT_VALUE = "__CREATE_NEW_CATEGORY__";

// --- 重要度（なし / 1〜5）の定義 ---
const IMPORTANCE_OPTIONS = [
  { value: 0, label: "なし", short: "なし", badgeClass: "bg-slate-100 text-slate-500 border-slate-200", activeBtnClass: "bg-slate-700 text-white border-slate-700" },
  { value: 1, label: "★1 (低)", short: "★1", badgeClass: "bg-slate-100 text-slate-700 border-slate-300", activeBtnClass: "bg-slate-600 text-white border-slate-600" },
  { value: 2, label: "★2 (やや低)", short: "★2", badgeClass: "bg-sky-50 text-sky-800 border-sky-200", activeBtnClass: "bg-sky-600 text-white border-sky-600" },
  { value: 3, label: "★3 (中)", short: "★3", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", activeBtnClass: "bg-amber-500 text-white border-amber-500" },
  { value: 4, label: "★4 (高)", short: "★4", badgeClass: "bg-orange-100 text-orange-900 border-orange-300", activeBtnClass: "bg-orange-600 text-white border-orange-600" },
  { value: 5, label: "★5 (最優先)", short: "★5", badgeClass: "bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-200", activeBtnClass: "bg-rose-600 text-white border-rose-600" }
];

const getImportanceMeta = (val) => {
  const num = Number(val) || 0;
  return IMPORTANCE_OPTIONS.find((o) => o.value === num) || IMPORTANCE_OPTIONS[0];
};

// --- 並び替えモードのラベル定義 ---
const SORT_MODE_LABELS = {
  manual: "手動順（↑↓）",
  added_asc: "追加順（昇順：古い→新しい）",
  added_desc: "追加順（降順：新しい→古い）",
  imp_desc: "重要度が高い順（★5→★1→なし）",
  imp_asc: "重要度が低い順（★1→★5→なし）",
  who_asc: "担当者名順"
};

// --- 写真の役職表に基づく幹部代メンバー20名と担当役職データ ---
const KANBU_ROSTER = [
  {
    name: "安部建人",
    aliases: ["安部", "あべ", "部長", "監督"],
    roles: ["部長", "監督", "PA（設営）", "PA（卓）"],
    leadRoles: ["部長", "監督"],
    groups: ["幹部", "ライブ各責任者", "PA"]
  },
  {
    name: "小林秀星",
    aliases: ["小林", "しゅうせい", "こばしゅう", "副部長"],
    roles: ["副部長", "PA（卓）", "差し入れ"],
    leadRoles: ["副部長", "PA（卓）"],
    groups: ["幹部", "ライブ各責任者", "PA"]
  },
  {
    name: "平野春音",
    aliases: ["平野", "はるね", "会計"],
    roles: ["会計", "照明（設営）", "カメラ"],
    leadRoles: ["会計"],
    groups: ["幹部", "ライブ各責任者", "照明"]
  },
  {
    name: "杉原和貴",
    aliases: ["杉原", "かずき", "渉外"],
    roles: ["渉外", "PA（設営）"],
    leadRoles: ["渉外", "PA（設営）"],
    groups: ["幹部", "ライブ各責任者", "PA"]
  },
  {
    name: "弘田隼大",
    aliases: ["弘田", "ひろはや", "総務"],
    roles: ["総務", "楽器庫"],
    leadRoles: ["総務", "楽器庫"],
    groups: ["幹部", "ライブ各責任者"]
  },
  {
    name: "溝上萌乃佳",
    aliases: ["溝上", "ほのか", "萌乃佳"],
    roles: ["ボーカル（パトリ）", "庶務", "電ドラ"],
    leadRoles: ["ボーカル（パトリ）", "庶務", "電ドラ"],
    groups: ["パートリーダー", "パトリ", "ライブ各責任者"]
  },
  {
    name: "渡会啓人",
    aliases: ["渡会", "わたらい"],
    roles: ["ギター（パトリ）", "チェックマン", "ビデオカメラ"],
    leadRoles: ["ギター（パトリ）", "ビデオカメラ"],
    groups: ["パートリーダー", "パトリ", "ライブ各責任者"]
  },
  {
    name: "浦山大樹",
    aliases: ["浦山", "大樹", "たいき"],
    roles: ["ベース（パトリ）", "PA（設営）", "機材統括"],
    leadRoles: ["ベース（パトリ）", "機材統括"],
    groups: ["パートリーダー", "パトリ", "ライブ各責任者", "PA"]
  },
  {
    name: "滑川優斗",
    aliases: ["滑川", "なめこ"],
    roles: ["ドラム（パトリ）", "格納庫", "機材車"],
    leadRoles: ["ドラム（パトリ）", "格納庫"],
    groups: ["パートリーダー", "パトリ", "ライブ各責任者", "その他"]
  },
  {
    name: "森柊実",
    aliases: ["森", "しゅうま", "柊実"],
    roles: ["キーボード（パトリ）", "照明（操作）", "差し入れ"],
    leadRoles: ["キーボード（パトリ）", "照明（操作）", "差し入れ"],
    groups: ["パートリーダー", "パトリ", "ライブ各責任者", "照明"]
  },
  {
    name: "春日京介",
    aliases: ["春日", "かすが"],
    roles: ["文連", "舞台", "機材車"],
    leadRoles: ["文連"],
    groups: ["ライブ各責任者", "幹文連", "その他"]
  },
  {
    name: "大橋菜純",
    aliases: ["大橋", "なすみ", "菜純"],
    roles: ["文連"],
    leadRoles: ["文連"],
    groups: ["ライブ各責任者", "幹文連"]
  },
  {
    name: "小川美晴",
    aliases: ["小川", "みはる", "美晴"],
    roles: ["チェックマン", "ビデオカメラ", "卒パ"],
    leadRoles: ["チェックマン", "卒パ"],
    groups: ["ライブ各責任者", "その他"]
  },
  {
    name: "亀谷博昭",
    aliases: ["亀谷", "かめや"],
    roles: ["舞台", "カメラ", "差し入れ", "機材車"],
    leadRoles: ["舞台"],
    groups: ["ライブ各責任者", "その他"]
  },
  {
    name: "松尾知律",
    aliases: ["松尾", "ちりつ", "知律"],
    roles: ["舞台"],
    leadRoles: [],
    groups: ["ライブ各責任者"]
  },
  {
    name: "清水康貴",
    aliases: ["清水", "やす", "康貴"],
    roles: ["楽器庫"],
    leadRoles: [],
    groups: ["ライブ各責任者"]
  },
  {
    name: "大場怜",
    aliases: ["大場", "れん", "蓮", "怜"],
    roles: ["照明（設営）", "BBQ"],
    leadRoles: ["照明（設営）", "BBQ"],
    groups: ["ライブ各責任者", "照明", "その他"]
  },
  {
    name: "小島大幹",
    aliases: ["小島", "こじだい", "大幹"],
    roles: ["照明（設営）", "カメラ", "卒パ"],
    leadRoles: ["カメラ"],
    groups: ["ライブ各責任者", "照明", "その他"]
  },
  {
    name: "朱函悦",
    aliases: ["朱", "かんえつ", "函悦"],
    roles: ["照明（操作）", "web,SNS", "機材車"],
    leadRoles: ["web,SNS", "機材車"],
    groups: ["ライブ各責任者", "照明", "その他"]
  },
  {
    name: "武捨裕吏",
    aliases: ["武捨", "ゆうり", "裕吏"],
    roles: ["電ドラ"],
    leadRoles: [],
    groups: ["ライブ各責任者"]
  }
];

const ROLE_CATEGORIES = [
  {
    group: "全体・グループ",
    roles: ["幹部代全員", "幹部", "幹文連", "パートリーダー（パトリ）", "各セクションリーダー"]
  },
  {
    group: "幹部",
    roles: ["部長", "副部長", "会計", "渉外", "総務"]
  },
  {
    group: "パートリーダー",
    roles: ["ボーカル（パトリ）", "ギター（パトリ）", "ベース（パトリ）", "ドラム（パトリ）", "キーボード（パトリ）"]
  },
  {
    group: "ライブ 各責任者",
    roles: [
      "監督", "文連", "チェックマン", "舞台", "楽器庫", "格納庫",
      "照明（設営）", "照明（操作）", "PA（設営）", "PA（卓）",
      "庶務", "電ドラ", "カメラ", "ビデオカメラ", "差し入れ", "機材統括"
    ]
  },
  {
    group: "その他",
    roles: ["web,SNS", "BBQ", "機材車", "卒パ"]
  }
];

const FULL_ROLE_TABLE = [
  { cat: "幹部", role: "部長", main: "安部建人", sub: "" },
  { cat: "幹部", role: "副部長", main: "小林秀星", sub: "" },
  { cat: "幹部", role: "会計", main: "平野春音", sub: "" },
  { cat: "幹部", role: "渉外", main: "杉原和貴", sub: "" },
  { cat: "幹部", role: "総務", main: "弘田隼大", sub: "" },
  { cat: "パートリーダー", role: "ボーカル", main: "溝上萌乃佳", sub: "" },
  { cat: "パートリーダー", role: "ギター", main: "渡会啓人", sub: "" },
  { cat: "パートリーダー", role: "ベース", main: "浦山大樹", sub: "" },
  { cat: "パートリーダー", role: "ドラム", main: "滑川優斗", sub: "" },
  { cat: "パートリーダー", role: "キーボード", main: "森柊実", sub: "" },
  { cat: "ライブ 各責任者", role: "監督", main: "安部建人", sub: "" },
  { cat: "ライブ 各責任者", role: "文連", main: "★春日京介, ★大橋菜純", sub: "" },
  { cat: "ライブ 各責任者", role: "チェックマン", main: "★小川美晴, 渡会啓人", sub: "岡井 涼太, 岡本 茉麻" },
  { cat: "ライブ 各責任者", role: "舞台（終わり次第遊軍/照明設営）", main: "★亀谷博昭, 松尾知律, 春日京介", sub: "柴 敏皓, 若林 周, 二木 櫂" },
  { cat: "ライブ 各責任者", role: "楽器庫", main: "★弘田隼大, 清水康貴", sub: "衣斐 真仁" },
  { cat: "ライブ 各責任者", role: "格納庫", main: "★滑川優斗", sub: "東川 颯希, 成田 涼真" },
  { cat: "ライブ 各責任者", role: "照明（設営）", main: "★大場怜, 小島大幹, 平野春音", sub: "渡邉 晴人, 伊藤 大賀, 工藤 暢々花, 讃岐 衣純" },
  { cat: "ライブ 各責任者", role: "照明（操作）", main: "★森柊実, 朱函悦", sub: "本山 莉彩, 高橋 由都" },
  { cat: "ライブ 各責任者", role: "PA（設営）舞台設営終わり次第", main: "★杉原和貴, 浦山大樹, 安部建人", sub: "松村 恭佑, 豊川 陽, YANG KERAN" },
  { cat: "ライブ 各責任者", role: "PA（卓）", main: "★小林秀星, 安部建人", sub: "東 そらユーゴ, 石坂 旭" },
  { cat: "ライブ 各責任者", role: "庶務", main: "★溝上萌乃佳", sub: "役職を削除予定 シフト作成は都度決定" },
  { cat: "ライブ 各責任者", role: "電ドラ", main: "★溝上萌乃佳, 武捨裕吏", sub: "前澤 恵恋, 田中 杏奈" },
  { cat: "ライブ 各責任者", role: "カメラ", main: "★小島大幹, 平野春音, 亀谷博昭", sub: "岡本 茉麻, 田中 杏奈, 石坂 旭（PAがあるので未定）" },
  { cat: "ライブ 各責任者", role: "ビデオカメラ", main: "★渡会啓人, 小川美晴", sub: "" },
  { cat: "ライブ 各責任者", role: "差し入れ", main: "★森柊実, 亀谷博昭, 小林秀星", sub: "" },
  { cat: "ライブ 各責任者", role: "機材統括", main: "★浦山大樹", sub: "" },
  { cat: "その他", role: "web,SNS", main: "★朱函悦", sub: "" },
  { cat: "その他", role: "BBQ", main: "★大場怜", sub: "" },
  { cat: "その他", role: "機材車", main: "★朱函悦, 春日京介, 滑川優斗, 亀谷博昭", sub: "" },
  { cat: "その他", role: "卒パ", main: "★小川美晴, 小島大幹", sub: "" }
];

// --- 初期データ ---
const INITIAL_STATE = {
  tasks: [
    { id: "todo-1", createdAt: 1001, who: "小林秀星（副部長）", when: "11/11会議後すぐ", what: "12月定例ライブでサポート出演（1曲免除対象）する人を把握するためのフォームを作成して流す。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-2", createdAt: 1002, who: "朱函悦（web,SNS）・小林秀星・動画編集に協力できる人", when: "11/11会議後すぐ", what: "学祭・講習会・新歓動画の編集（朱函悦の補助・あと2〜3名）について、小林秀星へ個別LINEで連絡する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-3", createdAt: 1003, who: "幹部代全員", when: "リンク共有後すぐ（次回会議まで）", what: "安部建人から送られるリンクの手順に従い、Zoomアカウント申請（1時間制限解除のため）を行う。また会議時のマイク環境を改善する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-4", createdAt: 1004, who: "安部建人（部長）・現幹部", when: "早急に", what: "合宿先の「ゆうげん荘」へ未返却の消毒液を送り返す。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-5", createdAt: 1005, who: "渡会啓人（ギター（パトリ））", when: "次回（来週）の会議までに確認・順次修理", what: "2スタの壊れているマーシャルキャビネット1台目の部品（約1,000〜4,000円）を購入し修理を試みる。もう1台について先輩（こたさん）に見てもらう。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-6", createdAt: 1006, who: "パートリーダー（パトリ）", when: "順次（次回会議に向けて）", what: "各パートのグループLINE等に「壊れている箇所・不安な機材・欲しい機材」のアンケートフォームを作成して流す（ドラムはハイハットの注意喚起も実施）。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-7", createdAt: 1007, who: "幹部代全員・杉原和貴（渉外）", when: "来週（次回）の幹部代会議", what: "【次回会議で議論・決定すべき持ち越し事項】\n① 2月ライブの残課題：個人のバンド数上限、過去の企画落選バンドの優先、さつまりさんのバンド受け入れ（杉原和貴が出席する回に実施）\n② ローディーの改善策：部ごとに固定するか、撤収ローディーによる次演者への声掛け、ステージ袖待機などのルール化\n③ タイムキーパーの割り振り：学祭等のタイムキーパーを1回生に振るか\n④ 台車の確保方法：文連部室のを使うか、借りるか、新規購入するか（および古い部室台車をブルーシート用等にするか）\n⑤ 各セクションの人員再配置：さつき・りさの抜けた穴埋め、舞台・格納庫・PA設営の人数不足解消（PA卓からの移動や兼任者ゆうごの稼働徹底など）（11/11幹部代）\n⑥ 学祭反省＋α", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-8", createdAt: 1008, who: "杉原和貴（渉外）", when: "11月中（180日前早割期限）", what: "5月（BlackHole）・6月（Flight）ライブの会場予約手配を進めるとともに、ライブハウス側でレンタル時間短縮（延長プラン組み合わせ等による費用圧縮）が可能か詳細条件を確認する。（10/14幹文連）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-9", createdAt: 1009, who: "溝上萌乃佳（庶務）・浦山大樹・幹文連", when: "12月定例の1週間前まで", what: "12月定例ライブ当日のチケット代（ドリチケ）回収（受付）シフトを作成する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-10", createdAt: 1010, who: "PA（設営）・照明（設営）・カメラ・機材統括", when: "順次（12月定例・次回イベントに向けて）", what: "大蛇用の箱、コード類整理用の箱、カメラケース、ベース返し（EV）、共用ピックホルダー3個、予備キャノン（長さ別5本ずつ）、六角レンチの選定・購入、および上手の横当ての修理手配を進める。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-11", createdAt: 1011, who: "浦山大樹（機材統括）", when: "次回ライブ・設営まで", what: "① PAシートのフォーマット修正（DI・同期の位置欄を追加）。\n② 先輩（けいたさん）と相談した電流不足対策（パワーディストリビューターからの電源確保）を整理・管轄する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-12", createdAt: 1012, who: "大場怜（照明（設営））", when: "次回設営まで", what: "① 暗幕固定用の透明な安全ピンを購入する。\n② 強く光る照明ライトを特定して端に配置し、各ライトに番号・印をつけて管理する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-13", createdAt: 1013, who: "安部建人（部長）・亀谷博昭（舞台）・大場怜（照明（設営））", when: "次回設営まで", what: "設営時のグリーンシートを敷く位置を安部が管理・指揮し、舞台・照明間でステージの中心位置を統一したマニュアルを作成する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-14", createdAt: 1014, who: "安部建人（部長）・杉原和貴（渉外）", when: "順次（おいおい作成・連絡）", what: "バラバラになっている3台目のマーシャルの修理について先輩（けいたさん）に連絡を取る。またボーカルエフェクターの使用スケジュール表を作成する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-15", createdAt: 1015, who: "幹文連・渉外", when: "順次", what: "3月第1週土日（3/6・3/7、府中Flight）の3月ライブについて、卒コン出演バンドの扱いや余った時間の活用方法（企画・時間延長）を検討する。（10/5幹文連）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-16", createdAt: 1016, who: "幹部代全員", when: "順次", what: "合宿の大まかな運営方針について各自考え、議論を進める。また出演キャンセル返金の細かい足切りラインを2月ライブ時等に再議論する。（10/5幹文連・11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-17", createdAt: 1017, who: "幹部代全員", when: "春学期前（4月頃）", what: "5月・6月ライブの出演希望アンケート（事前調査）の形式を検討し、5月の応募バンド不足時における企画バンド募集に備える。（10/14幹文連）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-18", createdAt: 1018, who: "幹部代全員・各セクションリーダー", when: "今後の全イベント・作業時（常時）", what: "設営・撤収等の現場に遅刻せず参加し、幹部代としての仕事を徹底する。（11/11幹部代）", completed: false, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-1", createdAt: 2001, who: "幹部代全員", when: "11/06(金) 枠決め前まで【完了】", what: "枠決め・練習枠数の周知：名簿の案内と一緒に「今回は上限6枠です」という内容をLINE等で周知する。（10/14幹部代）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-2", createdAt: 2002, who: "小林秀星・亀谷博昭", when: "11/06(金) 19:00〜【完了】", what: "定例ライブ＆講習会の枠決め実施：11月6日19:00スタートで定例ライブの枠決めを先に行い、終わり次第、講習会の枠決めを実施する。（10/5・10/14議事録）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-3", createdAt: 2003, who: "安部建人・小林秀星・朱函悦", when: "10/14次回会議〜学祭期間まで【完了】", what: "新歓・SNS用「5秒動画素材」の撮影指示依頼と学祭撮影：現幹部（こたさん等）に相談して各セクションへ撮影指示を出してもらい、学祭での短尺動画素材を撮影する。（10/14幹文連→11/11時点で学祭動画の編集が進行中）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-4", createdAt: 2004, who: "平野春音（会計）・安部建人", when: "学祭前まで【完了】", what: "生花（幹文連向け）の準備・保管：部費（予算3万円前後、割り勘なし）で幹文連向けの花を手配し、安部建人の家へ配達・保管する（余ったら機材統括へ）。（10/5・10/14幹文連）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "11/01" },
    { id: "done-5", createdAt: 2005, who: "幹文連・幹部代全員", when: "10/14会議まで【完了】", what: "5・6月ライブの会場（箱）検討と決定：10/5会議のToDoを受け、10/14幹文連会議にて「5月：BlackHole（1日間）」「6月：Flight（2日間）」に正式決定済み。（10/5・10/14幹文連）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "10/14" },
    { id: "done-6", createdAt: 2006, who: "幹文連・幹部代全員", when: "12月まで（11/11会議で実施済み）【完了】", what: "出演キャンセル時の対応・返金規定の全体投票：10/5・10/14会議のToDoを受け、11/11第1回幹部代会議で全体投票を実施。「15位以下の代替バンド繰り上げ」「一旦全額徴収（返金有無は事後会議で判断）」に正式決定済み。（10/5・10/14・11/11議事録）", completed: true, importance: 0, updatedBy: "初期データ", updatedAt: "11/11" }
  ],
  decisions: [
    {
      id: "cat-1",
      category: "■ 役職補佐・会議の役割分担と基本ルール",
      items: [
        { id: "dec-101", createdAt: 3101, title: "幹部補佐の決定（10/5幹文連）", content: "総務補佐＝「小島大幹（こじだい）」、渉外補佐＝「大場怜（れん）・小川美晴（みはる）」、会計補佐＝「森柊実（しゅうま）・渡会啓人（わたらい）」（しゅうまの差し入れ等の懸念も確認し問題なしと判断）。", importance: 0 },
        { id: "dec-102", createdAt: 3102, title: "会議・枠決めの役割分担（10/14幹部代）", content: "枠決め司会＝「小林秀星・亀谷博昭」の2名体制、黒板（板書）係＝「滑川優斗（なめこ）」、議事録係＝「小林秀星・渡会啓人」の2名体制、タイムキーパー＝会議進行役の「安部建人」が兼任。", importance: 0 },
        { id: "dec-103", createdAt: 3103, title: "会議の進行方法（10/14幹文連）", content: "全員が揃った上で、アジェンダの上から順番通りに議論を進める。", importance: 0 },
        { id: "dec-104", createdAt: 3104, title: "欠席・遅刻の原則禁止と連絡先（11/11幹部代）", content: "人数が少なく投票の信憑性を保つため、また説明を二度行う負担を減らすため欠席・遅刻は原則禁止。やむを得ず休む場合は「弘田隼大（ひろはや）」へ連絡する。", importance: 0 },
        { id: "dec-105", createdAt: 3105, title: "会議中のタバコ休憩禁止（11/11幹部代）", content: "会議中のタバコ休憩は全面禁止（事前に済ませてくること）。", importance: 0 },
        { id: "dec-106", createdAt: 3106, title: "決定事項の不遡及と発言の徹底（11/11幹部代）", content: "一度決まったことは後から覆らないため、意見が固まっていなくても不満や疑問はその場で必ず「ちょっと待って」と発言する。", importance: 0 },
        { id: "dec-107", createdAt: 3107, title: "投票ルール・ダブルスコア制（11/11幹部代）", content: "2択の投票で多数派が少数派の2倍以上（ダブルスコア）になった場合は協議なしで即決定。つかなければ1度だけ再協議を行い、2回目の投票で即決定（これも覆らない）。議論が停滞した際は一旦アンケートをとって整理する。", importance: 0 },
        { id: "dec-108", createdAt: 3108, title: "幹部代フォルダの共有制限（11/11幹部代）", content: "法政大学アカウント全員に編集権限がついているため、リンクは他学年には絶対に共有せず幹部代のみに厳守する。", importance: 0 }
      ]
    },
    {
      id: "cat-2",
      category: "■ バンド練習枠・枠決め・ベース講習の優先練習枠",
      items: [
        { id: "dec-201", createdAt: 3201, title: "枠決めの開始日時と順序（10/5・10/14議事録）", content: "11月6日（金）19:00スタート。昨年同様「定例ライブの枠決め」を先に行い、終わり次第「講習会の枠決め」を実施する。", importance: 0 },
        { id: "dec-202", createdAt: 3202, title: "練習枠の上限数（10/14幹部代）", content: "バンド数が昨年（9バンド）から12バンドへ増加したことを踏まえ、Zoom投票（8対6）の結果、上限は「6枠」に決定。", importance: 0 },
        { id: "dec-203", createdAt: 3203, title: "ベース講習の優先練習枠（11/11幹部代）", content: "課題曲のバンド合わせのため、12月定例後より取得可能な「ベース講習生も含めた優先練習枠（1枠：1週間後以降でも先に枠を取ってよい権利）」を与えることに決定（1回目12対6、2回目全会一致）。", importance: 0 }
      ]
    },
    {
      id: "cat-3",
      category: "■ 定例投票・12月定例ライブの運営ルール",
      items: [
        { id: "dec-301", createdAt: 3301, title: "定例投票の同数時ルール（10/21幹文連）", content: "定例投票において1位や14位などの得票数が同数だった場合、投票権を持つ幹部代による「決選投票（自票なし）」を行う。合宿3日目の夜に開票作業を行うため、決選投票は「3日目の夜〜撤収日の昼」の間に実施して決定する。", importance: 0 },
        { id: "dec-302", createdAt: 3302, title: "12月定例・サポート出演料免除（11/11幹部代）", content: "例年通り「1曲のみ出演のサポートメンバーは出演費免除」とする（小林秀星が把握用フォームを作成）。", importance: 0 },
        { id: "dec-303", createdAt: 3303, title: "12月定例・出演キャンセル時の対応（11/11幹部代）", content: "タイムテーブルを巻いて進行するのではなく、「15位以下の代わりのバンドを繰り上げて出す」ことに決定（1回目11対6 → 再協議後の2回目投票で14票のダブルスコアで決定）。", importance: 0 },
        { id: "dec-304", createdAt: 3304, title: "出演キャンセル時の返金・料金規定（10/5・10/14・11/11議事録）", content: "10/14会議で「全体会議の投票で決める」と決定し、11/11幹部代会議で投票を行った結果、回収額決定後のキャンセル料は「一旦全額を徴収し、返金（キャッシュバック）するかは事後の会議で状況を見て判断する」方針に決定（細かい足切り基準は2月ライブ時等に再議論）。", importance: 0 },
        { id: "dec-305", createdAt: 3305, title: "12月定例・チケット代（ドリチケ）回収シフト（11/11幹部代）", content: "当日の受付シフトは庶務の「溝上萌乃佳」（および浦山大樹・幹文連）が12月定例の1週間前までに作成する。", importance: 0 }
      ]
    },
    {
      id: "cat-4",
      category: "■ 2月・3月・春学期（5月・6月）ライブの会場・日程と運営方針",
      items: [
        { id: "dec-401", createdAt: 3401, title: "2月ライブの日程・会場・4回生確定枠（11/11幹部代）", content: "日程は2月2日（火）〜4日（木）の3日間、9:00演者入り／21:00完全撤収、会場は「府中Flight」。4回生（今年24人）の確定枠は「あり（例年通り1人1枠まで、同バンド内に複数の4回生がいる場合は全員がその枠を消費する）」に決定。", importance: 0 },
        { id: "dec-402", createdAt: 3402, title: "3月ライブの会場・日程（10/5幹文連）", content: "会場は「府中Flight」、日程は「3月第1週目の土日2日間（3月6日・7日）」に決定。昨年より出演増が予想されるため、卒コン出演バンドを抜くか、余った時間を企画や時間延長に充てるかを引き続き検討する。", importance: 0 },
        { id: "dec-403", createdAt: 3403, title: "5月・6月ライブの会場（10/5・10/14幹文連）", content: "180日前早割（10%オフ）適用時の料金差がほぼないこと（BlackHole：1日25万円、Flight：12時間パック＋機材等から早割で約23万円）や双方の利点を踏まえ、「5月：BlackHole（1日間）」「6月：Flight（2日間）」に決定。", importance: 0 },
        { id: "dec-404", createdAt: 3404, title: "5月・6月ライブの赤字対策（10/14幹文連）", content: "6月は通常どおり12時間パックで実施。5月は4月に事前アンケートを実施し、応募バンドが少なければ「5月企画バンド」を導入しつつ、レンタル時間短縮（8時間プラン＋延長等による費用圧縮）も含めて事前の赤字予防策を講じる。", importance: 0 }
      ]
    },
    {
      id: "cat-5",
      category: "■ 機材・備品の購入と修理・管理ルール（11/11幹部代）",
      items: [
        { id: "dec-501", createdAt: 3501, title: "購入決定品（予算残高：計約230万〜240万円規模で余裕あり）", content: "①大蛇用収納箱、②照明・PAコード類区別用の箱、③カメラ隊のカメラケース、④ベース返し（EV）、⑤2スタ・マーシャル1台目の修理部品（渡会啓人が修理）、⑥共用ピックホルダー（3個）、⑦予備キャノンケーブル（長さ別5本ずつ程度）、⑧ドラム台用六角レンチセット、⑨照明設営用の透明な安全ピン。", importance: 0 },
        { id: "dec-502", createdAt: 3502, title: "修理・確認決定", content: "上手の横当ては修理へ。2スタ・マーシャル2台目は先輩（こたさん）に確認後修理へ。バラバラの3台目マーシャルは先輩（けいたさん）に連絡して確認。", importance: 0 },
        { id: "dec-503", createdAt: 3503, title: "様子見・保留決定", content: "マークベースは12月定例まで様子見。ハイハット割れは現状維持（ドラムグルで注意喚起）。同期用オーディオインターフェース共有購入案は一旦保留（高額機材申請時に再検討）。", importance: 0 },
        { id: "dec-504", createdAt: 3504, title: "管理ルールの新設", content: "OB企画等での使用希望を受け「ボーカルエフェクターの使用スケジュール表」を作成する。各パトリはパート内で必要機材の要望アンケートフォームを実施する。", importance: 0 }
      ]
    },
    {
      id: "cat-6",
      category: "■ 学祭・生花手配・新歓SNS広報・学祭反省を受けた改善策",
      items: [
        { id: "dec-601", createdAt: 3601, title: "生花（なまばな）の手配と保管（10/5・10/14幹文連）", content: "割り勘なし・すべて部費（予算3万円前後）で幹文連向けに手配（余ったら機材統括へ）。配達・保管場所は「安部建人の家」。", importance: 0 },
        { id: "dec-602", createdAt: 3602, title: "新歓・SNS広報用の動画撮影と編集体制（10/14・11/11議事録）", content: "学祭の全エリアやパート別講習会の様子を「5秒程度（一瞬）の短い動画素材」として撮影・蓄積。編集は小林秀星・朱函悦に加え、程よく仕事がない人からあと2〜3名を追加募集する（亀谷博昭は冗談のため不採用）。", importance: 0 },
        { id: "dec-603", createdAt: 3603, title: "学祭の反省を受けた改善策（11/11幹部代）", content: "①グリーンシートを敷く位置は部長の「安部建人」が管理・指揮、②舞台・照明間でステージ中心位置を統一しマニュアル化、③異常に強く光る照明個体を特定して端に配置・番号管理（照明設営：大場怜管轄）、④電流不足対策としてパワーディストリビューター等から電源確保（機材統括：浦山大樹管轄）、⑤ステージ上のケーブル整理徹底（PA設営管轄）、⑥浦山大樹がPAシートを修正（DI・同期位置欄を追加）しシート通りの動きと「不要なコーラスマイク禁止」を徹底、⑦電ドラ受け渡し時の確認徹底、⑧幹部代（特にセクションリーダー）の現場遅刻厳禁。", importance: 0 }
      ]
    }
  ],
  memos: {},
  logs: [
    { id: "log-init", user: "システム", action: "2026年10月〜11月11日会議の決定事項・ToDoリストを初期構築しました", time: "2026/11/11" }
  ],
  lastModified: 0
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const formatNow = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}:${ss}`;
};

const formatDateLabel = (yyyyMmDd) => {
  if (!yyyyMmDd) return "";
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m - 1, d);
  const w = WEEKDAYS[dateObj.getDay()];
  return `${m}/${d}(${w})`;
};

const isTaskForMember = (taskWho, memberObj) => {
  if (!taskWho || !memberObj) return false;
  const text = taskWho.toLowerCase();
  if (text.includes("全員") || text.includes("全体") || text.includes("all") || text.includes("幹部代メンバー")) {
    return true;
  }
  if (text.includes(memberObj.name.toLowerCase())) return true;
  for (const alias of memberObj.aliases) {
    if (alias && text.includes(alias.toLowerCase())) return true;
  }
  for (const role of memberObj.roles) {
    const cleanRole = role.replace(/（.*?）/g, "").toLowerCase();
    if (cleanRole && text.includes(cleanRole)) return true;
  }
  for (const grp of memberObj.groups) {
    if (grp === "幹部" && (text.includes("幹部代") || text.includes("現幹部"))) continue;
    if (grp && text.includes(grp.toLowerCase())) return true;
  }
  return false;
};

const buildWhoString = (selectedNames, selectedRoles, freeText) => {
  const parts = [...selectedNames, ...selectedRoles];
  const cleanFree = (freeText || "").trim();
  if (parts.length > 0 && cleanFree) {
    return `${parts.join("・")}（${cleanFree}）`;
  }
  if (parts.length > 0) {
    return parts.join("・");
  }
  if (cleanFree) {
    return cleanFree;
  }
  return "未定（全体）";
};

const buildWhenString = (selectedDates, freeText) => {
  const formattedDates = selectedDates.map(formatDateLabel);
  const cleanFree = (freeText || "").trim();
  if (formattedDates.length > 0 && cleanFree) {
    return `${formattedDates.join("・")} ${cleanFree}`;
  }
  if (formattedDates.length > 0) {
    return formattedDates.join("・");
  }
  if (cleanFree) {
    return cleanFree;
  }
  return "順次";
};

// 各項目の「追加された順番（タイムスタンプまたは初期番号）」を取得するヘルパー
const getAddedOrderValue = (item) => {
  if (typeof item?.createdAt === "number" && !Number.isNaN(item.createdAt)) {
    return item.createdAt;
  }
  const idStr = String(item?.id || "");
  const match = idStr.match(/^(todo|done|dec|task|cat)-(\d+)$/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    if (prefix === "todo") return 1000 + num;
    if (prefix === "done") return 2000 + num;
    if (prefix === "dec" && num < 100000) return 3000 + num;
    return num; // Date.now() による13桁タイムスタンプ
  }
  return 0;
};

// 共通の並び替え比較関数（追加順［昇順・降順］・重要度順・担当者順）
const compareItems = (a, b, mode) => {
  if (mode === "added_asc") {
    return getAddedOrderValue(a) - getAddedOrderValue(b);
  }
  if (mode === "added_desc") {
    return getAddedOrderValue(b) - getAddedOrderValue(a);
  }
  const impA = Number(a.importance) || 0;
  const impB = Number(b.importance) || 0;
  if (mode === "imp_desc") {
    if (impA !== impB) return impB - impA;
    return getAddedOrderValue(a) - getAddedOrderValue(b);
  }
  if (mode === "imp_asc") {
    const rankA = impA === 0 ? 99 : impA;
    const rankB = impB === 0 ? 99 : impB;
    if (rankA !== rankB) return rankA - rankB;
    return getAddedOrderValue(a) - getAddedOrderValue(b);
  }
  if (mode === "who_asc") {
    return String(a.who || "").localeCompare(String(b.who || ""), "ja");
  }
  return 0;
};

// --- 重要度（なし / 1〜5）セレクターコンポーネント ---
function ImportanceSelector({ value, onChange, label = "重要度（1〜5 / なし）" }) {
  const currentVal = Number(value) || 0;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
        <Star size={14} className="text-amber-500" />
        <span>{label}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        {IMPORTANCE_OPTIONS.map((opt) => {
          const active = currentVal === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                active
                  ? opt.activeBtnClass + " shadow-xs scale-[1.02]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>{opt.label}</span>
              {active && <Check size={12} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- 重要度バッジ表示コンポーネント ---
function ImportanceBadge({ importance }) {
  const num = Number(importance) || 0;
  if (num <= 0) return null;
  const meta = getImportanceMeta(num);
  return (
    <span
      className={`font-bold text-[11px] px-2 py-0.5 rounded-lg border inline-flex items-center gap-0.5 ${meta.badgeClass}`}
      title={`重要度: ${meta.label}`}
    >
      <span>重要度 {meta.short}</span>
    </span>
  );
}

// --- カレンダー日付選択コンポーネント ---
function CalendarSelector({ selectedDates, onToggleDate, onClearDates }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, iso: `${viewYear}-${mm}-${dd}` });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-bold text-slate-800">
          {viewYear}年 {viewMonth + 1}月
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-7" />;
          const isSelected = selectedDates.includes(cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onToggleDate(cell.iso)}
              className={`h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "hover:bg-indigo-50 text-slate-700"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      {selectedDates.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {selectedDates.map((d) => (
              <span
                key={d}
                className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] font-bold"
              >
                {formatDateLabel(d)}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClearDates}
            className="text-[11px] text-red-500 hover:underline font-bold shrink-0 ml-2"
          >
            選択解除
          </button>
        </div>
      )}
    </div>
  );
}

// --- 「誰が」名前・役職複数選択＋自由記述ピッカー ---
function WhoSelector({
  selectedNames,
  setSelectedNames,
  selectedRoles,
  setSelectedRoles,
  freeText,
  setFreeText
}) {
  const [openPicker, setOpenPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState("names");

  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter((x) => x !== item));
    } else {
      setList([...list, item]);
    }
  };

  const previewText = buildWhoString(selectedNames, selectedRoles, freeText);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
          <Users size={14} className="text-indigo-600" />
          <span>誰が（名前・役職の複数選択 / 選択なし＋自由記述もOK）</span>
        </label>
        <button
          type="button"
          onClick={() => setOpenPicker(!openPicker)}
          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
        >
          {openPicker ? "▲ 名前・役職の選択欄を閉じる" : "▼ 名前・役職から選択する（複数可）"}
        </button>
      </div>

      {(selectedNames.length > 0 || selectedRoles.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/60 p-2 rounded-xl border border-indigo-100">
          <span className="text-[11px] font-bold text-indigo-800 mr-1">選択中:</span>
          {selectedNames.map((n) => (
            <span
              key={`n-${n}`}
              onClick={() => toggleItem(selectedNames, setSelectedNames, n)}
              className="cursor-pointer bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
            >
              👤 {n} <X size={11} />
            </span>
          ))}
          {selectedRoles.map((r) => (
            <span
              key={`r-${r}`}
              onClick={() => toggleItem(selectedRoles, setSelectedRoles, r)}
              className="cursor-pointer bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1"
            >
              🏷️ {r} <X size={11} />
            </span>
          ))}
          <button
            type="button"
            onClick={() => {
              setSelectedNames([]);
              setSelectedRoles([]);
            }}
            className="text-[11px] text-red-600 font-bold hover:underline ml-auto"
          >
            すべて解除
          </button>
        </div>
      )}

      {openPicker && (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2.5">
          <div className="flex gap-1.5 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setPickerTab("names")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                pickerTab === "names"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              👤 名前から選ぶ（20名）
            </button>
            <button
              type="button"
              onClick={() => setPickerTab("roles")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                pickerTab === "roles"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              🏷️ 役職から選ぶ（写真の表）
            </button>
          </div>

          {pickerTab === "names" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-0.5">
              {KANBU_ROSTER.map((m) => {
                const active = selectedNames.includes(m.name);
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => toggleItem(selectedNames, setSelectedNames, m.name)}
                    className={`px-2.5 py-1.5 rounded-xl text-left text-xs font-bold border transition flex items-center justify-between ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50"
                    }`}
                  >
                    <div className="truncate">
                      <div>{m.name}</div>
                      <div className={`text-[10px] truncate ${active ? "text-indigo-100" : "text-slate-400"}`}>
                        {m.roles.slice(0, 2).join("・")}
                      </div>
                    </div>
                    {active && <Check size={13} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {ROLE_CATEGORIES.map((cat) => (
                <div key={cat.group}>
                  <div className="text-[11px] font-bold text-slate-500 mb-1">■ {cat.group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.roles.map((role) => {
                      const active = selectedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => toggleItem(selectedRoles, setSelectedRoles, role)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                            active
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50"
                          }`}
                        >
                          <span>{role}</span>
                          {active && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="誰が：自由記述（選択なしでここだけ入力、または選択＋補足記述もOK）"
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="text-[11px] text-slate-500 mt-1">
          表示プレビュー: <strong className="text-indigo-800">{previewText}</strong>
        </div>
      </div>
    </div>
  );
}

// --- 「いつまで」カレンダー日付選択＋自由記述ピッカー ---
function WhenSelector({ selectedDates, setSelectedDates, freeText, setFreeText }) {
  const [openCal, setOpenCal] = useState(false);

  const toggleDate = (iso) => {
    if (selectedDates.includes(iso)) {
      setSelectedDates(selectedDates.filter((d) => d !== iso));
    } else {
      setSelectedDates([...selectedDates, iso].sort());
    }
  };

  const previewText = buildWhenString(selectedDates, freeText);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
          <Calendar size={14} className="text-amber-600" />
          <span>いつまでに（カレンダー日付選択 / 選択なし＋自由記述もOK）</span>
        </label>
        <button
          type="button"
          onClick={() => setOpenCal(!openCal)}
          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
        >
          {openCal ? "▲ カレンダーを閉じる" : "📅 カレンダーから日付を選択"}
        </button>
      </div>

      {openCal && (
        <CalendarSelector
          selectedDates={selectedDates}
          onToggleDate={toggleDate}
          onClearDates={() => setSelectedDates([])}
        />
      )}

      <div>
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="いつまでに：自由記述（例：次回会議まで / 19:00まで ※日付選択と併用・これだけでもOK）"
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="text-[11px] text-slate-500 mt-1">
          表示プレビュー: <strong className="text-amber-800">{previewText}</strong>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // --- ログイン状態管理（1ヶ月間維持） ---
  const [authInfo, setAuthInfo] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.userName && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });
  const [selectedLoginCandidate, setSelectedLoginCandidate] = useState("");

  // --- ボード全体のデータ管理 ---
  const [boardState, setBoardState] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : INITIAL_STATE.tasks,
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : INITIAL_STATE.decisions,
          memos: parsed.memos && typeof data?.memos === "object" ? parsed.memos : (parsed.memos || {}),
          logs: Array.isArray(parsed.logs) ? parsed.logs : INITIAL_STATE.logs,
          lastModified: parsed.lastModified || 0
        };
      }
    } catch (e) {}
    return INITIAL_STATE;
  });

  const [syncStatus, setSyncStatus] = useState("connecting");
  const [activeTab, setActiveTab] = useState("mypage"); // 'mypage' | 'all' | 'tasks' | 'decisions' | 'logs'
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWho, setFilterWho] = useState("ALL");
  const [filterImportance, setFilterImportance] = useState("ALL");
  const [showRoleTableModal, setShowRoleTableModal] = useState(false);

  // 各リストの並び替えモード状態
  // 'manual' | 'added_asc' | 'added_desc' | 'imp_desc' | 'imp_asc' | 'who_asc'
  const [todoSortMode, setTodoSortMode] = useState("manual");
  const [doneSortMode, setDoneSortMode] = useState("manual");
  const [decisionSortMode, setDecisionSortMode] = useState("manual");

  // ワンクッション確認モーダル状態
  const [confirmDialog, setConfirmDialog] = useState(null);

  // 新規タスク入力用
  const [newTaskNames, setNewTaskNames] = useState([]);
  const [newTaskRoles, setNewTaskRoles] = useState([]);
  const [newTaskWhoFree, setNewTaskWhoFree] = useState("");
  const [newTaskDates, setNewTaskDates] = useState([]);
  const [newTaskWhenFree, setNewTaskWhenFree] = useState("");
  const [newTaskWhat, setNewTaskWhat] = useState("");
  const [newTaskImportance, setNewTaskImportance] = useState(0);

  // タスク編集用
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskNames, setEditTaskNames] = useState([]);
  const [editTaskRoles, setEditTaskRoles] = useState([]);
  const [editTaskWhoFree, setEditTaskWhoFree] = useState("");
  const [editTaskDates, setEditTaskDates] = useState([]);
  const [editTaskWhenFree, setEditTaskWhenFree] = useState("");
  const [editTaskWhat, setEditTaskWhat] = useState("");
  const [editTaskImportance, setEditTaskImportance] = useState(0);

  // 新規決定事項・選択肢追加用
  const [selectedCatId, setSelectedCatId] = useState("cat-1");
  const [showCustomCatBox, setShowCustomCatBox] = useState(false);
  const [newCustomCatName, setNewCustomCatName] = useState("");
  const [newDecTitle, setNewDecTitle] = useState("");
  const [newDecContent, setNewDecContent] = useState("");
  const [newDecImportance, setNewDecImportance] = useState(0);

  // 決定事項編集用
  const [editingDecId, setEditingDecId] = useState(null);
  const [editDecForm, setEditDecForm] = useState({ title: "", content: "", importance: 0 });

  // マイページ：自由メモ用
  const [newMemoTitle, setNewMemoTitle] = useState("");
  const [newMemoBody, setNewMemoBody] = useState("");
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [editMemoForm, setEditMemoForm] = useState({ title: "", body: "" });
  const [showCompletedInMyPage, setShowCompletedInMyPage] = useState(false);

  const lastLocalWriteTimeRef = useRef(0);
  const broadcastChannelRef = useRef(null);

  const currentUser = authInfo?.userName || "";
  const currentMemberObj = useMemo(
    () => KANBU_ROSTER.find((m) => m.name === currentUser) || KANBU_ROSTER[0],
    [currentUser]
  );

  const requestConfirm = ({
    title,
    message,
    confirmLabel = "OK（実行する）",
    confirmColor = "bg-indigo-600 hover:bg-indigo-700",
    onConfirm
  }) => {
    setConfirmDialog({
      title,
      message,
      confirmLabel,
      confirmColor,
      onConfirm
    });
  };

  // --- 即時同期 ---
  const fetchLatestNow = async () => {
    if (!db) return;
    try {
      setSyncStatus("saving");
      const docRef = doc(db, SYNC_COLLECTION, SYNC_DOC_ID);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.tasks) && Array.isArray(data.decisions)) {
          const normalized = {
            tasks: data.tasks,
            decisions: data.decisions,
            memos: data.memos && typeof data.memos === "object" ? data.memos : {},
            logs: Array.isArray(data.logs) ? data.logs : [],
            lastModified: data.lastModified || Date.now()
          };
          setBoardState(normalized);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
        }
      }
      setSyncStatus("synced");
    } catch (e) {
      setSyncStatus("local");
    }
  };

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("wpb_kanbu_sync_realtime_v5");
      bc.onmessage = (ev) => {
        if (ev.data && Array.isArray(ev.data.tasks)) {
          setBoardState(ev.data);
          setSyncStatus("synced");
        }
      };
      broadcastChannelRef.current = bc;
    }

    const onStorage = (e) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && Array.isArray(parsed.tasks)) {
            setBoardState(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener("storage", onStorage);

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        fetchLatestNow();
      }
    };
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    if (!db) {
      setSyncStatus("local");
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("focus", onFocusOrVisible);
        document.removeEventListener("visibilitychange", onFocusOrVisible);
        if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      };
    }

    const docRef = doc(db, SYNC_COLLECTION, SYNC_DOC_ID);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          if (snap.metadata.hasPendingWrites) {
            setSyncStatus("synced");
            return;
          }
          const data = snap.data();
          if (data && Array.isArray(data.tasks) && Array.isArray(data.decisions)) {
            const normalized = {
              tasks: data.tasks,
              decisions: data.decisions,
              memos: data.memos && typeof data.memos === "object" ? data.memos : {},
              logs: Array.isArray(data.logs) ? data.logs : [],
              lastModified: data.lastModified || 0
            };
            setBoardState(normalized);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalized));
          }
        } else {
          setDoc(docRef, INITIAL_STATE).catch(() => {});
        }
        setSyncStatus("synced");
      },
      (err) => {
        console.warn("Firestore同期エラー:", err);
        setSyncStatus("local");
      }
    );

    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  const commitState = (nextState, logMessage) => {
    const nowTs = Date.now();
    lastLocalWriteTimeRef.current = nowTs;
    const newLog = {
      id: "log-" + nowTs,
      user: currentUser || "メンバー",
      action: logMessage,
      time: formatNow()
    };
    const updated = {
      tasks: nextState.tasks || boardState.tasks,
      decisions: nextState.decisions || boardState.decisions,
      memos: nextState.memos || boardState.memos || {},
      logs: [newLog, ...(nextState.logs || boardState.logs || [])].slice(0, 80),
      lastModified: nowTs
    };

    setBoardState(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(updated);
      } catch (e) {}
    }

    if (db) {
      setSyncStatus("saving");
      setDoc(doc(db, SYNC_COLLECTION, SYNC_DOC_ID), updated)
        .then(() => {
          setSyncStatus("synced");
        })
        .catch((e) => {
          console.warn("Firestore保存エラー:", e);
          setSyncStatus("local");
        });
    }
  };

  // --- ログイン・ログアウト ---
  const handleLogin = (nameToLogin) => {
    if (!nameToLogin) return;
    const now = Date.now();
    const newAuth = {
      userName: nameToLogin,
      loginAt: now,
      expiresAt: now + LOGIN_DURATION_MS
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth));
    setAuthInfo(newAuth);
  };

  const handleLogout = () => {
    requestConfirm({
      title: "ログアウト（ユーザー切替）の確認",
      message: `現在「${currentUser}」でログイン中です。ログアウトして名前選択画面に戻りますか？`,
      confirmLabel: "ログアウトする",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthInfo(null);
        setSelectedLoginCandidate("");
      }
    });
  };

  // --- タスク操作（重要度＆並び替え対応・ワンクッション確認付き） ---
  const handleToggleTask = (taskId) => {
    const target = boardState.tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextCompleted = !target.completed;
    const shortWhat = target.what.length > 28 ? target.what.slice(0, 28) + "…" : target.what;

    requestConfirm({
      title: nextCompleted ? "ToDo完了の確認" : "未完了へ戻す確認",
      message: nextCompleted
        ? `「${shortWhat}」（担当: ${target.who}）を【完了済みリスト】へ移動しますか？`
        : `「${shortWhat}」（担当: ${target.who}）を【やるべきことリスト（未完了）】に戻しますか？`,
      confirmLabel: nextCompleted ? "完了にする" : "未完了に戻す",
      confirmColor: nextCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700",
      onConfirm: () => {
        const nextTasks = boardState.tasks.map((t) =>
          t.id === taskId
            ? { ...t, completed: nextCompleted, updatedBy: currentUser, updatedAt: formatNow() }
            : t
        );
        commitState(
          { ...boardState, tasks: nextTasks },
          nextCompleted
            ? `タスク「${shortWhat}」（担当: ${target.who}）を【完了済み】に移動しました`
            : `タスク「${shortWhat}」（担当: ${target.who}）を【やるべきこと（未完了）】に戻しました`
        );
      }
    });
  };

  const handleAddTask = (isCompleted = false, presetWho = null) => {
    const what = newTaskWhat.trim();
    if (!what) {
      alert("「何をやるか（具体的な内容）」を入力してください。");
      return;
    }
    const who = presetWho || buildWhoString(newTaskNames, newTaskRoles, newTaskWhoFree);
    const when = buildWhenString(newTaskDates, newTaskWhenFree);
    const impMeta = getImportanceMeta(newTaskImportance);
    const shortWhat = what.length > 28 ? what.slice(0, 28) + "…" : what;

    requestConfirm({
      title: isCompleted ? "完了済みリストへの追加確認" : "やるべきこと（ToDo）の追加確認",
      message: `以下の内容でリストに追加しますか？\n\n・誰が：${who}\n・いつまで：${when}\n・重要度：${impMeta.label}\n・内容：${what}`,
      confirmLabel: "追加する",
      confirmColor: isCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700",
      onConfirm: () => {
        const nowTs = Date.now();
        const newTask = {
          id: "task-" + nowTs,
          createdAt: nowTs,
          who,
          when,
          what,
          importance: Number(newTaskImportance) || 0,
          completed: isCompleted,
          updatedBy: currentUser,
          updatedAt: formatNow()
        };
        setNewTaskNames([]);
        setNewTaskRoles([]);
        setNewTaskWhoFree("");
        setNewTaskDates([]);
        setNewTaskWhenFree("");
        setNewTaskWhat("");
        setNewTaskImportance(0);
        commitState(
          { ...boardState, tasks: [newTask, ...boardState.tasks] },
          `${isCompleted ? "完了済みリスト" : "やるべきことリスト"}に「${shortWhat}」（担当: ${who} / 重要度: ${impMeta.short}）を追加しました`
        );
      }
    });
  };

  const startEditTask = (t) => {
    requestConfirm({
      title: "ToDoの編集開始",
      message: `「${t.what.slice(0, 30)}${t.what.length > 30 ? "…" : ""}」（担当: ${t.who}）の編集を開始しますか？`,
      confirmLabel: "編集する",
      onConfirm: () => {
        setEditingTaskId(t.id);
        setEditTaskNames([]);
        setEditTaskRoles([]);
        setEditTaskWhoFree(t.who);
        setEditTaskDates([]);
        setEditTaskWhenFree(t.when);
        setEditTaskWhat(t.what);
        setEditTaskImportance(Number(t.importance) || 0);
      }
    });
  };

  const saveEditTask = (id) => {
    if (!editTaskWhat.trim()) {
      alert("タスク内容を入力してください。");
      return;
    }
    const finalWho = buildWhoString(editTaskNames, editTaskRoles, editTaskWhoFree);
    const finalWhen = buildWhenString(editTaskDates, editTaskWhenFree);
    const finalWhat = editTaskWhat.trim();
    const finalImp = Number(editTaskImportance) || 0;
    const impMeta = getImportanceMeta(finalImp);

    requestConfirm({
      title: "編集完了（保存）の確認",
      message: `以下の内容で編集を完了し、保存しますか？\n\n・誰が：${finalWho}\n・いつまで：${finalWhen}\n・重要度：${impMeta.label}\n・内容：${finalWhat}`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextTasks = boardState.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                who: finalWho,
                when: finalWhen,
                what: finalWhat,
                importance: finalImp,
                updatedBy: currentUser,
                updatedAt: formatNow()
              }
            : t
        );
        setEditingTaskId(null);
        commitState(
          { ...boardState, tasks: nextTasks },
          `タスク（担当: ${finalWho} / 重要度: ${impMeta.short}）の内容を編集しました`
        );
      }
    });
  };

  const deleteTask = (id) => {
    const target = boardState.tasks.find((t) => t.id === id);
    if (!target) return;
    requestConfirm({
      title: "ToDo削除の確認",
      message: `「${target.what.slice(0, 35)}${target.what.length > 35 ? "…" : ""}」（担当: ${target.who}）を削除しますか？`,
      confirmLabel: "削除する",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        const nextTasks = boardState.tasks.filter((t) => t.id !== id);
        commitState(
          { ...boardState, tasks: nextTasks },
          `タスク（担当: ${target.who}）を削除しました`
        );
      }
    });
  };

  // 手動の上下並び替え（ToDo / 完了済み共通）
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

    if (targetCompleted) {
      setDoneSortMode("manual");
    } else {
      setTodoSortMode("manual");
    }
    commitState(
      { ...boardState, tasks: nextTasks },
      `${targetCompleted ? "完了済みリスト" : "やるべきことリスト"}の表示順を並び替えました`
    );
  };

  // リスト自体の並び順を「追加順（昇順・降順）」「重要度順」等で一括確定保存する機能
  const applyPermanentTaskSort = (isCompletedTarget, mode) => {
    const effectiveMode = mode === "manual" ? "imp_desc" : mode;
    const modeLabel = SORT_MODE_LABELS[effectiveMode] || effectiveMode;
    const listName = isCompletedTarget ? "すでに終わっていること（完了済みリスト）" : "やるべきことリスト（ToDo）";
    requestConfirm({
      title: "リストの並び順を一括更新",
      message: `${listName}の並び順を「${modeLabel}」で確定し、全員の画面に保存しますか？`,
      confirmLabel: "並び替えて保存する",
      onConfirm: () => {
        const targetItems = boardState.tasks.filter((t) => Boolean(t.completed) === Boolean(isCompletedTarget));
        const otherItems = boardState.tasks.filter((t) => Boolean(t.completed) !== Boolean(isCompletedTarget));
        const sortedTarget = [...targetItems].sort((a, b) => compareItems(a, b, effectiveMode));
        const nextTasks = isCompletedTarget
          ? [...otherItems, ...sortedTarget]
          : [...sortedTarget, ...otherItems];
        if (isCompletedTarget) {
          setDoneSortMode("manual");
        } else {
          setTodoSortMode("manual");
        }
        commitState(
          { ...boardState, tasks: nextTasks },
          `${listName}を「${modeLabel}」に並び替えました`
        );
      }
    });
  };

  // --- マイページ自由メモ操作 ---
  const userMemoList = useMemo(() => {
    if (!currentUser) return [];
    const allMemos = boardState.memos || {};
    return Array.isArray(allMemos[currentUser]) ? allMemos[currentUser] : [];
  }, [boardState.memos, currentUser]);

  const handleAddMemo = () => {
    const title = newMemoTitle.trim() || "メモ";
    const body = newMemoBody.trim();
    if (!body) {
      alert("自由メモの内容を入力してください。");
      return;
    }
    requestConfirm({
      title: "自由メモの追加確認",
      message: `マイページに自由メモ「${title}」を追加しますか？`,
      confirmLabel: "追加する",
      onConfirm: () => {
        const newMemo = {
          id: "memo-" + Date.now(),
          title,
          body,
          updatedAt: formatNow()
        };
        const nextUserMemos = [newMemo, ...userMemoList];
        const nextMemos = { ...(boardState.memos || {}), [currentUser]: nextUserMemos };
        setNewMemoTitle("");
        setNewMemoBody("");
        commitState(
          { ...boardState, memos: nextMemos },
          `${currentUser}がマイページ自由メモを更新しました`
        );
      }
    });
  };

  const startEditMemo = (memo) => {
    requestConfirm({
      title: "自由メモの編集開始",
      message: `メモ「${memo.title}」の編集を開始しますか？`,
      confirmLabel: "編集する",
      onConfirm: () => {
        setEditingMemoId(memo.id);
        setEditMemoForm({ title: memo.title, body: memo.body });
      }
    });
  };

  const saveEditMemo = (memoId) => {
    if (!editMemoForm.body.trim()) {
      alert("メモの内容を入力してください。");
      return;
    }
    requestConfirm({
      title: "自由メモの編集完了（保存）",
      message: `メモ「${editMemoForm.title || "メモ"}」の編集内容を保存しますか？`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextUserMemos = userMemoList.map((m) =>
          m.id === memoId
            ? { ...m, title: editMemoForm.title.trim() || "メモ", body: editMemoForm.body.trim(), updatedAt: formatNow() }
            : m
        );
        const nextMemos = { ...(boardState.memos || {}), [currentUser]: nextUserMemos };
        setEditingMemoId(null);
        commitState(
          { ...boardState, memos: nextMemos },
          `${currentUser}がマイページ自由メモを編集しました`
        );
      }
    });
  };

  const deleteMemo = (memoId, title) => {
    requestConfirm({
      title: "自由メモの削除確認",
      message: `メモ「${title}」を削除しますか？`,
      confirmLabel: "削除する",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        const nextUserMemos = userMemoList.filter((m) => m.id !== memoId);
        const nextMemos = { ...(boardState.memos || {}), [currentUser]: nextUserMemos };
        commitState(
          { ...boardState, memos: nextMemos },
          `${currentUser}がマイページ自由メモを削除しました`
        );
      }
    });
  };

  // --- 決定事項＆選択肢（カテゴリ）操作 ---
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
    requestConfirm({
      title: "新しい選択肢（見出し）の追加確認",
      message: `「今まで決まったこと」に新しい見出し「${formatted}」を追加しますか？`,
      confirmLabel: "追加する",
      onConfirm: () => {
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
      }
    });
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

    const cleanTitle = title.endsWith("：") || title.endsWith(":") ? title.slice(0, -1) : title || "決定事項";
    const impMeta = getImportanceMeta(newDecImportance);

    requestConfirm({
      title: "決定事項の追加確認",
      message: `以下の決定事項を追加しますか？\n\n・項目名：${cleanTitle}\n・重要度：${impMeta.label}\n・内容：${content}`,
      confirmLabel: "追加する",
      onConfirm: () => {
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

        const nowTs = Date.now();
        const newItem = {
          id: "dec-" + nowTs,
          createdAt: nowTs,
          title: cleanTitle,
          content,
          importance: Number(newDecImportance) || 0,
          updatedBy: currentUser,
          updatedAt: formatNow()
        };

        nextDecisions = nextDecisions.map((cat) =>
          cat.id === targetCatId ? { ...cat, items: [...cat.items, newItem] } : cat
        );

        setSelectedCatId(targetCatId);
        setNewDecTitle("");
        setNewDecContent("");
        setNewDecImportance(0);
        commitState(
          { ...boardState, decisions: nextDecisions },
          `決定事項「${cleanTitle}」（重要度: ${impMeta.short}）を追加入力しました`
        );
      }
    });
  };

  const startEditDecision = (item) => {
    requestConfirm({
      title: "決定事項の編集開始",
      message: `決定事項「${item.title}」の編集を開始しますか？`,
      confirmLabel: "編集する",
      onConfirm: () => {
        setEditingDecId(item.id);
        setEditDecForm({
          title: item.title,
          content: item.content,
          importance: Number(item.importance) || 0
        });
      }
    });
  };

  const saveEditDecision = (catId, decId) => {
    if (!editDecForm.title.trim() && !editDecForm.content.trim()) {
      alert("内容を入力してください。");
      return;
    }
    const cleanTitle = editDecForm.title.trim().replace(/[：:]$/, "");
    const finalImp = Number(editDecForm.importance) || 0;
    const impMeta = getImportanceMeta(finalImp);

    requestConfirm({
      title: "決定事項の編集完了（保存）",
      message: `決定事項「${cleanTitle}」（重要度: ${impMeta.label}）の編集内容を保存しますか？`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.map((cat) =>
          cat.id !== catId
            ? cat
            : {
                ...cat,
                items: cat.items.map((it) =>
                  it.id === decId
                    ? {
                        ...it,
                        title: cleanTitle,
                        content: editDecForm.content.trim(),
                        importance: finalImp,
                        updatedBy: currentUser,
                        updatedAt: formatNow()
                      }
                    : it
                )
              }
        );
        setEditingDecId(null);
        commitState(
          { ...boardState, decisions: nextDecisions },
          `決定事項「${cleanTitle}」（重要度: ${impMeta.short}）を編集しました`
        );
      }
    });
  };

  const deleteDecision = (catId, decId, title) => {
    requestConfirm({
      title: "決定事項の削除確認",
      message: `決定事項「${title}」を削除しますか？`,
      confirmLabel: "削除する",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.map((cat) =>
          cat.id !== catId ? cat : { ...cat, items: cat.items.filter((it) => it.id !== decId) }
        );
        commitState(
          { ...boardState, decisions: nextDecisions },
          `決定事項「${title}」を削除しました`
        );
      }
    });
  };

  // 決定事項の各項目の上下並び替え
  const moveDecisionItem = (catId, decId, direction) => {
    const cat = boardState.decisions.find((c) => c.id === catId);
    if (!cat) return;
    const idx = cat.items.findIndex((i) => i.id === decId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= cat.items.length) return;

    const nextItems = [...cat.items];
    const tmp = nextItems[idx];
    nextItems[idx] = nextItems[targetIdx];
    nextItems[targetIdx] = tmp;

    const nextDecisions = boardState.decisions.map((c) =>
      c.id === catId ? { ...c, items: nextItems } : c
    );
    setDecisionSortMode("manual");
    commitState(
      { ...boardState, decisions: nextDecisions },
      `決定事項「${tmp.title}」の表示順を並び替えました`
    );
  };

  // 決定事項のカテゴリ（見出し）全体の上下並び替え
  const moveCategory = (catId, direction) => {
    const idx = boardState.decisions.findIndex((c) => c.id === catId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= boardState.decisions.length) return;

    const nextDecisions = [...boardState.decisions];
    const tmp = nextDecisions[idx];
    nextDecisions[idx] = nextDecisions[targetIdx];
    nextDecisions[targetIdx] = tmp;
    commitState(
      { ...boardState, decisions: nextDecisions },
      `カテゴリ見出し「${tmp.category}」の表示順を並び替えました`
    );
  };

  // 決定事項を選択中の並び順（追加順・重要度順）で一括確定保存
  const applyPermanentDecisionSort = (mode) => {
    const effectiveMode = mode === "manual" ? "imp_desc" : mode;
    const modeLabel = SORT_MODE_LABELS[effectiveMode] || effectiveMode;
    requestConfirm({
      title: "決定事項の並び順を一括更新",
      message: `各カテゴリ内の決定事項を「${modeLabel}」で並び替えて保存しますか？`,
      confirmLabel: "並び替えて保存する",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.map((cat) => ({
          ...cat,
          items: [...cat.items].sort((a, b) => compareItems(a, b, effectiveMode))
        }));
        setDecisionSortMode("manual");
        commitState(
          { ...boardState, decisions: nextDecisions },
          `決定事項を「${modeLabel}」に並び替えました`
        );
      }
    });
  };

  const editCategoryName = (catId, currentName) => {
    requestConfirm({
      title: "見出し名の編集確認",
      message: `カテゴリ見出し「${currentName}」を編集しますか？`,
      confirmLabel: "編集する",
      onConfirm: () => {
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
      }
    });
  };

  const deleteCategory = (catId, currentName) => {
    requestConfirm({
      title: "カテゴリ削除の確認",
      message: `「${currentName}」とその中の決定事項をすべて削除しますか？`,
      confirmLabel: "削除する",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.filter((cat) => cat.id !== catId);
        commitState(
          { ...boardState, decisions: nextDecisions },
          `カテゴリ「${currentName}」を削除しました`
        );
      }
    });
  };

  // Word (.doc) ダウンロード出力
  const exportWordDoc = () => {
    const todoList = boardState.tasks.filter((t) => !t.completed);
    const doneList = boardState.tasks.filter((t) => t.completed);
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

    let decHtml = "";
    boardState.decisions.forEach((cat) => {
      decHtml += `<h3 style="color:#2b579a;margin-top:12pt;margin-bottom:4pt;">${esc(cat.category)}</h3><ul>`;
      cat.items.forEach((it) => {
        const imp = Number(it.importance) || 0;
        const impText = imp > 0 ? `<span style="color:#c62828;font-weight:bold;">[重要度★${imp}] </span>` : "";
        decHtml += `<li style="margin-bottom:4pt;">${impText}<b>${esc(it.title)}：</b>${esc(it.content)}</li>`;
      });
      decHtml += `</ul>`;
    });

    const makeRows = (arr, symbol) =>
      arr
        .map((t) => {
          const imp = Number(t.importance) || 0;
          const impLabel = imp > 0 ? `★${imp}` : "なし";
          return `<tr><td style="text-align:center;width:32pt;">${symbol}</td><td style="text-align:center;width:45pt;font-weight:bold;">${impLabel}</td><td style="font-weight:bold;width:105pt;">${esc(
            t.who
          )}</td><td style="width:90pt;">${esc(t.when)}</td><td>${esc(t.what)}</td></tr>`;
        })
        .join("");

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>WPB 幹部代会議 統合まとめ</title>
      <style>body{font-family:"Meiryo",sans-serif;font-size:10pt;}h1{font-size:15pt;color:#1b365d;text-align:center;}h2{font-size:12.5pt;color:#1b365d;border-bottom:2px solid #1b365d;padding-bottom:3pt;margin-top:16pt;}table{border-collapse:collapse;width:100%;margin-top:6pt;}th,td{border:1px solid #888;padding:5pt;vertical-align:top;font-size:9.5pt;}th{background:#1b365d;color:#fff;}</style></head>
      <body>
        <h1>2026年10月〜11月11日 幹文連・幹部代会議 統合総括</h1>
        <h2>1. これから誰がいつまでに何をやるか（やるべきことリスト / ToDo）</h2>
        <table><tr><th>完了</th><th>重要度</th><th>誰が</th><th>いつまでに</th><th>何をやるか</th></tr>${makeRows(todoList, "☐")}</table>
        <h2>2. すでに終わっているはずのこと（完了済みリスト）</h2>
        <table><tr><th>完了</th><th>重要度</th><th>誰が</th><th>いつまでに</th><th>何をやったか</th></tr>${makeRows(doneList, "☑")}</table>
        <h2>3. 今まで決まったこと</h2>
        ${decHtml}
      </body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "2026_幹部代会議_決定事項・ToDoまとめ.doc";
    a.click();
  };

  // --- 集計＆フィルタリング＆ソート ---
  const matchImportanceFilter = (impValue) => {
    const imp = Number(impValue) || 0;
    if (filterImportance === "ALL") return true;
    if (filterImportance === "HAS_IMP") return imp >= 1;
    if (filterImportance === "NONE") return imp === 0;
    if (filterImportance === "5") return imp === 5;
    if (filterImportance === "4_UP") return imp >= 4;
    if (filterImportance === "3_UP") return imp >= 3;
    return true;
  };

  const { todoList, doneList, myTodoList, myDoneList, totalDecisions } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchTask = (t) => {
      const matchWho = filterWho === "ALL" || t.who.includes(filterWho);
      const matchImp = matchImportanceFilter(t.importance);
      const matchQ =
        !q ||
        t.who.toLowerCase().includes(q) ||
        t.when.toLowerCase().includes(q) ||
        t.what.toLowerCase().includes(q);
      return matchWho && matchImp && matchQ;
    };

    let todos = boardState.tasks.filter((t) => !t.completed && matchTask(t));
    let dones = boardState.tasks.filter((t) => t.completed && matchTask(t));
    let myTodos = boardState.tasks.filter(
      (t) => !t.completed && isTaskForMember(t.who, currentMemberObj) && matchImportanceFilter(t.importance)
    );
    let myDones = boardState.tasks.filter(
      (t) => t.completed && isTaskForMember(t.who, currentMemberObj) && matchImportanceFilter(t.importance)
    );

    if (todoSortMode !== "manual") {
      todos = [...todos].sort((a, b) => compareItems(a, b, todoSortMode));
      myTodos = [...myTodos].sort((a, b) => compareItems(a, b, todoSortMode));
    }
    if (doneSortMode !== "manual") {
      dones = [...dones].sort((a, b) => compareItems(a, b, doneSortMode));
      myDones = [...myDones].sort((a, b) => compareItems(a, b, doneSortMode));
    }

    const decCount = boardState.decisions.reduce((acc, c) => acc + c.items.length, 0);
    return {
      todoList: todos,
      doneList: dones,
      myTodoList: myTodos,
      myDoneList: myDones,
      totalDecisions: decCount
    };
  }, [boardState, searchQuery, filterWho, filterImportance, currentMemberObj, todoSortMode, doneSortMode]);

  const allUncompletedCount = boardState.tasks.filter((t) => !t.completed).length;
  const allCompletedCount = boardState.tasks.filter((t) => t.completed).length;
  const progressPercent =
    boardState.tasks.length > 0
      ? Math.round((allCompletedCount / boardState.tasks.length) * 100)
      : 0;

  // タスク行の共通レンダラー
  const renderTaskCard = (t) => {
    const isEditing = editingTaskId === t.id;
    const imp = Number(t.importance) || 0;
    return (
      <div
        key={t.id}
        className={`group border rounded-2xl p-3.5 transition shadow-xs flex items-start gap-3 ${
          t.completed
            ? "bg-emerald-50/40 border-emerald-200/80"
            : imp === 5
            ? "bg-rose-50/30 hover:bg-rose-50/50 border-rose-200"
            : imp === 4
            ? "bg-orange-50/20 hover:bg-orange-50/40 border-orange-200"
            : "bg-white hover:bg-blue-50/30 border-slate-200"
        }`}
      >
        <button
          type="button"
          onClick={() => handleToggleTask(t.id)}
          className={`mt-0.5 transition shrink-0 ${
            t.completed ? "text-emerald-600 hover:text-slate-500" : "text-slate-400 hover:text-emerald-600"
          }`}
          title={t.completed ? "クリックして未完了に戻す（確認あり）" : "クリックして完了済みに移動（確認あり）"}
        >
          {t.completed ? <CheckCircle2 size={22} /> : <Circle size={22} strokeWidth={2.2} />}
        </button>

        {isEditing ? (
          <div className="flex-1 space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-indigo-200">
            <div className="text-xs font-bold text-indigo-900">✏️ タスク内容を編集中</div>
            <WhoSelector
              selectedNames={editTaskNames}
              setSelectedNames={setEditTaskNames}
              selectedRoles={editTaskRoles}
              setSelectedRoles={setEditTaskRoles}
              freeText={editTaskWhoFree}
              setFreeText={setEditTaskWhoFree}
            />
            <WhenSelector
              selectedDates={editTaskDates}
              setSelectedDates={setEditTaskDates}
              freeText={editTaskWhenFree}
              setFreeText={setEditTaskWhenFree}
            />
            <ImportanceSelector
              value={editTaskImportance}
              onChange={setEditTaskImportance}
              label="重要度（1〜5 / なし）"
            />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">何をやるか（内容）</label>
              <textarea
                rows={3}
                value={editTaskWhat}
                onChange={(e) => setEditTaskWhat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTaskId(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => saveEditTask(t.id)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                💾 編集完了（保存）
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <ImportanceBadge importance={t.importance} />
              <span
                className={`font-bold text-xs px-2.5 py-0.5 rounded-lg border ${
                  t.completed
                    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                    : "bg-indigo-50 text-indigo-800 border-indigo-200"
                }`}
              >
                👤 {t.who}
              </span>
              <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px] px-2 py-0.5 rounded-lg">
                ⏰ 期限: {t.when}
              </span>
              {t.updatedBy && t.updatedBy !== "初期データ" && (
                <span className="text-[10px] text-slate-400">
                  （更新: {t.updatedBy} {t.updatedAt}）
                </span>
              )}
            </div>
            <p
              onClick={() => startEditTask(t)}
              className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed cursor-pointer hover:bg-slate-100/70 rounded p-1 -m-1"
              title="クリックして編集（確認あり）"
            >
              {t.what}
            </p>
          </div>
        )}

        {!isEditing && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => moveTask(t.id, -1)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
              title="上へ移動"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => moveTask(t.id, 1)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
              title="下へ移動"
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() => startEditTask(t)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
              title="編集"
            >
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => deleteTask(t.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="削除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // リストの並び替えコントロールバー共通コンポーネント（追加順［昇順・降順］対応）
  const renderSortToolbar = (sortMode, setSortMode, onPermanentSort, includeWhoSort = true) => {
    const sortButtons = [
      { id: "manual", label: "手動順（↑↓）" },
      { id: "added_asc", label: "🕒追加順（昇順：古い→新）" },
      { id: "added_desc", label: "🕒追加順（降順：新→古い）" },
      { id: "imp_desc", label: "★重要度が高い順" },
      { id: "imp_asc", label: "★重要度が低い順" }
    ];
    if (includeWhoSort) {
      sortButtons.push({ id: "who_asc", label: "👤担当者順" });
    }
    const targetSaveMode = sortMode === "manual" ? "imp_desc" : sortMode;

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mr-1">
            <ArrowUpDown size={13} className="text-indigo-600" />
            <span>並び替え:</span>
          </span>
          {sortButtons.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortMode(opt.id)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                sortMode === opt.id
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {onPermanentSort && (
          <button
            type="button"
            onClick={() => onPermanentSort(targetSaveMode)}
            className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-xl transition"
            title="選択中の並び順で全員の画面の並び順そのものを上書き保存します"
          >
            ⚡ {sortMode === "manual" ? "重要度順で確定保存" : "この並び順で確定保存"}
          </button>
        )}
      </div>
    );
  };

  // =========================================================================
  // 未ログイン時のログイン画面（幹部代20名から選択・1ヶ月間ログイン維持）
  // =========================================================================
  if (!authInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-bold text-2xl flex items-center justify-center mx-auto shadow-md">
              W
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              WPB 幹部代Sync ログイン
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              自分の名前を選択してログインしてください（ログイン後は1ヶ月間維持されます）
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[55vh] overflow-y-auto p-1">
            {KANBU_ROSTER.map((member) => {
              const selected = selectedLoginCandidate === member.name;
              return (
                <button
                  key={member.name}
                  type="button"
                  onClick={() => setSelectedLoginCandidate(member.name)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    selected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]"
                      : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-sm truncate">{member.name}</span>
                    {selected && <Check size={16} className="shrink-0" />}
                  </div>
                  <div
                    className={`text-[10px] leading-snug line-clamp-2 ${
                      selected ? "text-indigo-100" : "text-slate-500"
                    }`}
                  >
                    {member.roles.join(" / ")}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {selectedLoginCandidate ? (
                <span>
                  選択中: <strong className="text-indigo-700 text-sm">{selectedLoginCandidate}</strong>
                </span>
              ) : (
                <span>上のリストから自分の名前をタップしてください</span>
              )}
            </div>
            <button
              type="button"
              disabled={!selectedLoginCandidate}
              onClick={() => handleLogin(selectedLoginCandidate)}
              className={`w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-sm shadow-md transition ${
                selectedLoginCandidate
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              この名前でログインする（1ヶ月維持）
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // メイン画面（ログイン後）
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center font-bold text-lg shadow-inner">
              W
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight">WPB 幹部代Sync</h1>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  {syncStatus === "synced"
                    ? "🟢 即時同期中"
                    : syncStatus === "saving"
                    ? "⚡ 同期送信中..."
                    : "🟡 ローカル保存"}
                </span>
              </div>
              <p className="text-[11px] text-indigo-100 hidden sm:block">
                ログイン中: {currentUser}（{currentMemberObj.roles.join("・")}）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={fetchLatestNow}
              className="bg-white/15 hover:bg-white/25 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border border-white/20 transition"
              title="最新のクラウドデータを今すぐ取得"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">今すぐ同期</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mypage")}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
            >
              <User size={14} />
              <span>{currentUser}（マイページ）</span>
            </button>
            <button
              type="button"
              onClick={exportWordDoc}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
              title="Wordファイル(.doc)として保存"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Word保存</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-white/10 hover:bg-red-500/80 text-white p-1.5 rounded-xl text-xs transition"
              title="ログアウト / ユーザー切替"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4 space-y-5">
        {/* 上部クイックタブ切替バー */}
        <div className="bg-white rounded-2xl p-2 shadow-xs border border-slate-200 flex flex-wrap gap-1.5">
          {[
            { id: "mypage", label: `👤 マイページ (${myTodoList.length})` },
            { id: "all", label: "✨ 全体ボード（すべて表示）" },
            { id: "tasks", label: `✅ 全体ToDo (${allUncompletedCount})` },
            { id: "decisions", label: `📋 決定事項 (${totalDecisions})` },
            { id: "logs", label: "🕒 変更履歴" }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition ${
                activeTab === t.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* =================================================================== */}
        {/* 0. マイページ（自分の役職・自分の役職＆名前が入ったToDoリスト・自由メモ） */}
        {/* =================================================================== */}
        {activeTab === "mypage" && (
          <div className="space-y-5">
            {/* マイプロフィール＆担当役職カード */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                    {currentUser.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{currentUser} のマイページ</h2>
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                        ログイン維持：残り約{Math.max(1, Math.ceil((authInfo.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))}日
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      あなたの担当役職・自分宛てのToDo・個人自由メモをここでまとめて管理できます
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRoleTableModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Shield size={14} />
                  <span>📋 全体の役職・担当表（写真）を見る</span>
                </button>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-600 mb-2">
                  🏷️ あなたの担当役職（写真の表より自動反映）：
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentMemberObj.roles.map((role) => {
                    const isLead = currentMemberObj.leadRoles.includes(role);
                    return (
                      <span
                        key={role}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          isLead
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-indigo-50 text-indigo-800 border-indigo-200"
                        }`}
                      >
                        <span>{isLead ? "★責任者/代表:" : "担当:"}</span>
                        <span>{role}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* マイページ：自分の役職・名前が入ったToDoリスト */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-indigo-600 pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="text-indigo-600" size={22} />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-indigo-950">
                      自分の役職・名前が入ったToDoリスト
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      「{currentUser}」「{currentMemberObj.roles.join("・")}」「幹部代全員」が含まれるToDoが自動表示されます
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                    未完了 {myTodoList.length}件
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCompletedInMyPage(!showCompletedInMyPage)}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition"
                  >
                    {showCompletedInMyPage ? "完了済みを隠す" : `完了済みも表示 (${myDoneList.length}件)`}
                  </button>
                </div>
              </div>

              {/* マイページ内の並び替えバー（追加順 昇順・降順 対応） */}
              {renderSortToolbar(
                todoSortMode,
                setTodoSortMode,
                (mode) => applyPermanentTaskSort(false, mode),
                true
              )}

              <div className="space-y-2.5">
                {myTodoList.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    現在、あなたの名前・役職宛ての未完了ToDoはありません 🎉
                  </div>
                ) : (
                  myTodoList.map((t) => renderTaskCard(t))
                )}
              </div>

              {showCompletedInMyPage && myDoneList.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-emerald-800">
                    ✓ 完了済みの自分宛てToDo ({myDoneList.length}件)
                  </div>
                  {myDoneList.map((t) => renderTaskCard(t))}
                </div>
              )}
            </section>

            {/* マイページ：自由メモ */}
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-amber-200 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-amber-500 pb-3">
                <div className="flex items-center gap-2">
                  <StickyNote className="text-amber-600" size={22} />
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      マイページ自由メモ（{currentUser} 専用メモ帳）
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      自分の役職の引き継ぎメモや会議で話したいことなどを自由に書き留められます
                    </p>
                  </div>
                </div>
                <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
                  {userMemoList.length}件
                </span>
              </div>

              <div className="bg-amber-50/50 border border-dashed border-amber-300 rounded-2xl p-3.5 space-y-2.5">
                <input
                  type="text"
                  value={newMemoTitle}
                  onChange={(e) => setNewMemoTitle(e.target.value)}
                  placeholder="メモのタイトル（例：PA卓の引き継ぎ事項 / 次回会議で聞くこと）"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
                <textarea
                  rows={3}
                  value={newMemoBody}
                  onChange={(e) => setNewMemoBody(e.target.value)}
                  placeholder="自由にメモを入力してください..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddMemo}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition"
                  >
                    ＋ 自由メモを追加
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {userMemoList.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    まだ自由メモがありません。上の入力欄から追加できます。
                  </div>
                ) : (
                  userMemoList.map((memo) => (
                    <div
                      key={memo.id}
                      className="bg-amber-50/30 border border-amber-200 rounded-2xl p-3.5 space-y-1.5"
                    >
                      {editingMemoId === memo.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editMemoForm.title}
                            onChange={(e) => setEditMemoForm({ ...editMemoForm, title: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                          />
                          <textarea
                            rows={3}
                            value={editMemoForm.body}
                            onChange={(e) => setEditMemoForm({ ...editMemoForm, body: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMemoId(null)}
                              className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditMemo(memo.id)}
                              className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold"
                            >
                              💾 保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <h4
                              onClick={() => startEditMemo(memo)}
                              className="font-bold text-xs sm:text-sm text-slate-900 cursor-pointer hover:underline"
                            >
                              📌 {memo.title}
                            </h4>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 mr-1">{memo.updatedAt}</span>
                              <button
                                type="button"
                                onClick={() => startEditMemo(memo)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMemo(memo.id, memo.title)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                          <p
                            onClick={() => startEditMemo(memo)}
                            className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed cursor-pointer"
                          >
                            {memo.body}
                          </p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* 進捗サマリーバー ＆ 検索・担当者・重要度フィルター */}
        {activeTab !== "mypage" && (
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
              <div className="relative flex-1 min-w-[180px]">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="キーワード検索（例：マーシャル、2月ライブ、溝上...）"
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={filterWho}
                onChange={(e) => setFilterWho(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">👤 担当者・役職：すべて表示</option>
                <option value="全員">幹部代全員</option>
                {KANBU_ROSTER.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}（{m.roles[0]}）
                  </option>
                ))}
              </select>
              <select
                value={filterImportance}
                onChange={(e) => setFilterImportance(e.target.value)}
                className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900"
              >
                <option value="ALL">★ 重要度：すべて表示</option>
                <option value="5">★5（最優先）のみ</option>
                <option value="4_UP">★4以上（高〜最優先）</option>
                <option value="3_UP">★3以上（中〜最優先）</option>
                <option value="HAS_IMP">★重要度あり（★1〜★5）</option>
                <option value="NONE">重要度なしのみ</option>
              </select>
              {(searchQuery || filterWho !== "ALL" || filterImportance !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterWho("ALL");
                    setFilterImportance("ALL");
                  }}
                  className="text-xs text-indigo-600 font-bold px-2 py-1 hover:underline"
                >
                  解除
                </button>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* 1. これから誰がいつまでに何をやるか（やるべきことリスト / ToDo） */}
        {/* =================================================================== */}
        {(activeTab === "all" || activeTab === "tasks" || activeTab === "mypage") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b-2 border-blue-600 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-blue-600" size={22} />
                <h2 className="text-base sm:text-lg font-bold text-blue-900">
                  1. これから誰がいつまでに何をやるか（やるべきことリスト / ToDo追加）
                </h2>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                残り {todoList.length}件
              </span>
            </div>

            {/* 新規ToDo追加パネル */}
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 mb-5 space-y-3.5">
              <div className="text-xs font-bold text-indigo-950 flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5">
                  <Plus size={15} className="text-indigo-600" />
                  <span>新しいチェックリスト（やるべきこと / 完了済み）を追加</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskNames.includes(currentUser)) {
                      setNewTaskNames([...newTaskNames, currentUser]);
                    }
                  }}
                  className="text-[11px] bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg font-bold hover:bg-indigo-200 transition"
                >
                  ＋ 自分の名前（{currentUser}）を選択に入れる
                </button>
              </div>

              <WhoSelector
                selectedNames={newTaskNames}
                setSelectedNames={setNewTaskNames}
                selectedRoles={newTaskRoles}
                setSelectedRoles={setNewTaskRoles}
                freeText={newTaskWhoFree}
                setFreeText={setNewTaskWhoFree}
              />

              <WhenSelector
                selectedDates={newTaskDates}
                setSelectedDates={setNewTaskDates}
                freeText={newTaskWhenFree}
                setFreeText={setNewTaskWhenFree}
              />

              <ImportanceSelector
                value={newTaskImportance}
                onChange={setNewTaskImportance}
                label="重要度を設定（1〜5 / 設定なしもOK）"
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  📝 何をやるか（具体的なタスク内容）
                </label>
                <textarea
                  rows={2}
                  value={newTaskWhat}
                  onChange={(e) => setNewTaskWhat(e.target.value)}
                  placeholder="具体的なタスク内容を入力してください"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleAddTask(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm transition"
                >
                  ＋ やるべきこと（ToDo）に追加
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTask(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition"
                >
                  ＋ 完了済みに直接追加
                </button>
              </div>
            </div>

            {activeTab !== "mypage" && (
              <>
                {renderSortToolbar(
                  todoSortMode,
                  setTodoSortMode,
                  (mode) => applyPermanentTaskSort(false, mode),
                  true
                )}
                <div className="space-y-2.5">
                  {todoList.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      該当する未完了タスクはありません 🎉
                    </div>
                  ) : (
                    todoList.map((t) => renderTaskCard(t))
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {/* =================================================================== */}
        {/* 2. すでに終わっているはずのこと（完了済みリスト / 並び替え対応） */}
        {/* =================================================================== */}
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

            {/* 完了済みリスト用の並び替えバー（追加順 昇順・降順 対応） */}
            {renderSortToolbar(
              doneSortMode,
              setDoneSortMode,
              (mode) => applyPermanentTaskSort(true, mode),
              true
            )}

            <div className="space-y-2">
              {doneList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">完了済みのタスクはありません</div>
              ) : (
                doneList.map((t) => renderTaskCard(t))
              )}
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 3. 今まで決まったこと（重要度設定 ＆ 追加順［昇順・降順］並び替え対応） */}
        {/* =================================================================== */}
        {(activeTab === "all" || activeTab === "decisions") && (
          <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-indigo-900 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-900" size={22} />
                <h2 className="text-base sm:text-lg font-bold text-indigo-950">
                  3. 今まで決まったこと（重要度設定・並び替え・選択肢追加対応）
                </h2>
              </div>
              <button
                type="button"
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

            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-4 mb-4 space-y-3">
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
                  className="sm:col-span-5 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                <ImportanceSelector
                  value={newDecImportance}
                  onChange={setNewDecImportance}
                  label="決定事項の重要度（1〜5 / 設定なしもOK）"
                />
                <button
                  type="button"
                  onClick={handleAddDecision}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-sm transition"
                >
                  ＋ 決定事項を追加
                </button>
              </div>
            </div>

            {/* 決定事項の並び替えコントロールバー（追加順 昇順・降順 対応） */}
            {renderSortToolbar(
              decisionSortMode,
              setDecisionSortMode,
              (mode) => applyPermanentDecisionSort(mode),
              false
            )}

            <div className="space-y-4">
              {boardState.decisions.map((cat) => {
                const q = searchQuery.trim().toLowerCase();
                let visibleItems = cat.items.filter((it) => {
                  const matchImp = matchImportanceFilter(it.importance);
                  const matchQ =
                    !q ||
                    it.title.toLowerCase().includes(q) ||
                    it.content.toLowerCase().includes(q) ||
                    cat.category.toLowerCase().includes(q);
                  return matchImp && matchQ;
                });

                if (decisionSortMode !== "manual") {
                  visibleItems = [...visibleItems].sort((a, b) =>
                    compareItems(a, b, decisionSortMode)
                  );
                }

                return (
                  <div
                    key={cat.id}
                    className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-3">
                      <h3
                        onClick={() => editCategoryName(cat.id, cat.category)}
                        className="text-sm sm:text-base font-bold text-indigo-800 cursor-pointer hover:underline"
                      >
                        {cat.category}
                      </h3>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveCategory(cat.id, -1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="このカテゴリ見出しを上へ移動"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(cat.id, 1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                          title="このカテゴリ見出しを下へ移動"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editCategoryName(cat.id, cat.category)}
                          className="text-[11px] text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 font-medium"
                        >
                          ✏️ 見出し編集
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(cat.id, cat.category)}
                          className="text-[11px] text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {visibleItems.length === 0 ? (
                        <li className="text-xs text-slate-400 py-2">
                          （該当する決定事項がありません）
                        </li>
                      ) : (
                        visibleItems.map((item) => {
                          const imp = Number(item.importance) || 0;
                          return (
                            <li
                              key={item.id}
                              className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border transition ${
                                imp === 5
                                  ? "bg-rose-50/30 border-rose-200"
                                  : imp === 4
                                  ? "bg-orange-50/20 border-orange-200"
                                  : "hover:bg-slate-50 border-slate-100"
                              }`}
                            >
                              {editingDecId === item.id ? (
                                <div className="flex-1 space-y-2.5 bg-slate-50 p-3 rounded-xl border border-indigo-200">
                                  <input
                                    type="text"
                                    value={editDecForm.title}
                                    onChange={(e) =>
                                      setEditDecForm({ ...editDecForm, title: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    placeholder="項目名"
                                  />
                                  <ImportanceSelector
                                    value={editDecForm.importance}
                                    onChange={(val) =>
                                      setEditDecForm({ ...editDecForm, importance: val })
                                    }
                                    label="重要度（1〜5 / なし）"
                                  />
                                  <textarea
                                    rows={2}
                                    value={editDecForm.content}
                                    onChange={(e) =>
                                      setEditDecForm({ ...editDecForm, content: e.target.value })
                                    }
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                                    placeholder="決まった内容"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingDecId(null)}
                                      className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                                    >
                                      取消
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditDecision(cat.id, item.id)}
                                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                                    >
                                      💾 編集完了（保存）
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div
                                    onClick={() => startEditDecision(item)}
                                    className="flex-1 text-xs sm:text-sm leading-relaxed cursor-pointer"
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                      <ImportanceBadge importance={item.importance} />
                                      <span className="font-bold text-slate-900">
                                        {item.title}：
                                      </span>
                                    </div>
                                    <span className="text-slate-700 whitespace-pre-wrap">
                                      {item.content}
                                    </span>
                                    {item.updatedBy && (
                                      <span className="ml-2 text-[10px] text-slate-400">
                                        (更新: {item.updatedBy} {item.updatedAt})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => moveDecisionItem(cat.id, item.id, -1)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                                      title="上へ移動"
                                    >
                                      <ArrowUp size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveDecisionItem(cat.id, item.id, 1)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded"
                                      title="下へ移動"
                                    >
                                      <ArrowDown size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditDecision(item)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                                      title="編集"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      type="button"
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
                          );
                        })
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 4. リアルタイム変更履歴（更新ログ） */}
        {/* =================================================================== */}
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
                type="button"
                onClick={() => {
                  requestConfirm({
                    title: "初期状態へのリセット確認",
                    message: "本当にすべてのToDo・決定事項データを初期状態にリセットしますか？",
                    confirmLabel: "リセットする",
                    confirmColor: "bg-red-600 hover:bg-red-700",
                    onConfirm: () => {
                      commitState(INITIAL_STATE, "データを初期状態にリセットしました");
                    }
                  });
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 shadow-lg">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: "mypage", label: `マイページ(${myTodoList.length})`, icon: User },
            { id: "all", label: "全体ボード", icon: Sparkles },
            { id: "tasks", label: `ToDo(${allUncompletedCount})`, icon: CheckSquare },
            { id: "decisions", label: `決定事項(${totalDecisions})`, icon: FileText },
            { id: "logs", label: "変更履歴", icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-bold transition ${
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

      {/* 写真の役職一覧表モーダル */}
      {showRoleTableModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                📋 幹部・パートリーダー・ライブ各責任者・その他 一覧表
              </h3>
              <button
                type="button"
                onClick={() => setShowRoleTableModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-indigo-900 text-white">
                    <th className="p-2 border border-slate-300 text-left">区分</th>
                    <th className="p-2 border border-slate-300 text-left">役職</th>
                    <th className="p-2 border border-slate-300 text-left">幹部代担当（★＝赤字責任者）</th>
                    <th className="p-2 border border-slate-300 text-left">他メンバー・備考</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_ROLE_TABLE.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-slate-50">
                      <td className="p-2 border border-slate-200 font-bold text-slate-600">{row.cat}</td>
                      <td className="p-2 border border-slate-200 font-bold text-indigo-900">{row.role}</td>
                      <td className="p-2 border border-slate-200 font-bold text-slate-800">{row.main}</td>
                      <td className="p-2 border border-slate-200 text-slate-600">{row.sub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ワンクッション確認モーダル */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900">
              <AlertCircle className="text-indigo-600 shrink-0" size={22} />
              <h3 className="font-bold text-base">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (fn) fn();
                }}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition ${confirmDialog.confirmColor}`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
