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
  RAKUTEN_URL:   'https://item.rakuten.co.jp/i-literacy/akebi01/?iasid=07rpp_10095___3g-mp4z5qqg-4t-23da0e12-5462-47a5-bf83-7ba3baba16b9',  // 楽天商品ページURL
  AMAZON_URL:    'https://www.amazon.co.jp/dp/B0D95SQ2GC/',  // Amazon商品ページURL
  GENE_TEST_URL: '#',  // 遺伝子検査申込URL
  GYM_URL:       'https://i-literacy.co.jp/',  // パーソナルジム案内URL
};
