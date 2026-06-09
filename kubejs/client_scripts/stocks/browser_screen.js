// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - MCEF 인게임 브라우저 + 외부 브라우저 폴백
// [client_scripts] 클라이언트 전용
// ==========================================================

var BASE_URL = 'http://localhost:3000'

// 안전한 클래스 로드 헬퍼
function tryLoadClass(name) {
    try { return Java.loadClass(name) } catch(e) { return null }
}

// MCEF API 로드 시도 (여러 패키지)
var MCEFClass = tryLoadClass('net.montoyo.mcef.api.API')
    || tryLoadClass('com.cinemamod.mcef.MCEF')

// 마인크래프트 Util (URL 열기용)
var UtilClass = tryLoadClass('net.minecraft.Util')

// 공통 URL 열기 함수
function openUrl(url) {
    var mc = Client.getMinecraft()

    // 1) MCEF 인게임 브라우저 시도 (montoyo 방식)
    if (MCEFClass && MCEFClass.getInstance) {
        try {
            var api = MCEFClass.getInstance()
            if (api && api.isInitialized()) {
                var browser = api.createBrowser(url, false)
                if (browser) {
                    // MCEF montoyo는 GuiWebBrowser 생성자에 브라우저를 전달
                    var GuiClass = tryLoadClass('net.montoyo.mcef.client.gui.GuiWebBrowser')
                    if (GuiClass) {
                        mc.execute(function() {
                            mc.setScreen(new GuiClass(browser))
                        })
                        return
                    }
                }
            }
        } catch(e) {
            console.warn('[StockBrowser] MCEF montoyo 실패: ' + e)
        }
    }

    // 2) MCEF CinemaMod 방식 시도
    if (MCEFClass && MCEFClass.isInitialized) {
        try {
            if (MCEFClass.isInitialized()) {
                var browser2 = MCEFClass.createBrowser(url, false)
                var ScreenClass = tryLoadClass('com.cinemamod.mcef.client.gui.BrowserScreen')
                if (browser2 && ScreenClass) {
                    var w = mc.getWindow().getGuiScaledWidth()
                    var h = mc.getWindow().getGuiScaledHeight()
                    browser2.resize(w, h)
                    mc.execute(function() {
                        mc.setScreen(new ScreenClass(browser2))
                    })
                    return
                }
            }
        } catch(e) {
            console.warn('[StockBrowser] MCEF cinemamod 실패: ' + e)
        }
    }

    // 3) 폴백: 마인크래프트 내장 Util.getPlatform().openUri() 사용
    //    이건 클래스 필터에 차단되지 않음 (마인크래프트 자체 클래스)
    try {
        if (UtilClass) {
            UtilClass.getPlatform().openUri(url)
            return
        }
    } catch(e) {
        console.warn('[StockBrowser] Util.openUri 실패: ' + e)
    }

    // 4) 최종 폴백: 채팅에 URL 표시
    if (Client.player) {
        Client.player.sendSystemMessage(
            Component.literal('\u00a7e[주식] 브라우저에서 열어주세요: ' + url)
        )
    }
}

// 라이브 대시보드 (전체 기능: 매수/매도/관리자)
global.openStockBrowser = function(uuid) {
    var url = uuid ? (BASE_URL + '?uuid=' + uuid) : BASE_URL
    openUrl(url)
}

// 오프라인 대시보드
global.openOfflineDashboard = function(uuid) {
    // 오프라인 JSON 데이터가 있는 경로를 웹 서버 URL로 전환
    // 또는 file:// 로 열기 시도
    try {
        if (UtilClass) {
            var path = 'kubejs/exports/dashboard.json'
            // file:// 로 열기보다는 라이브 서버 URL 사용 권장
            // JSON만 있으므로 라이브 서버가 없으면 채팅 안내
            if (Client.player) {
                Client.player.sendSystemMessage(
                    Component.literal('\u00a7e[주식] 오프라인 모드: 인게임 명령어 !주식 를 사용하세요.')
                )
            }
            return
        }
    } catch(e) {}

    if (Client.player) {
        Client.player.sendSystemMessage(
            Component.literal('\u00a7e[주식] 인게임 명령어 !주식 를 사용하세요.')
        )
    }
}

console.info('[StockBrowser] 브라우저 모듈 로드됨. MCEF: ' + (MCEFClass ? 'YES' : 'NO'))
