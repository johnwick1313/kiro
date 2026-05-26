// =======================================================================
// 선릿밸리 주식 시스템 - 웹 브릿지 서버
// =======================================================================
// KubeJS 가 쓴 JSON 파일을 읽어 웹에 제공하고,
// 웹에서 들어온 매수/매도 주문을 JSON 파일로 기록 -> KubeJS 가 폴링하여 처리.
// =======================================================================

const express = require('express')
const fs      = require('fs')
const path    = require('path')
const crypto  = require('crypto')

// ----- 설정 -----
const PORT        = process.env.PORT || 3000
// 모드팩의 KubeJS 폴더 경로 (인스턴스의 kubejs 디렉토리)
// 환경 변수 KUBEJS_PATH 로 오버라이드 가능
const KUBEJS_PATH = process.env.KUBEJS_PATH || path.resolve(__dirname, '../kubejs')

const STATE_FILE     = path.join(KUBEJS_PATH, 'exports', 'stocks_state.json')
const ORDERS_FILE    = path.join(KUBEJS_PATH, 'exports', 'stocks_orders.json')
const RESPONSES_FILE = path.join(KUBEJS_PATH, 'exports', 'stocks_responses.json')
const AUDIT_FILE     = path.join(KUBEJS_PATH, 'exports', 'stocks_audit.json')

// ----- 유틸 -----
function readJsonSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback
        const raw = fs.readFileSync(filePath, 'utf8')
        if (!raw || !raw.trim()) return fallback
        return JSON.parse(raw)
    } catch (err) {
        console.warn('[bridge] 파일 읽기 실패:', filePath, err.message)
        return fallback
    }
}

function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const tmp = filePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    fs.renameSync(tmp, filePath)
}

// 새 주문을 큐에 추가 (KubeJS 가 다음 틱에 처리)
function enqueueOrder(order) {
    const queue = readJsonSafe(ORDERS_FILE, { orders: [] })
    if (!Array.isArray(queue.orders)) queue.orders = []
    queue.orders.push(order)
    writeJsonAtomic(ORDERS_FILE, queue)
}

// 시세 데이터에서 플레이어 룩업 (UUID 또는 username)
function findPlayer(state, identifier) {
    if (!state || !state.players) return null
    const key = String(identifier || '').toLowerCase()
    if (state.players[identifier]) return { uuid: identifier, data: state.players[identifier] }
    for (const uuid of Object.keys(state.players)) {
        const p = state.players[uuid]
        if (p && p.username && p.username.toLowerCase() === key) {
            return { uuid, data: p }
        }
    }
    return null
}

// ----- Express 앱 -----
const app = express()
app.use(express.json({ limit: '64kb' }))
app.use(express.static(path.join(__dirname, 'public')))

// 디버그: 현재 서버 설정
app.get('/api/info', (req, res) => {
    res.json({
        kubejsPath: KUBEJS_PATH,
        files: {
            state:     fs.existsSync(STATE_FILE),
            orders:    fs.existsSync(ORDERS_FILE),
            responses: fs.existsSync(RESPONSES_FILE),
        },
        version: '1.0.0',
    })
})

// 시세 + 메타 + 플레이어 일부
app.get('/api/state', (req, res) => {
    const state = readJsonSafe(STATE_FILE, null)
    if (!state) {
        return res.json({
            ok: false,
            message: '시세 파일을 찾을 수 없습니다. 서버가 켜져 있는지, KUBEJS_PATH 가 올바른지 확인하세요.',
            kubejsPath: KUBEJS_PATH,
        })
    }
    res.json({
        ok: true,
        prices:     state.prices  || {},
        meta:       state.meta    || {},
        lastUpdate: state.lastUpdate || 0,
        players:    Object.keys(state.players || {}).map(uuid => ({
            uuid,
            username: state.players[uuid].username || 'Unknown',
        })),
    })
})

// 특정 플레이어 데이터
app.get('/api/player/:identifier', (req, res) => {
    const state = readJsonSafe(STATE_FILE, null)
    if (!state) return res.status(503).json({ ok: false, message: '시세 데이터 없음' })

    const found = findPlayer(state, req.params.identifier)
    if (!found) return res.status(404).json({ ok: false, message: '플레이어를 찾을 수 없습니다' })

    // 평가 손익 계산
    const portfolio = []
    let totalValue = found.data.balance || 0
    let totalCost  = 0

    for (const [sym, shares] of Object.entries(found.data.portfolio || {})) {
        const avg   = (found.data.avgCost || {})[sym] || 0
        const price = ((state.prices || {})[sym] || {}).current || 0
        const cost  = avg * shares
        const value = price * shares
        portfolio.push({
            symbol: sym, shares, avg, price, cost, value,
            pl:    value - cost,
            plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
        })
        totalValue += value
        totalCost  += cost
    }

    res.json({
        ok: true,
        uuid:     found.uuid,
        username: found.data.username,
        balance:  found.data.balance,
        portfolio,
        transactions: (found.data.transactions || []).slice(0, 30),
        totals: {
            cash:      found.data.balance,
            invested:  totalCost,
            value:     totalValue,
            pl:        totalValue - (found.data.balance + totalCost),
            plPct:     totalCost > 0 ? (((totalValue - found.data.balance) - totalCost) / totalCost) * 100 : 0,
        },
    })
})

// 매수/매도 주문 큐 추가
app.post('/api/order', (req, res) => {
    const { uuid, username, type, symbol, shares } = req.body || {}

    if (!uuid && !username) return res.status(400).json({ ok: false, message: 'uuid 또는 username 필요' })
    if (!['buy', 'sell'].includes(type))     return res.status(400).json({ ok: false, message: 'type 은 buy/sell' })
    if (!symbol || typeof symbol !== 'string') return res.status(400).json({ ok: false, message: 'symbol 필요' })
    const sharesInt = parseInt(shares)
    if (!Number.isFinite(sharesInt) || sharesInt <= 0) return res.status(400).json({ ok: false, message: '잘못된 수량' })

    // username 만 받은 경우 state 에서 uuid 찾기
    let finalUuid = uuid
    if (!finalUuid) {
        const state = readJsonSafe(STATE_FILE, null)
        const found = state ? findPlayer(state, username) : null
        if (!found) return res.status(404).json({ ok: false, message: '플레이어 미등록 (인게임 1회 접속 필요)' })
        finalUuid = found.uuid
    }

    const order = {
        id:       crypto.randomUUID(),
        uuid:     finalUuid,
        username: username || null,
        type,
        symbol:   symbol.toUpperCase(),
        shares:   sharesInt,
        at:       Date.now(),
    }
    enqueueOrder(order)
    res.json({ ok: true, message: '주문 접수됨. 다음 틱(최대 10초)에 체결됩니다.', order })
})

// 응답 (체결 결과) 조회
app.get('/api/responses', (req, res) => {
    const data = readJsonSafe(RESPONSES_FILE, { responses: [] })
    res.json(data)
})

// 감사 로그 (최근 거래 전체)
app.get('/api/audit', (req, res) => {
    const data = readJsonSafe(AUDIT_FILE, { logs: [] })
    res.json(data)
})

// ----- 시작 -----
app.listen(PORT, () => {
    console.log('==========================================================')
    console.log('  선릿밸리 주식 시스템 웹 대시보드')
    console.log('==========================================================')
    console.log('  포트:        http://localhost:' + PORT)
    console.log('  KubeJS 경로:  ' + KUBEJS_PATH)
    console.log('  State 파일:   ' + (fs.existsSync(STATE_FILE) ? '발견됨' : '아직 없음 (서버 1회 실행 필요)'))
    console.log('==========================================================')
})
