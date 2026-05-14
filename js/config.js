// =============================================
// config.js — 環境切り替えはこのファイルだけ
// =============================================

const CONFIG = {

  // ===== 開発環境（GAS Web App URL）=====
  API_BASE: 'https://script.google.com/macros/s/AKfycbxhSXlksySy_HmkT-AbrRyxIoQj8-b9-jCfASYjNCcDs1fk05IypHZwIT995KRKHWvIEw/exec',

  // ===== 本番環境（Xserverに移行時はここのコメントを切り替え）=====
  // API_BASE: 'https://your-domain.com/api',

  APP_NAME: 'Nolia',
  APP_NAME_JP: 'ノリア',
  VERSION: '1.0.0',
  ENV: 'dev',

  // セッションキー（localStorage）
  SESSION_KEY: 'nolia_session',
  TOKEN_KEY: 'nolia_token',

  // ━━ 商品・外部リンク（URLを差し替えるだけでOK）━━
  RAKUTEN_URL:   '#',  // 楽天商品ページURL
  AMAZON_URL:    '#',  // Amazon商品ページURL
  GENE_TEST_URL: '#',  // 遺伝子検査申込URL
  GYM_URL:       '#',  // パーソナルジム案内URL
};
