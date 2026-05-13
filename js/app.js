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
      const url = `${CONFIG.API_BASE}?action=${action}`;
      const options = {
        method,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: method === 'GET' ? undefined : JSON.stringify({
          ...payload,
          token: State.token,
        }),
      };
      if (method === 'GET') {
        const params = new URLSearchParams({ action, token: State.token, ...payload });
        const res = await fetch(`${CONFIG.API_BASE}?${params}`);
        return await res.json();
      }
      const res = await fetch(url, options);
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
    }

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
  async init() {
    View.show('view-mypage');

    // ユーザー情報表示
    document.getElementById('mypage-name').textContent = State.user.display_name || State.user.name;
    document.getElementById('mypage-since').textContent =
      State.user.start_date ? `サプリ開始: ${Utils.formatDate(State.user.start_date)}` : '';

    // 記録データ取得
    const res = await Api.call('getDailyLogs', { days: 90 }, 'GET');
    if (res.ok && res.logs.length > 0) {
      this.renderChart(res.logs);
      this.renderStats(res.logs);
    }
  },

  renderStats(logs) {
    const taken = logs.filter(l => l.taken).length;
    const streak = Utils.calcStreak(logs);
    const el = document.getElementById('mypage-stats');
    el.innerHTML = `
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
          <div class="report-stat-val">${Math.round(taken/logs.length*100)}%</div>
          <div class="report-stat-label">服用率</div>
        </div>
      </div>`;
  },

  renderChart(logs) {
    const canvas = document.getElementById('weight-chart');
    if (!canvas || !window.Chart) return;
    const last30 = logs.slice(-30).filter(l => l.weight);
    if (last30.length < 2) return;

    new Chart(canvas, {
      type: 'line',
      data: {
        labels: last30.map(l => l.date.slice(5)),  // MM-DD
        datasets: [{
          data: last30.map(l => l.weight),
          borderColor: '#2B8A7A',
          backgroundColor: 'rgba(43,138,122,0.1)',
          tension: 0.3,
          pointRadius: 4,
          fill: true,
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
