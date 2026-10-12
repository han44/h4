/* =====================================================================
   员工认可激励平台 · MVP 前端
   原生 JS，无构建步骤，无外部依赖
   ===================================================================== */
(function () {
  'use strict';

  var TOKEN_KEY = 'er_token';

  var state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    me: null,
    settings: { minPointsPerRecognition: 10, maxPointsPerRecognition: 200 },
    tags: [],
    screen: 'home',
    tab: { recognize: 'received', rank: 'all', records: 'received' },
    form: { toId: null, tag: '', points: 100, message: '', q: '' },
    cache: {},
  };

  var NAV = [
    { key: 'home', label: '首页', icon: 'i-home' },
    { key: 'recognize', label: '认可', icon: 'i-heart' },
    { key: 'rank', label: '排行', icon: 'i-trophy' },
    { key: 'mall', label: '商城', icon: 'i-gift' },
    { key: 'me', label: '我的', icon: 'i-user' },
  ];

  /* ------------------------------ 工具 ------------------------------ */

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    if (!name) return '?';
    return name.length <= 2 ? name : name.slice(-2);
  }

  function avatar(name, color, cls) {
    return (
      '<div class="avatar ' + (cls || '') + '" style="background:' + esc(color || '#94A3B8') + '">' +
      esc(initials(name)) + '</div>'
    );
  }

  function icon(id, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return d.getMonth() + 1 + '月' + d.getDate() + '日';
  }

  function toast(msg, type) {
    var wrap = document.getElementById('toast');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2200);
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, {
      method: opts.method || 'GET',
      // 凭证通过 Cookie 传递：部署网关可能覆盖 Authorization 头，
      // 而业务自定义 Cookie 不会被覆盖，因此这里不再手工发送 Authorization。
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });
    var j;
    try {
      j = await res.json();
    } catch (_) {
      throw new Error('服务返回异常');
    }
    if (res.status === 401) {
      logout(true);
      throw new Error('登录已失效，请重新登录');
    }
    if (!j.ok) throw new Error(j.message || '请求失败');
    return j.data;
  }

  /* ------------------------------ 视图：登录 ------------------------------ */

  function viewLogin() {
    return (
      '<div class="login-wrap">' +
      '<div class="login-card">' +
      '<div class="login-logo">' +
      '<div class="lg-ico">' + icon('i-heart', 'icon-lg') + '</div>' +
      '<div class="lg-title">员工认可激励平台</div>' +
      '<div class="lg-sub">让每一份付出都被看见</div>' +
      '</div>' +
      '<div class="field">' +
      '<label class="field-label" for="loginNo">工号</label>' +
      '<input id="loginNo" class="input" type="text" inputmode="numeric" autocomplete="username" placeholder="请输入工号" value="1002">' +
      '</div>' +
      '<div class="field">' +
      '<label class="field-label" for="loginPwd">密码</label>' +
      '<input id="loginPwd" class="input" type="password" autocomplete="current-password" placeholder="请输入密码" value="123456">' +
      '</div>' +
      '<button class="btn btn-primary btn-block" data-action="login">登 录</button>' +
      '<div class="demo-hint">' +
      '<strong>演示账号（密码均为 123456）</strong><br>' +
      '员工：1002 王磊（产品部）<br>' +
      '管理员：1001 李静（人力资源部）' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  /* ------------------------------ 视图：首页 ------------------------------ */

  async function viewHome() {
    var d = await api('/api/dashboard');
    state.cache.dash = d;
    var s = d.stats;
    var me = d.employee;

    var recs = await api('/api/recognitions/received');
    var unread = recs.unread;

    var max = Math.max.apply(null, d.trend.map(function (t) { return t.points; }).concat([1]));
    var trendHtml = d.trend
      .map(function (t) {
        var h = Math.max(3, Math.round((t.points / max) * 70));
        return (
          '<div class="trend-col">' +
          '<div class="trend-val">' + (t.points || '') + '</div>' +
          '<div class="trend-bar' + (t.points ? '' : ' zero') + '" style="height:' + h + 'px"></div>' +
          '<div class="trend-label">' + esc(t.month) + '</div>' +
          '</div>'
        );
      })
      .join('');

    var latest = recs.list.slice(0, 3).map(function (r) { return recItem(r); }).join('') ||
      '<div class="empty"><div class="empty-ico">💌</div><div class="empty-text">还没有收到认可，先去给同事点个赞吧</div></div>';

    return (
      '<div class="hero">' +
      '<div class="hero-top">' +
      '<div>' +
      '<div class="hero-title">员工认可激励平台</div>' +
      '<div class="hero-name">你好，' + esc(me.name) + '</div>' +
      '<div class="hero-sub">' + esc(me.dept) + ' · ' + esc(me.title) + '</div>' +
      '</div>' +
      avatar(me.name, me.avatarColor, 'avatar-lg') +
      '</div>' +
      '<div class="hero-points">' +
      '<div class="hp-item"><div class="hp-num">' + s.points + '</div><div class="hp-label">可兑换积分</div></div>' +
      '<div class="hp-div"></div>' +
      '<div class="hp-item"><div class="hp-num">' + s.giveable + '</div><div class="hp-label">可发放积分</div></div>' +
      '<div class="hp-div"></div>' +
      '<div class="hp-item"><div class="hp-num">' + s.rank + '</div><div class="hp-label">积分排名 / ' + s.total + '</div></div>' +
      '</div>' +
      '</div>' +

      '<div class="quick">' +
      '<button class="quick-item" data-action="go" data-screen="recognize" data-tab="give">' +
      '<div class="quick-ico blue">' + icon('i-send') + '</div><div class="quick-label">给予认可</div></button>' +
      '<button class="quick-item" data-action="go" data-screen="recognize" data-tab="received">' +
      '<div class="quick-ico pink">' + icon('i-bell') + '</div><div class="quick-label">收到认可' +
      (unread ? '<span class="quick-badge">' + unread + '</span>' : '') + '</div></button>' +
      '<button class="quick-item" data-action="go" data-screen="vote">' +
      '<div class="quick-ico gold">' + icon('i-star') + '</div><div class="quick-label">月度之星</div></button>' +
      '<button class="quick-item" data-action="go" data-screen="birthday">' +
      '<div class="quick-ico green">' + icon('i-cake') + '</div><div class="quick-label">生日祝福</div></button>' +
      '</div>' +

      '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-num">' + s.receivedThisMonth + '</div><div class="stat-label">本月收到</div></div>' +
      '<div class="stat"><div class="stat-num green">' + s.sentThisMonth + '</div><div class="stat-label">本月发出</div></div>' +
      '<div class="stat"><div class="stat-num gold">' + s.pointsThisMonth + '</div><div class="stat-label">本月积分</div></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-chart') + '近 6 个月获得积分</div></div>' +
      '<div class="trend">' + trendHtml + '</div>' +
      '</div>' +

      '<div class="sec-title">最新收到的认可</div>' +
      '<div class="list">' + latest + '</div>'
    );
  }

  function recItem(r, showTo) {
    var who = showTo ? r.toName : r.fromName;
    var color = showTo ? r.toColor : r.fromColor;
    var dept = showTo ? r.toDept : r.fromDept;
    return (
      '<div class="list-item">' +
      (r.read ? '' : '<div class="unread-dot"></div>') +
      avatar(who, color) +
      '<div class="item-main">' +
      '<div class="item-title">' + esc(showTo ? '致 ' + who : who) +
      '<span class="tag tag-blue">' + esc(r.tag) + '</span></div>' +
      '<div class="item-sub">' + esc(dept) + ' · ' + fmtDate(r.createdAt) + '</div>' +
      '<div class="item-msg">' + esc(r.message) + '</div>' +
      '</div>' +
      '<div class="item-right"><span class="tag tag-gold">+' + r.points + '</span></div>' +
      '</div>'
    );
  }

  /* ------------------------------ 视图：认可 ------------------------------ */

  async function viewRecognize() {
    var t = state.tab.recognize;
    var head =
      '<div class="topbar"><div class="topbar-title">认可</div></div>' +
      '<div class="tabs">' +
      '<button class="tab' + (t === 'received' ? ' on' : '') + '" data-action="tab" data-group="recognize" data-tab="received">收到认可</button>' +
      '<button class="tab' + (t === 'give' ? ' on' : '') + '" data-action="tab" data-group="recognize" data-tab="give">给予认可</button>' +
      '</div>';

    if (t === 'received') return head + (await viewReceived());
    return head + (await viewGive());
  }

  async function viewReceived() {
    var d = await api('/api/recognitions/received');
    if (!d.list.length) {
      return '<div class="empty"><div class="empty-ico">💌</div><div class="empty-text">还没有收到认可</div></div>';
    }
    var bar =
      d.unread
        ? '<div style="padding:12px 16px 0"><button class="btn btn-ghost btn-block btn-sm" data-action="readAll">全部标记为已读（' + d.unread + '）</button></div>'
        : '';
    return bar + '<div class="list" style="margin-top:12px">' + d.list.map(function (r) { return recItem(r); }).join('') + '</div>';
  }

  async function viewGive() {
    if (!state.cache.employees) {
      var d = await api('/api/employees');
      state.cache.employees = d.employees;
      state.tags = d.valueTags || state.tags;
      state.settings = d.settings || state.settings;
    }
    var list = state.cache.employees.filter(function (e) {
      return !state.form.q || e.name.indexOf(state.form.q) >= 0 || (e.dept || '').indexOf(state.form.q) >= 0;
    });

    var empHtml = list.length
      ? list
          .map(function (e) {
            var on = state.form.toId === e.id;
            return (
              '<div class="list-item" data-action="pickEmp" data-id="' + e.id + '" style="' + (on ? 'background:var(--c-primary-50)' : '') + '">' +
              avatar(e.name, e.avatarColor) +
              '<div class="item-main">' +
              '<div class="item-title">' + esc(e.name) + (on ? '<span class="tag tag-blue">已选</span>' : '') + '</div>' +
              '<div class="item-sub">' + esc(e.dept) + ' · ' + esc(e.title) + '</div>' +
              '</div>' +
              '<div class="item-right"><span class="tag tag-gray">累计 ' + e.receivedPoints + '</span></div>' +
              '</div>'
            );
          })
          .join('')
      : '<div class="empty"><div class="empty-text">没有匹配的同事</div></div>';

    var tagHtml = state.tags
      .map(function (t) {
        return '<button class="chip' + (state.form.tag === t ? ' on' : '') + '" data-action="pickTag" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      })
      .join('');

    var ptsOpts = [20, 50, 100, 150, 200].filter(function (p) {
      return p >= state.settings.minPointsPerRecognition && p <= state.settings.maxPointsPerRecognition;
    });
    var ptsHtml = ptsOpts
      .map(function (p) {
        return '<button class="pts-opt' + (state.form.points === p ? ' on' : '') + '" data-action="pickPts" data-pts="' + p + '">' + p + '</button>';
      })
      .join('');

    var target = state.cache.employees.find(function (e) { return e.id === state.form.toId; });

    return (
      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-search') + '选择同事</div>' +
      '<div class="card-more">' + state.cache.employees.length + ' 人</div></div>' +
      '<input id="empSearch" class="input" placeholder="搜索姓名或部门" value="' + esc(state.form.q) + '">' +
      '</div>' +
      '<div class="list" style="margin-top:0">' + empHtml + '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-star') + '价值观标签</div></div>' +
      '<div class="chips">' + tagHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-coin') + '发放积分</div>' +
      '<div class="card-more">单次 ' + state.settings.minPointsPerRecognition + ' ~ ' + state.settings.maxPointsPerRecognition + '</div></div>' +
      '<div class="pts-row">' + ptsHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-send') + '认可理由</div></div>' +
      '<textarea id="recMessage" class="textarea" maxlength="200" placeholder="说说 TA 做得出色的地方（至少 5 个字）">' + esc(state.form.message) + '</textarea>' +
      '</div>' +

      '<div style="margin:0 16px 24px">' +
      '<button class="btn btn-primary btn-block" data-action="submitRec"' + (state.form.toId ? '' : ' disabled') + '>' +
      (target ? '向 ' + esc(target.name) + ' 发放 ' + state.form.points + ' 积分' : '请先选择同事') +
      '</button>' +
      '</div>'
    );
  }

  /* ------------------------------ 视图：排行榜 ------------------------------ */

  async function viewRank() {
    var scope = state.tab.rank;
    var d = await api('/api/leaderboard?scope=' + scope);

    var podium = '';
    if (d.board.length >= 3) {
      var order = [1, 0, 2]; // 名次 2、1、3 的视觉排列
      podium =
        '<div class="podium">' +
        order
          .map(function (i) {
            var e = d.board[i];
            if (!e) return '';
            return (
              '<div class="pod pod-' + i + '">' +
              '<div class="pod-avatar" style="background:' + esc(e.avatarColor) + '">' + esc(initials(e.name)) + '</div>' +
              '<div class="pod-name">' + esc(e.name) + '</div>' +
              '<div class="pod-pts">' + e.receivedPoints + '</div>' +
              '<div class="pod-base"></div>' +
              '</div>'
            );
          })
          .join('') +
        '</div>';
    }

    var rows = d.board
      .map(function (e) {
        return (
          '<div class="rank-row' + (e.isMe ? ' me' : '') + '">' +
          '<div class="rank-no' + (e.rank <= 3 ? ' top' : '') + '">' + e.rank + '</div>' +
          avatar(e.name, e.avatarColor, 'avatar-sm') +
          '<div class="rank-info"><div class="rank-name">' + esc(e.name) + (e.isMe ? ' <span class="tag tag-blue">我</span>' : '') + '</div>' +
          '<div class="rank-dept">' + esc(e.dept) + ' · 收到 ' + e.receivedCount + ' 次</div></div>' +
          '<div class="rank-pts">' + e.receivedPoints + '</div>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="topbar"><div class="topbar-title">排行榜</div></div>' +
      '<div class="tabs">' +
      '<button class="tab' + (scope === 'all' ? ' on' : '') + '" data-action="tab" data-group="rank" data-tab="all">全员</button>' +
      '<button class="tab' + (scope === 'dept' ? ' on' : '') + '" data-action="tab" data-group="rank" data-tab="dept">' + esc(d.dept) + '</button>' +
      '</div>' +
      podium +
      '<div class="list" style="margin-top:12px">' + rows + '</div>'
    );
  }

  /* ------------------------------ 视图：积分商城 ------------------------------ */

  async function viewMall() {
    var d = await api('/api/rewards');
    var grid = d.rewards
      .map(function (r) {
        return (
          '<div class="goods">' +
          '<div class="goods-emoji">' + esc(r.emoji) + '</div>' +
          '<div class="goods-body">' +
          '<div class="goods-name">' + esc(r.name) + '</div>' +
          '<div class="goods-desc">' + esc(r.desc) + '</div>' +
          '<div class="goods-foot">' +
          '<div class="goods-cost">' + r.cost + ' 分</div>' +
          '<button class="btn btn-sm ' + (r.affordable ? 'btn-gold' : 'btn-ghost') + '" data-action="redeem" data-id="' + r.id + '"' +
          (r.affordable && r.stock > 0 ? '' : ' disabled') + '>' +
          (r.stock <= 0 ? '已兑完' : r.affordable ? '兑换' : '积分不足') + '</button>' +
          '</div>' +
          '<div class="goods-stock" style="margin-top:4px">库存 ' + r.stock + (r.redeemedCount ? ' · 已兑 ' + r.redeemedCount + ' 次' : '') + '</div>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="hero" style="padding-bottom:24px">' +
      '<div class="hero-top"><div>' +
      '<div class="hero-title">积分商城</div>' +
      '<div class="hero-name">' + d.points + ' 分</div>' +
      '<div class="hero-sub">可用于兑换以下权益</div>' +
      '</div>' +
      '<div style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center">' +
      icon('i-gift', 'icon-lg') + '</div>' +
      '</div></div>' +
      '<div class="mall-grid">' + grid + '</div>' +
      '<div style="margin:0 16px 24px"><button class="btn btn-outline btn-block" data-action="go" data-screen="records" data-tab="redeem">查看兑换记录' + icon('i-right') + '</button></div>'
    );
  }

  /* ------------------------------ 视图：我的 ------------------------------ */

  function viewMe() {
    var me = state.me;
    var entries = [
      { screen: 'records', icon: 'i-clock', color: 'var(--grad-primary)', label: '我的记录', sub: '收到 / 发出 / 兑换' },
      { screen: 'vote', icon: 'i-star', color: 'var(--grad-gold)', label: '月度之星投票', sub: '为优秀的 TA 投一票' },
      { screen: 'birthday', icon: 'i-cake', color: 'linear-gradient(135deg,#F472B6,#EC4899)', label: '生日祝福', sub: '本月寿星与祝福' },
    ];
    if (me && me.role === 'admin') {
      entries.push({ screen: 'admin', icon: 'i-shield', color: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', label: '管理后台', sub: '员工 / 积分 / 数据概览' });
    }

    return (
      '<div class="hero" style="padding-bottom:28px">' +
      '<div class="hero-top">' +
      '<div>' +
      '<div class="hero-name">' + esc(me.name) + '</div>' +
      '<div class="hero-sub">' + esc(me.dept) + ' · ' + esc(me.title) + '</div>' +
      '<div class="hero-sub">工号 ' + esc(me.no) + ' · 生日 ' + esc(me.birthday) + '</div>' +
      '</div>' +
      avatar(me.name, me.avatarColor, 'avatar-lg') +
      '</div>' +
      '<div class="hero-points">' +
      '<div class="hp-item"><div class="hp-num">' + me.points + '</div><div class="hp-label">可兑换积分</div></div>' +
      '<div class="hp-div"></div>' +
      '<div class="hp-item"><div class="hp-num">' + me.giveable + '</div><div class="hp-label">可发放积分</div></div>' +
      '</div>' +
      '</div>' +

      '<div class="list" style="margin-top:16px">' +
      entries
        .map(function (e) {
          return (
            '<button class="entry" data-action="go" data-screen="' + e.screen + '">' +
            '<div class="entry-ico" style="background:' + e.color + '">' + icon(e.icon) + '</div>' +
            '<div class="entry-label"><div>' + esc(e.label) + '</div>' +
            '<div style="font-size:12px;color:var(--c-text-muted);font-weight:400">' + esc(e.sub) + '</div></div>' +
            icon('i-right') +
            '</button>'
          );
        })
        .join('') +
      '</div>' +

      '<div style="margin:16px">' +
      '<button class="btn btn-ghost btn-block" data-action="logout">' + icon('i-logout') + '退出登录</button>' +
      '</div>'
    );
  }

  /* ------------------------------ 视图：我的记录 ------------------------------ */

  async function viewRecords() {
    var t = state.tab.records;
    var body = '';
    if (t === 'received') {
      var a = await api('/api/recognitions/received');
      body = a.list.length
        ? '<div class="list" style="margin-top:12px">' + a.list.map(function (r) { return recItem(r); }).join('') + '</div>'
        : '<div class="empty"><div class="empty-ico">💌</div><div class="empty-text">暂无收到的认可</div></div>';
    } else if (t === 'sent') {
      var b = await api('/api/recognitions/sent');
      body = b.list.length
        ? '<div class="list" style="margin-top:12px">' + b.list.map(function (r) { return recItem(r, true); }).join('') + '</div>'
        : '<div class="empty"><div class="empty-ico">📤</div><div class="empty-text">还没有发出认可</div></div>';
    } else {
      var c = await api('/api/redemptions/mine');
      body = c.list.length
        ? '<div class="list" style="margin-top:12px">' +
          c.list
            .map(function (r) {
              return (
                '<div class="list-item">' +
                '<div class="avatar" style="background:var(--c-gold-500);font-size:20px">' + esc(r.emoji || '🎁') + '</div>' +
                '<div class="item-main">' +
                '<div class="item-title">' + esc(r.name) + '</div>' +
                '<div class="item-sub">' + fmtDate(r.createdAt) + ' · ' + esc(r.status) + '</div>' +
                '</div>' +
                '<div class="item-right"><span class="tag tag-gold">-' + r.cost + '</span></div>' +
                '</div>'
              );
            })
            .join('') +
          '</div>'
        : '<div class="empty"><div class="empty-ico">🎁</div><div class="empty-text">暂无兑换记录</div></div>';
    }

    return (
      '<div class="topbar">' +
      '<button class="icon-btn" data-action="go" data-screen="me">' + icon('i-back') + '</button>' +
      '<div class="topbar-title">我的记录</div></div>' +
      '<div class="tabs">' +
      '<button class="tab' + (t === 'received' ? ' on' : '') + '" data-action="tab" data-group="records" data-tab="received">收到</button>' +
      '<button class="tab' + (t === 'sent' ? ' on' : '') + '" data-action="tab" data-group="records" data-tab="sent">发出</button>' +
      '<button class="tab' + (t === 'redeem' ? ' on' : '') + '" data-action="tab" data-group="records" data-tab="redeem">兑换</button>' +
      '</div>' +
      body
    );
  }

  /* ------------------------------ 视图：投票 ------------------------------ */

  async function viewVote() {
    var d = await api('/api/vote/current');
    if (!d.vote) return '<div class="topbar"><div class="topbar-title">月度之星</div></div><div class="empty"><div class="empty-ico">🗳️</div><div class="empty-text">当前没有进行中的投票</div></div>';
    var v = d.vote;

    return (
      '<div class="topbar">' +
      '<button class="icon-btn" data-action="go" data-screen="home">' + icon('i-back') + '</button>' +
      '<div class="topbar-title">' + esc(v.title) + '</div></div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-star') + esc(v.title) + '</div>' +
      '<span class="tag ' + (v.myCandidateId ? 'tag-green' : 'tag-gold') + '">' + (v.myCandidateId ? '已投票' : '待投票') + '</span></div>' +
      '<div style="font-size:12.5px;color:var(--c-text-muted)">共 ' + v.totalVotes + ' 票 · 截止 ' + fmtDate(v.deadline) + '</div>' +
      '</div>' +

      v.candidates
        .map(function (c) {
          return (
            '<div class="cand' + (v.myCandidateId === c.id ? ' on' : '') + '">' +
            '<div class="cand-top">' +
            avatar(c.name, c.avatarColor, 'avatar-lg') +
            '<div class="cand-info">' +
            '<div class="cand-name">' + esc(c.name) + (c.isMe ? ' <span class="tag tag-blue">我</span>' : '') + '</div>' +
            '<div class="cand-reason">' + esc(c.dept) + ' · ' + esc(c.title) + '<br>' + esc(c.reason) + '</div>' +
            '</div>' +
            '<button class="btn btn-sm ' + (v.myCandidateId === c.id ? 'btn-ghost' : 'btn-primary') + '" data-action="vote" data-id="' + c.id + '">' +
            (v.myCandidateId === c.id ? '已选' : '投 TA') + '</button>' +
            '</div>' +
            '<div class="bar"><div class="bar-fill" style="width:' + c.percent + '%"></div></div>' +
            '<div class="bar-meta"><span>' + c.count + ' 票</span><span>' + c.percent + '%</span></div>' +
            '</div>'
          );
        })
        .join('') +
      '<div style="height:16px"></div>'
    );
  }

  /* ------------------------------ 视图：生日祝福 ------------------------------ */

  async function viewBirthday() {
    var d = await api('/api/birthdays');
    if (!d.list.length) {
      return '<div class="topbar"><button class="icon-btn" data-action="go" data-screen="home">' + icon('i-back') + '</button><div class="topbar-title">生日祝福</div></div>' +
        '<div class="empty"><div class="empty-ico">🎂</div><div class="empty-text">本月没有寿星</div></div>';
    }

    return (
      '<div class="topbar">' +
      '<button class="icon-btn" data-action="go" data-screen="home">' + icon('i-back') + '</button>' +
      '<div class="topbar-title">' + d.month + ' 月生日</div></div>' +
      '<div style="padding:16px 16px 0;font-size:13px;color:var(--c-text-secondary)">本月共 ' + d.list.length + ' 位寿星，送上你的祝福吧 🎉</div>' +

      d.list
        .map(function (b) {
          return (
            '<div class="bday' + (b.isToday ? ' today' : '') + '">' +
            avatar(b.name, b.avatarColor, 'avatar-lg') +
            '<div class="bday-info">' +
            '<div class="bday-name">' + esc(b.name) +
            (b.isToday ? '<span class="tag tag-pink">今天</span>' : '') +
            (b.isMe ? '<span class="tag tag-blue">我</span>' : '') +
            '</div>' +
            '<div style="font-size:12.5px;color:var(--c-text-muted);margin-top:2px">' +
            esc(b.dept) + ' · ' + b.birthday.slice(5).replace('-', ' 月 ') + ' 日' +
            (b.isToday ? '' : ' · ' + (b.daysLeft > 0 ? '还有 ' + b.daysLeft + ' 天' : '已过')) +
            '</div>' +
            '<div style="font-size:12px;color:var(--c-primary-600);margin-top:4px">已收到 ' + b.blessingCount + ' 条祝福</div>' +
            '</div>' +
            (b.isMe
              ? '<span class="tag tag-gold">🎂</span>'
              : '<button class="btn btn-sm ' + (b.blessedByMe ? 'btn-ghost' : 'btn-primary') + '" data-action="bless" data-id="' + b.id + '">' +
                (b.blessedByMe ? '已祝福' : '送祝福') + '</button>') +
            '</div>'
          );
        })
        .join('') +
      '<div style="height:16px"></div>'
    );
  }

  /* ------------------------------ 视图：管理后台 ------------------------------ */

  async function viewAdmin() {
    var ov = await api('/api/admin/overview');
    var empD = await api('/api/admin/employees');
    state.cache.adminEmps = empD.employees;

    var maxDept = Math.max.apply(null, ov.deptStats.map(function (d) { return d.points; }).concat([1]));
    var maxTag = Math.max.apply(null, ov.tagStats.map(function (t) { return t.count; }).concat([1]));

    var deptHtml = ov.deptStats
      .map(function (d) {
        return (
          '<div class="dept-row">' +
          '<div class="dept-name">' + esc(d.dept) + '</div>' +
          '<div class="dept-bar"><div class="dept-fill" style="width:' + Math.round((d.points / maxDept) * 100) + '%"></div></div>' +
          '<div class="dept-val">' + d.points + '</div>' +
          '</div>'
        );
      })
      .join('');

    var tagHtml = ov.tagStats
      .map(function (t) {
        return (
          '<div class="dept-row">' +
          '<div class="dept-name">' + esc(t.tag) + '</div>' +
          '<div class="dept-bar"><div class="dept-fill" style="width:' + Math.round((t.count / maxTag) * 100) + '%"></div></div>' +
          '<div class="dept-val">' + t.count + '</div>' +
          '</div>'
        );
      })
      .join('');

    var options = empD.employees
      .map(function (e) {
        return '<option value="' + e.id + '">' + esc(e.name) + '（' + esc(e.dept) + '）</option>';
      })
      .join('');

    var rows = empD.employees
      .map(function (e) {
        return (
          '<div class="rank-row">' +
          '<div class="rank-no">' + (e.role === 'admin' ? '★' : '') + '</div>' +
          avatar(e.name, e.avatarColor, 'avatar-sm') +
          '<div class="rank-info"><div class="rank-name">' + esc(e.name) + ' <span class="tag tag-gray">' + esc(e.no) + '</span></div>' +
          '<div class="rank-dept">' + esc(e.dept) + ' · 收到 ' + e.receivedCount + ' 次 / 发出 ' + e.sentCount + ' 次</div></div>' +
          '<div class="rank-pts">' + e.receivedPoints + '</div>' +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="topbar">' +
      '<button class="icon-btn" data-action="go" data-screen="me">' + icon('i-back') + '</button>' +
      '<div class="topbar-title">管理后台</div></div>' +

      '<div class="admin-grid">' +
      '<div class="admin-stat"><div class="admin-num">' + ov.headcount + '</div><div class="admin-label">在职员工</div></div>' +
      '<div class="admin-stat"><div class="admin-num">' + ov.recognitionTotal + '</div><div class="admin-label">累计认可</div></div>' +
      '<div class="admin-stat"><div class="admin-num">' + ov.recognitionThisMonth + '</div><div class="admin-label">本月认可</div></div>' +
      '<div class="admin-stat"><div class="admin-num">' + ov.pointsThisMonth + '</div><div class="admin-label">本月发放积分</div></div>' +
      '<div class="admin-stat"><div class="admin-num">' + ov.redeemedTotal + '</div><div class="admin-label">累计兑换</div></div>' +
      '<div class="admin-stat"><div class="admin-num">' + ov.pendingGiveable + '</div><div class="admin-label">待发放积分池</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div class="card-title">' + icon('i-users') + '部门认可分布</div></div>' + deptHtml + '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">' + icon('i-heart') + '价值观分布</div></div>' + tagHtml + '</div>' +

      '<div class="card">' +
      '<div class="card-head"><div class="card-title">' + icon('i-coin') + '发放积分</div></div>' +
      '<div class="field"><select id="grantEmp" class="select">' + options + '</select></div>' +
      '<div class="field"><input id="grantPts" class="input" type="number" min="1" step="10" value="200" placeholder="积分数量"></div>' +
      '<button class="btn btn-primary btn-block" data-action="grant">确认发放</button>' +
      '</div>' +

      '<div class="sec-title">员工列表</div>' +
      '<div class="list" style="margin-top:0">' + rows + '</div>' +
      '<div style="height:16px"></div>'
    );
  }

  /* ------------------------------ 路由与渲染 ------------------------------ */

  var VIEWS = {
    home: viewHome,
    recognize: viewRecognize,
    rank: viewRank,
    mall: viewMall,
    me: viewMe,
    records: viewRecords,
    vote: viewVote,
    birthday: viewBirthday,
    admin: viewAdmin,
  };

  async function render() {
    var el = document.getElementById('app');
    var bar = document.getElementById('tabbar');

    if (!state.token) {
      bar.hidden = true;
      el.innerHTML = viewLogin();
      return;
    }

    bar.hidden = false;
    renderTabbar();
    el.innerHTML = '<div class="boot">加载中…</div>';
    try {
      el.innerHTML = await VIEWS[state.screen]();
      window.scrollTo(0, 0);
    } catch (e) {
      el.innerHTML = '<div class="empty"><div class="empty-ico">⚠️</div><div class="empty-text">' + esc(e.message) + '</div>' +
        '<div style="margin-top:16px"><button class="btn btn-outline" data-action="retry">重试</button></div></div>';
    }
  }

  function renderTabbar() {
    var unread = (state.cache.dash && state.cache.dash.stats.unread) || 0;
    document.getElementById('tabbar').innerHTML = NAV.map(function (n) {
      var on = state.screen === n.key || (state.screen === 'records' && n.key === 'me');
      var dot = n.key === 'recognize' && unread ? '<span class="tab-dot"></span>' : '';
      return '<button class="tab-item' + (on ? ' on' : '') + '" data-action="go" data-screen="' + n.key + '">' +
        dot + icon(n.icon) + '<span class="tab-label">' + n.label + '</span></button>';
    }).join('');
  }

  function go(screen, tab) {
    if (tab) {
      if (screen === 'recognize') state.tab.recognize = tab;
      if (screen === 'records') state.tab.records = tab;
    }
    state.screen = screen;
    render();
  }

  function logout(silent) {
    state.token = '';
    state.me = null;
    state.cache = {};
    localStorage.removeItem(TOKEN_KEY);
    // 同步清除服务端下发的会话 Cookie
    try {
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (_) {}
    if (!silent) {
      state.screen = 'home';
      render();
    }
  }

  /* ------------------------------ 交互动作 ------------------------------ */

  var ACTIONS = {
    async login() {
      var no = document.getElementById('loginNo').value.trim();
      var pwd = document.getElementById('loginPwd').value;
      if (!no || !pwd) return toast('请输入工号与密码', 'err');
      try {
        var d = await api('/api/auth/login', { method: 'POST', body: { no: no, password: pwd } });
        state.token = d.token;
        state.me = d.employee;
        localStorage.setItem(TOKEN_KEY, d.token);
        state.screen = 'home';
        toast('欢迎回来，' + d.employee.name, 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    go(el) {
      go(el.dataset.screen, el.dataset.tab);
    },

    tab(el) {
      state.tab[el.dataset.group] = el.dataset.tab;
      render();
    },

    retry() { render(); },

    pickEmp(el) {
      state.form.toId = el.dataset.id;
      render();
    },

    pickTag(el) {
      state.form.tag = el.dataset.tag;
      render();
    },

    pickPts(el) {
      state.form.points = Number(el.dataset.pts);
      render();
    },

    async submitRec() {
      var f = state.form;
      if (!f.toId) return toast('请先选择同事', 'err');
      if (!f.tag) return toast('请选择价值观标签', 'err');
      if (f.message.trim().length < 5) return toast('认可理由至少 5 个字', 'err');
      try {
        await api('/api/recognitions', {
          method: 'POST',
          body: { toId: f.toId, tag: f.tag, message: f.message.trim(), points: f.points },
        });
        state.form = { toId: null, tag: '', points: 100, message: '', q: '' };
        state.tab.recognize = 'received';
        toast('认可已送出 👏', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    async readAll() {
      try {
        await api('/api/recognitions/read-all', { method: 'POST' });
        toast('已全部标记为已读', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    async redeem(el) {
      var id = el.dataset.id;
      try {
        var d = await api('/api/rewards/' + id + '/redeem', { method: 'POST' });
        toast('兑换成功，剩余 ' + d.points + ' 分', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    async vote(el) {
      try {
        await api('/api/vote/v1/vote', { method: 'POST', body: { candidateId: el.dataset.id } });
        toast('投票成功 🎉', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    async bless(el) {
      try {
        await api('/api/birthdays/' + el.dataset.id + '/bless', { method: 'POST', body: { message: '生日快乐，愿你一切顺利！' } });
        toast('祝福已送达 🎂', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    async grant() {
      var empId = document.getElementById('grantEmp').value;
      var pts = Number(document.getElementById('grantPts').value);
      if (!pts || pts <= 0) return toast('请输入正确的积分数量', 'err');
      try {
        var d = await api('/api/admin/grant', { method: 'POST', body: { employeeId: empId, points: pts, reason: '管理后台发放' } });
        toast('已向 ' + d.employee.name + ' 发放 ' + pts + ' 积分', 'ok');
        render();
      } catch (e) {
        toast(e.message, 'err');
      }
    },

    logout() {
      logout(false);
      toast('已退出登录');
    },
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id === 'recMessage') state.form.message = el.value;
    if (el.id === 'empSearch') {
      state.form.q = el.value.trim();
      var box = document.querySelectorAll('.list')[1];
      // 仅重绘同事列表，避免整页重渲染导致输入框失焦
      api('/api/employees').then(function (d) {
        var list = d.employees.filter(function (x) {
          return !state.form.q || x.name.indexOf(state.form.q) >= 0 || (x.dept || '').indexOf(state.form.q) >= 0;
        });
        box.innerHTML = list.length
          ? list
              .map(function (x) {
                var on = state.form.toId === x.id;
                return '<div class="list-item" data-action="pickEmp" data-id="' + x.id + '" style="' + (on ? 'background:var(--c-primary-50)' : '') + '">' +
                  avatar(x.name, x.avatarColor) +
                  '<div class="item-main"><div class="item-title">' + esc(x.name) + (on ? '<span class="tag tag-blue">已选</span>' : '') + '</div>' +
                  '<div class="item-sub">' + esc(x.dept) + ' · ' + esc(x.title) + '</div></div>' +
                  '<div class="item-right"><span class="tag tag-gray">累计 ' + x.receivedPoints + '</span></div></div>';
              })
              .join('')
          : '<div class="empty"><div class="empty-text">没有匹配的同事</div></div>';
      });
    }
  });

  /* ------------------------------ 启动 ------------------------------ */

  async function init() {
    // 登录态以服务端 Cookie 为准（localStorage 仅作本地镜像）。
    // 无任何凭证痕迹时直接渲染登录页，避免产生无意义的 401 探测请求。
    var hasCookie = document.cookie.indexOf('er_token=') >= 0;
    if (!state.token && !hasCookie) {
      render();
      return;
    }
    try {
      var d = await api('/api/me');
      state.me = d.employee;
      state.settings = d.settings || state.settings;
      state.tags = d.valueTags || state.tags;
      if (!state.token) state.token = 'cookie';
    } catch (_) {
      state.token = '';
      state.me = null;
    }
    render();
  }

  init();
})();
