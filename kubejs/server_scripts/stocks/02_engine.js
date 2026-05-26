// priority: 80
// ==========================================================
// 선릿밸리 주식 시스템 - 가격 시뮬레이션 엔진
// ==========================================================

// 종목별 가격을 한 스텝 갱신
global.updateStockPrices = function (server) {
    var data = global.getStockData()
    var tick = (server && server.tickCount) ? server.tickCount : Date.now() / 50

    global.STOCKS.forEach(function(stock) {
        var state = data.prices[stock.symbol]
        if (!state) {
            state = {
                current: stock.basePrice,
                open:    stock.basePrice,
                high:    stock.basePrice,
                low:     stock.basePrice,
                history: [{ t: Date.now(), p: stock.basePrice }],
                change:  0
            }
            data.prices[stock.symbol] = state
        }

        var previous = state.current

        // 1. 랜덤 워크 (백색 노이즈)
        var noise = (Math.random() - 0.5) * 2 * stock.volatility

        // 2. 사이클 트렌드 (긴 사인파)
        var cyclic = Math.sin(tick / 1200) * stock.trend

        // 3. 가끔 발생하는 큰 이벤트 (호재/악재) - 0.5% 확률
        var shock = 0
        if (Math.random() < 0.005) {
            shock = (Math.random() - 0.5) * stock.volatility * 6
        }

        var drift = noise + cyclic + shock
        var next = previous * (1 + drift)

        // 가격 클램프
        var minP = stock.basePrice * global.STOCK_CONFIG.minPriceMultiplier
        var maxP = stock.basePrice * global.STOCK_CONFIG.maxPriceMultiplier
        if (next < minP) next = minP
        if (next > maxP) next = maxP
        next = Math.round(next * 100) / 100

        state.current = next
        state.change  = previous > 0 ? ((next - previous) / previous) * 100 : 0
        if (next > state.high) state.high = next
        if (next < state.low)  state.low  = next

        state.history.push({ t: Date.now(), p: next })
        if (state.history.length > global.STOCK_CONFIG.historyLength) {
            state.history.shift()
        }
    })

    global.saveStockData(data)
}

// 종목 시세 조회 헬퍼
global.getStockPrice = function (data, symbol) {
    var state = data.prices[symbol]
    return state ? state.current : null
}

// 종목 정의 조회
global.findStock = function (symbol) {
    if (!symbol) return null
    var upper = String(symbol).toUpperCase()
    var found = null
    global.STOCKS.forEach(function(s) {
        if (s.symbol === upper) found = s
    })
    return found
}
