// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - MCEF 인게임 브라우저 화면
// [client_scripts] 클라이언트 전용
// ==========================================================

const Minecraft = Java.type('net.minecraft.client.Minecraft')
const Component = Java.type('net.minecraft.network.chat.Component')

// MCEF 2.x (CinemaMod fork) 클래스들
let MCEF = null
let BrowserScreen = null

try {
    MCEF = Java.type('net.cef.MCEF')
} catch(e) {
    try { MCEF = Java.type('com.cinemamod.mcef.MCEF') } catch(e2) {}
}
try {
    BrowserScreen = Java.type('net.cef.client.gui.BrowserScreen')
} catch(e) {
    try { BrowserScreen = Java.type('com.cinemamod.mcef.client.gui.BrowserScreen') } catch(e2) {}
}

const BASE_URL = 'http://localhost:3000'

global.openStockBrowser = function(uuid) {
    const url = uuid ? (BASE_URL + '?uuid=' + uuid) : BASE_URL
    const mc  = Minecraft.getInstance()

    if (!MCEF || !BrowserScreen) {
        // MCEF 없으면 외부 브라우저로 폴백
        try {
            Java.type('java.awt.Desktop').getDesktop()
                .browse(Java.type('java.net.URI').create(url))
        } catch(e) {
            mc.player && mc.player.displayClientMessage(
                Component.literal('§e[주식] 브라우저에서 열어주세요: ' + url), false
            )
        }
        return
    }

    try {
        if (!MCEF.isInitialized()) {
            mc.player && mc.player.displayClientMessage(
                Component.literal('§c[주식] MCEF 초기화 중입니다. 잠시 후 다시 시도하세요.'), true
            )
            return
        }
        const browser = MCEF.createBrowser(url, false)
        const w = mc.getWindow().getGuiScaledWidth()
        const h = mc.getWindow().getGuiScaledHeight()
        browser.resize(w, h)
        mc.execute(() => mc.setScreen(new BrowserScreen(browser)))
    } catch(e) {
        console.error('[StockBrowser] 오류: ' + e)
    }
}
