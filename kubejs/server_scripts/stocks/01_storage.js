// priority: 90
// ==========================================================
// 선릿밸리 주식 시스템 - 데이터 영속성 (JSON 파일 IO)
// ==========================================================

// JsonIO 로 안전하게 읽기 (없으면 null)
global.readJsonSafe = function (path) {
    try {
        var d = JsonIO.read(path)
        return d || null
    } catch (e) {
        return null
    }
}

// 주식 시스템 전체 상태 가져오기
global.getStockData = function () {
    var data = global.readJsonSafe(global.STOCK_CONFIG.exportPath)
    if (!data || typeof data !== 'object') {
        data = { prices: {}, players: {}, lastUpdate: 0, meta: {} }
    }
    if (!data.prices)  data.prices  = {}
    if (!data.players) data.players = {}
    if (!data.meta)    data.meta    = {}

    // 종목 메타데이터 동기화
    data.meta.stocks = global.STOCKS.map(function(s) {
        return { symbol: s.symbol, name: s.name, sector: s.sector, basePrice: s.basePrice, volatility: s.volatility, trend: s.trend }
    })
    data.meta.config = {
        updateIntervalTicks: global.STOCK_CONFIG.updateIntervalTicks,
        tradeFee: global.STOCK_CONFIG.tradeFee,
        currency: 'GOLD'
    }

    return data
}

// 상태 저장
global.saveStockData = function (data) {
    data.lastUpdate = Date.now()
    JsonIO.write(global.STOCK_CONFIG.exportPath, data)
}

// 플레이어 데이터 가져오기 (없으면 신규 생성)
global.getPlayerData = function (data, uuid, username) {
    if (!data.players[uuid]) {
        data.players[uuid] = {
            username: username || 'Unknown',
            balance: global.STOCK_CONFIG.startingBalance,
            portfolio: {},
            avgCost:   {},
            transactions: [],
            joinedAt: Date.now()
        }
    }
    if (username) data.players[uuid].username = username
    return data.players[uuid]
}

// 거래 내역 추가 (최근 50건만 유지)
global.appendTransaction = function (playerData, tx) {
    playerData.transactions.unshift(tx)
    if (playerData.transactions.length > 50) {
        playerData.transactions.length = 50
    }
}

// 감사 로그 (전체 거래 기록, 최근 500건 유지)
global.appendAudit = function (entry) {
    var audit = global.readJsonSafe(global.STOCK_CONFIG.auditPath) || { logs: [] }
    if (!audit.logs) audit.logs = []
    audit.logs.unshift(entry)
    if (audit.logs.length > 500) audit.logs.length = 500
    JsonIO.write(global.STOCK_CONFIG.auditPath, audit)
}
