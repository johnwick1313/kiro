// =============================================================
// Sunlit Exchange — 브릿지 서버
// KubeJS JSON ↔ 웹 브라우저 중간 서버
// =============================================================

const express = require('express')
const fs      = require('fs')
const path    = require('path')
const crypto  = require('crypto')

const PORT        = process.env.PORT || 3000
const KUBEJS_PATH = process.env.KUBEJS_PATH || path.resolve(__dirname, '../kubejs')

const P = {
  state:     path.join(KUBEJS_PATH, 'exports/stocks_state.json'),
  orders:    path.join(KUBEJS_PATH, 'exports/stocks_orders.json'),
  responses: path.join(KUBEJS_PATH, 'exports/stocks_responses.json'),
  audit:     path.join(KUBEJS_PATH, 'exports/stocks_audit.json'),
  custom:    path.join(KUBEJS_PATH, 'exports/stocks_custom.json'),  // 동적 종목
  ops:       path.join(KUBEJS_PATH, 'exports/stocks_ops.json'),     // OP 목록
}

// ── JSON 유틸 ──
function readJson(file, fallback = null) {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, 'utf8').trim()
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function writeJson(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}
function enqueueOrder(order) {
  const q = readJson(P.orders, { orders: [] })
  if (!Array.isArray(q.orders)) q.orders = []
  q.orders.push(order)
  writeJson(P.orders, q)
}

// ── 플레이어 조회 (UUID 또는 username) ──
function findPlayer(state, id) {
  if (!state?.players) return null
  if (state.players[id]) return { uuid: id, data: state.players[id] }
  for (const [uuid, data] of Object.entries(state.players)) {
    if (data.username?.toLowerCase() === String(id).toLowerCase())
      return { uuid, data }
  }
  return null
}

// ── OP 확인 ──
// KubeJS 서버가 ops.json 에 OP 플레이어 UUID 목록을 기록함
function isOp(uuid) {
  const ops = readJson(P.ops, { ops: [] })
  return Array.isArray(ops.ops) && ops.ops.includes(uuid)
}

// ── 플레이어 응답 포매터 ──
function formatPlayer(uuid, data, state) {
  const portfolio = []
  let totalValue  = data.balance || 0
  let totalCost   = 0

  for (const [sym, shares] of Object.entries(data.portfolio || {})) {
    const avg   = (data.avgCost || {})[sym] || 0
    const price = ((state.prices || {})[sym] || {}).current || 0
    const cost  = avg * shares
    const value = price * shares
    portfolio.push({ symbol:sym, shares, avg, price, cost, value, pl:value-cost, plPct:cost>0?((value-cost)/cost*100):0 })
    totalValue += value
    totalCost  += cost
  }

  return {
    ok: true,
    uuid,
    username:     data.username,
    balance:      data.balance,
    isOp:         isOp(uuid),
    portfolio,
    transactions: (data.transactions || []).slice(0, 50),
    totals: {
      cash:     data.balance,
      invested: totalCost,
      value:    totalValue,
      pl:       totalValue - data.balance - totalCost,
      plPct:    totalCost > 0 ? ((totalValue - data.balance - totalCost) / totalCost * 100) : 0,
    },
  }
}

// =============================================================
// Express
// =============================================================
const app = express()
app.use(express.json({ limit: '128kb' }))
app.use(express.static(path.join(__dirname, 'public')))

// ── 시세 상태 ──
app.get('/api/state', (req, res) => {
  const state = readJson(P.state, null)
  if (!state) return res.json({ ok:false, message:'시세 파일 없음. 마인크래프트 서버가 실행 중인지 확인하세요.' })

  // 관리자 페이지용 플레이어 요약
  const players = Object.entries(state.players || {}).map(([uuid, d]) => ({
    uuid,
    username:       d.username || 'Unknown',
    balance:        d.balance  || 0,
    portfolioCount: Object.keys(d.portfolio || {}).length,
    txCount:        (d.transactions || []).length,
  }))

  res.json({
    ok: true,
    prices:     state.prices  || {},
    meta:       state.meta    || {},
    lastUpdate: state.lastUpdate || 0,
    players,
  })
})

// ── 플레이어 조회 (UUID 또는 username) ──
app.get('/api/player/:id', (req, res) => {
  const state = readJson(P.state, null)
  if (!state) return res.status(503).json({ ok:false, message:'서버 데이터 없음' })

  const found = findPlayer(state, req.params.id)
  if (!found) return res.status(404).json({ ok:false, message:'플레이어를 찾을 수 없습니다. 마인크래프트에 먼저 접속해주세요.' })

  res.json(formatPlayer(found.uuid, found.data, state))
})

// ── 매수/매도 주문 ──
app.post('/api/order', (req, res) => {
  const { uuid, type, symbol, shares } = req.body || {}
  if (!uuid)                           return res.status(400).json({ ok:false, message:'uuid 필요' })
  if (!['buy','sell'].includes(type))  return res.status(400).json({ ok:false, message:'type은 buy/sell' })
  if (!symbol)                         return res.status(400).json({ ok:false, message:'symbol 필요' })
  const n = parseInt(shares)
  if (!n || n <= 0)                    return res.status(400).json({ ok:false, message:'수량 오류' })

  // UUID 본인 검증 — 서버에 해당 UUID 가 존재해야 함
  const state = readJson(P.state, null)
  if (!state?.players?.[uuid])
    return res.status(403).json({ ok:false, message:'등록되지 않은 플레이어입니다. 마인크래프트에 먼저 접속해주세요.' })

  const order = {
    id:      crypto.randomUUID(),
    uuid,
    username: state.players[uuid].username,
    type,
    symbol:  symbol.toUpperCase(),
    shares:  n,
    at:      Date.now(),
  }
  enqueueOrder(order)
  res.json({ ok:true, message:`주문 접수 (최대 10초 내 체결)`, order })
})

// ── 화폐 충전 (웹에서는 요청만, 실제 차감은 인게임 KubeJS) ──
app.post('/api/deposit', (req, res) => {
  const { uuid } = req.body || {}
  const state = readJson(P.state, null)
  if (!state?.players?.[uuid])
    return res.status(403).json({ ok:false, message:'인증 실패' })
  const n = parseInt(req.body?.amount ?? req.body?.emeralds)
  if (!n || n <= 0) return res.status(400).json({ ok:false, message:'금액 오류' })

  // 웹에서는 주문 큐로 처리 (KubeJS 가 인벤토리에서 화폐 차감)
  const order = {
    id: crypto.randomUUID(), uuid,
    username: state.players[uuid].username,
    type: 'deposit', amount: n, at: Date.now(),
  }
  enqueueOrder(order)
  res.json({ ok:true, message:`${n} G 충전 요청 접수 (인게임에서 화폐 차감)` })
})

app.post('/api/withdraw', (req, res) => {
  const { uuid } = req.body || {}
  const state = readJson(P.state, null)
  if (!state?.players?.[uuid])
    return res.status(403).json({ ok:false, message:'인증 실패' })
  const n = parseInt(req.body?.amount ?? req.body?.emeralds)
  if (!n || n <= 0) return res.status(400).json({ ok:false, message:'금액 오류' })

  const order = {
    id: crypto.randomUUID(), uuid,
    username: state.players[uuid].username,
    type: 'withdraw', amount: n, at: Date.now(),
  }
  enqueueOrder(order)
  res.json({ ok:true, message:`${n} G 출금 요청 접수 (인게임에서 화폐 지급)` })
})

// =============================================================
// 관리자 API (OP 전용)
// =============================================================

// OP 미들웨어
function requireOp(req, res, next) {
  const uuid = req.body?.uuid || req.query?.uuid
  if (!uuid || !isOp(uuid)) {
    return res.status(403).json({ ok:false, message:'OP 권한이 필요합니다.' })
  }
  next()
}

// 종목 추가
app.post('/api/admin/stock', requireOp, (req, res) => {
  const { symbol, name, sector, basePrice, volatility, trend } = req.body
  if (!symbol || !name || !basePrice)
    return res.status(400).json({ ok:false, message:'symbol, name, basePrice 필수' })

  const sym = String(symbol).toUpperCase().replace(/[^A-Z]/g,'').slice(0,5)
  if (!sym) return res.status(400).json({ ok:false, message:'심볼은 영문 대문자만 사용 가능' })

  // stocks_custom.json 에 저장 (KubeJS 가 다음 틱에 로드)
  const custom = readJson(P.custom, { stocks: [] })
  if (!Array.isArray(custom.stocks)) custom.stocks = []

  if (custom.stocks.find(s => s.symbol === sym))
    return res.status(409).json({ ok:false, message:`이미 존재하는 심볼: ${sym}` })

  const stock = {
    symbol:     sym,
    name:       String(name).slice(0,40),
    sector:     sector || '기타',
    basePrice:  Math.max(1, Math.round(parseFloat(basePrice)*100)/100),
    volatility: Math.min(0.30, Math.max(0.01, parseFloat(volatility)||0.05)),
    trend:      Math.min(0.10, Math.max(-0.10, parseFloat(trend)||0.02)),
    addedAt:    Date.now(),
  }
  custom.stocks.push(stock)
  writeJson(P.custom, custom)

  res.json({ ok:true, message:`${sym} (${name}) 종목이 추가됐습니다. 다음 틱에 반영됩니다.`, stock })
})

// 종목 삭제
app.delete('/api/admin/stock/:symbol', requireOp, (req, res) => {
  const sym    = req.params.symbol.toUpperCase()
  const custom = readJson(P.custom, { stocks: [] })
  if (!Array.isArray(custom.stocks)) custom.stocks = []

  const before = custom.stocks.length
  custom.stocks = custom.stocks.filter(s => s.symbol !== sym)

  if (custom.stocks.length === before)
    return res.status(404).json({ ok:false, message:`커스텀 종목 '${sym}'을 찾을 수 없습니다. (기본 종목은 00_config.js에서 수정하세요)` })

  writeJson(P.custom, custom)
  res.json({ ok:true, message:`${sym} 종목이 삭제됐습니다.` })
})

// 응답 확인
app.get('/api/responses', (req, res) => {
  res.json(readJson(P.responses, { responses:[] }))
})

// 감사 로그
app.get('/api/audit', (req, res) => {
  res.json(readJson(P.audit, { logs:[] }))
})

// 서버 정보
app.get('/api/info', (req, res) => {
  res.json({
    ok:         true,
    kubejsPath: KUBEJS_PATH,
    stateExists: fs.existsSync(P.state),
    version:    '2.0.0',
  })
})

// =============================================================
app.listen(PORT, () => {
  console.log('==================================================')
  console.log('  Sunlit Exchange 브릿지 서버 v2.0')
  console.log('==================================================')
  console.log('  http://localhost:' + PORT)
  console.log('  KubeJS 경로: ' + KUBEJS_PATH)
  console.log('  State 파일: ' + (fs.existsSync(P.state) ? '✔ 발견' : '✘ 없음 (서버 실행 필요)'))
  console.log('==================================================')
})
