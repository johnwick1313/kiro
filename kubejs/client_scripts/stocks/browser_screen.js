// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - MCEF 인게임 브라우저
// [client_scripts] 클라이언트 전용
// ==========================================================

var MCEF = null
try {
    MCEF = Java.loadClass('com.cinemamod.mcef.MCEF')
    console.info('[StockBrowser] CinemaMod MCEF 로드 성공')
} catch(e) {
    console.warn('[StockBrowser] CinemaMod MCEF 없음: ' + e)
}

var MCEFBrowserClass = null
try {
    MCEFBrowserClass = Java.loadClass('com.cinemamod.mcef.MCEFBrowser')
    console.info('[StockBrowser] MCEFBrowser 클래스 로드 성공')
} catch(e) {}

var MinecraftClass = null
try {
    MinecraftClass = Java.loadClass('net.minecraft.client.Minecraft')
} catch(e) {}

var UtilClass = null
try {
    UtilClass = Java.loadClass('net.minecraft.Util')
} catch(e) {}

console.info('[StockBrowser] 모듈 로드 완료. MCEF=' + (MCEF ? 'YES' : 'NO') + ', MC=' + (MinecraftClass ? 'YES' : 'NO'))

// 서버에서 보낸 네트워크 이벤트 수신
NetworkEvents.dataReceived('stock_open_browser', function(event) {
    console.info('[StockBrowser] dataReceived 이벤트 수신!')

    try {
        var url = event.data.getString('url')
        console.info('[StockBrowser] URL: ' + url)
        if (!url) {
            console.error('[StockBrowser] URL이 비어있음')
            return
        }

        // MCEF로 인게임 브라우저 열기 시도
        if (MCEF) {
            console.info('[StockBrowser] MCEF.isInitialized(): ' + MCEF.isInitialized())
            if (MCEF.isInitialized()) {
                var browser = MCEF.createBrowser(url, false)
                console.info('[StockBrowser] 브라우저 생성: ' + (browser ? 'OK' : 'FAIL'))

                if (browser && MinecraftClass) {
                    var mc = MinecraftClass.getInstance()
                    var w = mc.getWindow().getGuiScaledWidth()
                    var h = mc.getWindow().getGuiScaledHeight()
                    browser.resize(w, h)

                    // MCEFBrowser를 Screen으로 감싸기
                    // CinemaMod MCEF의 경우 MCEFBrowserScreen 또는 직접 Screen 상속 필요
                    // 여러 클래스 이름 시도
                    var ScreenClass = null
                    var screenNames = [
                        'com.cinemamod.mcef.internal.MCEFBrowserScreen',
                        'com.cinemamod.mcef.client.gui.BrowserScreen',
                        'com.cinemamod.mcef.MCEFBrowserScreen',
                        'net.montoyo.mcef.client.gui.GuiWebBrowser'
                    ]
                    for (var i = 0; i < screenNames.length; i++) {
                        try {
                            ScreenClass = Java.loadClass(screenNames[i])
                            console.info('[StockBrowser] Screen 클래스 발견: ' + screenNames[i])
                            break
                        } catch(e) {}
                    }

                    if (ScreenClass) {
                        try {
                            var screen = new ScreenClass(browser)
                            mc.execute(function() {
                                mc.setScreen(screen)
                            })
                            console.info('[StockBrowser] 인게임 브라우저 열기 성공!')
                            return
                        } catch(e) {
                            console.error('[StockBrowser] Screen 생성 실패: ' + e)
                        }
                    } else {
                        console.warn('[StockBrowser] Screen 클래스를 찾을 수 없음. 외부 브라우저로 폴백.')
                    }
                }
            }
        }

        // 폴백: 외부 브라우저
        console.info('[StockBrowser] 외부 브라우저로 열기 시도')
        if (UtilClass) {
            UtilClass.getPlatform().openUri(url)
            return
        }

        // 최종 폴백
        if (Client.player) {
            Client.player.sendSystemMessage(Component.literal('\u00a7e[주식] 브라우저에서 열어주세요: ' + url))
        }
    } catch(e) {
        console.error('[StockBrowser] 오류: ' + e)
        if (Client.player) {
            Client.player.sendSystemMessage(Component.literal('\u00a7c[주식] 브라우저 열기 실패: ' + e))
        }
    }
})
