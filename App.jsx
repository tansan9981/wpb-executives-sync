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
  History, Users, FileText, CheckSquare, Search,
  Download, RotateCcw, X, Check,
  Calendar, LogOut, User, RefreshCw, AlertCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Shield, Star,
  SlidersHorizontal, Maximize2, Crown, KeyRound, UserCheck,
  BookmarkPlus, BookmarkMinus, BookmarkCheck
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
const LOCAL_STORAGE_KEY = "wpb_kanbu_sync_backup_v10";
const AUTH_STORAGE_KEY = "wpb_kanbu_sync_auth_v1";
const LOGIN_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 1ヶ月（30日間）
const NEW_CAT_VALUE = "__CREATE_NEW_CATEGORY__";

// 管理者ユーザー名（変更履歴・ログイン履歴の閲覧権限）
const ADMIN_USER = "小林秀星";

// --- 重要度（なし / 1〜5）の定義 ---
const IMPORTANCE_OPTIONS = [
  { value: 0, label: "なし", short: "なし", badgeClass: "bg-slate-100 text-slate-500 border-slate-200", activeBtnClass: "bg-slate-700 text-white border-slate-700" },
  { value: 1, label: "★1 (低)", short: "★1", badgeClass: "bg-slate-100 text-slate-700 border-slate-300", activeBtnClass: "bg-slate-600 text-white border-slate-600" },
  { value: 2, label: "★2", short: "★2", badgeClass: "bg-sky-50 text-sky-800 border-sky-200", activeBtnClass: "bg-sky-600 text-white border-sky-600" },
  { value: 3, label: "★3 (中)", short: "★3", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", activeBtnClass: "bg-amber-500 text-white border-amber-500" },
  { value: 4, label: "★4 (高)", short: "★4", badgeClass: "bg-orange-100 text-orange-900 border-orange-300", activeBtnClass: "bg-orange-600 text-white border-orange-600" },
  { value: 5, label: "★5 (最優先)", short: "★5", badgeClass: "bg-rose-100 text-rose-800 border-rose-300", activeBtnClass: "bg-rose-600 text-white border-rose-600" }
];

const getImportanceMeta = (val) => {
  const num = Number(val) || 0;
  return IMPORTANCE_OPTIONS.find((o) => o.value === num) || IMPORTANCE_OPTIONS[0];
};

const SORT_MODE_LABELS = {
  manual: "手動順（↑↓ボタンで移動）",
  added_asc: "追加順（昇順：古い→新しい）",
  added_desc: "追加順（降順：新しい→古い）",
  imp_desc: "重要度が高い順（★5→★1→なし）",
  imp_asc: "重要度が低い順（★1→★5→なし）",
  who_asc: "担当者名順"
};

// --- 写真の役職表に基づく幹部代メンバー20名と担当役職データ ---
// ※機材購入担当 ＝ 「会計（平野春音）」「機材統括（浦山大樹）」
const KANBU_ROSTER = [
  { name: "安部建人", aliases: ["安部", "あべ"], roles: ["部長", "監督", "PA（設営）", "PA（卓）"], leadRoles: ["部長", "監督"], isKanbu: true, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "小林秀星", aliases: ["小林", "しゅうせい", "こばしゅう"], roles: ["副部長", "PA（卓）", "差し入れ"], leadRoles: ["副部長", "PA（卓）"], isKanbu: true, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "平野春音", aliases: ["平野", "はるね"], roles: ["会計", "機材購入担当", "照明（設営）", "カメラ"], leadRoles: ["会計", "機材購入担当"], isKanbu: true, isPatri: false, isBunren: false, isSectionLeader: false, isKizaiKonyu: true },
  { name: "杉原和貴", aliases: ["杉原", "かずき"], roles: ["渉外", "PA（設営）"], leadRoles: ["渉外", "PA（設営）"], isKanbu: true, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "弘田隼大", aliases: ["弘田", "ひろはや"], roles: ["総務", "楽器庫"], leadRoles: ["総務", "楽器庫"], isKanbu: true, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "溝上萌乃佳", aliases: ["溝上", "ほのか", "萌乃佳"], roles: ["ボーカル（パトリ）", "庶務", "電ドラ"], leadRoles: ["ボーカル（パトリ）", "庶務", "電ドラ"], isKanbu: false, isPatri: true, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "渡会啓人", aliases: ["渡会", "わたらい"], roles: ["ギター（パトリ）", "チェックマン", "ビデオカメラ"], leadRoles: ["ギター（パトリ）", "ビデオカメラ"], isKanbu: false, isPatri: true, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "浦山大樹", aliases: ["浦山", "大樹", "たいき"], roles: ["ベース（パトリ）", "機材統括", "機材購入担当", "PA（設営）"], leadRoles: ["ベース（パトリ）", "機材統括", "機材購入担当"], isKanbu: false, isPatri: true, isBunren: false, isSectionLeader: true, isKizaiKonyu: true },
  { name: "滑川優斗", aliases: ["滑川", "なめこ"], roles: ["ドラム（パトリ）", "格納庫", "機材車"], leadRoles: ["ドラム（パトリ）", "格納庫"], isKanbu: false, isPatri: true, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "森柊実", aliases: ["森", "しゅうま", "柊実"], roles: ["キーボード（パトリ）", "照明（操作）", "差し入れ"], leadRoles: ["キーボード（パトリ）", "照明（操作）", "差し入れ"], isKanbu: false, isPatri: true, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "春日京介", aliases: ["春日", "かすが"], roles: ["文連", "舞台", "機材車"], leadRoles: ["文連"], isKanbu: false, isPatri: false, isBunren: true, isSectionLeader: true, isKizaiKonyu: false },
  { name: "大橋菜純", aliases: ["大橋", "なすみ", "菜純"], roles: ["文連"], leadRoles: ["文連"], isKanbu: false, isPatri: false, isBunren: true, isSectionLeader: true, isKizaiKonyu: false },
  { name: "小川美晴", aliases: ["小川", "みはる", "美晴"], roles: ["チェックマン", "ビデオカメラ", "卒パ"], leadRoles: ["チェックマン", "卒パ"], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "亀谷博昭", aliases: ["亀谷", "かめや"], roles: ["舞台", "カメラ", "差し入れ", "機材車"], leadRoles: ["舞台"], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "松尾知律", aliases: ["松尾", "ちりつ", "知律"], roles: ["舞台"], leadRoles: [], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: false, isKizaiKonyu: false },
  { name: "清水康貴", aliases: ["清水", "やす", "康貴"], roles: ["楽器庫"], leadRoles: [], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: false, isKizaiKonyu: false },
  { name: "大場怜", aliases: ["大場", "大場怜", "れん"], roles: ["照明（設営）", "BBQ"], leadRoles: ["照明（設営）", "BBQ"], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "小島大幹", aliases: ["小島", "こじだい", "大幹"], roles: ["照明（設営）", "カメラ", "卒パ"], leadRoles: ["カメラ"], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "朱函悦", aliases: ["朱函悦", "かんえつ", "函悦"], roles: ["照明（操作）", "web,SNS", "機材車"], leadRoles: ["web,SNS", "機材車"], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: true, isKizaiKonyu: false },
  { name: "武捨裕吏", aliases: ["武捨", "ゆうり", "裕吏"], roles: ["電ドラ"], leadRoles: [], isKanbu: false, isPatri: false, isBunren: false, isSectionLeader: false, isKizaiKonyu: false }
];

const ROLE_CATEGORIES = [
  { group: "全体・グループ", roles: ["幹部代全員", "幹部", "幹文連", "パートリーダー（パトリ）", "各セクションリーダー", "機材購入担当（会計・機材統括）"] },
  { group: "幹部", roles: ["部長", "副部長", "会計", "渉外", "総務"] },
  { group: "パートリーダー", roles: ["ボーカル（パトリ）", "ギター（パトリ）", "ベース（パトリ）", "ドラム（パトリ）", "キーボード（パトリ）"] },
  { group: "ライブ 各責任者", roles: ["監督", "文連", "チェックマン", "舞台", "楽器庫", "格納庫", "照明（設営）", "照明（操作）", "PA（設営）", "PA（卓）", "庶務", "電ドラ", "カメラ", "ビデオカメラ", "差し入れ", "機材統括", "機材購入担当"] },
  { group: "その他", roles: ["web,SNS", "BBQ", "機材車", "卒パ"] }
];

const FULL_ROLE_TABLE = [
  { cat: "幹部", role: "部長", main: "安部建人", sub: "" },
  { cat: "幹部", role: "副部長", main: "小林秀星", sub: "" },
  { cat: "幹部", role: "会計", main: "平野春音", sub: "機材購入担当" },
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
  { cat: "ライブ 各責任者", role: "機材統括", main: "★浦山大樹", sub: "機材購入担当" },
  { cat: "ライブ 各責任者", role: "機材購入担当", main: "★平野春音（会計）, ★浦山大樹（機材統括）", sub: "会計・機材統括の2名体制" },
  { cat: "その他", role: "web,SNS", main: "★朱函悦", sub: "" },
  { cat: "その他", role: "BBQ", main: "★大場怜", sub: "" },
  { cat: "その他", role: "機材車", main: "★朱函悦, 春日京介, 滑川優斗, 亀谷博昭", sub: "" },
  { cat: "その他", role: "卒パ", main: "★小川美晴, 小島大幹", sub: "" }
];

// --- 初期データ ---
const INITIAL_STATE = {
  tasks: [
    { id: "todo-1", createdAt: 1001, who: "小林秀星（副部長）", when: "11/11会議後すぐ", what: "12月定例ライブでサポート出演（1曲免除対象）する人を把握するためのフォームを作成して流す。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-2", createdAt: 1002, who: "朱函悦（web,SNS）・小林秀星・動画編集に協力できる人", when: "11/11会議後すぐ", what: "学祭・講習会・新歓動画の編集（朱函悦の補助・あと2〜3名）について、小林秀星へ個別LINEで連絡する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-3", createdAt: 1003, who: "幹部代全員", when: "リンク共有後すぐ（次回会議まで）", what: "安部建人から送られるリンクの手順に従い、Zoomアカウント申請（1時間制限解除のため）を行う。また会議時のマイク環境を改善する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-4", createdAt: 1004, who: "安部建人（部長）・現幹部", when: "早急に", what: "合宿先の「ゆうげん荘」へ未返却の消毒液を送り返す。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-5", createdAt: 1005, who: "渡会啓人（ギター（パトリ））", when: "次回（来週）の会議までに確認・順次修理", what: "2スタの壊れているマーシャルキャビネット1台目の部品（約1,000〜4,000円）を購入し修理を試みる。もう1台について先輩（こたさん）に見てもらう。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-6", createdAt: 1006, who: "パートリーダー（パトリ）", when: "順次（次回会議に向けて）", what: "各パートのグループLINE等に「壊れている箇所・不安な機材・欲しい機材」のアンケートフォームを作成して流す（ドラムはハイハットの注意喚起も実施）。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-7", createdAt: 1007, who: "幹部代全員・杉原和貴（渉外）", when: "来週（次回）の幹部代会議", what: "【次回会議で議論・決定すべき持ち越し事項】\n① 2月ライブの残課題：個人のバンド数上限、過去の企画落選バンドの優先、さつまりさんのバンド受け入れ（杉原和貴が出席する回に実施）\n② ローディーの改善策：部ごとに固定するか、撤収ローディーによる次演者への声掛け、ステージ袖待機などのルール化\n③ タイムキーパーの割り振り：学祭等のタイムキーパーを1回生に振るか\n④ 台車の確保方法：文連部室のを使うか、借りるか、新規購入するか（および古い部室台車をブルーシート用等にするか）\n⑤ 各セクションの人員再配置：さつき・りさの抜けた穴埋め、舞台・格納庫・PA設営の人数不足解消（PA卓からの移動や兼任者ゆうごの稼働徹底など）（11/11幹部代）\n⑥ 学祭反省＋α", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-8", createdAt: 1008, who: "杉原和貴（渉外）", when: "11月中（180日前早割期限）", what: "5月（BlackHole）・6月（Flight）ライブの会場予約手配を進めるとともに、ライブハウス側でレンタル時間短縮（延長プラン組み合わせ等による費用圧縮）が可能か詳細条件を確認する。（10/14幹文連）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-9", createdAt: 1009, who: "溝上萌乃佳（庶務）・浦山大樹・幹文連", when: "12月定例の1週間前まで", what: "12月定例ライブ当日のチケット代（ドリチケ）回収（受付）シフトを作成する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-10", createdAt: 1010, who: "PA（設営）・照明（設営）・カメラ・機材購入担当（会計・機材統括）", when: "順次（12月定例・次回イベントに向けて）", what: "大蛇用の箱、コード類整理用の箱、カメラケース、ベース返し（EV）、共用ピックホルダー3個、予備キャノン（長さ別5本ずつ）、六角レンチの選定・購入、および上手の横当ての修理手配を進める。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-11", createdAt: 1011, who: "浦山大樹（機材統括）", when: "次回ライブ・設営まで", what: "① PAシートのフォーマット修正（DI・同期の位置欄を追加）。\n② 先輩（けいたさん）と相談した電流不足対策（パワーディストリビューターからの電源確保）を整理・管轄する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-12", createdAt: 1012, who: "大場怜（照明（設営））", when: "次回設営まで", what: "① 暗幕固定用の透明な安全ピンを購入する。\n② 強く光る照明ライトを特定して端に配置し、各ライトに番号・印をつけて管理する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-13", createdAt: 1013, who: "安部建人（部長）・亀谷博昭（舞台）・大場怜（照明（設営））", when: "次回設営まで", what: "設営時のグリーンシートを敷く位置を安部が管理・指揮し、舞台・照明間でステージの中心位置を統一したマニュアルを作成する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-14", createdAt: 1014, who: "安部建人（部長）・杉原和貴（渉外）", when: "順次（おいおい作成・連絡）", what: "バラバラになっている3台目のマーシャルの修理について先輩（けいたさん）に連絡を取る。またボーカルエフェクターの使用スケジュール表を作成する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-15", createdAt: 1015, who: "幹文連・渉外", when: "順次", what: "3月第1週土日（3/6・3/7、府中Flight）の3月ライブについて、卒コン出演バンドの扱いや余った時間の活用方法（企画・時間延長）を検討する。（10/5幹文連）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-16", createdAt: 1016, who: "幹部代全員", when: "順次", what: "合宿の大まかな運営方針について各自考え、議論を進める。また出演キャンセル返金の細かい足切りラインを2月ライブ時等に再議論する。（10/5幹文連・11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-17", createdAt: 1017, who: "幹部代全員", when: "春学期前（4月頃）", what: "5月・6月ライブの出演希望アンケート（事前調査）の形式を検討し、5月の応募バンド不足時における企画バンド募集に備える。（10/14幹文連）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "todo-18", createdAt: 1018, who: "幹部代全員・各セクションリーダー", when: "今後の全イベント・作業時（常時）", what: "設営・撤収等の現場に遅刻せず参加し、幹部代としての仕事を徹底する。（11/11幹部代）", completed: false, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-1", createdAt: 2001, who: "幹部代全員", when: "11/06(金) 枠決め前まで【完了】", what: "枠決め・練習枠数の周知：名簿の案内と一緒に「今回は上限6枠です」という内容をLINE等で周知する。（10/14幹部代）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-2", createdAt: 2002, who: "小林秀星・亀谷博昭", when: "11/06(金) 19:00〜【完了】", what: "定例ライブ＆講習会の枠決め実施：11月6日19:00スタートで定例ライブの枠決めを先に行い、終わり次第、講習会の枠決めを実施する。（10/5・10/14議事録）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/06" },
    { id: "done-3", createdAt: 2003, who: "安部建人・小林秀星・朱函悦", when: "10/14次回会議〜学祭期間まで【完了】", what: "新歓・SNS用「5秒動画素材」の撮影指示依頼と学祭撮影：現幹部（こたさん等）に相談して各セクションへ撮影指示を出してもらい、学祭での短尺動画素材を撮影する。（10/14幹文連→11/11時点で学祭動画の編集が進行中）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" },
    { id: "done-4", createdAt: 2004, who: "平野春音（会計）・安部建人", when: "学祭前まで【完了】", what: "生花（幹文連向け）の準備・保管：部費（予算3万円前後、割り勘なし）で幹文連向けの花を手配し、安部建人の家へ配達・保管する（余ったら機材統括へ）。（10/5・10/14幹文連）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/01" },
    { id: "done-5", createdAt: 2005, who: "幹文連・幹部代全員", when: "10/14会議まで【完了】", what: "5・6月ライブの会場（箱）検討と決定：10/5会議のToDoを受け、10/14幹文連会議にて「5月：BlackHole（1日間）」「6月：Flight（2日間）」に正式決定済み。（10/5・10/14幹文連）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "10/14" },
    { id: "done-6", createdAt: 2006, who: "幹文連・幹部代全員", when: "12月まで（11/11会議で実施済み）【完了】", what: "出演キャンセル時の対応・返金規定の全体投票：10/5・10/14会議のToDoを受け、11/11第1回幹部代会議で全体投票を実施。「15位以下の代替バンド繰り上げ」「一旦全額徴収（返金有無は事後会議で判断）」に正式決定済み。（10/5・10/14・11/11議事録）", completed: true, completedBy: [], manualAddedUsers: [], manualExcludedUsers: [], importance: 0, updatedBy: "初期データ", updatedAt: "11/11" }
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
  loginLogs: [],
  lastModified: 0
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const formatNow = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
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

// 既存のtodo-10（機材購入タスク）に「会計」が含まれていない旧データの場合、自動的に「機材購入担当（会計・機材統括）」へ補正するヘルパー
const upgradeTasksForKizaiKonyu = (tasks) => {
  if (!Array.isArray(tasks)) return INITIAL_STATE.tasks;
  return tasks.map((t) => {
    if (
      t.id === "todo-10" &&
      (t.who === "PA（設営）・照明（設営）・カメラ・機材統括" ||
        t.who === "PA・照明・カメラ・機材購入担当")
    ) {
      return {
        ...t,
        who: "PA（設営）・照明（設営）・カメラ・機材購入担当（会計・機材統括）"
      };
    }
    return t;
  });
};

// ============================================================================
// 自動判定ロジック（名前・役職に基づく厳密なマイページ対象判定）
// ※機材購入担当 ＝ 会計（平野春音）・機材統括（浦山大樹）
// ============================================================================
const isTaskForMember = (taskWho, memberObj) => {
  if (!taskWho || !memberObj) return false;
  const raw = String(taskWho).replace(/\s+/g, "");

  // 1. 全体・全員対象のキーワード
  if (
    raw.includes("幹部代全員") ||
    raw.includes("全員") ||
    raw.includes("全体") ||
    raw.includes("幹部代メンバー") ||
    raw.toUpperCase().includes("ALL")
  ) {
    return true;
  }

  // 2. 本人のフルネーム一致
  if (raw.includes(memberObj.name.replace(/\s+/g, ""))) {
    return true;
  }

  // 3. 本人の別名（エイリアス）一致
  for (const alias of memberObj.aliases || []) {
    if (alias && alias.length >= 2 && raw.includes(alias)) {
      return true;
    }
  }

  // 4. 「機材購入担当」「機材購入」指定（会計・機材統括の2名にマッチ）
  if (memberObj.isKizaiKonyu && (raw.includes("機材購入担当") || raw.includes("機材購入"))) {
    return true;
  }

  // 5. グループ名の一致判定
  const textWithoutKanbudai = raw
    .replace(/幹部代全員/g, "")
    .replace(/次期幹部代/g, "")
    .replace(/幹部代/g, "")
    .replace(/現幹部/g, "");

  if (memberObj.isKanbu && textWithoutKanbudai.includes("幹部")) {
    return true;
  }
  if ((memberObj.isKanbu || memberObj.isBunren) && raw.includes("幹文連")) {
    return true;
  }
  if (memberObj.isPatri && (raw.includes("パートリーダー") || raw.includes("パトリ"))) {
    return true;
  }
  if (memberObj.isSectionLeader && (raw.includes("セクションリーダー") || raw.includes("各責任者"))) {
    return true;
  }

  // 6. 各役職の厳密一致判定
  const memberRoles = memberObj.roles || [];

  for (const role of memberRoles) {
    if (role === "部長") {
      const withoutFukubucho = raw.replace(/副部長/g, "");
      if (withoutFukubucho.includes("部長")) return true;
    } else if (role === "副部長") {
      if (raw.includes("副部長")) return true;
    } else if (role === "カメラ") {
      const withoutVideoCamera = raw.replace(/ビデオカメラ/g, "");
      if (withoutVideoCamera.includes("カメラ")) return true;
    } else if (role === "ビデオカメラ") {
      if (raw.includes("ビデオカメラ")) return true;
    } else if (role === "照明（設営）") {
      if (raw.includes("照明（設営）") || raw.includes("照明(設営)") || raw.includes("照明設営")) {
        return true;
      }
      const withoutSousa = raw
        .replace(/照明（操作）/g, "")
        .replace(/照明\(操作\)/g, "")
        .replace(/照明操作/g, "");
      if (withoutSousa.includes("照明")) return true;
    } else if (role === "照明（操作）") {
      if (raw.includes("照明（操作）") || raw.includes("照明(操作)") || raw.includes("照明操作")) {
        return true;
      }
      const withoutSetsuei = raw
        .replace(/照明（設営）/g, "")
        .replace(/照明\(設営\)/g, "")
        .replace(/照明設営/g, "");
      if (withoutSetsuei.includes("照明")) return true;
    } else if (role === "PA（設営）") {
      if (raw.includes("PA（設営）") || raw.includes("PA(設営)") || raw.includes("PA設営")) {
        return true;
      }
      const withoutTaku = raw
        .replace(/PA（卓）/g, "")
        .replace(/PA\(卓\)/g, "")
        .replace(/PA卓/g, "");
      if (withoutTaku.includes("PA")) return true;
    } else if (role === "PA（卓）") {
      if (raw.includes("PA（卓）") || raw.includes("PA(卓)") || raw.includes("PA卓")) {
        return true;
      }
      const withoutSetsuei = raw
        .replace(/PA（設営）/g, "")
        .replace(/PA\(設営\)/g, "")
        .replace(/PA設営/g, "");
      if (withoutSetsuei.includes("PA")) return true;
    } else if (role === "文連") {
      if (raw.includes("文連")) return true;
    } else if (role.endsWith("（パトリ）")) {
      const partName = role.replace("（パトリ）", "");
      if (raw.includes(role) || raw.includes(`${partName}パトリ`) || raw.includes(`${partName}（パトリ）`)) {
        return true;
      }
    } else {
      if (raw.includes(role)) return true;
    }
  }

  return false;
};

// ============================================================================
// 手動追加・手動削除（マイリストから削除／マイリストに追加）を含めた最終判定
// ============================================================================
const isTaskInUserMyList = (task, memberObj) => {
  if (!task || !memberObj) return false;
  const userName = memberObj.name;
  const excluded = Array.isArray(task.manualExcludedUsers) ? task.manualExcludedUsers : [];
  const added = Array.isArray(task.manualAddedUsers) ? task.manualAddedUsers : [];

  if (excluded.includes(userName)) return false;
  if (added.includes(userName)) return true;
  return isTaskForMember(task.who, memberObj);
};

const getTargetMembersForTask = (task) => {
  if (!task) return [];
  return KANBU_ROSTER.filter((m) => isTaskInUserMyList(task, m)).map((m) => m.name);
};

const normalizeCompletedBy = (completedByRaw) => {
  if (!Array.isArray(completedByRaw)) return [];
  return completedByRaw
    .map((entry) => {
      if (typeof entry === "string") return { name: entry, time: "" };
      if (entry && typeof entry === "object" && entry.name) {
        return { name: String(entry.name), time: String(entry.time || "") };
      }
      return null;
    })
    .filter(Boolean);
};

const isCompletedByUser = (task, userName) => {
  if (!task || !userName) return false;
  const list = normalizeCompletedBy(task.completedBy);
  return list.some((entry) => entry.name === userName);
};

const buildWhoString = (selectedNames, selectedRoles, freeText) => {
  const parts = [...selectedNames, ...selectedRoles];
  const cleanFree = (freeText || "").trim();
  if (parts.length > 0 && cleanFree) return `${parts.join("・")}（${cleanFree}）`;
  if (parts.length > 0) return parts.join("・");
  if (cleanFree) return cleanFree;
  return "未定（全体）";
};

const buildWhenString = (selectedDates, freeText) => {
  const formattedDates = selectedDates.map(formatDateLabel);
  const cleanFree = (freeText || "").trim();
  if (formattedDates.length > 0 && cleanFree) return `${formattedDates.join("・")} ${cleanFree}`;
  if (formattedDates.length > 0) return formattedDates.join("・");
  if (cleanFree) return cleanFree;
  return "順次";
};

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
    return num;
  }
  return 0;
};

const compareItems = (a, b, mode) => {
  if (mode === "added_asc") return getAddedOrderValue(a) - getAddedOrderValue(b);
  if (mode === "added_desc") return getAddedOrderValue(b) - getAddedOrderValue(a);
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

const isLongContent = (text) => {
  if (!text) return false;
  const lines = String(text).split("\n");
  return String(text).length > 75 || lines.length >= 3;
};

// --- 重要度セレクター ---
function ImportanceSelector({ value, onChange, label = "重要度（1〜5 / なし）" }) {
  const currentVal = Number(value) || 0;
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1 ${
                active
                  ? opt.activeBtnClass + " shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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

function ImportanceBadge({ importance }) {
  const num = Number(importance) || 0;
  if (num <= 0) return null;
  const meta = getImportanceMeta(num);
  return (
    <span className={`font-bold text-xs px-2.5 py-0.5 rounded-lg border inline-flex items-center ${meta.badgeClass}`}>
      {meta.short}
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
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ day: d, iso: `${viewYear}-${mm}-${dd}` });
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-bold text-slate-800">
          {viewYear}年 {viewMonth + 1}月
        </span>
        <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-white rounded-lg text-slate-600">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} className="h-8" />;
          const isSelected = selectedDates.includes(cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onToggleDate(cell.iso)}
              className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                isSelected ? "bg-indigo-600 text-white shadow-xs" : "bg-white hover:bg-indigo-50 text-slate-700"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      {selectedDates.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {selectedDates.map((d) => (
              <span key={d} className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md text-xs font-bold">
                {formatDateLabel(d)}
              </span>
            ))}
          </div>
          <button type="button" onClick={onClearDates} className="text-xs text-red-600 font-bold ml-2">
            クリア
          </button>
        </div>
      )}
    </div>
  );
}

// --- 「誰が」選択＋自由記述コンポーネント ---
function WhoSelector({ selectedNames, setSelectedNames, selectedRoles, setSelectedRoles, freeText, setFreeText }) {
  const [openPicker, setOpenPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState("names");

  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) setList(list.filter((x) => x !== item));
    else setList([...list, item]);
  };

  const previewText = buildWhoString(selectedNames, selectedRoles, freeText);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Users size={15} className="text-indigo-600" />
          <span>誰が（名前・役職を選択 または 自由記述）</span>
        </label>
        <button
          type="button"
          onClick={() => setOpenPicker(!openPicker)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
        >
          {openPicker ? "▲ 選択リストを閉じる" : "▼ 名前・役職リストから選ぶ（複数可）"}
        </button>
      </div>

      {(selectedNames.length > 0 || selectedRoles.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
          {selectedNames.map((n) => (
            <span
              key={`n-${n}`}
              onClick={() => toggleItem(selectedNames, setSelectedNames, n)}
              className="cursor-pointer bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
            >
              👤 {n} <X size={12} />
            </span>
          ))}
          {selectedRoles.map((r) => (
            <span
              key={`r-${r}`}
              onClick={() => toggleItem(selectedRoles, setSelectedRoles, r)}
              className="cursor-pointer bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
            >
              🏷️ {r} <X size={12} />
            </span>
          ))}
          <button
            type="button"
            onClick={() => { setSelectedNames([]); setSelectedRoles([]); }}
            className="text-xs text-red-600 font-bold hover:underline ml-auto"
          >
            全解除
          </button>
        </div>
      )}

      {openPicker && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-3">
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setPickerTab("names")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                pickerTab === "names" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              👤 名前から選ぶ（20名）
            </button>
            <button
              type="button"
              onClick={() => setPickerTab("roles")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                pickerTab === "roles" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              🏷️ 役職から選ぶ
            </button>
          </div>

          {pickerTab === "names" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
              {KANBU_ROSTER.map((m) => {
                const active = selectedNames.includes(m.name);
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => toggleItem(selectedNames, setSelectedNames, m.name)}
                    className={`p-2.5 rounded-xl text-left text-xs font-bold border transition flex items-start justify-between gap-1 ${
                      active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="break-words">{m.name}</div>
                      <div className={`text-[10px] leading-snug break-words mt-0.5 ${active ? "text-indigo-100" : "text-slate-400"}`}>
                        {m.roles.join("・")}
                      </div>
                    </div>
                    {active && <Check size={13} className="shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto">
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
                            active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 border-slate-200"
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

      <input
        type="text"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        placeholder="自由記述（選択なしでここだけ入力、または選択＋補足記述もOK）"
        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="text-xs text-slate-500 break-words">
        表示プレビュー: <strong className="text-indigo-700">{previewText}</strong>
      </div>
    </div>
  );
}

// --- 「いつまで」カレンダー選択＋自由記述コンポーネント ---
function WhenSelector({ selectedDates, setSelectedDates, freeText, setFreeText }) {
  const [openCal, setOpenCal] = useState(false);

  const toggleDate = (iso) => {
    if (selectedDates.includes(iso)) setSelectedDates(selectedDates.filter((d) => d !== iso));
    else setSelectedDates([...selectedDates, iso].sort());
  };

  const previewText = buildWhenString(selectedDates, freeText);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Calendar size={15} className="text-amber-600" />
          <span>いつまでに（カレンダー選択 または 自由記述）</span>
        </label>
        <button
          type="button"
          onClick={() => setOpenCal(!openCal)}
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition"
        >
          {openCal ? "▲ カレンダーを閉じる" : "📅 カレンダーから日付を選ぶ"}
        </button>
      </div>

      {openCal && (
        <CalendarSelector
          selectedDates={selectedDates}
          onToggleDate={toggleDate}
          onClearDates={() => setSelectedDates([])}
        />
      )}

      <input
        type="text"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        placeholder="自由記述（例：次回会議まで / 19:00まで ※日付選択と併用・これだけでもOK）"
        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <div className="text-xs text-slate-500 break-words">
        表示プレビュー: <strong className="text-amber-800">{previewText}</strong>
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
          tasks: upgradeTasksForKizaiKonyu(parsed.tasks),
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : INITIAL_STATE.decisions,
          memos: parsed.memos && typeof parsed.memos === "object" ? parsed.memos : {},
          logs: Array.isArray(parsed.logs) ? parsed.logs : INITIAL_STATE.logs,
          loginLogs: Array.isArray(parsed.loginLogs) ? parsed.loginLogs : [],
          lastModified: parsed.lastModified || 0
        };
      }
    } catch (e) {}
    return INITIAL_STATE;
  });

  const [syncStatus, setSyncStatus] = useState("connecting");

  // メインタブ: 'mypage' | 'tasks' | 'decisions' | 'logs'
  const [activeTab, setActiveTab] = useState("mypage");
  // マイページ内のサブタブ: 'todo' (未完了) | 'done' (完了済み) | 'memo' (自由メモ)
  const [myPageSubTab, setMyPageSubTab] = useState("todo");
  // 全体ToDoタブ内のサブタブ: 'todo' (未完了) | 'done' (完了済み)
  const [taskSubTab, setTaskSubTab] = useState("todo");
  // 管理者タブ内のサブタブ: 'login' (ログイン履歴) | 'edit' (変更履歴)
  const [adminLogSubTab, setAdminLogSubTab] = useState("login");

  // 検索・フィルターパネルの開閉
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWho, setFilterWho] = useState("ALL");
  const [filterImportance, setFilterImportance] = useState("ALL");

  // 並び替えモード
  const [todoSortMode, setTodoSortMode] = useState("manual");
  const [doneSortMode, setDoneSortMode] = useState("manual");
  const [decisionSortMode, setDecisionSortMode] = useState("manual");

  // 決定事項カテゴリの開閉状態
  const [collapsedCats, setCollapsedCats] = useState({});

  // 長文カードの「▼ 全文・詳細を開く」展開状態管理 & 詳細ポップアップモーダル
  const [expandedItemIds, setExpandedItemIds] = useState({});
  const [detailModalItem, setDetailModalItem] = useState(null);

  // 複数人ToDoの「自分だけ完了 ／ 全体完了 ／ 未完了に戻す」選択モーダル
  const [taskCompletionModal, setTaskCompletionModal] = useState(null);

  // ToDo削除時の「マイリストから削除 ／ 全体から完全に削除」選択モーダル
  const [taskDeleteModal, setTaskDeleteModal] = useState(null);

  // ポップアップモーダル制御
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showAddDecisionModal, setShowAddDecisionModal] = useState(false);
  const [showAddMemoModal, setShowAddMemoModal] = useState(false);
  const [showRoleTableModal, setShowRoleTableModal] = useState(false);
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
  const [editingDec, setEditingDec] = useState(null);

  // マイページ：自由メモ用
  const [newMemoTitle, setNewMemoTitle] = useState("");
  const [newMemoBody, setNewMemoBody] = useState("");
  const [editingMemoId, setEditingMemoId] = useState(null);
  const [editMemoForm, setEditMemoForm] = useState({ title: "", body: "" });

  const broadcastChannelRef = useRef(null);
  const sessionAccessLoggedRef = useRef(false);

  const currentUser = authInfo?.userName || "";
  const isAdmin = currentUser === ADMIN_USER;

  const currentMemberObj = useMemo(
    () => KANBU_ROSTER.find((m) => m.name === currentUser) || KANBU_ROSTER[0],
    [currentUser]
  );

  const toggleExpandItem = (id) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ワンクッション確認ダイアログ
  const requestConfirm = ({
    title,
    message,
    confirmLabel = "OK（実行する）",
    confirmColor = "bg-indigo-600 hover:bg-indigo-700",
    onConfirm
  }) => {
    setConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm });
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
            tasks: upgradeTasksForKizaiKonyu(data.tasks),
            decisions: data.decisions,
            memos: data.memos && typeof data.memos === "object" ? data.memos : {},
            logs: Array.isArray(data.logs) ? data.logs : [],
            loginLogs: Array.isArray(data.loginLogs) ? data.loginLogs : [],
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
      const bc = new BroadcastChannel("wpb_kanbu_sync_realtime_v10");
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
          if (parsed && Array.isArray(parsed.tasks)) setBoardState(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener("storage", onStorage);

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") fetchLatestNow();
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
              tasks: upgradeTasksForKizaiKonyu(data.tasks),
              decisions: data.decisions,
              memos: data.memos && typeof data.memos === "object" ? data.memos : {},
              logs: Array.isArray(data.logs) ? data.logs : [],
              loginLogs: Array.isArray(data.loginLogs) ? data.loginLogs : [],
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
      () => setSyncStatus("local")
    );

    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
    };
  }, []);

  // 状態更新＆クラウド同期
  const commitState = (nextState, logMessage, activeUserName = currentUser, customLoginLogEntry = null) => {
    const nowTs = Date.now();
    const nextLogs = logMessage
      ? [
          {
            id: "log-" + nowTs,
            user: activeUserName || "メンバー",
            action: logMessage,
            time: formatNow()
          },
          ...(nextState.logs || boardState.logs || [])
        ].slice(0, 120)
      : nextState.logs || boardState.logs || [];

    const nextLoginLogs = customLoginLogEntry
      ? [customLoginLogEntry, ...(nextState.loginLogs || boardState.loginLogs || [])].slice(0, 150)
      : nextState.loginLogs || boardState.loginLogs || [];

    const updated = {
      tasks: nextState.tasks || boardState.tasks,
      decisions: nextState.decisions || boardState.decisions,
      memos: nextState.memos || boardState.memos || {},
      logs: nextLogs,
      loginLogs: nextLoginLogs,
      lastModified: nowTs
    };

    setBoardState(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    if (broadcastChannelRef.current) {
      try { broadcastChannelRef.current.postMessage(updated); } catch (e) {}
    }

    if (db) {
      setSyncStatus("saving");
      setDoc(doc(db, SYNC_COLLECTION, SYNC_DOC_ID), updated)
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("local"));
    }
  };

  // --- ログイン履歴記録 ---
  const recordLoginEvent = async (userName, typeLabel = "ログイン") => {
    const nowTs = Date.now();
    const loginEntry = {
      id: "login-" + nowTs,
      user: userName,
      type: typeLabel,
      time: formatNow(),
      timestamp: nowTs
    };

    if (db) {
      try {
        const docRef = doc(db, SYNC_COLLECTION, SYNC_DOC_ID);
        const snap = await getDoc(docRef);
        const baseData = snap.exists() ? snap.data() : boardState;
        const nextLoginLogs = [loginEntry, ...(Array.isArray(baseData.loginLogs) ? baseData.loginLogs : [])].slice(0, 150);
        const nextLogs = [
          {
            id: "log-" + nowTs,
            user: userName,
            action: `${typeLabel}しました`,
            time: formatNow()
          },
          ...(Array.isArray(baseData.logs) ? baseData.logs : [])
        ].slice(0, 120);

        const updated = {
          tasks: upgradeTasksForKizaiKonyu(Array.isArray(baseData.tasks) ? baseData.tasks : boardState.tasks),
          decisions: Array.isArray(baseData.decisions) ? baseData.decisions : boardState.decisions,
          memos: baseData.memos && typeof baseData.memos === "object" ? baseData.memos : boardState.memos,
          logs: nextLogs,
          loginLogs: nextLoginLogs,
          lastModified: nowTs
        };
        setBoardState(updated);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        await setDoc(docRef, updated);
        setSyncStatus("synced");
        return;
      } catch (e) {
        console.warn("ログイン記録エラー:", e);
      }
    }

    commitState(boardState, `${typeLabel}しました`, userName, loginEntry);
  };

  useEffect(() => {
    if (authInfo?.userName && !sessionAccessLoggedRef.current) {
      sessionAccessLoggedRef.current = true;
      const lastLoggedKey = `wpb_last_access_logged_${authInfo.userName}`;
      const lastTime = Number(sessionStorage.getItem(lastLoggedKey) || 0);
      if (Date.now() - lastTime > 5 * 60 * 1000) {
        sessionStorage.setItem(lastLoggedKey, String(Date.now()));
        recordLoginEvent(authInfo.userName, "アクセス（ログイン維持）");
      }
    }
  }, [authInfo?.userName]);

  // --- ログイン・ログアウト ---
  const handleLogin = (nameToLogin) => {
    if (!nameToLogin) return;
    const now = Date.now();
    const newAuth = { userName: nameToLogin, loginAt: now, expiresAt: now + LOGIN_DURATION_MS };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth));
    sessionStorage.setItem(`wpb_last_access_logged_${nameToLogin}`, String(now));
    sessionAccessLoggedRef.current = true;
    setAuthInfo(newAuth);
    recordLoginEvent(nameToLogin, "ログイン");
  };

  const handleLogout = () => {
    requestConfirm({
      title: "ログアウト（名前切替）の確認",
      message: `現在「${currentUser}」でログイン中です。ログアウトして名前選択画面に戻りますか？`,
      confirmLabel: "ログアウトする",
      confirmColor: "bg-red-600 hover:bg-red-700",
      onConfirm: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthInfo(null);
        setSelectedLoginCandidate("");
        setActiveTab("mypage");
      }
    });
  };

  // =========================================================================
  // マイリストへの手動追加 ＆ 削除（マイリストから削除 ／ 全体から完全削除）
  // =========================================================================
  const handleAddToMyList = (task) => {
    if (!task || !currentUser) return;
    requestConfirm({
      title: "マイリストへの追加確認",
      message: `以下のToDoを「${currentUser}」のマイリスト（マイToDo）に追加しますか？\n\n・担当：${task.who}\n・期限：${task.when}\n・内容：${task.what}`,
      confirmLabel: "マイリストに追加する",
      confirmColor: "bg-indigo-600 hover:bg-indigo-700",
      onConfirm: () => {
        const nextTasks = boardState.tasks.map((t) => {
          if (t.id !== task.id) return t;
          const prevAdded = Array.isArray(t.manualAddedUsers) ? t.manualAddedUsers : [];
          const prevExcluded = Array.isArray(t.manualExcludedUsers) ? t.manualExcludedUsers : [];
          const nextAdded = prevAdded.includes(currentUser) ? prevAdded : [...prevAdded, currentUser];
          const nextExcluded = prevExcluded.filter((u) => u !== currentUser);
          return {
            ...t,
            manualAddedUsers: nextAdded,
            manualExcludedUsers: nextExcluded,
            updatedBy: currentUser,
            updatedAt: formatNow()
          };
        });
        commitState(
          { ...boardState, tasks: nextTasks },
          `タスク（担当: ${task.who}）を自分のマイリストに追加しました`
        );
      }
    });
  };

  const openDeleteTaskModal = (task, defaultChoice = null) => {
    if (!task) return;
    const inMyList = isTaskInUserMyList(task, currentMemberObj);
    const initialOption = defaultChoice
      ? defaultChoice
      : inMyList
      ? "remove_mylist"
      : "delete_global";

    setTaskDeleteModal({
      task,
      inMyList,
      selectedOption: initialOption
    });
  };

  const executeTaskDeleteChoice = () => {
    if (!taskDeleteModal) return;
    const { task, selectedOption } = taskDeleteModal;
    setTaskDeleteModal(null);

    if (selectedOption === "remove_mylist") {
      requestConfirm({
        title: "【マイリストから削除】の最終確認",
        message: `以下のToDoを「${currentUser}」のマイリストからのみ削除しますか？\n\n・あなたのマイページ（マイToDo）から消えます。\n・全体のToDoリストや他のメンバーの画面にはそのまま残ります（あとから全体ToDoの「＋マイリストに追加」で戻すことも可能です）。\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "マイリストから削除する",
        confirmColor: "bg-amber-600 hover:bg-amber-700",
        onConfirm: () => {
          const nextTasks = boardState.tasks.map((t) => {
            if (t.id !== task.id) return t;
            const prevAdded = Array.isArray(t.manualAddedUsers) ? t.manualAddedUsers : [];
            const prevExcluded = Array.isArray(t.manualExcludedUsers) ? t.manualExcludedUsers : [];
            const nextAdded = prevAdded.filter((u) => u !== currentUser);
            const nextExcluded = prevExcluded.includes(currentUser)
              ? prevExcluded
              : [...prevExcluded, currentUser];
            return {
              ...t,
              manualAddedUsers: nextAdded,
              manualExcludedUsers: nextExcluded,
              updatedBy: currentUser,
              updatedAt: formatNow()
            };
          });
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）を自分のマイリストから削除しました`
          );
        }
      });
    } else if (selectedOption === "delete_global") {
      requestConfirm({
        title: "【全体のToDoリストから完全削除】の最終確認",
        message: `以下のToDoを全体のToDoリストから完全に削除しますか？\n\n⚠️ 全員の画面および全体のToDoリストから完全に消去されます。\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "全体から完全に削除する",
        confirmColor: "bg-red-600 hover:bg-red-700",
        onConfirm: () => {
          const nextTasks = boardState.tasks.filter((t) => t.id !== task.id);
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）を全体リストから削除しました`
          );
        }
      });
    }
  };

  // =========================================================================
  // タスクの完了・未完了切り替え（自分だけ完了 ／ 全体完了 の選択＆ワンクッション確認）
  // =========================================================================
  const handleToggleTask = (taskId) => {
    const target = boardState.tasks.find((t) => t.id === taskId);
    if (!target) return;

    const myPersonalDone = isCompletedByUser(target, currentUser);
    const isGlobalDone = Boolean(target.completed);

    if (!isGlobalDone && !myPersonalDone) {
      const targetMembers = getTargetMembersForTask(target);
      const isMyTask = isTaskInUserMyList(target, currentMemberObj);
      const defaultOpt = isMyTask && targetMembers.length > 1 ? "self" : isMyTask ? "self" : "all";
      setTaskCompletionModal({
        task: target,
        mode: "complete",
        selectedOption: defaultOpt
      });
      return;
    }

    if (!isGlobalDone && myPersonalDone) {
      setTaskCompletionModal({
        task: target,
        mode: "uncomplete_personal",
        selectedOption: "revert_self"
      });
      return;
    }

    if (isGlobalDone) {
      setTaskCompletionModal({
        task: target,
        mode: "uncomplete_global",
        selectedOption: "revert_all"
      });
    }
  };

  const executeTaskCompletionChoice = () => {
    if (!taskCompletionModal) return;
    const { task, selectedOption } = taskCompletionModal;
    setTaskCompletionModal(null);

    if (selectedOption === "self") {
      requestConfirm({
        title: "【自分だけ完了】の最終確認",
        message: `以下のToDoを「${currentUser}（自分）だけ完了」にしますか？\n\n・マイページの「未完了ToDo」から消え、マイページの「完了済み」へ移動します。\n・全体のToDoリストには残り、詳細画面の「個人で完了した人リスト」にあなたの名前が記録されます。\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "自分だけ完了にする",
        confirmColor: "bg-indigo-600 hover:bg-indigo-700",
        onConfirm: () => {
          const existingList = normalizeCompletedBy(task.completedBy).filter((e) => e.name !== currentUser);
          const nextCompletedBy = [...existingList, { name: currentUser, time: formatNow() }];
          const nextTasks = boardState.tasks.map((t) =>
            t.id === task.id
              ? { ...t, completedBy: nextCompletedBy, updatedBy: currentUser, updatedAt: formatNow() }
              : t
          );
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）を【個人完了（${currentUser}）】にしました`
          );
        }
      });
    } else if (selectedOption === "all") {
      requestConfirm({
        title: "【全員分（全体）を完了】の最終確認",
        message: `以下のToDoを「全員分（タスク全体）完了」にしますか？\n\n・全体のToDoリストおよび全員のマイページで「完了済み」へ移動します。\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "タスク全体を完了にする",
        confirmColor: "bg-emerald-600 hover:bg-emerald-700",
        onConfirm: () => {
          const existingList = normalizeCompletedBy(task.completedBy);
          const hasMe = existingList.some((e) => e.name === currentUser);
          const nextCompletedBy = hasMe
            ? existingList
            : [...existingList, { name: currentUser, time: formatNow() }];
          const nextTasks = boardState.tasks.map((t) =>
            t.id === task.id
              ? { ...t, completed: true, completedBy: nextCompletedBy, updatedBy: currentUser, updatedAt: formatNow() }
              : t
          );
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）を【全体完了】に移動しました`
          );
        }
      });
    } else if (selectedOption === "revert_self") {
      requestConfirm({
        title: "【マイToDo（未完了）へ戻す】最終確認",
        message: `「${currentUser}」の個人完了を取り消して、マイページの未完了ToDoリストに戻しますか？\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "未完了ToDoに戻す",
        confirmColor: "bg-blue-600 hover:bg-blue-700",
        onConfirm: () => {
          const nextCompletedBy = normalizeCompletedBy(task.completedBy).filter((e) => e.name !== currentUser);
          const nextTasks = boardState.tasks.map((t) =>
            t.id === task.id
              ? { ...t, completed: false, completedBy: nextCompletedBy, updatedBy: currentUser, updatedAt: formatNow() }
              : t
          );
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）の個人完了を取り消し、【未完了ToDo】に戻しました`
          );
        }
      });
    } else if (selectedOption === "revert_all") {
      requestConfirm({
        title: "【タスク全体を未完了ToDoへ戻す】最終確認",
        message: `以下の完了済みタスクを、全体の【やるべきことリスト（未完了ToDo）】に戻しますか？\n（※自分自身の個人完了チェックもあわせて解除されます）\n\n【対象ToDo】\n担当：${task.who}\n内容：${task.what}`,
        confirmLabel: "未完了ToDoに戻す",
        confirmColor: "bg-blue-600 hover:bg-blue-700",
        onConfirm: () => {
          const nextCompletedBy = normalizeCompletedBy(task.completedBy).filter((e) => e.name !== currentUser);
          const nextTasks = boardState.tasks.map((t) =>
            t.id === task.id
              ? { ...t, completed: false, completedBy: nextCompletedBy, updatedBy: currentUser, updatedAt: formatNow() }
              : t
          );
          commitState(
            { ...boardState, tasks: nextTasks },
            `タスク（担当: ${task.who}）を【やるべきこと（未完了）】に戻しました`
          );
        }
      });
    }
  };

  // --- 新規タスク追加・編集 ---
  const handleAddTask = (isCompleted = false) => {
    const what = newTaskWhat.trim();
    if (!what) {
      alert("「何をやるか（内容）」を入力してください。");
      return;
    }
    const who = buildWhoString(newTaskNames, newTaskRoles, newTaskWhoFree);
    const when = buildWhenString(newTaskDates, newTaskWhenFree);
    const impMeta = getImportanceMeta(newTaskImportance);

    requestConfirm({
      title: isCompleted ? "完了済みリストへの追加確認" : "ToDoの追加確認",
      message: `以下の内容で追加しますか？\n\n・誰が：${who}\n・いつまで：${when}\n・重要度：${impMeta.label}\n・内容：${what}`,
      confirmLabel: "追加する",
      confirmColor: isCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700",
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
          completedBy: [],
          manualAddedUsers: [],
          manualExcludedUsers: [],
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
        setShowAddTaskModal(false);
        commitState(
          { ...boardState, tasks: [newTask, ...boardState.tasks] },
          `タスク（担当: ${who}）を追加しました`
        );
      }
    });
  };

  const startEditTask = (t) => {
    requestConfirm({
      title: "ToDoの編集開始",
      message: `以下のToDoの編集画面を開きますか？\n\n・担当：${t.who}\n・内容：${t.what}`,
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

  const saveEditTask = () => {
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
      message: `以下の内容で保存しますか？\n\n・誰が：${finalWho}\n・いつまで：${finalWhen}\n・重要度：${impMeta.label}\n・内容：${finalWhat}`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextTasks = boardState.tasks.map((t) =>
          t.id === editingTaskId
            ? { ...t, who: finalWho, when: finalWhen, what: finalWhat, importance: finalImp, updatedBy: currentUser, updatedAt: formatNow() }
            : t
        );
        setEditingTaskId(null);
        commitState({ ...boardState, tasks: nextTasks }, `タスク（担当: ${finalWho}）を編集しました`);
      }
    });
  };

  const moveTask = (id, direction) => {
    const idx = boardState.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const targetCompleted = boardState.tasks[idx].completed;
    let swapIdx = -1;
    if (direction === -1) {
      for (let i = idx - 1; i >= 0; i--) {
        if (boardState.tasks[i].completed === targetCompleted) { swapIdx = i; break; }
      }
    } else {
      for (let i = idx + 1; i < boardState.tasks.length; i++) {
        if (boardState.tasks[i].completed === targetCompleted) { swapIdx = i; break; }
      }
    }
    if (swapIdx === -1) return;
    const nextTasks = [...boardState.tasks];
    const tmp = nextTasks[idx];
    nextTasks[idx] = nextTasks[swapIdx];
    nextTasks[swapIdx] = tmp;

    if (targetCompleted) setDoneSortMode("manual");
    else setTodoSortMode("manual");
    commitState({ ...boardState, tasks: nextTasks }, `タスクの表示順を並び替えました`);
  };

  const applyPermanentTaskSort = (isCompletedTarget, mode) => {
    const effectiveMode = mode === "manual" ? "imp_desc" : mode;
    const modeLabel = SORT_MODE_LABELS[effectiveMode] || effectiveMode;
    const listName = isCompletedTarget ? "完了済みリスト" : "やるべきことリスト（ToDo）";
    requestConfirm({
      title: "並び順の確定保存",
      message: `${listName}の並び順を「${modeLabel}」で確定し、全員の画面に保存しますか？`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const targetItems = boardState.tasks.filter((t) => Boolean(t.completed) === Boolean(isCompletedTarget));
        const otherItems = boardState.tasks.filter((t) => Boolean(t.completed) !== Boolean(isCompletedTarget));
        const sortedTarget = [...targetItems].sort((a, b) => compareItems(a, b, effectiveMode));
        const nextTasks = isCompletedTarget ? [...otherItems, ...sortedTarget] : [...sortedTarget, ...otherItems];
        if (isCompletedTarget) setDoneSortMode("manual");
        else setTodoSortMode("manual");
        commitState({ ...boardState, tasks: nextTasks }, `${listName}を「${modeLabel}」に並び替えました`);
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
      alert("メモの内容を入力してください。");
      return;
    }
    requestConfirm({
      title: "自由メモの追加確認",
      message: `自由メモ「${title}」を追加しますか？\n\n${body}`,
      confirmLabel: "追加する",
      onConfirm: () => {
        const newMemo = { id: "memo-" + Date.now(), title, body, updatedAt: formatNow() };
        const nextMemos = { ...(boardState.memos || {}), [currentUser]: [newMemo, ...userMemoList] };
        setNewMemoTitle("");
        setNewMemoBody("");
        setShowAddMemoModal(false);
        commitState({ ...boardState, memos: nextMemos }, `${currentUser}がマイページ自由メモを追加しました`);
      }
    });
  };

  const startEditMemo = (memo) => {
    requestConfirm({
      title: "自由メモの編集開始",
      message: `メモ「${memo.title}」を編集しますか？`,
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
      title: "自由メモの保存確認",
      message: `メモ「${editMemoForm.title || "メモ"}」の変更を保存しますか？`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextUserMemos = userMemoList.map((m) =>
          m.id === memoId ? { ...m, title: editMemoForm.title.trim() || "メモ", body: editMemoForm.body.trim(), updatedAt: formatNow() } : m
        );
        const nextMemos = { ...(boardState.memos || {}), [currentUser]: nextUserMemos };
        setEditingMemoId(null);
        commitState({ ...boardState, memos: nextMemos }, `${currentUser}が自由メモを編集しました`);
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
        commitState({ ...boardState, memos: nextMemos }, `${currentUser}が自由メモを削除しました`);
      }
    });
  };

  // --- 決定事項＆カテゴリ操作 ---
  const formatCategoryTitle = (raw) => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    return trimmed.startsWith("■") ? trimmed : "■ " + trimmed;
  };

  const handleAddDecision = () => {
    const customCatFormatted = formatCategoryTitle(newCustomCatName);
    const title = newDecTitle.trim();
    const content = newDecContent.trim();

    if ((selectedCatId === NEW_CAT_VALUE || showCustomCatBox) && customCatFormatted && !title && !content) {
      requestConfirm({
        title: "新しい見出しの追加確認",
        message: `新しいカテゴリ見出し「${customCatFormatted}」を追加しますか？`,
        confirmLabel: "追加する",
        onConfirm: () => {
          const newId = "cat-" + Date.now();
          const nextDecisions = [...boardState.decisions, { id: newId, category: customCatFormatted, items: [] }];
          setNewCustomCatName("");
          setShowCustomCatBox(false);
          setSelectedCatId(newId);
          setShowAddDecisionModal(false);
          commitState({ ...boardState, decisions: nextDecisions }, `カテゴリ見出し「${customCatFormatted}」を追加しました`);
        }
      });
      return;
    }

    if (!title && !content) {
      alert("「項目名」または「決まった内容」を入力してください。");
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
            alert("新しいカテゴリ名を入力してください。");
            return;
          }
          const existing = nextDecisions.find((c) => c.category === customCatFormatted);
          if (existing) targetCatId = existing.id;
          else {
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
        setShowAddDecisionModal(false);
        commitState({ ...boardState, decisions: nextDecisions }, `決定事項「${cleanTitle}」を追加しました`);
      }
    });
  };

  const startEditDecision = (catId, item) => {
    requestConfirm({
      title: "決定事項の編集開始",
      message: `以下の決定事項の編集画面を開きますか？\n\n・項目名：${item.title}\n・内容：${item.content}`,
      confirmLabel: "編集する",
      onConfirm: () => {
        setEditingDec({
          catId,
          id: item.id,
          title: item.title,
          content: item.content,
          importance: Number(item.importance) || 0
        });
      }
    });
  };

  const saveEditDecision = () => {
    if (!editingDec) return;
    if (!editingDec.title.trim() && !editingDec.content.trim()) {
      alert("内容を入力してください。");
      return;
    }
    const cleanTitle = editingDec.title.trim().replace(/[：:]$/, "");
    const finalImp = Number(editingDec.importance) || 0;
    const impMeta = getImportanceMeta(finalImp);

    requestConfirm({
      title: "決定事項の保存確認",
      message: `決定事項「${cleanTitle}」（重要度: ${impMeta.label}）を保存しますか？\n\n${editingDec.content.trim()}`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.map((cat) =>
          cat.id !== editingDec.catId
            ? cat
            : {
                ...cat,
                items: cat.items.map((it) =>
                  it.id === editingDec.id
                    ? { ...it, title: cleanTitle, content: editingDec.content.trim(), importance: finalImp, updatedBy: currentUser, updatedAt: formatNow() }
                    : it
                )
              }
        );
        setEditingDec(null);
        commitState({ ...boardState, decisions: nextDecisions }, `決定事項「${cleanTitle}」を編集しました`);
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
        commitState({ ...boardState, decisions: nextDecisions }, `決定事項「${title}」を削除しました`);
      }
    });
  };

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

    const nextDecisions = boardState.decisions.map((c) => (c.id === catId ? { ...c, items: nextItems } : c));
    setDecisionSortMode("manual");
    commitState({ ...boardState, decisions: nextDecisions }, `決定事項「${tmp.title}」の順序を移動しました`);
  };

  const moveCategory = (catId, direction) => {
    const idx = boardState.decisions.findIndex((c) => c.id === catId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= boardState.decisions.length) return;

    const nextDecisions = [...boardState.decisions];
    const tmp = nextDecisions[idx];
    nextDecisions[idx] = nextDecisions[targetIdx];
    nextDecisions[targetIdx] = tmp;
    commitState({ ...boardState, decisions: nextDecisions }, `カテゴリ「${tmp.category}」の順序を移動しました`);
  };

  const applyPermanentDecisionSort = (mode) => {
    const effectiveMode = mode === "manual" ? "imp_desc" : mode;
    const modeLabel = SORT_MODE_LABELS[effectiveMode] || effectiveMode;
    requestConfirm({
      title: "決定事項の並び順を確定保存",
      message: `各カテゴリ内の決定事項を「${modeLabel}」で並び替えて保存しますか？`,
      confirmLabel: "保存する",
      onConfirm: () => {
        const nextDecisions = boardState.decisions.map((cat) => ({
          ...cat,
          items: [...cat.items].sort((a, b) => compareItems(a, b, effectiveMode))
        }));
        setDecisionSortMode("manual");
        commitState({ ...boardState, decisions: nextDecisions }, `決定事項を「${modeLabel}」に並び替えました`);
      }
    });
  };

  const editCategoryName = (catId, currentName) => {
    requestConfirm({
      title: "見出し名の編集確認",
      message: `カテゴリ見出し「${currentName}」の名前を変更しますか？`,
      confirmLabel: "変更する",
      onConfirm: () => {
        const nextName = window.prompt("新しい見出し名を入力してください：", currentName);
        if (!nextName || !nextName.trim()) return;
        const formatted = formatCategoryTitle(nextName);
        const nextDecisions = boardState.decisions.map((cat) =>
          cat.id === catId ? { ...cat, category: formatted } : cat
        );
        commitState({ ...boardState, decisions: nextDecisions }, `見出しを「${formatted}」に変更しました`);
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
        commitState({ ...boardState, decisions: nextDecisions }, `カテゴリ「${currentName}」を削除しました`);
      }
    });
  };

  const exportWordDoc = () => {
    const todoList = boardState.tasks.filter((t) => !t.completed);
    const doneList = boardState.tasks.filter((t) => t.completed);
    const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

    let decHtml = "";
    boardState.decisions.forEach((cat) => {
      decHtml += `<h3 style="color:#2b579a;margin-top:12pt;margin-bottom:4pt;">${esc(cat.category)}</h3><ul>`;
      cat.items.forEach((it) => {
        const imp = Number(it.importance) || 0;
        const impText = imp > 0 ? `<span style="color:#c62828;font-weight:bold;">[★${imp}] </span>` : "";
        decHtml += `<li style="margin-bottom:4pt;">${impText}<b>${esc(it.title)}：</b>${esc(it.content)}</li>`;
      });
      decHtml += `</ul>`;
    });

    const makeRows = (arr, symbol) =>
      arr.map((t) => {
        const imp = Number(t.importance) || 0;
        const impLabel = imp > 0 ? `★${imp}` : "-";
        const pDone = normalizeCompletedBy(t.completedBy).map((e) => e.name).join(", ");
        const pDoneHtml = pDone ? `<br><span style="color:#2e7d32;font-size:8.5pt;">[個人完了: ${esc(pDone)}]</span>` : "";
        return `<tr><td style="text-align:center;width:32pt;">${symbol}</td><td style="text-align:center;width:40pt;font-weight:bold;">${impLabel}</td><td style="font-weight:bold;width:105pt;">${esc(t.who)}${pDoneHtml}</td><td style="width:90pt;">${esc(t.when)}</td><td>${esc(t.what)}</td></tr>`;
      }).join("");

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>WPB 幹部代会議 まとめ</title>
      <style>body{font-family:"Meiryo",sans-serif;font-size:10pt;}h1{font-size:15pt;color:#1b365d;text-align:center;}h2{font-size:12.5pt;color:#1b365d;border-bottom:2px solid #1b365d;padding-bottom:3pt;margin-top:16pt;}table{border-collapse:collapse;width:100%;margin-top:6pt;}th,td{border:1px solid #888;padding:5pt;vertical-align:top;font-size:9.5pt;}th{background:#1b365d;color:#fff;}</style></head>
      <body>
        <h1>WPB 幹部代会議 決定事項・ToDoまとめ</h1>
        <h2>1. やるべきことリスト（ToDo）</h2>
        <table><tr><th>状態</th><th>重要度</th><th>誰が</th><th>いつまでに</th><th>内容</th></tr>${makeRows(todoList, "☐")}</table>
        <h2>2. 完了済みリスト</h2>
        <table><tr><th>状態</th><th>重要度</th><th>誰が</th><th>いつまでに</th><th>内容</th></tr>${makeRows(doneList, "☑")}</table>
        <h2>3. 今まで決まったこと</h2>
        ${decHtml}
      </body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "WPB_幹部代会議_決定事項・ToDoまとめ.doc";
    a.click();
  };

  // --- フィルタリング＆ソート集計 ---
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
      const matchQ = !q || t.who.toLowerCase().includes(q) || t.when.toLowerCase().includes(q) || t.what.toLowerCase().includes(q);
      return matchWho && matchImp && matchQ;
    };

    // 全体リスト
    let todos = boardState.tasks.filter((t) => !t.completed && matchTask(t));
    let dones = boardState.tasks.filter((t) => t.completed && matchTask(t));

    // マイページリスト（自動判定 ＋ 手動マイリスト追加 − 手動マイリスト削除 を反映）
    let myTodos = boardState.tasks.filter((t) => {
      if (!isTaskInUserMyList(t, currentMemberObj)) return false;
      const doneForMe = Boolean(t.completed) || isCompletedByUser(t, currentUser);
      if (doneForMe) return false;
      return matchImportanceFilter(t.importance) && (!q || t.what.toLowerCase().includes(q) || t.who.toLowerCase().includes(q));
    });

    let myDones = boardState.tasks.filter((t) => {
      const excluded = Array.isArray(t.manualExcludedUsers) ? t.manualExcludedUsers : [];
      if (excluded.includes(currentUser)) return false;
      const inMyList = isTaskInUserMyList(t, currentMemberObj);
      const doneByMe = isCompletedByUser(t, currentUser);
      if (!inMyList && !doneByMe) return false;
      const doneForMe = Boolean(t.completed) || doneByMe;
      if (!doneForMe) return false;
      return matchImportanceFilter(t.importance) && (!q || t.what.toLowerCase().includes(q) || t.who.toLowerCase().includes(q));
    });

    if (todoSortMode !== "manual") {
      todos = [...todos].sort((a, b) => compareItems(a, b, todoSortMode));
      myTodos = [...myTodos].sort((a, b) => compareItems(a, b, todoSortMode));
    }
    if (doneSortMode !== "manual") {
      dones = [...dones].sort((a, b) => compareItems(a, b, doneSortMode));
      myDones = [...myDones].sort((a, b) => compareItems(a, b, doneSortMode));
    }

    const decCount = boardState.decisions.reduce((acc, c) => acc + c.items.length, 0);
    return { todoList: todos, doneList: dones, myTodoList: myTodos, myDoneList: myDones, totalDecisions: decCount };
  }, [boardState, searchQuery, filterWho, filterImportance, currentMemberObj, currentUser, todoSortMode, doneSortMode]);

  const allUncompletedCount = boardState.tasks.filter((t) => !t.completed).length;
  const allCompletedCount = boardState.tasks.filter((t) => t.completed).length;
  const hasActiveFilter = Boolean(searchQuery || filterWho !== "ALL" || filterImportance !== "ALL");

  // メンバー別の最終ログイン状況集計（管理者用）
  const memberLastLoginMap = useMemo(() => {
    const map = {};
    for (const log of boardState.loginLogs || []) {
      if (log.user && !map[log.user]) {
        map[log.user] = log;
      }
    }
    return map;
  }, [boardState.loginLogs]);

  // --- タスクカード（マイリストへの追加・マイリストからの削除・個人完了リスト対応） ---
  const renderTaskCard = (t, isMyPageContext = false) => {
    const imp = Number(t.importance) || 0;
    const isLong = isLongContent(t.what);
    const isExpanded = Boolean(expandedItemIds[t.id]);
    const personalDoneList = normalizeCompletedBy(t.completedBy);
    const myPersonalDone = isCompletedByUser(t, currentUser);
    const inMyList = isTaskInUserMyList(t, currentMemberObj);
    const isManuallyAdded = Array.isArray(t.manualAddedUsers) && t.manualAddedUsers.includes(currentUser);
    const isCheckedVisually = isMyPageContext ? (Boolean(t.completed) || myPersonalDone) : Boolean(t.completed);

    return (
      <div
        key={t.id}
        className={`border rounded-2xl p-4 transition shadow-2xs flex items-start gap-3 ${
          isCheckedVisually
            ? "bg-emerald-50/30 border-emerald-200"
            : imp === 5
            ? "bg-rose-50/40 border-rose-200"
            : imp === 4
            ? "bg-orange-50/30 border-orange-200"
            : "bg-white border-slate-200 hover:border-indigo-200"
        }`}
      >
        <button
          type="button"
          onClick={() => handleToggleTask(t.id)}
          className={`mt-0.5 p-0.5 transition shrink-0 ${
            isCheckedVisually
              ? "text-emerald-600 hover:text-slate-500"
              : myPersonalDone
              ? "text-indigo-600 hover:text-emerald-600"
              : "text-slate-300 hover:text-emerald-600"
          }`}
          title={
            isCheckedVisually
              ? "クリックして未完了（ToDo）に戻す（確認あり）"
              : "クリックして完了（自分だけ完了 / 全体完了）を選択"
          }
        >
          {isCheckedVisually || myPersonalDone ? (
            <CheckCircle2 size={24} />
          ) : (
            <Circle size={24} strokeWidth={2} />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* 上段：バッジと操作ボタン */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <ImportanceBadge importance={t.importance} />
              <span
                className={`font-bold text-xs px-2.5 py-1 rounded-lg break-words ${
                  t.completed ? "bg-emerald-100 text-emerald-900" : "bg-indigo-50 text-indigo-900"
                }`}
              >
                👤 {t.who}
              </span>
              <span className="bg-amber-50 text-amber-900 border border-amber-200/80 font-bold text-xs px-2.5 py-1 rounded-lg break-words">
                ⏰ {t.when}
              </span>
              {!t.completed && myPersonalDone && (
                <span className="bg-emerald-600 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full">
                  ✓ 自分は完了済（全体は未完了）
                </span>
              )}
              {isManuallyAdded && (
                <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] px-2 py-0.5 rounded-lg">
                  📌 マイリスト手動追加
                </span>
              )}
            </div>

            {/* 操作ボタン */}
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setDetailModalItem({ type: "task", data: t })}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                title="詳細・個人完了した人リストを見る"
              >
                <Maximize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveTask(t.id, -1)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                title="上へ移動"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => moveTask(t.id, 1)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                title="下へ移動"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                onClick={() => startEditTask(t)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                title="編集"
              >
                <Edit2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => openDeleteTaskModal(t)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                title="削除（マイリストからのみ削除 / 全体から削除 を選択可能）"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* 個人完了しているメンバーがいる場合のサマリー表示 */}
          {personalDoneList.length > 0 && (
            <div
              onClick={() => setDetailModalItem({ type: "task", data: t })}
              className="flex flex-wrap items-center gap-1.5 bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-emerald-100/70 transition"
            >
              <UserCheck size={14} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-bold text-emerald-900">
                個人完了済 ({personalDoneList.length}名):
              </span>
              {personalDoneList.map((entry) => (
                <span
                  key={entry.name}
                  className="bg-white text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-md"
                >
                  ✓ {entry.name}
                </span>
              ))}
              <span className="text-[11px] text-emerald-700 underline ml-auto">詳細を見る</span>
            </div>
          )}

          {/* 下段：本文 */}
          <div
            onClick={() => {
              if (isLong) toggleExpandItem(t.id);
              else setDetailModalItem({ type: "task", data: t });
            }}
            className="cursor-pointer rounded-xl p-1 -m-1 hover:bg-slate-50/80 transition"
          >
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                t.completed ? "line-through text-slate-500" : "text-slate-800"
              } ${isLong && !isExpanded ? "line-clamp-2" : ""}`}
            >
              {t.what}
            </p>
          </div>

          {/* 展開時に個人完了リストもその場で表示 */}
          {isExpanded && personalDoneList.length > 0 && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-1.5">
              <div className="text-xs font-bold text-emerald-900">
                ✅ このToDoを個人で完了した人リスト（{personalDoneList.length}名）
              </div>
              <div className="flex flex-wrap gap-1.5">
                {personalDoneList.map((entry) => (
                  <span
                    key={entry.name}
                    className="bg-white border border-emerald-200 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg"
                  >
                    ✓ {entry.name} {entry.time && <span className="text-[10px] text-slate-400">({entry.time})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* アクションバー */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {isLong && (
                <button
                  type="button"
                  onClick={() => toggleExpandItem(t.id)}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={14} />
                      <span>折りたたむ</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      <span>全文・詳細を開く</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setDetailModalItem({ type: "task", data: t })}
                className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
              >
                <Maximize2 size={12} />
                <span>詳細・完了者一覧</span>
              </button>

              {!inMyList && (
                <button
                  type="button"
                  onClick={() => handleAddToMyList(t)}
                  className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                  title="このToDoを自分のマイリスト（マイToDo）に追加します"
                >
                  <BookmarkPlus size={13} />
                  <span>＋ マイリストに追加</span>
                </button>
              )}

              {inMyList && isMyPageContext && (
                <button
                  type="button"
                  onClick={() => openDeleteTaskModal(t, "remove_mylist")}
                  className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                  title="全体のToDoには残したまま、自分のマイリストからのみ外します"
                >
                  <BookmarkMinus size={13} />
                  <span>マイリストから削除</span>
                </button>
              )}

              {inMyList && !isMyPageContext && (
                <button
                  type="button"
                  onClick={() => openDeleteTaskModal(t, "remove_mylist")}
                  className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-amber-50 hover:text-amber-800 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                  title="現在あなたのマイリストに入っています（タップするとマイリストから外せます）"
                >
                  <BookmarkCheck size={13} />
                  <span>マイリスト内（外す）</span>
                </button>
              )}

              {isCheckedVisually && (
                <button
                  type="button"
                  onClick={() => handleToggleTask(t.id)}
                  className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  <RotateCcw size={12} />
                  <span>未完了(ToDo)に戻す</span>
                </button>
              )}
            </div>

            {t.updatedBy && t.updatedBy !== "初期データ" && (
              <div className="text-[11px] text-slate-400 ml-auto">
                更新: {t.updatedBy} ({t.updatedAt})
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- コンパクトな並び替え＆絞り込みバー ---
  const renderCompactControlBar = ({ sortMode, setSortMode, onPermanentSort, includeWhoSort = true }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[210px]">
          <span className="text-xs font-bold text-slate-500 shrink-0">並び順:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="manual">↕️ 手動順（↑↓ボタンで移動）</option>
            <option value="added_asc">🕒 追加順（昇順：古い→新しい）</option>
            <option value="added_desc">🕒 追加順（降順：新しい→古い）</option>
            <option value="imp_desc">★ 重要度が高い順（★5→なし）</option>
            <option value="imp_asc">★ 重要度が低い順（★1→なし）</option>
            {includeWhoSort && <option value="who_asc">👤 担当者名順</option>}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {sortMode !== "manual" && onPermanentSort && (
            <button
              type="button"
              onClick={() => onPermanentSort(sortMode)}
              className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-xl hover:bg-indigo-100 transition"
            >
              ⚡ この順番で全体に保存
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
              showFilterBar || hasActiveFilter
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>検索・絞り込み{hasActiveFilter ? " (適用中)" : ""}</span>
          </button>
        </div>
      </div>

      {(showFilterBar || hasActiveFilter) && (
        <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワード検索..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <select
            value={filterWho}
            onChange={(e) => setFilterWho(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="ALL">👤 担当者：すべて表示</option>
            <option value="全員">幹部代全員</option>
            <option value="機材購入担当">機材購入担当（会計・機材統括）</option>
            {KANBU_ROSTER.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}（{m.roles[0]}）
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <select
              value={filterImportance}
              onChange={(e) => setFilterImportance(e.target.value)}
              className="flex-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900"
            >
              <option value="ALL">★ 重要度：すべて</option>
              <option value="5">★5（最優先）のみ</option>
              <option value="4_UP">★4以上</option>
              <option value="3_UP">★3以上</option>
              <option value="HAS_IMP">★重要度ありのみ</option>
              <option value="NONE">重要度なしのみ</option>
            </select>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setFilterWho("ALL"); setFilterImportance("ALL"); }}
                className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold shrink-0"
              >
                リセット
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // =========================================================================
  // 未ログイン時のログイン画面
  // =========================================================================
  if (!authInfo) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-sm">
              W
            </div>
            <h1 className="text-xl font-bold text-slate-900">WPB 幹部代Sync ログイン</h1>
            <p className="text-xs text-slate-500">
              自分の名前を選んでログインしてください（1ヶ月間ログインが維持されます）
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[55vh] overflow-y-auto p-1">
            {KANBU_ROSTER.map((member) => {
              const selected = selectedLoginCandidate === member.name;
              return (
                <button
                  key={member.name}
                  type="button"
                  onClick={() => setSelectedLoginCandidate(member.name)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    selected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-indigo-50"
                  }`}
                >
                  <div className="font-bold text-sm break-words flex items-center gap-1">
                    <span>{member.name}</span>
                  </div>
                  <div className={`text-[10px] leading-snug break-words mt-1 ${selected ? "text-indigo-100" : "text-slate-500"}`}>
                    {member.roles.join(" / ")}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!selectedLoginCandidate}
            onClick={() => handleLogin(selectedLoginCandidate)}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-sm transition ${
              selectedLoginCandidate
                ? "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {selectedLoginCandidate ? `「${selectedLoginCandidate}」でログインする` : "名前を選択してください"}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // メイン画面
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-24 font-sans">
      {/* ヘッダー */}
      <header className="bg-indigo-900 text-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-bold text-sm shrink-0">
              W
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold">WPB 幹部代Sync</h1>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                  {syncStatus === "synced" ? "🟢 同期済" : syncStatus === "saving" ? "⚡ 同期中" : "🟡 保存済"}
                </span>
                {isAdmin && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Crown size={11} />
                    <span>管理者</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchLatestNow}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-xs transition"
              title="今すぐ最新データを同期"
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              onClick={() => setShowRoleTableModal(true)}
              className="bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              title="役職表を見る"
            >
              <Shield size={14} />
              <span className="hidden sm:inline">役職表</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-white/10 hover:bg-red-500/80 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition"
              title="ユーザー切替・ログアウト"
            >
              <User size={14} />
              <span>{currentUser}</span>
              <LogOut size={13} className="ml-0.5 opacity-80" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        {/* =================================================================== */}
        {/* タブ1: マイページ（マイToDo ／ マイ完了済 ／ 自由メモ） */}
        {/* =================================================================== */}
        {activeTab === "mypage" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-2xs border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>👤 {currentUser} のマイページ</span>
                    {isAdmin && (
                      <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                        👑 管理者権限
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    違うToDoが入っている場合は「マイリストから削除」、足りない場合は全体ToDoから「＋マイリストに追加」できます
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskNames.includes(currentUser)) setNewTaskNames([currentUser]);
                    setShowAddTaskModal(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus size={16} />
                  <span>ToDoを追加</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {currentMemberObj.roles.map((role) => {
                  const isLead = currentMemberObj.leadRoles.includes(role);
                  return (
                    <span
                      key={role}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                        isLead
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-indigo-50 text-indigo-800 border-indigo-200"
                      }`}
                    >
                      {isLead ? `★責任者: ${role}` : `担当: ${role}`}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* マイページ内の3サブタブ */}
            <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setMyPageSubTab("todo")}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                  myPageSubTab === "todo" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"
                }`}
              >
                🔥 マイToDo ({myTodoList.length})
              </button>
              <button
                type="button"
                onClick={() => setMyPageSubTab("done")}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                  myPageSubTab === "done" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                }`}
              >
                ✅ マイ完了済 ({myDoneList.length})
              </button>
              <button
                type="button"
                onClick={() => setMyPageSubTab("memo")}
                className={`flex-1 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                  myPageSubTab === "memo" ? "bg-white text-amber-700 shadow-xs" : "text-slate-600"
                }`}
              >
                📌 自由メモ ({userMemoList.length})
              </button>
            </div>

            {myPageSubTab === "todo" && (
              <div className="space-y-3">
                {renderCompactControlBar({
                  sortMode: todoSortMode,
                  setSortMode: setTodoSortMode,
                  onPermanentSort: (mode) => applyPermanentTaskSort(false, mode),
                  includeWhoSort: false
                })}

                <div className="space-y-2.5">
                  {myTodoList.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center space-y-3 border border-slate-200">
                      <div className="text-slate-400 text-sm">
                        現在、あなたのマイToDo（未完了）はありません 🎉
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("tasks");
                          setTaskSubTab("todo");
                        }}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
                      >
                        <BookmarkPlus size={14} />
                        <span>全体のToDoリストからマイリストに追加する</span>
                      </button>
                    </div>
                  ) : (
                    myTodoList.map((t) => renderTaskCard(t, true))
                  )}
                </div>
              </div>
            )}

            {myPageSubTab === "done" && (
              <div className="space-y-3">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900">
                  💡 <strong>「自分だけ完了」</strong>または<strong>「全体完了」</strong>にしたあなたのToDoがここに集まります。左の緑チェックまたは「未完了(ToDo)に戻す」ボタンを押すと、確認のうえでマイToDoに戻せます。
                </div>

                {renderCompactControlBar({
                  sortMode: doneSortMode,
                  setSortMode: setDoneSortMode,
                  onPermanentSort: null,
                  includeWhoSort: false
                })}

                <div className="space-y-2.5">
                  {myDoneList.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm border border-slate-200">
                      完了済みのマイToDoはまだありません
                    </div>
                  ) : (
                    myDoneList.map((t) => renderTaskCard(t, true))
                  )}
                </div>
              </div>
            )}

            {myPageSubTab === "memo" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">
                    引き継ぎ事項や会議で話したいことを自由にメモできます
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddMemoModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs shrink-0 transition"
                  >
                    ＋ メモを追加
                  </button>
                </div>

                {userMemoList.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm border border-slate-200">
                    まだ自由メモがありません。「＋ メモを追加」から作成できます。
                  </div>
                ) : (
                  userMemoList.map((memo) => {
                    const isLong = isLongContent(memo.body);
                    const isExpanded = Boolean(expandedItemIds[memo.id]);
                    return (
                      <div key={memo.id} className="bg-white border border-amber-200 rounded-2xl p-4 space-y-2 shadow-2xs">
                        {editingMemoId === memo.id ? (
                          <div className="space-y-2.5">
                            <input
                              type="text"
                              value={editMemoForm.title}
                              onChange={(e) => setEditMemoForm({ ...editMemoForm, title: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                            />
                            <textarea
                              rows={4}
                              value={editMemoForm.body}
                              onChange={(e) => setEditMemoForm({ ...editMemoForm, body: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingMemoId(null)}
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                              >
                                取消
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditMemo(memo.id)}
                                className="px-4 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold"
                              >
                                💾 保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <h4
                                onClick={() => {
                                  if (isLong) toggleExpandItem(memo.id);
                                  else setDetailModalItem({ type: "memo", data: memo });
                                }}
                                className="font-bold text-sm text-slate-900 cursor-pointer break-words"
                              >
                                📌 {memo.title}
                              </h4>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[11px] text-slate-400 mr-1">{memo.updatedAt}</span>
                                <button
                                  type="button"
                                  onClick={() => setDetailModalItem({ type: "memo", data: memo })}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg"
                                  title="拡大表示"
                                >
                                  <Maximize2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditMemo(memo)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"
                                  title="編集"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMemo(memo.id, memo.title)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                                  title="削除"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <p
                              onClick={() => {
                                if (isLong) toggleExpandItem(memo.id);
                                else setDetailModalItem({ type: "memo", data: memo });
                              }}
                              className={`text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed cursor-pointer ${
                                isLong && !isExpanded ? "line-clamp-2" : ""
                              }`}
                            >
                              {memo.body}
                            </p>
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => toggleExpandItem(memo.id)}
                                className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-lg flex items-center gap-1 transition"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp size={14} />
                                    <span>折りたたむ</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} />
                                    <span>全文・詳細を開く</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* タブ2: 全体ToDo */}
        {/* =================================================================== */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  ✅ 全体のToDo・完了済みリスト
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  マイリストにない項目は各カードの「＋ マイリストに追加」ボタンから自分のマイToDoに追加できます
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xs flex items-center gap-1.5 transition"
              >
                <Plus size={16} />
                <span>新しいToDoを追加</span>
              </button>
            </div>

            <div className="flex bg-slate-200/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setTaskSubTab("todo")}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                  taskSubTab === "todo" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600"
                }`}
              >
                🔥 やるべきこと ({todoList.length}件)
              </button>
              <button
                type="button"
                onClick={() => setTaskSubTab("done")}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                  taskSubTab === "done" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                }`}
              >
                ✓ 全体完了済み ({doneList.length}件)
              </button>
            </div>

            {taskSubTab === "todo" ? (
              <div className="space-y-3">
                {renderCompactControlBar({
                  sortMode: todoSortMode,
                  setSortMode: setTodoSortMode,
                  onPermanentSort: (mode) => applyPermanentTaskSort(false, mode),
                  includeWhoSort: true
                })}
                <div className="space-y-2.5">
                  {todoList.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm border border-slate-200">
                      該当する未完了のToDoはありません 🎉
                    </div>
                  ) : (
                    todoList.map((t) => renderTaskCard(t, false))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {renderCompactControlBar({
                  sortMode: doneSortMode,
                  setSortMode: setDoneSortMode,
                  onPermanentSort: (mode) => applyPermanentTaskSort(true, mode),
                  includeWhoSort: true
                })}
                <div className="space-y-2.5">
                  {doneList.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-sm border border-slate-200">
                      完了済みのタスクはありません
                    </div>
                  ) : (
                    doneList.map((t) => renderTaskCard(t, false))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* タブ3: 今まで決まったこと */}
        {/* =================================================================== */}
        {activeTab === "decisions" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  📋 今まで決まったこと（全{totalDecisions}件）
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  長文の項目はタップすると全文が開きます
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDecisionModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-2xl shadow-xs flex items-center gap-1.5 transition"
              >
                <Plus size={16} />
                <span>決定事項・見出しを追加</span>
              </button>
            </div>

            {renderCompactControlBar({
              sortMode: decisionSortMode,
              setSortMode: setDecisionSortMode,
              onPermanentSort: (mode) => applyPermanentDecisionSort(mode),
              includeWhoSort: false
            })}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollapsedCats({})}
                className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50"
              >
                すべて開く
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = {};
                  boardState.decisions.forEach((c) => { next[c.id] = true; });
                  setCollapsedCats(next);
                }}
                className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-xl hover:bg-slate-50"
              >
                すべて折りたたむ
              </button>
            </div>

            <div className="space-y-3">
              {boardState.decisions.map((cat) => {
                const q = searchQuery.trim().toLowerCase();
                let visibleItems = cat.items.filter((it) => {
                  const matchImp = matchImportanceFilter(it.importance);
                  const matchQ = !q || it.title.toLowerCase().includes(q) || it.content.toLowerCase().includes(q) || cat.category.toLowerCase().includes(q);
                  return matchImp && matchQ;
                });

                if (decisionSortMode !== "manual") {
                  visibleItems = [...visibleItems].sort((a, b) => compareItems(a, b, decisionSortMode));
                }

                const isCollapsed = Boolean(collapsedCats[cat.id]) && !hasActiveFilter;

                return (
                  <div key={cat.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
                    <div
                      onClick={() => setCollapsedCats({ ...collapsedCats, [cat.id]: !collapsedCats[cat.id] })}
                      className="p-4 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer flex items-start justify-between gap-2 transition"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        {isCollapsed ? (
                          <ChevronRight size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-bold text-indigo-950 break-words leading-snug">
                            {cat.category}
                          </h3>
                        </div>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                          {visibleItems.length}件
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => moveCategory(cat.id, -1)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg"
                          title="見出しを上へ移動"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCategory(cat.id, 1)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg"
                          title="見出しを下へ移動"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editCategoryName(cat.id, cat.category)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg"
                          title="見出し名を編集"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCategory(cat.id, cat.category)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg"
                          title="カテゴリを削除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="p-4 space-y-2.5 border-t border-slate-100">
                        {visibleItems.length === 0 ? (
                          <div className="text-xs text-slate-400 py-3 text-center">
                            該当する決定事項がありません
                          </div>
                        ) : (
                          visibleItems.map((item) => {
                            const imp = Number(item.importance) || 0;
                            const isLong = isLongContent(item.content);
                            const isExpanded = Boolean(expandedItemIds[item.id]);

                            return (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-2xl border transition space-y-2 ${
                                  imp === 5
                                    ? "bg-rose-50/30 border-rose-200"
                                    : imp === 4
                                    ? "bg-orange-50/20 border-orange-200"
                                    : "bg-white hover:bg-slate-50/60 border-slate-150"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div
                                    onClick={() => {
                                      if (isLong) toggleExpandItem(item.id);
                                      else setDetailModalItem({ type: "decision", data: item, catId: cat.id, catName: cat.category });
                                    }}
                                    className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                                  >
                                    <ImportanceBadge importance={item.importance} />
                                    <span className="font-bold text-sm text-slate-900 break-words">
                                      {item.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setDetailModalItem({ type: "decision", data: item, catId: cat.id, catName: cat.category })}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                      title="詳細ウィンドウで全文を見る"
                                    >
                                      <Maximize2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveDecisionItem(cat.id, item.id, -1)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                      title="上へ移動"
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveDecisionItem(cat.id, item.id, 1)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                      title="下へ移動"
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditDecision(cat.id, item)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                      title="編集"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteDecision(cat.id, item.id, item.title)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                      title="削除"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                <div
                                  onClick={() => {
                                    if (isLong) toggleExpandItem(item.id);
                                    else setDetailModalItem({ type: "decision", data: item, catId: cat.id, catName: cat.category });
                                  }}
                                  className="cursor-pointer"
                                >
                                  <p
                                    className={`text-xs sm:text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed ${
                                      isLong && !isExpanded ? "line-clamp-2" : ""
                                    }`}
                                  >
                                    {item.content}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  {isLong ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandItem(item.id)}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg flex items-center gap-1 transition"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp size={14} />
                                            <span>折りたたむ</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown size={14} />
                                            <span>全文・詳細を開く</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDetailModalItem({ type: "decision", data: item, catId: cat.id, catName: cat.category })}
                                        className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                                      >
                                        <Maximize2 size={12} />
                                        <span>拡大表示</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span />
                                  )}

                                  {item.updatedBy && (
                                    <div className="text-[10px] text-slate-400 ml-auto">
                                      更新: {item.updatedBy} ({item.updatedAt})
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* タブ4: 出力・管理（変更履歴＆ログイン履歴は管理者「小林秀星」のみ表示） */}
        {/* =================================================================== */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <h2 className="text-base font-bold text-slate-900">📄 ファイル出力・役職表</h2>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={exportWordDoc}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Download size={15} />
                  <span>Wordファイル (.doc) に保存</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRoleTableModal(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Shield size={15} />
                  <span>全体の役職・担当表を見る</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      requestConfirm({
                        title: "初期状態へのリセット確認（管理者専用）",
                        message: "本当にすべてのToDo・決定事項データを初期状態にリセットしますか？",
                        confirmLabel: "リセットする",
                        confirmColor: "bg-red-600 hover:bg-red-700",
                        onConfirm: () => commitState(INITIAL_STATE, "データを初期状態にリセットしました")
                      });
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition ml-auto"
                  >
                    <RotateCcw size={14} />
                    <span>初期状態に戻す</span>
                  </button>
                )}
              </div>
            </div>

            {isAdmin ? (
              <div className="bg-white rounded-3xl p-5 border-2 border-amber-300 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="text-amber-500" size={22} />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        管理者専用パネル（{ADMIN_USER} のみ閲覧可能）
                      </h3>
                      <p className="text-xs text-slate-500">
                        誰がいつログインしたか・誰が何を変更したかを確認できます
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setAdminLogSubTab("login")}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                      adminLogSubTab === "login"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600"
                    }`}
                  >
                    <KeyRound size={15} />
                    <span>ログイン履歴 ({(boardState.loginLogs || []).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminLogSubTab("edit")}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                      adminLogSubTab === "edit"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600"
                    }`}
                  >
                    <History size={15} />
                    <span>編集・変更履歴 ({(boardState.logs || []).length})</span>
                  </button>
                </div>

                {adminLogSubTab === "login" ? (
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                      <div className="text-xs font-bold text-slate-700">
                        👥 幹部代20名の最終ログイン日時一覧
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {KANBU_ROSTER.map((m) => {
                          const lastLog = memberLastLoginMap[m.name];
                          return (
                            <div
                              key={m.name}
                              className={`p-2.5 rounded-xl border text-xs ${
                                lastLog
                                  ? "bg-white border-emerald-200"
                                  : "bg-slate-100/70 border-slate-200 opacity-70"
                              }`}
                            >
                              <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>{m.name}</span>
                                {lastLog && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                              </div>
                              <div className="text-[11px] mt-0.5 text-slate-500 font-mono">
                                {lastLog ? `最終: ${lastLog.time}` : "未ログイン"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      <div className="text-xs font-bold text-slate-600">
                        🕒 時系列ログイン・アクセス記録
                      </div>
                      {(boardState.loginLogs || []).length === 0 ? (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          まだログイン履歴がありません
                        </div>
                      ) : (
                        (boardState.loginLogs || []).map((entry) => (
                          <div
                            key={entry.id}
                            className="text-xs flex items-center justify-between gap-2 py-2.5 px-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100"
                          >
                            <div className="flex items-center gap-2">
                              <span className="bg-indigo-600 text-white font-bold px-2.5 py-0.5 rounded-lg">
                                👤 {entry.user}
                              </span>
                              <span className="text-slate-700 font-medium">
                                {entry.type || "ログイン"}しました
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono shrink-0">
                              {entry.time}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {(boardState.logs || []).map((log) => (
                      <div
                        key={log.id}
                        className="text-xs flex items-start justify-between gap-2 py-2.5 px-3.5 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <div className="break-words">
                          <span className="font-bold text-indigo-700 mr-1.5">[{log.user}]</span>
                          <span className="text-slate-700">{log.action}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0 font-mono">{log.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-5 border border-slate-200 text-center space-y-1">
                <div className="text-xs font-bold text-slate-500">
                  🔒 変更履歴・ログイン履歴は管理者（{ADMIN_USER}）専用です
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* 下部ナビゲーションバー */}
      {/* =================================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 shadow-lg">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: "mypage", label: `マイページ (${myTodoList.length})`, icon: User },
            { id: "tasks", label: `全体ToDo (${allUncompletedCount})`, icon: CheckSquare },
            { id: "decisions", label: `決定事項 (${totalDecisions})`, icon: FileText },
            {
              id: "logs",
              label: isAdmin ? "👑 管理・履歴" : "出力・役職表",
              icon: isAdmin ? Crown : Shield
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-xs font-bold transition ${
                  active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* =================================================================== */}
      {/* モーダルB: ToDoの削除方法選択ウィンドウ（マイリストから削除 ／ 全体から完全削除） */}
      {/* =================================================================== */}
      {taskDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Trash2 className="text-red-600" size={20} />
                <span>削除方法の選択</span>
              </h3>
              <button
                type="button"
                onClick={() => setTaskDeleteModal(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1">
              <div className="font-bold text-indigo-900 break-words">
                👤 担当: {taskDeleteModal.task.who}
              </div>
              <div className="text-slate-700 line-clamp-3 whitespace-pre-wrap break-words">
                {taskDeleteModal.task.what}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-700">
                自分のマイリストからのみ削除するか、全体のToDoリストから完全に削除するか選択してください：
              </p>

              {taskDeleteModal.inMyList && (
                <button
                  type="button"
                  onClick={() =>
                    setTaskDeleteModal({ ...taskDeleteModal, selectedOption: "remove_mylist" })
                  }
                  className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    taskDeleteModal.selectedOption === "remove_mylist"
                      ? "border-amber-600 bg-amber-50/70"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5">
                    {taskDeleteModal.selectedOption === "remove_mylist" ? (
                      <CheckCircle2 size={20} className="text-amber-600" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      🙋‍♂️ マイリストから削除（自分のマイページからのみ外す）
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      自分の担当ではないのにマイリストに入っている場合に使います。全体のToDoリストや他メンバーの画面にはそのまま残ります。
                    </p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setTaskDeleteModal({ ...taskDeleteModal, selectedOption: "delete_global" })
                }
                className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                  taskDeleteModal.selectedOption === "delete_global"
                    ? "border-red-600 bg-red-50/70"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="mt-0.5">
                  {taskDeleteModal.selectedOption === "delete_global" ? (
                    <CheckCircle2 size={20} className="text-red-600" />
                  ) : (
                    <Circle size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">
                    🌐 全体のToDoリストから完全に削除する
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    タスク自体が不要になった場合に使います。全員の画面および全体ToDoリストから完全に消去されます。
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTaskDeleteModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeTaskDeleteChoice}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm ${
                  taskDeleteModal.selectedOption === "remove_mylist"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                次へ（確認画面へ）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダルA: 複数人ToDoの「自分だけ完了 ／ 全体完了 ／ 未完了に戻す」選択ウィンドウ */}
      {/* =================================================================== */}
      {taskCompletionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-600" size={20} />
                <span>
                  {taskCompletionModal.mode === "complete"
                    ? "ToDo完了方法の選択"
                    : "ToDoへ戻す（または全体完了）"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setTaskCompletionModal(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1">
              <div className="font-bold text-indigo-900 break-words">
                👤 担当: {taskCompletionModal.task.who}
              </div>
              <div className="text-slate-700 line-clamp-3 whitespace-pre-wrap break-words">
                {taskCompletionModal.task.what}
              </div>
            </div>

            {taskCompletionModal.mode === "complete" && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-700">
                  自分だけ完了にするか、全員分（タスク全体）を完了にするか選択してください：
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setTaskCompletionModal({ ...taskCompletionModal, selectedOption: "self" })
                  }
                  className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    taskCompletionModal.selectedOption === "self"
                      ? "border-indigo-600 bg-indigo-50/70"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5">
                    {taskCompletionModal.selectedOption === "self" ? (
                      <CheckCircle2 size={20} className="text-indigo-600" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      🙋‍♂️ 自分（{currentUser}）だけ完了にする
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      マイページの未完了ToDoから消え、マイページの「完了済み」に移ります。他のメンバーの未完了ToDoには残り、詳細画面にあなたが完了したことが記録されます。
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTaskCompletionModal({ ...taskCompletionModal, selectedOption: "all" })
                  }
                  className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    taskCompletionModal.selectedOption === "all"
                      ? "border-emerald-600 bg-emerald-50/70"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5">
                    {taskCompletionModal.selectedOption === "all" ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      🌐 全員分（タスク全体）を完了にする
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      タスクそのものがすべて終わった場合に使います。全体のToDoリストから完了済みへ移動します。
                    </p>
                  </div>
                </button>
              </div>
            )}

            {taskCompletionModal.mode === "uncomplete_personal" && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-700">
                  あなたは現在このToDoを「個人完了」しています。操作を選択してください：
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setTaskCompletionModal({ ...taskCompletionModal, selectedOption: "revert_self" })
                  }
                  className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    taskCompletionModal.selectedOption === "revert_self"
                      ? "border-blue-600 bg-blue-50/70"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5">
                    {taskCompletionModal.selectedOption === "revert_self" ? (
                      <CheckCircle2 size={20} className="text-blue-600" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      ↩️ 自分の完了を取り消してマイToDo（未完了）に戻す
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      マイページの「マイ完了済」から「マイToDo（未完了）」に戻します。
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTaskCompletionModal({ ...taskCompletionModal, selectedOption: "all" })
                  }
                  className={`w-full p-3.5 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                    taskCompletionModal.selectedOption === "all"
                      ? "border-emerald-600 bg-emerald-50/70"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="mt-0.5">
                    {taskCompletionModal.selectedOption === "all" ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : (
                      <Circle size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      🌐 全員分（タスク全体）も完了にする
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      全体のToDoリストでもこのタスクを完了済みに移動します。
                    </p>
                  </div>
                </button>
              </div>
            )}

            {taskCompletionModal.mode === "uncomplete_global" && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-slate-700">
                  このタスクは現在「全体完了」になっています。未完了（ToDo）に戻しますか？
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setTaskCompletionModal({ ...taskCompletionModal, selectedOption: "revert_all" })
                  }
                  className="w-full p-3.5 rounded-2xl border-2 border-blue-600 bg-blue-50/70 text-left flex items-start gap-3"
                >
                  <CheckCircle2 size={20} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900">
                      ↩️ 未完了のToDoリストに戻す
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      全体のやるべきことリスト（未完了ToDo）およびマイページの未完了ToDoに戻します。
                    </p>
                  </div>
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTaskCompletionModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={executeTaskCompletionChoice}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm"
              >
                次へ（確認画面へ）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル0: 全文・詳細表示ウィンドウ（個人完了した人リスト ＆ マイリスト追加/削除対応） */}
      {/* =================================================================== */}
      {detailModalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {detailModalItem.type === "task"
                  ? "📋 ToDoの詳細・個人完了リスト"
                  : detailModalItem.type === "decision"
                  ? "📋 決定事項の詳細・全文"
                  : "📌 自由メモの詳細・全文"}
              </h3>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3.5 pr-1">
              {detailModalItem.type === "task" && (() => {
                const taskObj =
                  boardState.tasks.find((x) => x.id === detailModalItem.data.id) || detailModalItem.data;
                const personalDoneList = normalizeCompletedBy(taskObj.completedBy);
                const targetMembers = getTargetMembersForTask(taskObj);
                const doneNames = personalDoneList.map((e) => e.name);
                const remainingMembers = targetMembers.filter((m) => !doneNames.includes(m));
                const inMyList = isTaskInUserMyList(taskObj, currentMemberObj);

                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <ImportanceBadge importance={taskObj.importance} />
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                        全体状態: {taskObj.completed ? "✅ 全体完了済み" : "🔥 未完了 (進行中)"}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          inMyList
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {inMyList ? "📌 あなたのマイリスト内" : "マイリスト外"}
                      </span>
                    </div>

                    <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 space-y-1.5 text-xs">
                      <div>
                        <span className="font-bold text-indigo-900">👤 誰が（担当）：</span>
                        <span className="text-slate-800 break-words font-bold">{taskObj.who}</span>
                      </div>
                      <div>
                        <span className="font-bold text-amber-900">⏰ いつまでに（期限）：</span>
                        <span className="text-slate-800 break-words">{taskObj.when}</span>
                      </div>
                    </div>

                    {/* 個人で完了した人リスト */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <UserCheck size={16} className="text-emerald-700" />
                          <span>個人で完了した人リスト ({personalDoneList.length}名)</span>
                        </span>
                      </div>

                      {personalDoneList.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-white/80 rounded-xl p-2.5 border border-emerald-100">
                          まだ個人で完了にしたメンバーはいません
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {personalDoneList.map((entry) => (
                            <span
                              key={entry.name}
                              className="bg-white border border-emerald-300 text-emerald-900 text-xs font-bold px-3 py-1 rounded-xl shadow-2xs"
                            >
                              ✓ {entry.name}
                              {entry.time && (
                                <span className="text-[10px] text-slate-400 ml-1">({entry.time})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {targetMembers.length > 1 && !taskObj.completed && (
                        <div className="pt-2 border-t border-emerald-200/70">
                          <div className="text-[11px] font-bold text-slate-600 mb-1">
                            ⏳ 未完了の対象メンバー ({remainingMembers.length}名):
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {remainingMembers.length === 0 ? (
                              <span className="text-xs text-emerald-700 font-bold">
                                対象メンバー全員が個人完了しています！
                              </span>
                            ) : (
                              remainingMembers.map((mName) => (
                                <span
                                  key={mName}
                                  className="bg-white/70 text-slate-600 border border-slate-200 text-[11px] px-2 py-0.5 rounded-md"
                                >
                                  {mName}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <div className="text-xs font-bold text-slate-500 mb-1.5">📝 内容（全文）：</div>
                      <p className="text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
                        {taskObj.what}
                      </p>
                    </div>
                  </>
                );
              })()}

              {detailModalItem.type === "decision" && (
                <>
                  {detailModalItem.catName && (
                    <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl break-words">
                      {detailModalItem.catName}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <ImportanceBadge importance={detailModalItem.data.importance} />
                    <h4 className="font-bold text-base text-slate-900 break-words">
                      {detailModalItem.data.title}
                    </h4>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
                      {detailModalItem.data.content}
                    </p>
                  </div>
                </>
              )}

              {detailModalItem.type === "memo" && (
                <>
                  <h4 className="font-bold text-base text-slate-900 break-words">
                    📌 {detailModalItem.data.title}
                  </h4>
                  <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words leading-relaxed">
                      {detailModalItem.data.body}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-100">
              {detailModalItem.type === "task" && (() => {
                const taskObj =
                  boardState.tasks.find((x) => x.id === detailModalItem.data.id) || detailModalItem.data;
                const inMyList = isTaskInUserMyList(taskObj, currentMemberObj);
                return (
                  <>
                    {!inMyList ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailModalItem(null);
                          handleAddToMyList(taskObj);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1"
                      >
                        <BookmarkPlus size={14} />
                        <span>＋ マイリストに追加</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDetailModalItem(null);
                          openDeleteTaskModal(taskObj, "remove_mylist");
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1"
                      >
                        <BookmarkMinus size={14} />
                        <span>マイリストから削除</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalItem(null);
                        handleToggleTask(taskObj.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"
                    >
                      完了切替 / ToDoに戻す
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailModalItem(null);
                        startEditTask(taskObj);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold"
                    >
                      ✏️ 編集
                    </button>
                  </>
                );
              })()}
              {detailModalItem.type === "decision" && (
                <button
                  type="button"
                  onClick={() => {
                    const { catId, data } = detailModalItem;
                    setDetailModalItem(null);
                    startEditDecision(catId, data);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold"
                >
                  ✏️ 編集する
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル1: 新規ToDo追加ウィンドウ */}
      {/* =================================================================== */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">＋ 新しいToDoを追加</h3>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!newTaskNames.includes(currentUser)) setNewTaskNames([...newTaskNames, currentUser]);
                }}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-xl font-bold"
              >
                ＋ 自分の名前（{currentUser}）を入れる
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
              label="重要度（1〜5 / 設定なしもOK）"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📝 何をやるか（内容）</label>
              <textarea
                rows={3}
                value={newTaskWhat}
                onChange={(e) => setNewTaskWhat(e.target.value)}
                placeholder="具体的なタスク内容を入力してください"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => handleAddTask(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                ＋ 完了済みに追加
              </button>
              <button
                type="button"
                onClick={() => handleAddTask(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                ＋ やるべきこと（ToDo）に追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル2: ToDo編集ウィンドウ */}
      {/* =================================================================== */}
      {editingTaskId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">✏️ ToDo内容を編集</h3>
              <button
                type="button"
                onClick={() => setEditingTaskId(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

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

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📝 何をやるか（内容）</label>
              <textarea
                rows={4}
                value={editTaskWhat}
                onChange={(e) => setEditTaskWhat(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTaskId(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEditTask}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                💾 編集完了（保存）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル3: 決定事項・見出し追加ウィンドウ */}
      {/* =================================================================== */}
      {showAddDecisionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">＋ 決定事項・新しい見出しを追加</h3>
              <button
                type="button"
                onClick={() => setShowAddDecisionModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">📂 カテゴリ（会議名・テーマ）</label>
              <select
                value={selectedCatId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCatId(val);
                  setShowCustomCatBox(val === NEW_CAT_VALUE);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                {boardState.decisions.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.category}</option>
                ))}
                <option value={NEW_CAT_VALUE}>➕ 新しい見出し（会議名・テーマ）を作成する...</option>
              </select>

              {showCustomCatBox && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-indigo-900">
                    ✨ 新しく作成する見出し名：
                  </label>
                  <input
                    type="text"
                    value={newCustomCatName}
                    onChange={(e) => setNewCustomCatName(e.target.value)}
                    placeholder="例：11/18 第2回幹部代会議 / 合宿について"
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📌 項目名（タイトル）</label>
              <input
                type="text"
                value={newDecTitle}
                onChange={(e) => setNewDecTitle(e.target.value)}
                placeholder="例：2月ライブの個人バンド上限（※見出しだけ作る場合は空欄でOK）"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <ImportanceSelector
              value={newDecImportance}
              onChange={setNewDecImportance}
              label="重要度（1〜5 / 設定なしもOK）"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📝 決まった内容</label>
              <textarea
                rows={3}
                value={newDecContent}
                onChange={(e) => setNewDecContent(e.target.value)}
                placeholder="例：3回生以下は最大3バンドまでに決定"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddDecisionModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddDecision}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                ＋ 追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル4: 決定事項の編集ウィンドウ */}
      {/* =================================================================== */}
      {editingDec && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">✏️ 決定事項を編集</h3>
              <button
                type="button"
                onClick={() => setEditingDec(null)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📌 項目名</label>
              <input
                type="text"
                value={editingDec.title}
                onChange={(e) => setEditingDec({ ...editingDec, title: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>

            <ImportanceSelector
              value={editingDec.importance}
              onChange={(val) => setEditingDec({ ...editingDec, importance: val })}
              label="重要度（1〜5 / なし）"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">📝 決まった内容</label>
              <textarea
                rows={4}
                value={editingDec.content}
                onChange={(e) => setEditingDec({ ...editingDec, content: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingDec(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEditDecision}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                💾 編集完了（保存）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル5: マイページ自由メモ追加ウィンドウ */}
      {/* =================================================================== */}
      {showAddMemoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-base text-slate-900">＋ 自由メモを追加</h3>
              <button
                type="button"
                onClick={() => setShowAddMemoModal(false)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <input
              type="text"
              value={newMemoTitle}
              onChange={(e) => setNewMemoTitle(e.target.value)}
              placeholder="タイトル（例：PA卓の引き継ぎ事項 / 次回会議で聞くこと）"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            />
            <textarea
              rows={4}
              value={newMemoBody}
              onChange={(e) => setNewMemoBody(e.target.value)}
              placeholder="メモの内容を自由に入力してください..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddMemoModal(false)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleAddMemo}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                ＋ 追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* モーダル6: 写真の役職一覧表 */}
      {/* =================================================================== */}
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
                    <th className="p-2.5 border border-slate-300 text-left">区分</th>
                    <th className="p-2.5 border border-slate-300 text-left">役職</th>
                    <th className="p-2.5 border border-slate-300 text-left">幹部代担当（★＝責任者）</th>
                    <th className="p-2.5 border border-slate-300 text-left">他メンバー・備考</th>
                  </tr>
                </thead>
                <tbody>
                  {FULL_ROLE_TABLE.map((row, i) => (
                    <tr key={i} className="odd:bg-white even:bg-slate-50">
                      <td className="p-2.5 border border-slate-200 font-bold text-slate-600">{row.cat}</td>
                      <td className="p-2.5 border border-slate-200 font-bold text-indigo-900">{row.role}</td>
                      <td className="p-2.5 border border-slate-200 font-bold text-slate-800">{row.main}</td>
                      <td className="p-2.5 border border-slate-200 text-slate-600">{row.sub}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ワンクッション確認ダイアログ */}
      {/* =================================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900">
              <AlertCircle className="text-indigo-600 shrink-0" size={22} />
              <h3 className="font-bold text-base">{confirmDialog.title}</h3>
            </div>
            <div className="max-h-60 overflow-y-auto bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
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
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition ${confirmDialog.confirmColor}`}
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
