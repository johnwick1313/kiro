// =============================================================
// Sunlit Exchange — 프론트엔드 메인 로직
// =============================================================

const POLL_MS  = 3000
const FEE_RATE = 0.005

// ── 상태 ──
const S = {
  prices:      {},
  meta:        {},
  selected:    null,
  orderSide:   'buy',   // 'buy' | 'sell'
  sectorFilter:'ALL',
  searchQuery: '',
  user: { uuid: null, username: null, data: null, isOp: false },
  chart:       null,
  prevPrices:  {},
  lastPriceTs: {},
}

// ── DOM ──
const $  = id => document.getElementById(id)
const $$ = sel => document.querySelectorAll(sel)

// ── 테마 (라이트 기본 + 다크 토글, localStorage 영속) ──
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
    const t = $('theme-toggle'); if (t) t.textContent = '☀️'
  } else {
    document.documentElement.removeAttribute('data-theme')
    const t = $('theme-toggle'); if (t) t.textContent = '🌙'
  }
  localStorage.setItem('sunlit-theme', theme)
  // 차트 색상 갱신
  if (S.chart) { S.chart.destroy(); S.chart = null; if (S.selected) renderChart() }
}
function toggleTheme() {
  const cur = localStorage.getItem('sunlit-theme') || 'light'
  applyTheme(cur === 'dark' ? 'light' : 'dark')
}
// 초기 테마 적용 (저장값 없으면 라이트)
applyTheme(localStorage.getItem('sunlit-theme') || 'light')

// ── 포맷 ──
const fmtG   = n => (+(n||0)).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' G'
const fmtPct = n => (n>=0?'+':'') + (+(n||0)).toFixed(2) + '%'
const fmtTime= ts => ts ? new Date(ts).toLocaleTimeString('ko-KR',{hour12:false}) : '--'
const fmtDate= ts => ts ? new Date(ts).toLocaleString('ko-KR',{hour12:false}) : '--'
const plClass= n => n >= 0 ? 'up' : 'down'

// ── API ──
async function api(path, opts) {
  try {
    const r = await fetch(path, opts)
    return await r.json()
  } catch(e) { return { ok:false, message:'네트워크 오류: '+e.message } }
}

// =============================================================
// 자동 로그인 (URL ?uuid= 파라미터)
// =============================================================
async function autoLogin() {
  const params = new URLSearchParams(location.search)
  const uuid   = params.get('uuid')

  if (uuid) {
    // UUID가 URL에 있으면 해당 플레이어로 로그인
    const r = await api('/api/player/' + encodeURIComponent(uuid))
    if (!r.ok) {
      setUserDisplay(null)
      showConnLabel('UUID를 찾을 수 없음 (인게임 접속 필요)')
      return
    }
    S.user.uuid     = uuid
    S.user.username = r.username
    S.user.data     = r
    S.user.isOp     = !!r.isOp
  } else {
    // UUID 없으면 자동 로그인 (가장 최근 플레이어)
    const r = await api('/api/auto-login')
    if (!r.ok) {
      setUserDisplay(null)
      showConnLabel('인게임에서 !주식 를 한번 사용해주세요')
      return
    }
    S.user.uuid     = r.uuid
    S.user.username = r.username
    S.user.data     = r
    S.user.isOp     = !!r.isOp
  }

  setUserDisplay(S.user.username, S.user.isOp)
  renderAccount()

  // OP 이면 관리자 탭 표시
  if (S.user.isOp) {
    $('admin-nav-btn').classList.remove('hidden')
  }
}

function setUserDisplay(name, isOp) {
  if (!name) {
    $('user-avatar').textContent     = '?'
    $('user-display-name').textContent = '미접속'
    return
  }
  $('user-avatar').textContent       = name[0].toUpperCase()
  $('user-display-name').textContent = name + (isOp ? ' 👑' : '')
}

function showConnLabel(msg) {
  $('conn-label').textContent = msg || ''
}

// =============================================================
// 상태 폴링
// =============================================================
async function poll() {
  const d = await api('/api/state')
  if (!d || !d.ok) {
    $('conn-dot').className = 'conn-dot offline'
    $('conn-label').textContent = '오프라인'
    return
  }
  $('conn-dot').className = 'conn-dot online'
  $('conn-label').textContent = '실시간'

  S.prevPrices = Object.fromEntries(
    Object.entries(S.prices).map(([k,v]) => [k, v.current])
  )
  S.prices = d.prices || {}
  S.meta   = d.meta   || {}

  renderStockList()
  renderTicker()
  updateCalc()
  if (S.selected) renderChart()

  // 플레이어 데이터 갱신
  if (S.user.uuid) {
    const r = await api('/api/player/' + encodeURIComponent(S.user.uuid))
    if (r && r.ok) {
      S.user.data  = r
      S.user.isOp  = !!r.isOp
      renderAccount()
    }
  }
}

// =============================================================
// 종목 리스트
// =============================================================
function renderStockList() {
  const stocks = (S.meta.stocks || []).filter(s => {
    if (S.sectorFilter !== 'ALL' && s.sector !== S.sectorFilter) return false
    if (S.searchQuery && !s.symbol.includes(S.searchQuery.toUpperCase()) &&
        !s.name.includes(S.searchQuery)) return false
    return true
  })

  const container = $('stock-list')
  const existing  = new Map([...container.querySelectorAll('.stock-item')].map(el => [el.dataset.sym, el]))

  const seen = new Set()
  stocks.forEach(s => {
    const p   = S.prices[s.symbol] || {}
    const cur = p.current || 0
    const chg = p.change  || 0
    const prev= S.prevPrices[s.symbol]

    let el = existing.get(s.symbol)
    if (!el) {
      el = document.createElement('div')
      el.className = 'stock-item'
      el.dataset.sym = s.symbol
      el.innerHTML = `
        <div class="si-symbol"></div><div class="si-price"></div>
        <div class="si-name"></div><div class="si-change"></div>`
      el.addEventListener('click', () => selectStock(s.symbol))
      container.appendChild(el)
    }

    el.querySelector('.si-symbol').textContent = s.symbol
    el.querySelector('.si-name').textContent   = s.name
    el.querySelector('.si-price').textContent  = fmtG(cur)
    el.querySelector('.si-price').className    = 'si-price ' + plClass(chg)

    const chgEl = el.querySelector('.si-change')
    chgEl.textContent = fmtPct(chg)
    chgEl.className   = 'si-change ' + plClass(chg)

    el.classList.toggle('active', S.selected === s.symbol)

    // 가격 변동 플래시
    if (prev !== undefined && prev !== cur) {
      el.classList.remove('flash-up','flash-down')
      void el.offsetWidth
      el.classList.add(cur > prev ? 'flash-up' : 'flash-down')
    }
    seen.add(s.symbol)
  })

  existing.forEach((el, sym) => { if (!seen.has(sym)) el.remove() })
}

// =============================================================
// 종목 선택 & 차트
// =============================================================
function selectStock(symbol) {
  S.selected = symbol
  renderStockList()
  renderHero()
  renderChart()
  updateCalc()
  $('order-btn').disabled = !symbol
}

function renderHero() {
  const sym = S.selected
  if (!sym) return
  const s = (S.meta.stocks||[]).find(x => x.symbol === sym) || {}
  const p = S.prices[sym] || {}

  $('hero-symbol').textContent = sym
  $('hero-name').textContent   = s.name || sym
  $('hero-sector').textContent = s.sector || ''
  $('hero-price').textContent  = fmtG(p.current)
  $('hero-price').className    = 'hero-price ' + plClass(p.change)
  $('hero-change').textContent = fmtPct(p.change) + (p.change >= 0 ? ' ▲' : ' ▼')
  $('hero-change').className   = 'hero-change ' + plClass(p.change)

  $('o-open').textContent = fmtG(p.open)
  $('o-high').textContent = fmtG(p.high)
  $('o-low').textContent  = fmtG(p.low)
  $('o-base').textContent = fmtG(s.basePrice)
  $('o-vol').textContent  = s.volatility ? (s.volatility * 100).toFixed(0) + '%' : '--'
}

function renderChart() {
  const sym = S.selected
  if (!sym) return

  const p       = S.prices[sym] || {}
  const history = p.history || []
  const isUp    = (p.change || 0) >= 0
  const upC     = cssVar('--up')   || '#e22c3a'
  const downC   = cssVar('--down') || '#2f6bff'
  const color   = isUp ? upC : downC
  const fillUp  = cssVar('--up-soft')   || 'rgba(226,44,58,.10)'
  const fillDn  = cssVar('--down-soft') || 'rgba(47,107,255,.10)'
  const gridC   = cssVar('--hairline')  || 'rgba(0,0,0,0.06)'
  const tickC   = cssVar('--muted')     || '#8b95a7'
  const tipBg   = cssVar('--bg2')       || '#f7f8fa'
  const tipTxt  = cssVar('--text')      || '#1a1d24'
  const labels  = history.map(h => fmtTime(h.t))
  const data    = history.map(h => h.p)

  $('chart-placeholder').classList.add('hidden')

  if (S.chart) {
    S.chart.data.labels = labels
    S.chart.data.datasets[0].data            = data
    S.chart.data.datasets[0].borderColor     = color
    S.chart.data.datasets[0].backgroundColor = isUp ? fillUp : fillDn
    S.chart.update('none')
    return
  }

  const ctx = $('price-chart').getContext('2d')
  S.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor:     color,
        backgroundColor: isUp ? fillUp : fillDn,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: {
          grid: { color: gridC },
          ticks: {
            color: tickC, font:{ family:'JetBrains Mono', size:10 },
            maxTicksLimit:8, maxRotation:0, autoSkip:true,
          },
        },
        y: {
          grid: { color: gridC },
          position: 'right',
          ticks: {
            color: tickC, font:{ family:'JetBrains Mono', size:10 },
            callback: v => v.toLocaleString('ko-KR',{maximumFractionDigits:0}) + ' G',
          },
        },
      },
      plugins: {
        legend: { display:false },
        tooltip: {
          backgroundColor: tipBg,
          borderColor: color,
          borderWidth: 1,
          titleColor: tipTxt,
          bodyColor: tipTxt,
          titleFont:{ family:'JetBrains Mono', size:11 },
          bodyFont:{ family:'JetBrains Mono', size:13 },
          padding:10,
          callbacks: {
            title: items => items[0].label,
            label: item  => ' ' + fmtG(item.parsed.y),
          }
        },
      },
    },
  })
}

// =============================================================
// 계좌 패널
// =============================================================
function renderAccount() {
  const d = S.user.data
  if (!d) return

  const t = d.totals || {}
  $('acc-balance').textContent  = fmtG(t.cash)
  $('acc-total').textContent    = fmtG(t.value)
  $('acc-invested').textContent = fmtG(t.invested)

  const plEl    = $('acc-pl')
  const plPctEl = $('acc-plpct')
  plEl.textContent    = (t.pl >= 0 ? '+' : '') + fmtG(t.pl)
  plPctEl.textContent = fmtPct(t.plPct)
  plEl.className    = 'pl-num ' + (t.pl >= 0 ? 'pos' : 'neg')
  plPctEl.className = 'pl-num ' + (t.pl >= 0 ? 'pos' : 'neg')

  // 보유 종목
  const hl = $('holdings-list')
  const portfolio = d.portfolio || []
  if (!portfolio.length) {
    hl.innerHTML = '<div class="acc-empty">보유 종목 없음</div>'
  } else {
    hl.innerHTML = portfolio.map(h => `
      <div class="holding-row">
        <div class="hr-sym">${h.symbol}</div>
        <div class="hr-val">${fmtG(h.value)}</div>
        <div class="hr-meta">${h.shares}주 @${fmtG(h.avg)}</div>
        <div class="hr-pl ${plClass(h.pl)}">${fmtPct(h.plPct)}</div>
      </div>`).join('')
  }

  // 포트폴리오 탭도 갱신
  renderPortfolioTab()
  renderHistoryTab()
}

// =============================================================
// 포트폴리오 탭
// =============================================================
function renderPortfolioTab() {
  const d = S.user.data
  const t = d ? (d.totals||{}) : {}

  // 요약 카드
  $('pf-cards').innerHTML = [
    ['총 자산',   fmtG(t.value),    ''],
    ['현금 잔고', fmtG(t.cash),     ''],
    ['투자 원금', fmtG(t.invested), ''],
    ['평가 손익', (t.pl>=0?'+':'')+fmtG(t.pl), plClass(t.pl)],
  ].map(([lbl,val,cls]) => `
    <div class="pf-card">
      <div class="pf-card-label">${lbl}</div>
      <div class="pf-card-val ${cls}">${val}</div>
    </div>`).join('')

  // 테이블
  const portfolio = d ? (d.portfolio||[]) : []
  $('pf-tbody').innerHTML = portfolio.length
    ? portfolio.map(h => `
      <tr>
        <td><span class="sym-badge">${h.symbol}</span></td>
        <td>${h.shares.toLocaleString()}주</td>
        <td>${fmtG(h.avg)}</td>
        <td>${fmtG(h.price)}</td>
        <td>${fmtG(h.value)}</td>
        <td class="${plClass(h.pl)}">${(h.pl>=0?'+':'')+fmtG(h.pl)}</td>
        <td class="${plClass(h.plPct)}">${fmtPct(h.plPct)}</td>
        <td>
          <button class="exch-btn dep" style="font-size:11px;padding:4px 10px"
            onclick="quickSell('${h.symbol}', ${h.shares})">전량 매도</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:#7b869e;padding:20px">보유 종목 없음</td></tr>'
}

async function quickSell(symbol, shares) {
  if (!S.user.uuid) return
  const r = await api('/api/order', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ uuid:S.user.uuid, type:'sell', symbol, shares }),
  })
  showOrderFeedback(r.ok, r.message)
}

// =============================================================
// 거래내역 탭
// =============================================================
function renderHistoryTab() {
  const txs = S.user.data ? (S.user.data.transactions||[]) : []
  $('hist-tbody').innerHTML = txs.length
    ? txs.map(tx => `
      <tr>
        <td style="color:#7b869e">${fmtDate(tx.at)}</td>
        <td><span class="${tx.type==='buy'?'badge-buy':'badge-sell'}">${tx.type==='buy'?'매수':'매도'}</span></td>
        <td><span class="sym-badge">${tx.symbol}</span></td>
        <td>${tx.shares.toLocaleString()}주</td>
        <td>${fmtG(tx.price)}</td>
        <td style="color:#7b869e">${fmtG(tx.fee)}</td>
        <td>${fmtG(tx.total)}</td>
        <td class="${tx.profit!=null?plClass(tx.profit):''}">
          ${tx.profit!=null ? (tx.profit>=0?'+':'')+fmtG(tx.profit) : '--'}
        </td>
      </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:#7b869e;padding:20px">거래내역 없음</td></tr>'
}

// =============================================================
// 주문
// =============================================================
function updateCalc() {
  const sym = S.selected
  if (!sym) { ['calc-price','calc-sub','calc-fee','calc-total'].forEach(id => $(id).textContent='--'); return }
  const price = (S.prices[sym]||{}).current || 0
  const qty   = parseInt($('qty-input').value) || 0
  const sub   = price * qty
  const fee   = sub * FEE_RATE
  const total = S.orderSide === 'buy' ? sub + fee : sub - fee

  $('calc-price').textContent = fmtG(price)
  $('calc-sub').textContent   = fmtG(sub)
  $('calc-fee').textContent   = fmtG(fee)
  $('calc-total').textContent = fmtG(total)

  const btn = $('order-btn')
  if (sym && S.user.uuid) {
    btn.disabled = false
    btn.textContent = (S.orderSide === 'buy' ? '매수 주문 ' : '매도 주문 ') + sym
    btn.className   = 'order-btn ' + (S.orderSide === 'buy' ? 'buy-btn' : 'sell-btn')
  } else if (!S.user.uuid) {
    btn.disabled    = true
    btn.textContent = '로그인 필요'
  }
}

async function submitOrder() {
  if (!S.user.uuid || !S.selected) return
  const qty = parseInt($('qty-input').value) || 0
  if (qty <= 0) return

  const r = await api('/api/order', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      uuid:   S.user.uuid,
      type:   S.orderSide,
      symbol: S.selected,
      shares: qty,
    }),
  })
  showOrderFeedback(r.ok, r.message)
  if (r.ok) setTimeout(poll, 1500)
}

function showOrderFeedback(ok, msg) {
  const el = $('order-feedback')
  el.textContent = msg || (ok ? '주문 완료' : '주문 실패')
  el.className   = 'order-feedback ' + (ok ? 'ok' : 'fail')
  setTimeout(() => { el.textContent = ''; el.className = 'order-feedback' }, 4000)
}

// =============================================================
// 에메랄드 환전
// =============================================================
async function deposit() {
  if (!S.user.uuid) return
  const qty = parseInt($('dep-qty').value) || 0
  if (qty <= 0) return
  const r = await api('/api/deposit', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uuid:S.user.uuid, amount:qty }),
  })
  showExchMsg(r.ok, r.message)
  if (r.ok) setTimeout(poll, 1000)
}
async function withdraw() {
  if (!S.user.uuid) return
  const qty = parseInt($('with-qty').value) || 0
  if (qty <= 0) return
  const r = await api('/api/withdraw', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uuid:S.user.uuid, amount:qty }),
  })
  showExchMsg(r.ok, r.message)
  if (r.ok) setTimeout(poll, 1000)
}
function showExchMsg(ok, msg) {
  const el = $('exch-msg')
  el.textContent = msg
  el.className   = 'exch-msg ' + (ok ? 'ok' : 'fail')
  setTimeout(() => { el.textContent=''; el.className='exch-msg' }, 4000)
}

// =============================================================
// 티커
// =============================================================
function renderTicker() {
  const stocks = S.meta.stocks || []
  $('ticker-inner').innerHTML = [...stocks, ...stocks].map(s => {
    const p = S.prices[s.symbol] || {}
    const c = (p.change||0) >= 0
    return `<div class="ticker-item">
      <span class="ti-sym">${s.symbol}</span>
      <span class="ti-price">${fmtG(p.current||0)}</span>
      <span class="ti-chg ${c?'up':'down'}">${fmtPct(p.change||0)}</span>
    </div>`
  }).join('')
}

// =============================================================
// 관리자 페이지
// =============================================================
async function renderAdminPage() {
  if (!S.user.isOp) return

  // 종목 테이블
  const state = await api('/api/state')
  if (!state || !state.ok) return
  const stocks = state.meta.stocks || []
  const prices = state.prices || {}

  $('admin-stock-tbody').innerHTML = stocks.map(s => `
    <tr>
      <td><span class="sym-badge">${s.symbol}</span></td>
      <td>${s.name}</td>
      <td>${s.sector}</td>
      <td>${fmtG(s.basePrice)}</td>
      <td>${(s.volatility*100).toFixed(0)}%</td>
      <td>${s.trend >= 0 ? '+' : ''}${(s.trend*100).toFixed(1)}%</td>
      <td class="${plClass((prices[s.symbol]||{}).change)}">${fmtG((prices[s.symbol]||{}).current)}</td>
      <td>
        <button class="del-btn" onclick="deleteStock('${s.symbol}')">삭제</button>
      </td>
    </tr>`).join('')

  // 플레이어 목록
  const allPlayers = state.players || []
  $('admin-player-tbody').innerHTML = allPlayers.map(p => `
    <tr>
      <td>${p.username}</td>
      <td>${fmtG(p.balance)}</td>
      <td>${p.portfolioCount}</td>
      <td>${p.txCount}</td>
    </tr>`).join('')
}

async function addStock() {
  const symbol = $('ad-symbol').value.trim().toUpperCase()
  const name   = $('ad-name').value.trim()
  const sector = $('ad-sector').value
  const price  = parseFloat($('ad-price').value)
  const vol    = parseFloat($('ad-vol').value)
  const trend  = parseFloat($('ad-trend').value)

  if (!symbol || !name || !price || !vol) {
    showAdminMsg(false, '모든 필드를 입력해주세요')
    return
  }

  const r = await api('/api/admin/stock', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uuid:S.user.uuid, symbol, name, sector, basePrice:price, volatility:vol, trend }),
  })
  showAdminMsg(r.ok, r.message)
  if (r.ok) {
    renderAdminPage()
    $('ad-symbol').value = $('ad-name').value = $('ad-price').value = $('ad-vol').value = $('ad-trend').value = ''
  }
}

async function deleteStock(symbol) {
  if (!confirm(`'${symbol}' 종목을 정말 삭제하시겠습니까?`)) return
  const r = await api('/api/admin/stock/' + encodeURIComponent(symbol), {
    method:'DELETE', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ uuid:S.user.uuid }),
  })
  showAdminMsg(r.ok, r.message)
  if (r.ok) renderAdminPage()
}

function showAdminMsg(ok, msg) {
  const el = $('admin-msg')
  el.textContent = msg
  el.className   = 'admin-msg ' + (ok ? 'ok' : 'fail')
  setTimeout(() => { el.textContent=''; el.className='admin-msg' }, 4000)
}

// =============================================================
// 탭 전환
// =============================================================
function switchView(view) {
  $$('.view').forEach(el => el.classList.remove('active'))
  $$('.nav-tab').forEach(el => el.classList.remove('active'))
  $('view-' + view).classList.add('active')
  document.querySelector(`.nav-tab[data-view="${view}"]`).classList.add('active')
  if (view === 'admin') renderAdminPage()
}

// =============================================================
// 이벤트 바인딩
// =============================================================
$$('.nav-tab').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)))
$$('.chip').forEach(btn => btn.addEventListener('click', () => {
  $$('.chip').forEach(b => b.classList.remove('on'))
  btn.classList.add('on')
  S.sectorFilter = btn.dataset.sector
  renderStockList()
}))
$('search-input').addEventListener('input', e => {
  S.searchQuery = e.target.value.trim()
  renderStockList()
})
$('ot-buy').addEventListener('click',  () => { S.orderSide='buy';  $('ot-buy').classList.add('active'); $('ot-sell').classList.remove('active'); updateCalc() })
$('ot-sell').addEventListener('click', () => { S.orderSide='sell'; $('ot-sell').classList.add('active'); $('ot-buy').classList.remove('active'); updateCalc() })
$('qty-input').addEventListener('input', updateCalc)
$('btn-minus').addEventListener('click', () => { const v=parseInt($('qty-input').value)||1; if(v>1) { $('qty-input').value=v-1; updateCalc() } })
$('btn-plus').addEventListener('click',  () => { $('qty-input').value=(parseInt($('qty-input').value)||1)+1; updateCalc() })
$('order-btn').addEventListener('click', submitOrder)
$('dep-btn').addEventListener('click',  deposit)
$('with-btn').addEventListener('click', withdraw)
$('ad-add-btn').addEventListener('click', addStock)
$('theme-toggle').addEventListener('click', toggleTheme)

// 시계
setInterval(() => {
  $('nav-clock').textContent = new Date().toLocaleTimeString('ko-KR',{hour12:false})
}, 1000)

// =============================================================
// 시작
// =============================================================
;(async () => {
  await autoLogin()
  await poll()
  setInterval(poll, POLL_MS)
})()
