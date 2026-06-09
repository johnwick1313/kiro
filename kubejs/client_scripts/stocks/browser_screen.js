// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - MCEF 인게임 브라우저 + 외부 브라우저 폴백
// [client_scripts] 클라이언트 전용
// ==========================================================
// MCEF 2.x (Forge 1.20.1) 클래스: net.ccbluex.liquidbounce.mcef 패키지가 아닌
// 독립형 MCEF 모드의 경우 net.montoyo.mcef 또는 com.cinemamod.mcef 사용.
// 이 스크립트는 여러 패키지를 시도하여 호환성을 확보합니다.
// ==========================================================

var BASE_URL = 'http://localhost:3000'

// 안전한 클래스 로드 헬퍼
function tryLoad(name) {
    try { return Java.loadClass(name) } catch(e) { return null }
}

// MCEF API 클래스 탐색 (여러 패키지명 시도)
var MCEFApi = tryLoad('net.montoyo.mcef.api.API')
    || tryLoad('com.cinemamod.mcef.MCEF')
    || tryLoad('net.ccbluex.liquidbounce.mcef.MCEF')

var MCEFBrowserClass = tryLoad('net.montoyo.mcef.api.IBrowser')

// Screen 클래스 (MCEF가 제공하는 브라우저 화면)
var BrowserScreenClass = tryLoad('net.montoyo.mcef.client.gui.GuiWebBrowser')
    || tryLoad('com.cinemamod.mcef.client.gui.BrowserScreen')

// 공통 URL 열기 함수
function openUrl(url) {
    var mc = Client.getMinecraft()

    // MCEF 인게임 브라우저 시도
    if (MCEFApi) {
        try {
            var api = null
            // montoyo MCEF: API.getInstance()
            if (MCEFApi.getInstance) {
                api = MCEFApi.getInstance()
            }
            if (api && api.isInitialized && api.isInitialized()) {
                var browser = api.createBrowser(url, false)
                if (browser && BrowserScreenClass) {
                    var screen = new BrowserScreenClass(browser)
                    mc.execute(function() { mc.setScreen(screen) })
                    return
                }
            }
        } catch(e) {
            console.warn('[StockBrowser] MCEF 인게임 브라우저 실패, 외부 브라우저로 폴백: ' + e)
        }
    }

    // CinemaMod MCEF 방식 시도
    if (!MCEFApi) {
        var CinemaMCEF = tryLoad('com.cinemamod.mcef.MCEF')
        if (CinemaMCEF) {
            try {
                if (CinemaMCEF.isInitialized()) {
                    var browser2 = CinemaMCEF.createBrowser(url, false)
                    if (browser2 && BrowserScreenClass) {
                        var w = mc.getWindow().getGuiScaledWidth()
                        var h = mc.getWindow().getGuiScaledHeight()
                        browser2.resize(w, h)
                        var screen2 = new BrowserScreenClass(browser2)
                        mc.execute(function() { mc.setScreen(screen2) })
                        return
                    }
                }
            } catch(e2) {
                console.warn('[StockBrowser] CinemaMod MCEF 실패: ' + e2)
            }
        }
    }

    // 폴백: 시스템 기본 브라우저로 열기
    try {
        var Desktop = Java.loadClass('java.awt.Desktop')
        var URI = Java.loadClass('java.net.URI')
        Desktop.getDesktop().browse(URI.create(url))
    } catch(e) {
        if (Client.player) {
            Client.player.sendSystemMessage(
                Component.literal('\u00a7e[주식] 브라우저에서 열어주세요: ' + url)
            )
        }
    }
}

// 라이브 대시보드 (전체 기능: 매수/매도/관리자)
global.openStockBrowser = function(uuid) {
    var url = uuid ? (BASE_URL + '?uuid=' + uuid) : BASE_URL
    openUrl(url)
}

// 오프라인 대시보드 (file:// 프로토콜)
global.openOfflineDashboard = function(uuid) {
    try {
        var File = Java.loadClass('java.io.File')
        var f = new File('kubejs/exports/dashboard.html')
        if (!f.exists()) {
            if (Client.player) {
                Client.player.sendSystemMessage(
                    Component.literal('\u00a7c[주식] 오프라인 대시보드 파일을 찾을 수 없습니다. 서버에 접속해 생성하세요.')
                )
            }
            return
        }
        var url = f.toURI().toString()
        if (uuid) url = url + '?uuid=' + uuid
        openUrl(url)
    } catch(e) {
        if (Client.player) {
            Client.player.sendSystemMessage(
                Component.literal('\u00a7c[주식] 대시보드 열기 실패: ' + e)
            )
        }
    }
}

console.info('[StockBrowser] 브라우저 모듈 로드됨. MCEF: ' + (MCEFApi ? 'O' : 'X'))
