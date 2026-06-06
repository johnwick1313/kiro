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

// 오프라인 대시보드 파일의 file:// URL 계산
global.getOfflineDashboardUrl = function() {
    try {
        const File = Java.type('java.io.File')
        const f = new File('kubejs/exports/dashboard.html')
        return f.toURI().toString()   // file:///.../kubejs/exports/dashboard.html
    } catch(e) {
        return null
    }
}

// 공통: URL 을 MCEF(있으면) 또는 외부 브라우저로 열기
function openUrl(url) {
    const mc = Minecraft.getInstance()

    if (!MCEF || !BrowserScreen) {
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

// 라이브 서버 대시보드 (Node 브릿지 서버 필요, 매수/매도 가능)
global.openStockBrowser = function(uuid) {
    openUrl(uuid ? (BASE_URL + '?uuid=' + uuid) : BASE_URL)
}

// 오프라인 대시보드 (서버 불필요, 읽기 전용)
global.openOfflineDashboard = function(uuid) {
    const fileUrl = global.getOfflineDashboardUrl()
    if (!fileUrl) {
        const mc = Minecraft.getInstance()
        mc.player && mc.player.displayClientMessage(
            Component.literal('§c[주식] 오프라인 대시보드 파일을 찾을 수 없습니다. 월드에 한 번 접속해 생성하세요.'), false
        )
        return
    }
    openUrl(uuid ? (fileUrl + '?uuid=' + uuid) : fileUrl)
}
