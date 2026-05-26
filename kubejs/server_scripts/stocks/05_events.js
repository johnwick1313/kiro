// priority: 50
// ==========================================================
// 선릿밸리 주식 시스템 - 서버 이벤트 (틱, 로그인, 로드)
// ==========================================================

// 서버 시작 시 초기화
ServerEvents.loaded(event => {
    console.info('[StockSystem] 서버 로드. 종목 가격 초기화 중...')
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
let _stockTickCounter = 0
ServerEvents.tick(event => {
    _stockTickCounter++
    if (_stockTickCounter < global.STOCK_CONFIG.updateIntervalTicks) return
    _stockTickCounter = 0

    try {
        global.updateStockPrices(event.server)
    } catch (e) {
        console.error('[StockSystem] 가격 갱신 오류: ' + e)
    }

    try {
        global.processOrders(event.server)
    } catch (e) {
        console.error('[StockSystem] 주문 처리 오류: ' + e)
    }
})

// 로그인 환영 메시지 + 신규 플레이어 자동 생성
PlayerEvents.loggedIn(event => {
    const data = global.getStockData()
    const playerData = global.getPlayerData(
        data, event.player.stringUuid, event.player.username || event.player.name.string
    )
    global.saveStockData(data)

    event.player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    event.player.tell(Text.of('  $$$  주식 시스템 v1.0  $$$').color('yellow').bold(true))
    event.player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    event.player.tell(Text.of('현재 잔고: ').color('aqua')
        .append(Text.white(playerData.balance.toFixed(2) + ' G')))
    event.player.tell(Text.of('명령어 도움말: ').color('aqua')
        .append(Text.yellow('!주식 도움말')))
    event.player.tell(
        Text.of('웹 대시보드: ').color('aqua')
            .append(
                Text.of('[ 클릭해서 열기 → localhost:3000 ]')
                    .color('green')
                    .underlined(true)
                    .click({ type: 'open_url', value: 'http://localhost:3000' })
                    .hover({ type: 'text', value: Text.of('브라우저에서 주식 대시보드를 엽니다').color('white') })
            )
    )
})
