// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - MCEF 인게임 브라우저
// [client_scripts] 클라이언트 전용
// ==========================================================
// 서버에서 'stock:open_browser' 네트워크 이벤트를 받으면 MCEF 브라우저를 엽니다.

var MCEF = null
try {
    MCEF = Java.loadClass('com.cinemamod.mcef.MCEF')
} catch(e) {
    try { MCEF = Java.loadClass('net.montoyo.mcef.api.API') } catch(e2) {}
}

var MCEFBrowser = null
try {
    MCEFBrowser = Java.loadClass('com.cinemamod.mcef.MCEFBrowser')
} catch(e) {}

console.info('[StockBrowser] MCEF: ' + (MCEF ? 'YES' : 'NO'))

// 서버에서 보낸 네트워크 이벤트 수신
NetworkEvents.dataReceived('stock:open_browser', function(event) {
    try {
        var url = event.data.getString('url')
        if (!url) return

        if (MCEF && MCEF.isInitialized()) {
            var browser = MCEF.createBrowser(url, false)
            if (browser) {
                // CinemaMod MCEF에서는 MCEFBrowserScreen을 직접 만들거나
                // 간단히 Minecraft.getInstance().setScreen 사용
                var mc = Java.loadClass('net.minecraft.client.Minecraft').getInstance()
                var w = mc.getWindow().getGuiScaledWidth()
                var h = mc.getWindow().getGuiScaledHeight()
                browser.resize(w, h)

                // CinemaMod BrowserScreen 로드 시도
                var BrowserScreen = null
                try { BrowserScreen = Java.loadClass('com.cinemamod.mcef.client.gui.BrowserScreen') } catch(e3) {}

                if (BrowserScreen) {
                    mc.execute(function() {
                        mc.setScreen(new BrowserScreen(browser))
                    })
                } else {
                    // 폴백: 외부 브라우저
                    Java.loadClass('net.minecraft.Util').getPlatform().openUri(url)
                }
                return
            }
        }

        // MCEF 실패 시 외부 브라우저
        try {
            Java.loadClass('net.minecraft.Util').getPlatform().openUri(url)
        } catch(e4) {
            if (Client.player) {
                Client.player.sendSystemMessage(Component.literal('\u00a7e[주식] 브라우저에서 열어주세요: ' + url))
            }
        }
    } catch(e) {
        console.error('[StockBrowser] ' + e)
        if (Client.player) {
            Client.player.sendSystemMessage(Component.literal('\u00a7c[주식] 브라우저 열기 실패: ' + e))
        }
    }
})
