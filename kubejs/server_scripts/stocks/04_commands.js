// priority: 60
// ==========================================================
// 선릿밸리 주식 시스템 - 채팅 명령어 (!주식 ...)
// ==========================================================

function fmtPct(p) {
    const sign = p >= 0 ? '+' : ''
    return sign + p.toFixed(2) + '%'
}
function colorChange(p) { return p >= 0 ? 'green' : 'red' }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s }

function sendWebLink(player) {
    // UUID를 URL 파라미터에 포함 → 자동 로그인
    const uuid = player.stringUuid
    const url  = 'http://localhost:3000/?uuid=' + uuid
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(Text.of('  📈 선릿밸리 주식 거래소').color('yellow').bold(true))
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
    player.tell(
        Text.of('  ▶ ').color('green')
            .append(
                Text.of('[ 대시보드 열기 - 자동 로그인 ]')
                    .color('aqua')
                    .underlined(true)
                    .click({ type: 'open_url', value: url })
                    .hover({ type: 'text', value: Text.of('클릭 시 ' + player.name.string + ' 으로 자동 로그인됩니다').color('white') })
            )
    )
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
}

function sendHelp(player) {
    player.tell(Text.of('━━━━━━━━━━ 주식 시스템 도움말 ━━━━━━━━━━').color('gold'))
    player.tell(Text.of('!주식 목록            ').color('aqua').append(Text.white('- 모든 종목 시세 조회')))
    player.tell(Text.of('!주식 시세 [심볼]     ').color('aqua').append(Text.white('- 특정 종목 상세')))
    player.tell(Text.of('!주식 매수 [심볼] [수량]').color('aqua').append(Text.white(' - 매수 주문')))
    player.tell(Text.of('!주식 매도 [심볼] [수량]').color('aqua').append(Text.white(' - 매도 주문')))
    player.tell(Text.of('!주식 포트폴리오      ').color('aqua').append(Text.white('- 보유 종목 조회')))
    player.tell(Text.of('!주식 잔고            ').color('aqua').append(Text.white('- 보유 골드 조회')))
    player.tell(Text.of('!주식 충전 [에메랄드수]').color('aqua').append(Text.white(' - 에메랄드 -> 골드 환전')))
    player.tell(Text.of('!주식 출금 [수량]     ').color('aqua').append(Text.white('- 골드 -> 에메랄드 환전')))
    player.tell(Text.of('!주식 거래내역        ').color('aqua').append(Text.white('- 최근 거래 10건')))
    player.tell(Text.of('!주식 웹              ').color('aqua').append(Text.white('- 웹 대시보드 링크 열기')))
    player.tell(Text.of('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━').color('gold'))
}

function sendList(player, data) {
    player.tell(Text.of('━━━━━━ 실시간 시세 ━━━━━━').color('gold'))
    player.tell(Text.of('심볼   가격          변동률    종목').color('gray'))
    global.STOCKS.forEach(s => {
        const st = data.prices[s.symbol]
        if (!st) return
        const line = Text.of(pad(s.symbol, 6)).color('yellow')
            .append(Text.of(pad(st.current.toFixed(2) + ' G', 14)).color('white'))
            .append(Text.of(pad(fmtPct(st.change), 10)).color(colorChange(st.change)))
            .append(Text.of(s.name).color('gray'))
        player.tell(line)
    })
    player.tell(Text.of('업데이트: ' + new Date(data.lastUpdate || Date.now()).toLocaleTimeString()).color('dark_gray'))
}

function sendQuote(player, data, symbol) {
    const stock = global.findStock(symbol)
    if (!stock) { player.tell(Text.red('종목을 찾을 수 없습니다: ' + symbol)); return }
    const st = data.prices[stock.symbol]
    if (!st) { player.tell(Text.red('시세 없음')); return }

    player.tell(Text.of('━━━ ' + stock.name + ' (' + stock.symbol + ') ━━━').color('gold'))
    player.tell(Text.of('현재가: ').color('aqua').append(Text.white(st.current.toFixed(2) + ' G')))
    player.tell(Text.of('변동률: ').color('aqua').append(Text.of(fmtPct(st.change)).color(colorChange(st.change))))
    player.tell(Text.of('일중고가: ').color('aqua').append(Text.white(st.high.toFixed(2) + ' G')))
    player.tell(Text.of('일중저가: ').color('aqua').append(Text.white(st.low.toFixed(2) + ' G')))
    player.tell(Text.of('섹터: ').color('aqua').append(Text.white(stock.sector)))
}

function sendPortfolio(player, data, playerData) {
    player.tell(Text.of('━━━━━━ 포트폴리오 (' + playerData.username + ') ━━━━━━').color('gold'))
    player.tell(Text.of('잔고: ' + playerData.balance.toFixed(2) + ' G').color('yellow'))

    const symbols = Object.keys(playerData.portfolio || {})
    if (symbols.length === 0) {
        player.tell(Text.gray('보유 종목 없음'))
        return
    }

    let totalValue = playerData.balance
    let totalCost  = 0

    symbols.forEach(sym => {
        const shares = playerData.portfolio[sym]
        const avg    = playerData.avgCost[sym] || 0
        const price  = global.getStockPrice(data, sym) || 0
        const cost   = avg * shares
        const value  = price * shares
        const pl     = value - cost
        const plPct  = cost > 0 ? (pl / cost) * 100 : 0

        totalValue += value
        totalCost  += cost

        const line = Text.of(pad(sym, 6)).color('yellow')
            .append(Text.of(pad(shares + '주', 8)).color('white'))
            .append(Text.of(pad('@' + avg.toFixed(2), 12)).color('gray'))
            .append(Text.of(pad(value.toFixed(2) + 'G', 12)).color('white'))
            .append(Text.of(fmtPct(plPct)).color(colorChange(pl)))
        player.tell(line)
    })

    const totalPl = totalCost > 0 ? ((totalValue - playerData.balance - totalCost) / totalCost) * 100 : 0
    player.tell(Text.of('총 자산: ' + totalValue.toFixed(2) + ' G  ').color('gold')
        .append(Text.of('(평가손익 ' + fmtPct(totalPl) + ')').color(colorChange(totalPl))))
}

function sendHistory(player, playerData) {
    player.tell(Text.of('━━━ 최근 거래내역 ━━━').color('gold'))
    const list = (playerData.transactions || []).slice(0, 10)
    if (list.length === 0) { player.tell(Text.gray('거래내역 없음')); return }
    list.forEach(tx => {
        const c = tx.type === 'buy' ? 'red' : 'green'
        const t = tx.type === 'buy' ? '[매수]' : '[매도]'
        const time = new Date(tx.at).toLocaleTimeString()
        player.tell(Text.of(time + ' ').color('dark_gray')
            .append(Text.of(t + ' ').color(c))
            .append(Text.white(tx.symbol + ' ' + tx.shares + '주 @ ' + tx.price.toFixed(2))))
    })
}

function handleDeposit(player, data, playerData, count) {
    if (!Number.isFinite(count) || count <= 0) { player.tell(Text.red('잘못된 수량')); return }
    count = Math.floor(count)

    // 인벤토리에서 에메랄드 차감 (간단 구현 - 인게임 명령어로 차감)
    const itemId = global.STOCK_CONFIG.currencyItem
    const inv    = player.inventory
    let owned    = 0
    for (let i = 0; i < inv.size(); i++) {
        const stack = inv.getItem(i)
        if (!stack || stack.empty) continue
        if (stack.id === itemId) owned += stack.count
    }
    if (owned < count) {
        player.tell(Text.red('에메랄드가 부족합니다. 보유: ' + owned + '개'))
        return
    }

    // 차감
    let remaining = count
    for (let i = 0; i < inv.size() && remaining > 0; i++) {
        const stack = inv.getItem(i)
        if (!stack || stack.empty) continue
        if (stack.id === itemId) {
            const take = Math.min(stack.count, remaining)
            stack.count -= take
            inv.setItem(i, stack.count <= 0 ? Item.of('minecraft:air') : stack)
            remaining -= take
        }
    }

    const credited = count * global.STOCK_CONFIG.goldPerEmerald
    playerData.balance += credited
    player.tell(Text.green('충전 완료: 에메랄드 ' + count + '개 -> ' + credited + ' G'))
    player.tell(Text.gold('현재 잔고: ' + playerData.balance.toFixed(2) + ' G'))
}

function handleWithdraw(player, playerData, count) {
    if (!Number.isFinite(count) || count <= 0) { player.tell(Text.red('잘못된 수량')); return }
    count = Math.floor(count)

    const goldNeeded = count * global.STOCK_CONFIG.goldPerEmerald
    if (playerData.balance < goldNeeded) {
        player.tell(Text.red('잔고 부족. 필요: ' + goldNeeded + ' G'))
        return
    }
    playerData.balance -= goldNeeded
    player.give(Item.of(global.STOCK_CONFIG.currencyItem, count))
    player.tell(Text.green('출금 완료: ' + goldNeeded + ' G -> 에메랄드 ' + count + '개'))
}

// 채팅 이벤트로 명령어 처리
PlayerEvents.chat(event => {
    const message = (event.message || '').trim()
    if (!message.startsWith('!주식') && !message.startsWith('!stock')) return

    event.cancel()

    const args = message.split(/\s+/)
    args.shift()
    const cmd = (args[0] || '도움말').toLowerCase()

    const player     = event.player
    const data       = global.getStockData()
    const playerData = global.getPlayerData(data, player.stringUuid, player.username || player.name.string)

    let dirty = false

    switch (cmd) {
        case '웹': case 'web': case 'gui':
            sendWebLink(player); break
        case '도움말': case 'help': case '?':
            sendHelp(player); break
        case '목록': case 'list': case 'ls':
            sendList(player, data); break
        case '시세': case 'quote': case 'q':
            sendQuote(player, data, args[1]); break
        case '매수': case 'buy': {
            const r = global.executeBuy(data, playerData, args[1], parseInt(args[2]))
            player.tell(Text.of(r.message).color(r.ok ? 'green' : 'red'))
            dirty = r.ok; break
        }
        case '매도': case 'sell': {
            const r = global.executeSell(data, playerData, args[1], parseInt(args[2]))
            player.tell(Text.of(r.message).color(r.ok ? 'green' : 'red'))
            dirty = r.ok; break
        }
        case '포트폴리오': case 'portfolio': case 'p':
            sendPortfolio(player, data, playerData); break
        case '잔고': case 'balance': case 'bal':
            player.tell(Text.gold('잔고: ' + playerData.balance.toFixed(2) + ' G')); break
        case '충전': case 'deposit':
            handleDeposit(player, data, playerData, parseInt(args[1]) || 1); dirty = true; break
        case '출금': case 'withdraw':
            handleWithdraw(player, playerData, parseInt(args[1]) || 1); dirty = true; break
        case '거래내역': case 'history':
            sendHistory(player, playerData); break
        default:
            player.tell(Text.red('알 수 없는 명령: ' + cmd))
            sendHelp(player)
    }

    if (dirty) global.saveStockData(data)
})
