// =============================================
// app.js — Nolia メインアプリケーション
// =============================================

// ─── 状態管理 ─────────────────────────────
const State = {
  user: null,
  token: null,
  todayLog: null,
  reports: [],
  content: [],
  bioToday: null,
  currentView: null,
};

// ─── API通信 ──────────────────────────────
const Api = {
  async call(action, payload = {}, method = 'POST') {
    try {
      if (method === 'GET') {
        const params = new URLSearchParams({ action, token: State.token, ...payload });
        const res = await fetch(`${CONFIG.API_BASE}?${params}`);
        return await res.json();
      }
      const res = await fetch(`${CONFIG.API_BASE}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, token: State.token }),
      });
      return await res.json();
    } catch (err) {
      console.error('API Error:', err);
      return { ok: false, error: err.message };
    }
  },

  // トークン不要のPOST（requestLoginLink など）
  async callUnauth(action, payload = {}) {
    try {
      const res = await fetch(`${CONFIG.API_BASE}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      console.error('API Error:', err);
      return { ok: false, error: err.message };
    }
  },
};

// ─── ユーティリティ ───────────────────────
const Utils = {
  today() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  },
  formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  },
  // 連続記録日数を計算
  calcStreak(logs) {
    if (!logs || logs.length === 0) return 0;
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    let cursor = new Date(Utils.today());
    for (const log of sorted) {
      const logDate = new Date(log.date);
      const diff = (cursor - logDate) / 86400000;
      if (diff <= 1) {
        streak++;
        cursor = logDate;
      } else break;
    }
    return streak;
  },
  // トースト通知
  toast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  },
};

// ─── ビュー管理 ───────────────────────────
const View = {
  show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      State.currentView = id;
    }
    // ナビゲーションのアクティブ状態
    const navMap = {
      'view-home':    'nav-home',
      'view-log':     'nav-log',
      'view-report':  'nav-report',
      'view-content': 'nav-content',
      'view-mypage':  'nav-mypage',
    };
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navMap[id]) {
      const navEl = document.getElementById(navMap[id]);
      if (navEl) navEl.classList.add('active');
    }
    window.scrollTo(0, 0);
  },
};

// ─── 認証 ────────────────────────────────
const Auth = {
  // URLパラメータまたはlocalStorageからトークンを取得
  getToken() {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('t');
    if (urlToken) {
      localStorage.setItem(CONFIG.TOKEN_KEY, urlToken);
      // URLからトークンを消す（履歴に残さない）
      window.history.replaceState({}, '', window.location.pathname);
      return urlToken;
    }
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  },

  // トークンをAPIで検証してユーザー情報を取得
  async verify(token) {
    State.token = token; // Api.call がURLパラメータに使うので先に設定
    const res = await Api.call('login', {}, 'GET');
    if (res.ok) {
      State.user = res.user;
      return res.user;
    }
    State.token = null;
    return null;
  },

  logout() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    State.user = null;
    State.token = null;
    View.show('view-login-error');
    document.getElementById('bottom-nav').style.display = 'none';
  },

  // ログインリンク再発行（パスワード忘れ代替）
  async requestLoginLink() {
    const email = (document.getElementById('relogin-email').value || '').trim();
    if (!email) { Utils.toast('メールアドレスを入力してください', 'error'); return; }

    const btn = document.getElementById('relogin-btn');
    btn.textContent = '送信中…'; btn.disabled = true;

    await Api.callUnauth('requestLoginLink', { email });

    btn.textContent = '送信しました ✓';
    const msg = document.getElementById('relogin-message');
    msg.textContent = 'ご登録のメールアドレスに新しいログインリンクをお送りしました。届かない場合はスタッフにご連絡ください。';
    msg.style.display = 'block';
  },
};

// ─── 占い ─────────────────────────────────
const Fortune = {
  _key(date) { return 'nolia_fortune_' + date; },

  getCached(date) {
    try {
      const raw = localStorage.getItem(this._key(date));
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },

  saveCache(date, data) {
    try { localStorage.setItem(this._key(date), JSON.stringify(data)); } catch (_) {}
  },

  async load() {
    const today = Utils.today();
    const cached = this.getCached(today);
    if (cached) { this.render(cached); return; }

    this.renderLoading();
    const res = await Api.call('getDailyFortune', {}, 'GET');
    if (res.ok && res.fortune) {
      this.saveCache(today, res.fortune);
      this.render(res.fortune);
    } else {
      this.renderFallback(res.error);
    }
  },

  renderLoading() {
    const el = document.getElementById('home-fortune');
    if (!el) return;
    el.innerHTML = `
      <div class="fortune-card" style="background:linear-gradient(135deg,#2B8A7ACC,#38B2AC99); text-align:center; padding:28px;">
        <div class="spinner" style="margin:0 auto 10px; border-color:rgba(255,255,255,0.3); border-top-color:white;"></div>
        <div style="font-size:12px; opacity:0.8;">エネルギーを読み取り中…</div>
      </div>`;
  },

  render(f) {
    const el = document.getElementById('home-fortune');
    if (!el) return;

    // 旧フォーマット（動物占い）が残っていたらキャッシュ破棄して再取得
    if (!f.energy_name && f.animal) {
      localStorage.removeItem(this._key(Utils.today()));
      this.load();
      return;
    }

    const hex = (f.color_hex && /^#[0-9A-Fa-f]{6}$/.test(f.color_hex))
      ? f.color_hex : '#2B8A7A';

    el.innerHTML = `
      <div class="fortune-card" style="background:linear-gradient(140deg,${hex}F0,${hex}99); box-shadow:0 4px 24px ${hex}55;">
        <div class="fortune-top">
          <div class="fortune-orb">
            <div class="fortune-orb-keyword">${f.keyword}</div>
          </div>
          <div>
            <div class="fortune-energy-name">${f.energy_name}</div>
            <div class="fortune-color-label">🎨 ${f.color_name}</div>
          </div>
        </div>
        <div class="fortune-message">${f.message}</div>
        <div class="fortune-lucky">
          <div class="fortune-lucky-item">
            <span class="fortune-lucky-label">今日のカラー</span>
            <span class="fortune-lucky-val">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:white;opacity:0.9;margin-right:3px;"></span>${f.color_name}
            </span>
          </div>
          <div class="fortune-lucky-item">
            <span class="fortune-lucky-label">今日意識すること</span>
            <span class="fortune-lucky-val">✨ ${f.lucky_action}</span>
          </div>
        </div>
      </div>`;
  },

  renderFallback(error) {
    const el = document.getElementById('home-fortune');
    if (!el) return;
    if (error === 'birthdate_not_set') {
      el.innerHTML = `
        <div class="fortune-card" style="background:linear-gradient(140deg,#2B8A7ACC,#38B2AC99); text-align:center;">
          <div style="font-size:32px; margin-bottom:10px;">🌿</div>
          <div style="font-size:13px; font-weight:700; margin-bottom:6px;">生年月日を登録するとエネルギーが見られます</div>
          <div style="font-size:11px; opacity:0.8;">マイページ → 編集 → 生年月日を入力してください</div>
        </div>`;
    } else {
      el.innerHTML = '';
    }
  },
};

// ─── AIフィードバック（ホーム表示） ─────────
const AiFeedback = {
  _key(date) { return 'nolia_aifb_' + date; },

  getCached(date) {
    try {
      const raw = localStorage.getItem(this._key(date));
      return raw || null;
    } catch (_) { return null; }
  },

  saveCache(date, text) {
    try { localStorage.setItem(this._key(date), text); } catch (_) {}
  },

  async load(log) {
    const el = document.getElementById('home-ai-feedback');
    if (!el || !log) { if (el) el.innerHTML = ''; return; }

    const today = Utils.today();
    const cached = this.getCached(today);
    if (cached) { this.render(cached); return; }

    // バックグラウンドで取得（表示はスケルトンなし）
    el.innerHTML = `
      <div class="ai-feedback-card">
        <div class="ai-feedback-header">🌿 Nolia AI より</div>
        <div style="text-align:center; padding:6px 0; color:var(--nolia-muted); font-size:12px;">
          <div class="spinner" style="width:20px; height:20px; border-width:3px; margin:0 auto 6px;"></div>
          フィードバック作成中…
        </div>
      </div>`;

    const res = await Api.call('getAiFeedback', {
      weight: log.weight, mood: log.mood, cond: log.cond, taken: log.taken,
    });
    if (res.ok && res.feedback) {
      this.saveCache(today, res.feedback);
      this.render(res.feedback);
    } else {
      el.innerHTML = '';
    }
  },

  render(text) {
    const el = document.getElementById('home-ai-feedback');
    if (!el) return;
    el.innerHTML = `
      <div class="ai-feedback-card">
        <div class="ai-feedback-header">🌿 Nolia AI より</div>
        <div class="ai-feedback-text">${text}</div>
      </div>`;
  },
};

// ─── ホーム ───────────────────────────────
const Home = {
  async init() {
    View.show('view-home');

    // バイオサイクル表示
    if (State.user.birthdate) {
      State.bioToday = Biorhythm.calc(State.user.birthdate);
      this.renderBio(State.bioToday);
    }

    // 今日の記録確認
    const todayRes = await Api.call('getDailyLogs', { days: 30 }, 'GET');
    if (todayRes.ok) {
      const todayLog = todayRes.logs.find(l => l.date === Utils.today());
      State.todayLog = todayLog || null;
      this.renderStreak(Utils.calcStreak(todayRes.logs));
      this.renderTodayStatus(todayLog);
      // AIフィードバック（今日の記録がある場合のみ）
      AiFeedback.load(todayLog);
    }

    // 占い（非同期・ローカルキャッシュ優先）
    Fortune.load();

    // 最新レポートプレビュー
    const reportRes = await Api.call('getReports', {}, 'GET');
    if (reportRes.ok && reportRes.reports.length > 0) {
      this.renderLatestReport(reportRes.reports[0]);
    }
  },

  renderStreak(days) {
    const el = document.getElementById('home-streak');
    el.innerHTML = `
      <div class="streak-badge">
        <div class="streak-num">${days}</div>
        <div class="streak-label">日連続記録中 🔥</div>
      </div>`;
  },

  renderTodayStatus(log) {
    const el = document.getElementById('home-today-status');
    if (log) {
      el.innerHTML = `
        <div class="nolia-card" style="border-left: 4px solid var(--nolia-primary);">
          <div class="card-title">✅ 今日の記録済み</div>
          <div style="display:flex; gap:16px; font-size:13px; color:var(--nolia-muted);">
            <span>体重: <strong>${log.weight || '-'}kg</strong></span>
            <span>気分: <strong>${['', '😞','😕','😐','😊','😄'][log.mood] || '-'}</strong></span>
            <span>サプリ: <strong>${log.taken ? '✅' : '❌'}</strong></span>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <button class="btn-accent" onclick="View.show('view-log'); Log.init();">
          📝 今日の記録をつける
        </button>`;
    }
  },

  renderBio(bio) {
    const el = document.getElementById('home-bio');
    const p = bio.overall.phaseInfo;
    el.innerHTML = `
      <div class="nolia-card">
        <div class="card-title">🌀 今日のカラダのリズム</div>
        <div class="bio-overall" style="background:${p.bg};">
          <div class="bio-overall-icon">${p.icon}</div>
          <div class="bio-overall-phase" style="color:${p.color};">${p.label}</div>
        </div>
        <div class="bio-bars">
          ${this.bioBar('体力', bio.physical)}
          ${this.bioBar('こころ', bio.emotional)}
          ${this.bioBar('活力', bio.vitality)}
        </div>
      </div>`;
  },

  bioBar(label, data) {
    return `
      <div class="bio-bar-item">
        <div class="bio-bar-label">${label}</div>
        <div class="bio-bar-track">
          <div class="bio-bar-fill" style="width:${data.score}%; background:${data.phaseInfo.color};"></div>
        </div>
        <div class="bio-bar-score">${data.phaseInfo.icon}</div>
      </div>`;
  },

  renderLatestReport(report) {
    const el = document.getElementById('home-latest-report');
    if (!el) return;
    el.innerHTML = `
      <div class="nolia-card" style="cursor:pointer;" onclick="View.show('view-report'); Report.init();">
        <div class="card-title">📊 最新レポート</div>
        <div class="report-date">${Utils.formatDate(report.week_start)}の週</div>
        <div class="report-body" style="overflow:hidden; max-height:60px;">${report.report_text}</div>
        <div style="text-align:right; font-size:11px; color:var(--nolia-primary); margin-top:8px;">続きを読む →</div>
      </div>`;
  },
};

// ─── 日次記録 ─────────────────────────────
const Log = {
  takenStatus: null,

  init() {
    View.show('view-log');
    this.takenStatus = null;

    // 今日すでに記録がある場合はプリフィル
    if (State.todayLog) {
      const l = State.todayLog;
      document.getElementById('log-weight').value = l.weight || '';
      document.getElementById('log-mood').value = l.mood || 3;
      document.getElementById('log-cond').value = l.cond || 3;
      document.getElementById('log-memo').value = l.memo || '';
      this.takenStatus = l.taken;
      this.updateSliderDisplay('log-mood', 'mood-val');
      this.updateSliderDisplay('log-cond', 'cond-val');
      this.updateTakenUI();
    }

    document.getElementById('log-date').textContent = Utils.formatDate(Utils.today());
  },

  updateSliderDisplay(sliderId, displayId) {
    const val = document.getElementById(sliderId).value;
    const emojis = ['', '😞', '😕', '😐', '😊', '😄'];
    document.getElementById(displayId).textContent = emojis[val] + ' ' + val;
  },

  setTaken(val) {
    this.takenStatus = val;
    this.updateTakenUI();
  },

  updateTakenUI() {
    const yesBtn = document.getElementById('taken-yes');
    const noBtn  = document.getElementById('taken-no');
    yesBtn.className = 'toggle-option' + (this.takenStatus === true  ? ' selected-yes' : '');
    noBtn.className  = 'toggle-option' + (this.takenStatus === false ? ' selected-no'  : '');
  },

  async save() {
    const weight = parseFloat(document.getElementById('log-weight').value);
    const mood   = parseInt(document.getElementById('log-mood').value);
    const cond   = parseInt(document.getElementById('log-cond').value);
    const memo   = document.getElementById('log-memo').value.trim();

    if (isNaN(weight) || weight < 20 || weight > 300) {
      Utils.toast('体重を正しく入力してください', 'error');
      return;
    }
    if (this.takenStatus === null) {
      Utils.toast('サプリを飲んだか教えてください', 'error');
      return;
    }

    const btn = document.getElementById('log-save-btn');
    btn.textContent = '保存中…';
    btn.disabled = true;

    const res = await Api.call('saveDailyLog', {
      date: Utils.today(), weight, mood, cond,
      taken: this.takenStatus, memo,
    });

    btn.textContent = '記録を保存';
    btn.disabled = false;

    if (res.ok) {
      State.todayLog = { date: Utils.today(), weight, mood, cond, taken: this.takenStatus, memo };
      // 今日の記録が変わったのでフィードバックキャッシュをリセット
      try { localStorage.removeItem(AiFeedback._key(Utils.today())); } catch (_) {}
      Utils.toast('記録しました！', 'success');
      await Home.init();
    } else {
      Utils.toast('保存に失敗しました。もう一度お試しください', 'error');
    }
  },
};

// ─── 週次レポート ─────────────────────────
const Report = {
  async init() {
    View.show('view-report');
    const el = document.getElementById('report-list');
    el.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:auto;"></div></div>';

    const res = await Api.call('getReports', {}, 'GET');
    // レポート開封記録
    await Api.call('openReport', {}, 'GET');

    if (!res.ok || res.reports.length === 0) {
      el.innerHTML = `
        <div class="nolia-card" style="text-align:center; padding: 30px;">
          <div style="font-size:40px; margin-bottom:12px;">📭</div>
          <p style="color:var(--nolia-muted);">まだレポートがありません。<br>毎日記録を続けると、週末にレポートが届きます！</p>
        </div>`;
      return;
    }

    el.innerHTML = res.reports.map(r => this.renderReport(r)).join('');
  },

  renderReport(r) {
    const bio = State.user.birthdate
      ? Biorhythm.calc(State.user.birthdate, new Date(r.week_start))
      : null;

    return `
      <div class="report-card">
        <div class="report-date">${Utils.formatDate(r.week_start)} 〜 の週</div>
        ${r.stats ? `
        <div class="report-stats">
          <div class="report-stat">
            <div class="report-stat-val">${r.stats.weight_change > 0 ? '+' : ''}${r.stats.weight_change}kg</div>
            <div class="report-stat-label">体重変化</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-val">${r.stats.taken_rate}%</div>
            <div class="report-stat-label">服用率</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-val">${r.stats.avg_mood}</div>
            <div class="report-stat-label">平均気分</div>
          </div>
        </div>` : ''}
        <div class="report-body">${r.report_text}</div>
        ${bio ? `
        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--nolia-border);">
          <div style="font-size:11px; font-weight:700; color:var(--nolia-muted); margin-bottom:6px;">この週のバイオサイクル</div>
          <div style="font-size:12px; color:var(--nolia-text);">
            ${bio.overall.phaseInfo.icon} 総合: <strong>${bio.overall.phaseInfo.label}</strong> ／
            体力 ${bio.physical.phaseInfo.icon} ／ こころ ${bio.emotional.phaseInfo.icon} ／ 活力 ${bio.vitality.phaseInfo.icon}
          </div>
        </div>` : ''}
      </div>`;
  },
};

// ─── コンテンツ ───────────────────────────
const Content = {
  async init() {
    View.show('view-content');
    const el = document.getElementById('content-list');
    el.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:auto;"></div></div>';

    const res = await Api.call('getContent', {}, 'GET');
    if (!res.ok || res.content.length === 0) {
      el.innerHTML = `<div class="nolia-card" style="text-align:center;padding:30px;">
        <p style="color:var(--nolia-muted);">コンテンツを準備中です</p></div>`;
      return;
    }

    const icons = { tip: '💡', blog: '📖', promo: '🎁', testimonial: '⭐' };
    const catLabels = { tip: '健康Tips', blog: 'ジムノウハウ', promo: '特別なご提案', testimonial: '体験談' };

    el.innerHTML = res.content.map(c => `
      <div class="content-card" onclick="Content.open('${c.external_url}')">
        <div class="content-card-icon">${icons[c.type] || '📌'}</div>
        <div class="content-card-body">
          <div class="content-card-cat">${catLabels[c.type] || c.category}</div>
          <div class="content-card-title">${c.title}</div>
          <div class="content-card-excerpt">${c.excerpt}</div>
        </div>
      </div>`).join('');
  },

  open(url) {
    if (url && url !== '#') window.open(url, '_blank');
  },
};

// ─── マイページ ───────────────────────────
const MyPage = {
  _chart: null,

  async init() {
    View.show('view-mypage');
    const user = State.user;

    this._renderProfile(user);

    const res = await Api.call('getDailyLogs', { days: 90 }, 'GET');
    const logs = res.ok ? res.logs : [];

    this._renderAchievements(logs, user);
    this._renderSupplementStatus(user, logs);
    if (logs.length > 0) {
      this._renderStats(logs);
      this._renderChart(logs);
    }
    this._renderCrossSell(user);
  },

  _renderProfile(user) {
    const fortune = Fortune.getCached(Utils.today());
    document.getElementById('mypage-avatar').textContent = fortune ? fortune.emoji : '🌿';
    document.getElementById('mypage-name').textContent  = user.display_name || user.name;
    document.getElementById('mypage-email').textContent = user.email || '';

    const memberDays = user.joined_at
      ? Math.floor((new Date() - new Date(user.joined_at)) / 86400000)
      : 0;
    document.getElementById('mypage-since').textContent = `Nolia会員 ${memberDays}日目`;
  },

  _renderAchievements(logs, user) {
    const streak = Utils.calcStreak(logs);
    const total  = logs.length;
    const takenRate = total > 0 ? Math.round(logs.filter(l => l.taken).length / total * 100) : 0;
    const suppDays  = user.start_date
      ? Math.floor((new Date() - new Date(user.start_date)) / 86400000) : 0;

    const badges = [
      { icon: '🔥', days: '7日', label: '連続記録',  earned: streak >= 7 },
      { icon: '🌟', days: '30日', label: '連続記録', earned: streak >= 30 },
      { icon: '💎', days: '60日', label: '連続記録', earned: streak >= 60 },
      { icon: '👑', days: '90日', label: '連続記録', earned: streak >= 90 },
      { icon: '📝', days: '50回', label: '記録達成',  earned: total >= 50 },
      { icon: '📖', days: '100回', label: '記録達成', earned: total >= 100 },
      { icon: '💊', days: '80%+', label: '服用率',   earned: takenRate >= 80 && total >= 7 },
      { icon: '🏆', days: '180日', label: '継続',    earned: suppDays >= 180 },
    ];

    document.getElementById('mypage-achievements').innerHTML = badges.map(b => `
      <div class="badge-item ${b.earned ? 'earned' : 'locked'}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-days">${b.days}</div>
        <div class="badge-label">${b.label}</div>
      </div>`).join('');
  },

  _renderSupplementStatus(user, logs) {
    const el = document.getElementById('mypage-supplement-status');
    if (!el) return;
    if (!user.start_date) { el.innerHTML = ''; return; }

    const days   = Math.floor((new Date() - new Date(user.start_date)) / 86400000);
    const target = 90;
    const pct    = Math.min(Math.round(days / target * 100), 100);

    let bmiHtml = '';
    const latestWeight = logs.filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latestWeight && user.height) {
      const h = parseFloat(user.height) / 100;
      const bmi = (latestWeight.weight / (h * h)).toFixed(1);
      bmiHtml = `<span style="font-size:12px; color:var(--nolia-muted); margin-left:10px;">BMI ${bmi}</span>`;
    }

    const reorderHtml = days >= 25 ? `
      <div style="margin-top:4px; font-size:11px; color:var(--nolia-accent); font-weight:700;">
        🛒 そろそろ補充の時期です
      </div>
      <div class="reorder-row">
        <button class="reorder-btn reorder-btn-rakuten"
          onclick="window.open(CONFIG.RAKUTEN_URL,'_blank')">🛒 楽天で購入</button>
        <button class="reorder-btn reorder-btn-amazon"
          onclick="window.open(CONFIG.AMAZON_URL,'_blank')">📦 Amazonで購入</button>
      </div>` : '';

    el.innerHTML = `
      <div class="supplement-progress-card">
        <div class="supplement-top">
          <div>
            <span class="supplement-days-num">${days}</span>
            <span class="supplement-days-unit">日継続中</span>
            ${bmiHtml}
          </div>
          <span class="supplement-target">目標：${target}日</span>
        </div>
        <div class="supplement-bar-track">
          <div class="supplement-bar-fill" style="width:${pct}%;"></div>
        </div>
        <div style="text-align:right; font-size:11px; color:var(--nolia-muted);">${pct}%</div>
        ${reorderHtml}
      </div>`;
  },

  _renderStats(logs) {
    const taken  = logs.filter(l => l.taken).length;
    const streak = Utils.calcStreak(logs);
    document.getElementById('mypage-stats').innerHTML = `
      <div class="report-stats">
        <div class="report-stat">
          <div class="report-stat-val">${logs.length}</div>
          <div class="report-stat-label">記録日数</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val">${streak}</div>
          <div class="report-stat-label">連続記録</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-val">${Math.round(taken / logs.length * 100)}%</div>
          <div class="report-stat-label">服用率</div>
        </div>
      </div>`;
  },

  _renderChart(logs) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas || !window.Chart) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const last30 = logs.slice(-30).filter(l => l.weight);
    if (last30.length < 2) {
      document.getElementById('weight-chart-card').innerHTML =
        '<p style="text-align:center; color:var(--nolia-muted); padding:20px; font-size:13px;">体重データが2件以上あるとグラフが表示されます</p>';
      return;
    }

    this._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: last30.map(l => l.date.slice(5)),
        datasets: [{
          data: last30.map(l => l.weight),
          borderColor: '#2B8A7A',
          backgroundColor: 'rgba(43,138,122,0.1)',
          tension: 0.3, pointRadius: 4, fill: true,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => v + 'kg' } },
          x: { ticks: { maxTicksLimit: 6 } },
        },
      },
    });
  },

  _renderCrossSell(user) {
    const el = document.getElementById('mypage-crosssell');
    if (!el) return;

    const days = user.start_date
      ? Math.floor((new Date() - new Date(user.start_date)) / 86400000) : 0;

    let html = '<div class="section-header">あなたへのご案内</div>';

    if (days >= 30) {
      html += `
        <div class="crosssell-card crosssell-gene" onclick="window.open(CONFIG.GENE_TEST_URL,'_blank')">
          <div class="crosssell-icon">🧬</div>
          <div class="crosssell-body">
            <div class="crosssell-tag">遺伝子検査 / オンライン受付</div>
            <div class="crosssell-title">${days}日間継続中のあなたへ</div>
            <div class="crosssell-desc">自分の体質を遺伝子レベルで知ると、サプリとの相性がさらに明確になります。通販対応・オンライン完結。</div>
          </div>
        </div>`;
    }

    html += `
      <div class="crosssell-card crosssell-gym" onclick="window.open(CONFIG.GYM_URL,'_blank')">
        <div class="crosssell-icon">💪</div>
        <div class="crosssell-body">
          <div class="crosssell-tag">パーソナルジム / 無料相談</div>
          <div class="crosssell-title">専門家があなたの目標をサポート</div>
          <div class="crosssell-desc">カラダのプロが、あなたのリズムとデータに合ったトレーニングプランを提案します。まずは無料相談から。</div>
        </div>
      </div>`;

    el.innerHTML = html;
  },

  openEdit() {
    const u = State.user;
    document.getElementById('edit-display-name').value  = u.display_name || '';
    document.getElementById('edit-birthdate').value     = u.birthdate || '';
    document.getElementById('edit-height').value        = u.height || '';
    document.getElementById('edit-activity').value      = u.exercise_days !== undefined ? String(u.exercise_days) : '0';
    document.getElementById('edit-goal-weight').value   = u.goal_weight || '';
    document.getElementById('modal-profile').classList.add('open');
  },

  closeEdit(e) {
    if (!e || e.target === document.getElementById('modal-profile')) {
      document.getElementById('modal-profile').classList.remove('open');
    }
  },

  async saveEdit() {
    const body = {
      display_name:  document.getElementById('edit-display-name').value.trim(),
      birthdate:     document.getElementById('edit-birthdate').value || '',
      height:        parseFloat(document.getElementById('edit-height').value) || '',
      exercise_days: parseInt(document.getElementById('edit-activity').value),
      goal_weight:   parseFloat(document.getElementById('edit-goal-weight').value) || '',
    };
    if (!body.display_name) { Utils.toast('ニックネームを入力してください', 'error'); return; }

    const res = await Api.call('updateProfile', body);
    if (res.ok) {
      State.user = { ...State.user, ...body, ...res.user };
      document.getElementById('header-username').textContent = State.user.display_name || State.user.name;
      this.closeEdit();
      Utils.toast('プロフィールを更新しました ✓', 'success');
      await this.init();
    } else {
      // エラー内容を表示して原因特定を助ける
      Utils.toast(`更新失敗: ${res.error || '不明なエラー'}`, 'error');
      console.error('updateProfile error:', res);
    }
  },
};

// ─── セットアップ（初回）─────────────────
const Setup = {
  step: 1,

  init() {
    View.show('view-setup');
    this.step = 1;
    this.updateProgress();
    document.getElementById('bottom-nav').style.display = 'none';
  },

  updateProgress() {
    for (let i = 1; i <= 2; i++) {
      const el = document.getElementById(`setup-step-${i}`);
      if (!el) continue;
      el.className = 'setup-step ' + (i < this.step ? 'done' : i === this.step ? 'current' : '');
    }
    document.querySelectorAll('.setup-page').forEach((p, idx) => {
      p.style.display = (idx + 1 === this.step) ? 'block' : 'none';
    });
  },

  next() { this.step++; this.updateProgress(); },

  async save() {
    const btn = document.getElementById('setup-save-btn');
    btn.textContent = '保存中…'; btn.disabled = true;

    const data = {
      display_name: document.getElementById('setup-display-name').value.trim(),
      birthdate:    document.getElementById('setup-birthdate').value,
      start_date:   document.getElementById('setup-start-date').value,
      initial_weight: parseFloat(document.getElementById('setup-initial-weight').value),
      goal_weight:    parseFloat(document.getElementById('setup-goal-weight').value),
      purpose:      document.getElementById('setup-purpose').value,
    };

    const res = await Api.call('setupProfile', data);
    btn.textContent = 'はじめる'; btn.disabled = false;

    if (res.ok) {
      State.user = { ...State.user, ...data };
      document.getElementById('bottom-nav').style.display = 'flex';
      Utils.toast('設定完了！Noliaへようこそ 🌿', 'success');
      await Home.init();
    } else {
      Utils.toast('設定の保存に失敗しました', 'error');
    }
  },
};

// ─── アプリ起動 ───────────────────────────
async function initApp() {
  // ローディング表示
  document.getElementById('view-loading').classList.add('active');
  document.getElementById('bottom-nav').style.display = 'none';

  // トークン取得・検証
  const token = Auth.getToken();
  if (!token) {
    View.show('view-login-error');
    return;
  }

  const user = await Auth.verify(token);
  if (!user) {
    View.show('view-login-error');
    return;
  }

  // 認証成功
  document.getElementById('header-username').textContent = user.display_name || user.name;
  document.getElementById('bottom-nav').style.display = 'flex';

  // 初回セットアップチェック
  if (!user.start_date || !user.birthdate) {
    Setup.init();
  } else {
    await Home.init();
  }
}

// DOMロード後に起動
document.addEventListener('DOMContentLoaded', initApp);
