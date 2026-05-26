// priority: 50
// ==========================================================
// 선릿밸리 주식 시스템 - 서버 이벤트 (틱, 로그인, 로드)
// ==========================================================

// 커스텀 종목 불러오기 (웹 관리자 페이지에서 추가된 종목)
global.loadCustomStocks = function () {
    try {
        const custom = global.readJsonSafe(global.STOCK_CONFIG.customStocksPath)
        if (!custom || !Array.isArray(custom.stocks)) return
        custom.stocks.forEach(s => {
            // 중복 심볼이 없을 때만 추가
            if (!global.STOCKS.find(x => x.symbol === s.symbol)) {
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
        const opUuids = []
        server.playerList.players.forEach(p => {
            try {
                // hasPermissions(4) = OP 레벨 4
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

// 서버 시작 시 초기화
ServerEvents.loaded(event => {
    console.info('[StockSystem] 서버 로드. 커스텀 종목 불러오는 중...')

    // 커스텀 종목 먼저 로드
    global.loadCustomStocks()

    const data = global.getStockData()

    global.STOCKS.forEach(stock => {
        if (!data.prices[stock.symbol]) {
            data.prices[stock.symbol] = {
                current: stock.basePrice,
                open:    stock.basePrice,
                high:    stock.basePrice,
                low:     stock.basePrice,
                history: [{ t: Date.now(), p: stock.basePrice }],
                change:  0,
            }
        }
    })

    global.saveStockData(data)
    console.info('[StockSystem] 초기화 완료. 종목 ' + global.STOCKS.length + '개')
})

// 틱 이벤트 - N틱마다 가격 갱신 + 웹 주문 처리
let _stockTickCounter  = 0
let _customCheckCounter = 0
ServerEvents.tick(event => {
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
PlayerEvents.loggedIn(event => {
    const player     = event.player
    const uuid       = player.stringUuid
    const username   = player.username || player.name.string
    const data       = global.getStockData()
    const playerData = global.getPlayerData(data, uuid, username)
    global.saveStockData(data)

    // OP 목록 갱신
    try { global.syncOps(player.server) } catch (e) {}

    const webUrl = 'http://localhost:3000/?uuid=' + uuid
    const isOp   = player.hasPermissions(4)

    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(Text.of('  📈 Sunlit Exchange').color('yellow').bold(true)
        .append(isOp ? Text.of('  [OP]').color('gold') : Text.empty()))
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(Text.of('잔고: ').color('gray')
        .append(Text.of(playerData.balance.toFixed(2) + ' G').color('white').bold(true)))
    player.tell(
        Text.of('  ▶ ').color('green').append(
            Text.of('[ 대시보드 열기 — 자동 로그인 ]')
                .color('aqua').underlined(true)
                .click({ type: 'open_url', value: webUrl })
                .hover({ type: 'text', value: Text.white(webUrl) })
        )
    )
    player.tell(Text.of('명령어: ').color('gray').append(Text.yellow('!주식 도움말')))
})
