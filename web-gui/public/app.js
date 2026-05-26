// =======================================================================
// 선릿밸리 주식 거래소 - 프론트엔드 로직
// =======================================================================

const POLL_MS = 3000  // 3초마다 시세 갱신

const state = {
    prices:        {},
    meta:          {},
    selected:      null,        // 현재 보고 있는 종목 심볼
    sectorFilter:  'ALL',
    user: {
        username: null,
        uuid:     null,
        data:     null,
    },
    chart:           null,
    lastPrices:      {},        // 가격 펄스 효과용
}

// ---------- DOM 헬퍼 ----------
const $  = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

// ---------- 포맷터 ----------
const fmtMoney = (n) => Number(n || 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtPct   = (n) => (n >= 0 ? '+' : '') + Number(n || 0).toFixed(2) + '%'
const fmtTime  = (ts) => ts ? new Date(ts).toLocaleTimeString('ko-KR', { hour12: false }) : '--'

// ---------- API ----------
async function api(path, opts) {
    try {
        const r = await fetch(path, opts)
        return await r.json()
    } catch (e) {
        return { ok: false, message: '네트워크 오류: ' + e.message }
    }
}

async function fetchState() {
    const data = await api('/api/state')
    if (!data || !data.ok) {
        setConnection(false, data && data.message)
        return null
    }
    setConnection(true, '온라인 · ' + (Object.keys(data.prices || {}).length) + '개 종목')
    return data
}

async function fetchPlayer(identifier) {
    return await api('/api/player/' + encodeURIComponent(identifier))
}

async function submitOrder(type, symbol, shares) {
    if (!state.user.username) {
        return { ok: false, message: '먼저 로그인하세요' }
    }
    return await api('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uuid:     state.user.uuid,
            username: state.user.username,
            type, symbol, shares,
        }),
    })
}

async function fetchInfo() {
    const r = await api('/api/info')
    if (r && r.kubejsPath) {
        $('#bridge-info').textContent = 'KubeJS: ' + r.kubejsPath
    }
}

// ---------- UI 업데이트 ----------
function setConnection(online, text) {
    const dot = $('#conn-status .dot')
    dot.classList.toggle('online',  !!online)
    dot.classList.toggle('offline', !online)
    $('#conn-text').textContent = text || (online ? '온라인' : '오프라인')
}

function renderStocksList() {
    const container = $('#stocks-list')
    const stocks = state.meta.stocks || []
    if (!stocks.length) {
        container.innerHTML = '<div class="placeholder">시세 데이터 대기 중...</div>'
        return
    }

    const filter = state.sectorFilter
    const filtered = stocks.filter(s => filter === 'ALL' || s.sector === filter)

    // 기존 카드 유지 (애니메이션을 위해)
    const existing = new Map()
    container.querySelectorAll('.stock-card').forEach(el => {
        existing.set(el.dataset.symbol, el)
    })

    const seen = new Set()
    filtered.forEach(s => {
        const price = state.prices[s.symbol] || {}
        const last  = state.lastPrices[s.symbol]
        const cur   = price.current || 0
        const ch    = price.change  || 0

        let card = existing.get(s.symbol)
        if (!card) {
            card = document.createElement('div')
            card.className = 'stock-card'
            card.dataset.symbol = s.symbol
            card.innerHTML = `
                <div class="symbol"></div>
                <div class="price"></div>
                <div class="name"></div>
                <div class="change"></div>
            `
            card.addEventListener('click', () => selectStock(s.symbol))
            container.appendChild(card)
        }

        card.querySelector('.symbol').textContent = s.symbol
        card.querySelector('.name').textContent   = s.name
        card.querySelector('.price').textContent  = fmtMoney(cur) + ' G'

        const changeEl = card.querySelector('.change')
        changeEl.textContent = fmtPct(ch)
        changeEl.classList.toggle('up',   ch >= 0)
        changeEl.classList.toggle('down', ch < 0)

        // 가격 변동 펄스
        if (last !== undefined && last !== cur) {
            card.classList.remove('pulse-up', 'pulse-down')
            void card.offsetWidth  // reflow
            card.classList.add(cur > last ? 'pulse-up' : 'pulse-down')
        }

        card.classList.toggle('active', state.selected === s.symbol)
        seen.add(s.symbol)
    })

    // 사라진 카드 제거
    existing.forEach((el, sym) => { if (!seen.has(sym)) el.remove() })

    // 정렬: 활성 -> 변동률 큰 순
    const cards = Array.from(container.querySelectorAll('.stock-card'))
    cards.sort((a, b) => {
        const ca = state.prices[a.dataset.symbol]?.change || 0
        const cb = state.prices[b.dataset.symbol]?.change || 0
        return Math.abs(cb) - Math.abs(ca)
    })
    cards.forEach(el => container.appendChild(el))
}

function renderTicker() {
    const stocks = state.meta.stocks || []
    const parts = stocks.map(s => {
        const p = state.prices[s.symbol] || {}
        const ch = p.change || 0
        const sign = ch >= 0 ? '▲' : '▼'
        return `${s.symbol} ${fmtMoney(p.current||0)} ${sign}${Math.abs(ch).toFixed(2)}%`
    })
    $('#ticker').textContent = parts.join('   ◆   ')
}

function selectStock(symbol) {
    state.selected = symbol
    renderStocksList()
    renderChart()
    renderTradePanel()
}

function renderChart() {
    const sym = state.selected
    if (!sym) {
        $('#chart-title').textContent = '종목을 선택하세요'
        $('#chart-meta').innerHTML = ''
        if (state.chart) { state.chart.destroy(); state.chart = null }
        return
    }

    const stockMeta = (state.meta.stocks || []).find(s => s.symbol === sym) || {}
    const price = state.prices[sym] || {}
    const history = price.history || []

    $('#chart-title').textContent = (stockMeta.name || sym) + ' (' + sym + ')'
    $('#chart-meta').innerHTML = `
        <div>현재가: <span class="v">${fmtMoney(price.current || 0)} G</span></div>
        <div>변동: <span class="v ${price.change >= 0 ? 'up' : 'down'}">${fmtPct(price.change || 0)}</span></div>
        <div>고가: <span class="v">${fmtMoney(price.high || 0)}</span></div>
        <div>저가: <span class="v">${fmtMoney(price.low || 0)}</span></div>
        <div>섹터: <span class="v">${stockMeta.sector || '-'}</span></div>
    `

    const labels = history.map(h => fmtTime(h.t))
    const data   = history.map(h => h.p)
    const isUp   = (price.change || 0) >= 0
    const color  = isUp ? '#00ff88' : '#ff3860'

    const ctx = document.getElementById('price-chart').getContext('2d')

    if (state.chart) {
        state.chart.data.labels = labels
        state.chart.data.datasets[0].data = data
        state.chart.data.datasets[0].borderColor = color
        state.chart.data.datasets[0].backgroundColor = isUp
            ? 'rgba(0,255,136,0.15)' : 'rgba(255,56,96,0.15)'
        state.chart.update('none')
        return
    }

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: sym,
                data,
                borderColor: color,
                backgroundColor: isUp ? 'rgba(0,255,136,0.15)' : 'rgba(255,56,96,0.15)',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.25,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#6b7299', font: { family: 'JetBrains Mono', size: 10 },
                        maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
                    },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#6b7299', font: { family: 'JetBrains Mono', size: 10 },
                        callback: (v) => fmtMoney(v) + ' G',
                    },
                },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15,20,36,0.95)',
                    borderColor: color, borderWidth: 1,
                    titleColor: '#e0e7ff', bodyColor: '#e0e7ff',
                    titleFont: { family: 'Orbitron', size: 11 },
                    bodyFont:  { family: 'JetBrains Mono', size: 12 },
                    padding: 10,
                    callbacks: {
                        label: (c) => '가격: ' + fmtMoney(c.parsed.y) + ' G',
                    },
                },
            },
        },
    })
}

function renderTradePanel() {
    const hasUser  = !!state.user.username
    const selected = state.selected

    $('#buy-btn').disabled  = !(hasUser && selected)
    $('#sell-btn').disabled = !(hasUser && selected)

    updateEstimate()
}

function updateEstimate() {
    const sym = state.selected
    const qty = parseInt($('#trade-qty').value) || 0
    const price = (state.prices[sym] || {}).current || 0
    const total = price * qty
    const fee   = total * ((state.meta.config?.tradeFee || 0.5) / 100)
    $('#trade-estimate').textContent = sym
        ? `예상: ${fmtMoney(total)} G (수수료 ${fmtMoney(fee)})`
        : '예상: --'
}

function renderPortfolio() {
    const u = state.user
    if (!u.username) {
        $('#player-tag').textContent = '미로그인'
        $('#portfolio-summary').innerHTML = '<div class="placeholder">로그인 후 표시됩니다</div>'
        $('#portfolio-holdings').innerHTML = ''
        $('#portfolio-history').innerHTML  = ''
        return
    }

    if (!u.data) {
        $('#player-tag').textContent = u.username
        $('#portfolio-summary').innerHTML = '<div class="placeholder">데이터 로딩 중...</div>'
        return
    }

    $('#player-tag').textContent = u.username

    const t = u.data.totals || {}
    $('#portfolio-summary').innerHTML = `
        <div class="summary-row"><span class="label">현금</span><span class="value">${fmtMoney(t.cash)} G</span></div>
        <div class="summary-row"><span class="label">투자원금</span><span class="value">${fmtMoney(t.invested)} G</span></div>
        <div class="summary-row"><span class="label">평가손익</span><span class="value ${t.pl >= 0 ? 'up' : 'down'}">${fmtPct(t.plPct)}</span></div>
        <div class="summary-row total"><span class="label">총 자산</span><span class="value">${fmtMoney(t.value)} G</span></div>
    `

    const holdings = u.data.portfolio || []
    if (holdings.length === 0) {
        $('#portfolio-holdings').innerHTML = '<div class="placeholder">보유 종목 없음</div>'
    } else {
        $('#portfolio-holdings').innerHTML = holdings.map(h => `
            <div class="holding">
                <div class="sym">${h.symbol}</div>
                <div class="val">${fmtMoney(h.value)} G</div>
                <div class="meta">${h.shares}주 @${fmtMoney(h.avg)}</div>
                <div class="pl ${h.pl >= 0 ? 'up' : 'down'}">${fmtPct(h.plPct)}</div>
            </div>
        `).join('')
    }

    const txs = u.data.transactions || []
    if (txs.length === 0) {
        $('#portfolio-history').innerHTML = '<div class="placeholder">거래내역 없음</div>'
    } else {
        $('#portfolio-history').innerHTML = txs.slice(0, 12).map(tx => `
            <div class="tx">
                <span class="time">${fmtTime(tx.at)}</span>
                <span class="type-${tx.type}">${tx.type === 'buy' ? '매수' : '매도'} ${tx.symbol} ×${tx.shares}</span>
                <span>${fmtMoney(tx.price)}</span>
            </div>
        `).join('')
    }
}

// ---------- 이벤트 ----------
$('#login-btn').addEventListener('click', login)
$('#username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login()
})

async function login() {
    const name = $('#username-input').value.trim()
    if (!name) return
    state.user.username = name
    $('#player-tag').textContent = name + ' (로딩...)'
    await refreshPlayer()
    renderPortfolio()
    renderTradePanel()
}

async function refreshPlayer() {
    if (!state.user.username) return
    const r = await fetchPlayer(state.user.username)
    if (!r.ok) {
        state.user.data = null
        $('#portfolio-summary').innerHTML = `<div class="placeholder">${r.message || '플레이어 데이터를 찾을 수 없습니다.<br>인게임에 1회 접속한 후 다시 시도해주세요.'}</div>`
        return
    }
    state.user.uuid = r.uuid
    state.user.data = r
    renderPortfolio()
}

$('#trade-qty').addEventListener('input', updateEstimate)

$('#buy-btn').addEventListener('click', () => placeOrder('buy'))
$('#sell-btn').addEventListener('click', () => placeOrder('sell'))

async function placeOrder(type) {
    const sym = state.selected
    const qty = parseInt($('#trade-qty').value) || 0
    if (!sym || qty <= 0) return

    const msgEl = $('#trade-message')
    msgEl.className = 'trade-message'
    msgEl.textContent = '주문 전송 중...'

    const r = await submitOrder(type, sym, qty)
    msgEl.className = 'trade-message ' + (r.ok ? 'success' : 'error')
    msgEl.textContent = r.message || (r.ok ? '주문 완료' : '주문 실패')

    if (r.ok) {
        // 약간의 지연 후 플레이어 데이터 갱신 (KubeJS 가 처리할 시간)
        setTimeout(refreshPlayer, 1500)
        setTimeout(refreshPlayer, 6000)
    }
}

// 섹터 필터
$$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        state.sectorFilter = btn.dataset.sector
        renderStocksList()
    })
})

// ---------- 시계 ----------
function tickClock() {
    $('#clock').textContent = new Date().toLocaleTimeString('ko-KR', { hour12: false })
}
setInterval(tickClock, 1000); tickClock()

// ---------- 메인 폴링 루프 ----------
async function poll() {
    const data = await fetchState()
    if (data) {
        state.lastPrices = Object.fromEntries(
            Object.entries(state.prices).map(([k, v]) => [k, v.current])
        )
        state.prices = data.prices
        state.meta   = data.meta
        $('#last-update').textContent = fmtTime(data.lastUpdate)

        renderStocksList()
        renderTicker()
        if (state.selected) renderChart()
        if (state.user.username) {
            // 매 폴링마다 플레이어 데이터도 갱신
            refreshPlayer()
        }
        updateEstimate()
    }
}

// 시작
fetchInfo()
poll()
setInterval(poll, POLL_MS)
