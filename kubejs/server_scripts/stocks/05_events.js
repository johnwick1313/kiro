// priority: 50
// ==========================================================
// 선릿밸리 주식 시스템 - 서버 이벤트 (틱, 로그인, 로드)
// ==========================================================

// 커스텀 종목 불러오기 (웹 관리자 페이지에서 추가된 종목)
global.loadCustomStocks = function () {
    try {
        var customData = global.readJsonSafe(global.STOCK_CONFIG.customStocksPath)
        if (!customData || !Array.isArray(customData.stocks)) return
        customData.stocks.forEach(function(s) {
            if (!global.STOCKS.find(function(x) { return x.symbol === s.symbol })) {
                global.STOCKS.push(s)
                console.info('[StockSystem] 커스텀 종목 로드: ' + s.symbol + ' (' + s.name + ')')
            }
        })
    } catch (e) {
        console.error('[StockSystem] 커스텀 종목 로드 오류: ' + e)
    }
}

// OP 목록을 exports 에 동기화 (웹 서버가 읽을 수 있도록)
global.syncOps = function (server) {
    try {
        var opUuids = []
        server.playerList.players.forEach(function(p) {
            try {
                if (p.hasPermissions(4)) {
                    opUuids.push(p.stringUuid)
                }
            } catch (e) {}
        })
        JsonIO.write(global.STOCK_CONFIG.opsPath, { ops: opUuids, updatedAt: Date.now() })
    } catch (e) {
        console.error('[StockSystem] OP 동기화 오류: ' + e)
    }
}

// exports 폴더 보장 (없으면 초기 파일 생성)
global.ensureExportsDir = function () {
    try {
        // stocks_state.json 이 없으면 빈 구조로 생성
        var existing = global.readJsonSafe(global.STOCK_CONFIG.exportPath)
        if (!existing) {
            JsonIO.write(global.STOCK_CONFIG.exportPath, { prices: {}, players: {}, lastUpdate: 0, meta: {} })
        }
        var existingOrders = global.readJsonSafe(global.STOCK_CONFIG.ordersPath)
        if (!existingOrders) {
            JsonIO.write(global.STOCK_CONFIG.ordersPath, { orders: [] })
        }
    } catch (e) {
        console.error('[StockSystem] exports 초기화 오류: ' + e)
    }
}

// 서버 시작 시 초기화
ServerEvents.loaded(function(event) {
    console.info('[StockSystem] 서버 로드. 커스텀 종목 불러오는 중...')

    global.ensureExportsDir()
    global.loadCustomStocks()

    var data = global.getStockData()

    global.STOCKS.forEach(function(stock) {
        if (!data.prices[stock.symbol]) {
            data.prices[stock.symbol] = {
                current: stock.basePrice,
                open:    stock.basePrice,
                high:    stock.basePrice,
                low:     stock.basePrice,
                history: [{ t: Date.now(), p: stock.basePrice }],
                change:  0
            }
        }
    })

    global.saveStockData(data)
    console.info('[StockSystem] 초기화 완료. 종목 ' + global.STOCKS.length + '개')
})

// 틱 이벤트 - N틱마다 가격 갱신 + 웹 주문 처리
var _stockTickCounter  = 0
var _customCheckCounter = 0
ServerEvents.tick(function(event) {
    _stockTickCounter++
    _customCheckCounter++

    // 커스텀 종목 변경 감지 (30초마다)
    if (_customCheckCounter >= 600) {
        _customCheckCounter = 0
        global.loadCustomStocks()
        global.syncOps(event.server)
    }

    if (_stockTickCounter < global.STOCK_CONFIG.updateIntervalTicks) return
    _stockTickCounter = 0

    try { global.updateStockPrices(event.server) }
    catch (e) { console.error('[StockSystem] 가격 갱신 오류: ' + e) }

    try { global.processOrders(event.server) }
    catch (e) { console.error('[StockSystem] 주문 처리 오류: ' + e) }
})

// 로그인: 환영 메시지 + OP 동기화
PlayerEvents.loggedIn(function(event) {
    var player   = event.player
    var uuid     = player.stringUuid
    var username = player.username || player.name.string
    var data     = global.getStockData()
    var playerData = global.getPlayerData(data, uuid, username)
    global.saveStockData(data)

    try { global.syncOps(player.server) } catch (e) {}

    var webUrl = 'http://localhost:3000/?uuid=' + uuid
    var isOp   = player.hasPermissions(4)

    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(Text.of('  📈 Sunlit Exchange').color('yellow').bold(true))
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(Text.of('잔고: ').color('gray')
        .append(Text.of(Number(playerData.balance || 0).toFixed(2) + ' G').color('white').bold(true)))
    player.tell(
        Text.of('  ▶ ').color('green').append(
            Text.of('[ 대시보드 열기 — 자동 로그인 ]')
                .color('aqua').underlined(true)
                .click('open_url:' + webUrl)
                .hover(Text.white(webUrl))
        )
    )
    player.tell(Text.of('명령어: ').color('gray').append(Text.yellow('!주식 도움말')))
})
