// priority: 95
// ==========================================================
// 선릿밸리 주식 시스템 - 화폐(모드팩 통화) 연동 어댑터
// ==========================================================
// 주식계좌의 잔고는 내부 단위(G)로 관리하지만,
// "충전/출금"은 이 어댑터를 통해 모드팩의 실제 화폐와 환전합니다.
//
// 노출 API (모두 player 객체 1개를 받음):
//   global.Currency.unit()                  -> 단위명 (예: 'G')
//   global.Currency.label()                 -> 모드 설명 문자열
//   global.Currency.heldG(player)           -> 플레이어가 물리적으로 보유한 화폐의 G 환산액
//   global.Currency.take(player, gAmount)   -> 화폐 차감. { ok, taken, message }
//   global.Currency.give(player, gAmount)   -> 화폐 지급. { ok, given, message }
// ==========================================================

global.Currency = (function () {
    function cfg() { return global.STOCK_CONFIG.currency || { mode: 'emerald' } }

    function unit() { return (cfg().unit) || 'G' }

    // 액면가 큰 -> 작은 순 정렬된 코인 목록
    function sortedCoins() {
        var coins = (cfg().coins || []).slice()
        coins.sort(function (a, b) { return b.value - a.value })
        return coins
    }

    // ── 인벤토리에서 특정 아이템 개수 세기 ──
    function countItem(player, itemId) {
        var inv = player.inventory
        var total = 0
        for (var i = 0; i < inv.size(); i++) {
            var stack = inv.getItem(i)
            if (!stack || stack.empty) continue
            if (stack.id === itemId) total += stack.count
        }
        return total
    }

    // ── 인벤토리에서 특정 아이템 N개 차감 (가능한 만큼) -> 실제 차감 수 반환 ──
    function removeItem(player, itemId, count) {
        var inv = player.inventory
        var remaining = count
        for (var i = 0; i < inv.size() && remaining > 0; i++) {
            var stack = inv.getItem(i)
            if (!stack || stack.empty) continue
            if (stack.id === itemId) {
                var take = Math.min(stack.count, remaining)
                stack.count -= take
                inv.setItem(i, stack.count <= 0 ? Item.of('minecraft:air') : stack)
                remaining -= take
            }
        }
        return count - remaining
    }

    // ========================================================
    // 모드별 구현
    // ========================================================

    // 단일 아이템 (emerald / item 모드 공용)
    function singleItemAdapter(itemId, perUnit) {
        return {
            heldG: function (player) { return countItem(player, itemId) * perUnit },
            take: function (player, gAmount) {
                var need = Math.ceil(gAmount / perUnit)
                var have = countItem(player, itemId)
                if (have < need) return { ok: false, taken: 0, message: '화폐가 부족합니다. 필요: ' + need + '개 / 보유: ' + have + '개' }
                var removed = removeItem(player, itemId, need)
                return { ok: true, taken: removed * perUnit, message: '' }
            },
            give: function (player, gAmount) {
                var n = Math.floor(gAmount / perUnit)
                if (n <= 0) return { ok: false, given: 0, message: '출금 단위(' + perUnit + ' ' + unit() + ')보다 작습니다.' }
                player.give(Item.of(itemId, n))
                return { ok: true, given: n * perUnit, message: '' }
            },
        }
    }

    // 다중 코인 (lightmans 모드) — 액면가 분해/합산
    function multiCoinAdapter() {
        return {
            heldG: function (player) {
                var coins = sortedCoins(), sum = 0
                coins.forEach(function (c) { sum += countItem(player, c.id) * c.value })
                return sum
            },
            // 보유 코인을 작은 단위로 분해할 수 없으므로, 큰 코인부터 차감 후
            // 초과분은 거스름돈으로 되돌려 줍니다.
            take: function (player, gAmount) {
                var coins = sortedCoins()
                var held = this.heldG(player)
                if (held < gAmount) return { ok: false, taken: 0, message: '화폐가 부족합니다. 보유: ' + held + ' ' + unit() }

                var toTake = gAmount
                // 작은 코인부터 차감하면 거스름돈 최소화
                var asc = coins.slice().reverse()
                var taken = 0
                asc.forEach(function (c) {
                    if (toTake <= 0) return
                    var want = Math.floor(toTake / c.value)
                    if (want <= 0) return
                    var got = removeItem(player, c.id, want)
                    taken += got * c.value
                    toTake -= got * c.value
                })
                // 아직 부족하면 더 큰 코인 한 개로 충당 후 거스름돈
                if (toTake > 0) {
                    for (var i = asc.length - 1; i >= 0; i--) {
                        var c2 = asc[i]
                        if (c2.value < toTake) continue
                        if (countItem(player, c2.id) > 0) {
                            removeItem(player, c2.id, 1)
                            taken += c2.value
                            toTake -= c2.value
                            break
                        }
                    }
                }
                // 거스름돈 환급 (초과 차감분)
                var change = taken - gAmount
                if (change > 0) giveCoins(player, change)
                return { ok: true, taken: gAmount, message: '' }
            },
            give: function (player, gAmount) {
                var given = giveCoins(player, gAmount)
                if (given <= 0) return { ok: false, given: 0, message: '출금 단위가 너무 작습니다.' }
                return { ok: true, given: given, message: '' }
            },
        }
    }

    // 코인 그리디 지급 (큰 액면부터)
    function giveCoins(player, gAmount) {
        var coins = sortedCoins()
        var remaining = Math.floor(gAmount)
        var given = 0
        coins.forEach(function (c) {
            if (remaining < c.value) return
            var n = Math.floor(remaining / c.value)
            if (n <= 0) return
            player.give(Item.of(c.id, n))
            given += n * c.value
            remaining -= n * c.value
        })
        return given
    }

    // 스코어보드 모드
    function scoreboardAdapter() {
        var obj = function () { return cfg().scoreboardObjective || 'money' }
        var per = function () { return cfg().scoreboardPerG || 1 }
        function getScore(player) {
            try {
                var sb = player.server.scoreboard
                var objective = sb.getObjective(obj())
                if (!objective) return 0
                var name = player.username || player.name.string
                return sb.getOrCreatePlayerScore(name, objective).score
            } catch (e) { return 0 }
        }
        function addScore(player, delta) {
            try {
                player.server.runCommandSilent('scoreboard players add ' + (player.username || player.name.string) + ' ' + obj() + ' ' + delta)
                return true
            } catch (e) { return false }
        }
        function removeScore(player, delta) {
            try {
                player.server.runCommandSilent('scoreboard players remove ' + (player.username || player.name.string) + ' ' + obj() + ' ' + delta)
                return true
            } catch (e) { return false }
        }
        return {
            heldG: function (player) { return getScore(player) * per() },
            take: function (player, gAmount) {
                var pts = Math.ceil(gAmount / per())
                if (getScore(player) < pts) return { ok: false, taken: 0, message: '점수 부족' }
                removeScore(player, pts)
                return { ok: true, taken: pts * per(), message: '' }
            },
            give: function (player, gAmount) {
                var pts = Math.floor(gAmount / per())
                if (pts <= 0) return { ok: false, given: 0, message: '출금 단위가 너무 작습니다.' }
                addScore(player, pts)
                return { ok: true, given: pts * per(), message: '' }
            },
        }
    }

    // 명령어 위임 모드 (모든 경제 모드 브릿지)
    function commandAdapter() {
        function run(tmpl, player, amount) {
            var name = player.username || player.name.string
            var cmd = String(tmpl || '').replace(/\{player\}/g, name).replace(/\{amount\}/g, amount)
            if (!cmd) return false
            try { player.server.runCommandSilent(cmd); return true } catch (e) { return false }
        }
        return {
            // 명령어 모드는 잔액을 알 수 없으므로 항상 충분하다고 가정 (모드가 검증)
            heldG: function () { return Number.MAX_SAFE_INTEGER },
            take: function (player, gAmount) {
                var ok = run(cfg().depositTakeCmd, player, Math.floor(gAmount))
                return { ok: ok, taken: ok ? gAmount : 0, message: ok ? '' : '명령어 실행 실패' }
            },
            give: function (player, gAmount) {
                var ok = run(cfg().withdrawGiveCmd, player, Math.floor(gAmount))
                return { ok: ok, given: ok ? gAmount : 0, message: ok ? '' : '명령어 실행 실패' }
            },
        }
    }

    // ── 모드 선택 ──
    function adapter() {
        var c = cfg()
        switch (c.mode) {
            case 'lightmans':  return multiCoinAdapter()
            case 'item':       return singleItemAdapter((c.coins && c.coins[0] && c.coins[0].id) || global.STOCK_CONFIG.currencyItem, (c.coins && c.coins[0] && c.coins[0].value) || 1)
            case 'scoreboard': return scoreboardAdapter()
            case 'command':    return commandAdapter()
            case 'emerald':
            default:           return singleItemAdapter(global.STOCK_CONFIG.currencyItem, global.STOCK_CONFIG.goldPerEmerald)
        }
    }

    function label() {
        var m = cfg().mode
        var names = {
            lightmans: "Lightman's Currency 코인",
            item: '커스텀 아이템',
            emerald: '에메랄드',
            scoreboard: '스코어보드(' + (cfg().scoreboardObjective || 'money') + ')',
            command: '명령어 연동',
        }
        return names[m] || m
    }

    return {
        unit: unit,
        label: label,
        heldG: function (player) { try { return adapter().heldG(player) } catch (e) { return 0 } },
        take:  function (player, g) { try { return adapter().take(player, g) } catch (e) { return { ok: false, taken: 0, message: '오류: ' + e } } },
        give:  function (player, g) { try { return adapter().give(player, g) } catch (e) { return { ok: false, given: 0, message: '오류: ' + e } } },
    }
})()

console.info('[StockSystem] 화폐 어댑터 로드: ' + global.Currency.label())
