// priority: 30
// ==========================================================
// 선릿밸리 주식 시스템 - 마크 JVM 내장 HTTP 서버
// ==========================================================
// 별도 Node 서버를 실행하지 않고도, 마인크래프트 안에서 직접
// 작은 웹 서버를 띄워 전체 웹 GUI(매수/매도/관리자 포함)를 제공합니다.
//
// - JDK 내장 com.sun.net.httpserver 사용 (외부 의존성 없음)
// - Node 서버(server.js)와 동일한 API/파일 큐 방식 → 스레드 안전
//   (주문은 orders 파일에 쌓이고, 틱에서 processOrders 가 체결)
// - 정적 자산은 kubejs/web/ 에서 서빙 (Chart.js 로컬 번들 포함 → 오프라인 가능)
//
// 일부 최소화된 자바 런타임에는 com.sun.net.httpserver 모듈이
// 없을 수 있습니다. 그 경우 자동으로 비활성화되고 안내 메시지를 출력합니다.
// (대안: Node 서버 또는 J키 오프라인 대시보드 사용)
// ==========================================================

(function () {
    var CFG = global.STOCK_CONFIG
    if (!CFG.httpServerEnabled) {
        console.info('[StockHttp] 임베디드 HTTP 서버 비활성화됨 (httpServerEnabled=false)')
        return
    }

    // ── 필요한 자바 타입 로드 (모듈 없으면 여기서 실패 → 안전하게 종료) ──
    var HttpServer, InetSocketAddress, Files, Paths, StandardCharsets, UUIDt, URLDecoder
    try {
        HttpServer        = Java.type('com.sun.net.httpserver.HttpServer')
        InetSocketAddress = Java.type('java.net.InetSocketAddress')
        Files             = Java.type('java.nio.file.Files')
        Paths             = Java.type('java.nio.file.Paths')
        StandardCharsets  = Java.type('java.nio.charset.StandardCharsets')
        UUIDt             = Java.type('java.util.UUID')
        URLDecoder        = Java.type('java.net.URLDecoder')
    } catch (e) {
        console.warn('[StockHttp] com.sun.net.httpserver 를 사용할 수 없어 임베디드 서버를 끕니다.')
        console.warn('[StockHttp] -> Node 서버(web-gui) 또는 J키 오프라인 대시보드를 사용하세요. (' + e + ')')
        return
    }

    var UTF8 = StandardCharsets.UTF_8

    // ====================================================
    // 파일 IO (java.nio) — KubeJS 메인 스레드와 분리되어 안전
    // ====================================================
    function readText(path) {
        try {
            var p = Paths.get(path)
            if (!Files.exists(p)) return null
            return new java.lang.String(Files.readAllBytes(p), UTF8)
        } catch (e) { return null }
    }
    function readBytes(path) {
        try {
            var p = Paths.get(path)
            if (!Files.exists(p)) return null
            return Files.readAllBytes(p)
        } catch (e) { return null }
    }
    function readJson(path, fallback) {
        var t = readText(path)
        if (!t) return fallback
        try { return JSON.parse(String(t).trim() || 'null') || fallback }
        catch (e) { return fallback }
    }
    function writeJson(path, obj) {
        try {
            var p = Paths.get(path)
            var parent = p.getParent()
            if (parent && !Files.exists(parent)) Files.createDirectories(parent)
            Files.write(p, new java.lang.String(JSON.stringify(obj, null, 2)).getBytes(UTF8))
            return true
        } catch (e) { console.error('[StockHttp] writeJson 오류: ' + e); return false }
    }
    function enqueueOrder(order) {
        var q = readJson(CFG.ordersPath, { orders: [] })
        if (!q.orders || !(q.orders instanceof Array)) q.orders = []
        q.orders.push(order)
        writeJson(CFG.ordersPath, q)
    }
    function newId() { return UUIDt.randomUUID().toString() }
    function decode(s) { try { return URLDecoder.decode(s, 'UTF-8') } catch (e) { return s } }

    // ====================================================
    // HTTP 응답 헬퍼
    // ====================================================
    function setCors(ex) {
        var h = ex.getResponseHeaders()
        h.set('Access-Control-Allow-Origin', '*')
        h.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        h.set('Access-Control-Allow-Headers', 'Content-Type')
    }
    function sendBytes(ex, code, contentType, bytes) {
        try {
            var h = ex.getResponseHeaders()
            h.set('Content-Type', contentType)
            setCors(ex)
            ex.sendResponseHeaders(code, bytes.length)
            var os = ex.getResponseBody()
            os.write(bytes)
            os.close()
        } catch (e) { try { ex.close() } catch (e2) {} }
    }
    function sendText(ex, code, contentType, str) {
        sendBytes(ex, code, contentType, new java.lang.String(String(str)).getBytes(UTF8))
    }
    function sendJson(ex, code, obj) {
        sendText(ex, code, 'application/json; charset=utf-8', JSON.stringify(obj))
    }
    function readReqBody(ex) {
        try {
            var is = ex.getRequestBody()
            var bytes = is.readAllBytes()
            return new java.lang.String(bytes, UTF8)
        } catch (e) { return '' }
    }
    function parseBody(ex) {
        var t = readReqBody(ex)
        if (!t) return {}
        try { return JSON.parse(String(t)) || {} } catch (e) { return {} }
    }

    // ====================================================
    // 정적 파일 서빙
    // ====================================================
    var CONTENT_TYPES = {
        html: 'text/html; charset=utf-8',
        js:   'application/javascript; charset=utf-8',
        css:  'text/css; charset=utf-8',
        json: 'application/json; charset=utf-8',
        svg:  'image/svg+xml',
        png:  'image/png',
        jpg:  'image/jpeg',
        ico:  'image/x-icon',
        map:  'application/json',
    }
    function contentTypeFor(name) {
        var i = name.lastIndexOf('.')
        var ext = i >= 0 ? name.substring(i + 1).toLowerCase() : ''
        return CONTENT_TYPES[ext] || 'application/octet-stream'
    }
    function serveStatic(ex, path) {
        var rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '')
        // 경로 탈출 방지
        if (rel.indexOf('..') !== -1) { sendText(ex, 403, 'text/plain', 'forbidden'); return }
        var full = CFG.httpWebRoot + '/' + rel
        var bytes = readBytes(full)
        if (bytes === null) {
            // SPA 폴백: 알 수 없는 경로는 index.html
            if (rel.indexOf('api/') !== 0) {
                bytes = readBytes(CFG.httpWebRoot + '/index.html')
                if (bytes !== null) { sendBytes(ex, 200, CONTENT_TYPES.html, bytes); return }
            }
            sendText(ex, 404, 'text/plain', 'not found: ' + rel)
            return
        }
        sendBytes(ex, 200, contentTypeFor(rel), bytes)
    }

    // ====================================================
    // 도메인 헬퍼 (server.js 와 동일 로직)
    // ====================================================
    function isOp(uuid) {
        var ops = readJson(CFG.opsPath, { ops: [] })
        return ops && ops.ops instanceof Array && ops.ops.indexOf(uuid) !== -1
    }
    function findPlayer(state, id) {
        if (!state || !state.players) return null
        if (state.players[id]) return { uuid: id, data: state.players[id] }
        var keys = Object.keys(state.players)
        for (var i = 0; i < keys.length; i++) {
            var d = state.players[keys[i]]
            if (d.username && String(d.username).toLowerCase() === String(id).toLowerCase())
                return { uuid: keys[i], data: d }
        }
        return null
    }
    function formatPlayer(uuid, data, state) {
        var portfolio = []
        var totalValue = data.balance || 0
        var totalCost = 0
        var pf = data.portfolio || {}
        Object.keys(pf).forEach(function (sym) {
            var shares = pf[sym]
            var avg = (data.avgCost || {})[sym] || 0
            var price = ((state.prices || {})[sym] || {}).current || 0
            var cost = avg * shares
            var value = price * shares
            portfolio.push({
                symbol: sym, shares: shares, avg: avg, price: price,
                cost: cost, value: value, pl: value - cost,
                plPct: cost > 0 ? ((value - cost) / cost * 100) : 0,
            })
            totalValue += value
            totalCost += cost
        })
        return {
            ok: true, uuid: uuid, username: data.username, balance: data.balance,
            isOp: isOp(uuid), portfolio: portfolio,
            transactions: (data.transactions || []).slice(0, 50),
            totals: {
                cash: data.balance, invested: totalCost, value: totalValue,
                pl: totalValue - data.balance - totalCost,
                plPct: totalCost > 0 ? ((totalValue - data.balance - totalCost) / totalCost * 100) : 0,
            },
        }
    }

    // ====================================================
    // API 라우팅
    // ====================================================
    function handleApi(ex, method, path) {
        // ── GET /api/state ──
        if (method === 'GET' && path === '/api/state') {
            var state = readJson(CFG.exportPath, null)
            if (!state) { sendJson(ex, 200, { ok: false, message: '시세 파일 없음. 마인크래프트 서버 실행 확인.' }); return }
            var players = Object.keys(state.players || {}).map(function (uuid) {
                var d = state.players[uuid]
                return {
                    uuid: uuid, username: d.username || 'Unknown', balance: d.balance || 0,
                    portfolioCount: Object.keys(d.portfolio || {}).length,
                    txCount: (d.transactions || []).length,
                }
            })
            sendJson(ex, 200, {
                ok: true, prices: state.prices || {}, meta: state.meta || {},
                lastUpdate: state.lastUpdate || 0, players: players,
            })
            return
        }

        // ── GET /api/player/:id ──
        if (method === 'GET' && path.indexOf('/api/player/') === 0) {
            var state2 = readJson(CFG.exportPath, null)
            if (!state2) { sendJson(ex, 503, { ok: false, message: '서버 데이터 없음' }); return }
            var id = decode(path.substring('/api/player/'.length))
            var found = findPlayer(state2, id)
            if (!found) { sendJson(ex, 404, { ok: false, message: '플레이어를 찾을 수 없습니다. 마인크래프트에 먼저 접속해주세요.' }); return }
            sendJson(ex, 200, formatPlayer(found.uuid, found.data, state2))
            return
        }

        // ── POST /api/order ──
        if (method === 'POST' && path === '/api/order') {
            var b = parseBody(ex)
            if (!b.uuid) { sendJson(ex, 400, { ok: false, message: 'uuid 필요' }); return }
            if (b.type !== 'buy' && b.type !== 'sell') { sendJson(ex, 400, { ok: false, message: 'type은 buy/sell' }); return }
            if (!b.symbol) { sendJson(ex, 400, { ok: false, message: 'symbol 필요' }); return }
            var n = parseInt(b.shares)
            if (!n || n <= 0) { sendJson(ex, 400, { ok: false, message: '수량 오류' }); return }
            var st = readJson(CFG.exportPath, null)
            if (!st || !st.players || !st.players[b.uuid]) { sendJson(ex, 403, { ok: false, message: '등록되지 않은 플레이어입니다. 마인크래프트에 먼저 접속해주세요.' }); return }
            var order = {
                id: newId(), uuid: b.uuid, username: st.players[b.uuid].username,
                type: b.type, symbol: String(b.symbol).toUpperCase(), shares: n, at: Date.now(),
            }
            enqueueOrder(order)
            sendJson(ex, 200, { ok: true, message: '주문 접수 (최대 10초 내 체결)', order: order })
            return
        }

        // ── POST /api/deposit, /api/withdraw ──
        if (method === 'POST' && (path === '/api/deposit' || path === '/api/withdraw')) {
            var bd = parseBody(ex)
            var std = readJson(CFG.exportPath, null)
            if (!std || !std.players || !std.players[bd.uuid]) { sendJson(ex, 403, { ok: false, message: '인증 실패' }); return }
            var amt = parseInt(bd.amount != null ? bd.amount : bd.emeralds)
            if (!amt || amt <= 0) { sendJson(ex, 400, { ok: false, message: '금액 오류' }); return }
            var type = path === '/api/deposit' ? 'deposit' : 'withdraw'
            enqueueOrder({ id: newId(), uuid: bd.uuid, username: std.players[bd.uuid].username, type: type, amount: amt, at: Date.now() })
            sendJson(ex, 200, { ok: true, message: amt + ' G ' + (type === 'deposit' ? '충전' : '출금') + ' 요청 접수 (인게임에서 화폐 처리)' })
            return
        }

        // ── POST /api/admin/stock (OP) ──
        if (method === 'POST' && path === '/api/admin/stock') {
            var ab = parseBody(ex)
            if (!ab.uuid || !isOp(ab.uuid)) { sendJson(ex, 403, { ok: false, message: 'OP 권한이 필요합니다.' }); return }
            if (!ab.symbol || !ab.name || !ab.basePrice) { sendJson(ex, 400, { ok: false, message: 'symbol, name, basePrice 필수' }); return }
            var sym = String(ab.symbol).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)
            if (!sym) { sendJson(ex, 400, { ok: false, message: '심볼은 영문 대문자만 사용 가능' }); return }
            var custom = readJson(CFG.customStocksPath, { stocks: [] })
            if (!custom.stocks || !(custom.stocks instanceof Array)) custom.stocks = []
            for (var ci = 0; ci < custom.stocks.length; ci++) {
                if (custom.stocks[ci].symbol === sym) { sendJson(ex, 409, { ok: false, message: '이미 존재하는 심볼: ' + sym }); return }
            }
            var stock = {
                symbol: sym, name: String(ab.name).slice(0, 40), sector: ab.sector || '기타',
                basePrice: Math.max(1, Math.round(parseFloat(ab.basePrice) * 100) / 100),
                volatility: Math.min(0.30, Math.max(0.01, parseFloat(ab.volatility) || 0.05)),
                trend: Math.min(0.10, Math.max(-0.10, parseFloat(ab.trend) || 0.02)),
                addedAt: Date.now(),
            }
            custom.stocks.push(stock)
            writeJson(CFG.customStocksPath, custom)
            sendJson(ex, 200, { ok: true, message: sym + ' (' + ab.name + ') 종목이 추가됐습니다. 다음 틱에 반영됩니다.', stock: stock })
            return
        }

        // ── DELETE /api/admin/stock/:symbol (OP) ──
        if (method === 'DELETE' && path.indexOf('/api/admin/stock/') === 0) {
            var db = parseBody(ex)
            if (!db.uuid || !isOp(db.uuid)) { sendJson(ex, 403, { ok: false, message: 'OP 권한이 필요합니다.' }); return }
            var dsym = decode(path.substring('/api/admin/stock/'.length)).toUpperCase()
            var dc = readJson(CFG.customStocksPath, { stocks: [] })
            if (!dc.stocks || !(dc.stocks instanceof Array)) dc.stocks = []
            var before = dc.stocks.length
            dc.stocks = dc.stocks.filter(function (s) { return s.symbol !== dsym })
            if (dc.stocks.length === before) { sendJson(ex, 404, { ok: false, message: "커스텀 종목 '" + dsym + "'을 찾을 수 없습니다. (기본 종목은 00_config.js에서 수정)" }); return }
            writeJson(CFG.customStocksPath, dc)
            sendJson(ex, 200, { ok: true, message: dsym + ' 종목이 삭제됐습니다.' })
            return
        }

        // ── GET /api/responses, /api/audit, /api/info ──
        if (method === 'GET' && path === '/api/responses') { sendJson(ex, 200, readJson('kubejs/exports/stocks_responses.json', { responses: [] })); return }
        if (method === 'GET' && path === '/api/audit')     { sendJson(ex, 200, readJson(CFG.auditPath, { logs: [] })); return }
        if (method === 'GET' && path === '/api/info') {
            sendJson(ex, 200, { ok: true, mode: 'embedded', stateExists: !!readJson(CFG.exportPath, null), version: '2.1.0' })
            return
        }

        sendJson(ex, 404, { ok: false, message: '알 수 없는 API: ' + method + ' ' + path })
    }

    // ── 루트 핸들러 ──
    var rootHandler = new (Java.type('com.sun.net.httpserver.HttpHandler'))({
        handle: function (ex) {
            try {
                var method = ex.getRequestMethod()
                var path = ex.getRequestURI().getPath()
                if (method === 'OPTIONS') { setCors(ex); ex.sendResponseHeaders(204, -1); ex.close(); return }
                if (path.indexOf('/api/') === 0) { handleApi(ex, method, path); return }
                serveStatic(ex, path)
            } catch (e) {
                console.error('[StockHttp] 요청 처리 오류: ' + e)
                try { sendJson(ex, 500, { ok: false, message: '서버 오류' }) } catch (e2) {}
            }
        }
    })

    // ====================================================
    // 서버 시작/중지
    // ====================================================
    function stopExisting() {
        if (global._stockHttpServer) {
            try { global._stockHttpServer.stop(0); console.info('[StockHttp] 기존 서버 중지') } catch (e) {}
            global._stockHttpServer = null
        }
    }
    function startServer() {
        stopExisting()
        var port = CFG.httpServerPort || 3000
        var host = CFG.httpServerHost || '0.0.0.0'
        try {
            var server = HttpServer.create(new InetSocketAddress(host, port), 0)
            server.createContext('/', rootHandler)
            server.setExecutor(null) // 기본(순차) 실행기 — 저트래픽엔 충분
            server.start()
            global._stockHttpServer = server
            console.info('[StockHttp] ✔ 임베디드 웹 서버 시작: http://localhost:' + port + ' (host ' + host + ')')
            console.info('[StockHttp]   웹 자산: ' + CFG.httpWebRoot + ' / 별도 Node 서버 불필요')
        } catch (e) {
            // 포트 점유 = /reload 후 이전 인스턴스가 살아있는 경우. 파일을 매번 새로 읽으므로 그대로 동작.
            console.warn('[StockHttp] 서버 시작 실패(이미 실행 중일 수 있음): ' + e)
        }
    }

    ServerEvents.loaded(function (event) {
        startServer()
    })

    // 월드 언로드 시 정리 (이벤트가 없는 버전이면 무시)
    try {
        ServerEvents.unloaded(function (event) { stopExisting() })
    } catch (e) { /* unloaded 미지원 버전 */ }

    console.info('[StockHttp] 임베디드 HTTP 서버 모듈 로드됨 (시작은 서버 로드 시)')
})()
