// priority: 70
// ==========================================================
// 선릿밸리 주식 시스템 - 매수/매도 핵심 로직
// ==========================================================

// 매수 실행 (성공 시 true, 실패 시 false). 메시지는 result.message 에 담깁니다.
global.executeBuy = function (data, playerData, symbol, shares) {
    const result = { ok: false, message: '' }

    const stock = global.findStock(symbol)
    if (!stock) { result.message = '존재하지 않는 종목입니다: ' + symbol; return result }
    if (!Number.isFinite(shares) || shares <= 0) { result.message = '잘못된 수량입니다.'; return result }
    shares = Math.floor(shares)

    const price = global.getStockPrice(data, stock.symbol)
    if (price === null) { result.message = '시세 데이터가 없습니다.'; return result }

    const gross = price * shares
    const fee   = gross * (global.STOCK_CONFIG.tradeFee / 100)
    const total = gross + fee

    if (playerData.balance < total) {
        result.message = '잔고가 부족합니다. 필요: ' + total.toFixed(2) + ' G / 보유: ' + playerData.balance.toFixed(2) + ' G'
        return result
    }

    // 평단가 갱신
    const oldShares = playerData.portfolio[stock.symbol] || 0
    const oldAvg    = playerData.avgCost[stock.symbol]   || 0
    const newShares = oldShares + shares
    const newAvg    = ((oldShares * oldAvg) + gross) / newShares

    playerData.balance -= total
    playerData.portfolio[stock.symbol] = newShares
    playerData.avgCost[stock.symbol]   = Math.round(newAvg * 100) / 100

    const tx = {
        type: 'buy', symbol: stock.symbol, name: stock.name,
        shares: shares, price: price, fee: fee, total: total, at: Date.now()
    }
    global.appendTransaction(playerData, tx)
    global.appendAudit(Object.assign({ player: playerData.username }, tx))

    result.ok = true
    result.message = '[매수 체결] ' + stock.name + ' ' + shares + '주 @ ' + price.toFixed(2) + ' G (수수료 ' + fee.toFixed(2) + ')'
    result.tx = tx
    return result
}

// 매도 실행
global.executeSell = function (data, playerData, symbol, shares) {
    const result = { ok: false, message: '' }

    const stock = global.findStock(symbol)
    if (!stock) { result.message = '존재하지 않는 종목입니다: ' + symbol; return result }
    if (!Number.isFinite(shares) || shares <= 0) { result.message = '잘못된 수량입니다.'; return result }
    shares = Math.floor(shares)

    const owned = playerData.portfolio[stock.symbol] || 0
    if (shares > owned) {
        result.message = '보유 수량이 부족합니다. 보유: ' + owned + '주'
        return result
    }

    const price = global.getStockPrice(data, stock.symbol)
    if (price === null) { result.message = '시세 데이터가 없습니다.'; return result }

    const gross = price * shares
    const fee   = gross * (global.STOCK_CONFIG.tradeFee / 100)
    const net   = gross - fee

    const avg   = playerData.avgCost[stock.symbol] || price
    const profit = (price - avg) * shares - fee

    playerData.balance += net
    playerData.portfolio[stock.symbol] = owned - shares
    if (playerData.portfolio[stock.symbol] === 0) {
        delete playerData.portfolio[stock.symbol]
        delete playerData.avgCost[stock.symbol]
    }

    const tx = {
        type: 'sell', symbol: stock.symbol, name: stock.name,
        shares: shares, price: price, fee: fee, total: net, profit: profit, at: Date.now()
    }
    global.appendTransaction(playerData, tx)
    global.appendAudit(Object.assign({ player: playerData.username }, tx))

    result.ok = true
    const sign = profit >= 0 ? '+' : ''
    result.message = '[매도 체결] ' + stock.name + ' ' + shares + '주 @ ' + price.toFixed(2) + ' G (손익 ' + sign + profit.toFixed(2) + ' G)'
    result.tx = tx
    return result
}

// 웹 GUI 에서 들어온 주문 처리
global.processOrders = function (server) {
    const orders = global.readJsonSafe(global.STOCK_CONFIG.ordersPath)
    if (!orders || !Array.isArray(orders.orders) || orders.orders.length === 0) return

    const data = global.getStockData()
    const responses = []

    orders.orders.forEach(order => {
        if (!order || !order.uuid || !order.type) return

        const playerData = global.getPlayerData(data, order.uuid, order.username)
        let res
        if (order.type === 'buy') {
            res = global.executeBuy(data, playerData, order.symbol, order.shares)
        } else if (order.type === 'sell') {
            res = global.executeSell(data, playerData, order.symbol, order.shares)
        } else if (order.type === 'deposit') {
            var depositAmt = (order.amount != null ? order.amount : order.emeralds)
            var depositPlayer = server ? server.getPlayer(order.uuid) : null
            if (depositPlayer) {
                depositPlayer.chat('!주식 충전 ' + depositAmt)
                res = { ok: true, message: '충전 명령 전달됨' }
            } else {
                res = { ok: false, message: '플레이어가 오프라인입니다. 인게임에서 !주식 충전 명령어를 사용하세요.' }
            }
        } else if (order.type === 'withdraw') {
            var withdrawAmt = (order.amount != null ? order.amount : order.emeralds)
            var withdrawPlayer = server ? server.getPlayer(order.uuid) : null
            if (withdrawPlayer) {
                withdrawPlayer.chat('!주식 출금 ' + withdrawAmt)
                res = { ok: true, message: '출금 명령 전달됨' }
            } else {
                res = { ok: false, message: '플레이어가 오프라인입니다. 인게임에서 !주식 출금 명령어를 사용하세요.' }
            }
        } else {
            res = { ok: false, message: '알 수 없는 주문 타입' }
        }

        responses.push({
            id: order.id || null,
            uuid: order.uuid,
            ok: res.ok, message: res.message,
            at: Date.now(),
        })

        // 게임 내 플레이어에게도 알림
        try {
            const onlinePlayer = server.getPlayer(order.uuid)
            if (onlinePlayer) {
                onlinePlayer.tell(Text.of('[Web] ').color(res.ok ? 'green' : 'red').append(Text.white(res.message)))
            }
        } catch (e) { /* 오프라인 플레이어 무시 */ }
    })

    global.saveStockData(data)

    // 처리 완료, 응답을 별도 파일에 저장하고 주문 큐 비움
    JsonIO.write(global.STOCK_CONFIG.ordersPath, { orders: [] })
    JsonIO.write('kubejs/exports/stocks_responses.json', { responses: responses, at: Date.now() })
}
