// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩 (K=라이브, J=오프라인)
// [client_scripts] 클라이언트 전용
// ==========================================================

// LWJGL GLFW는 게임 엔진 라이브러리이므로 클래스 필터에 차단되지 않음
var _GLFW = null
try {
    _GLFW = Java.loadClass('org.lwjgl.glfw.GLFW')
    console.info('[StockKeybind] GLFW 로드 성공. K=대시보드, J=오프라인')
} catch(e) {
    console.error('[StockKeybind] GLFW 로드 실패: ' + e)
}

var _kDown = false
var _jDown = false

ClientEvents.tick(function(event) {
    if (!_GLFW) return

    var player = Client.player
    if (!player || Client.screen) return

    var mc = Client.getMinecraft()
    var win = mc.getWindow().getWindow()

    // J (74) - 오프라인 대시보드
    var jPressed = (_GLFW.glfwGetKey(win, 74) == 1)
    if (jPressed && !_jDown) {
        _jDown = true
        if (global.openOfflineDashboard) {
            global.openOfflineDashboard(player.getStringUUID())
        }
    }
    if (!jPressed) _jDown = false

    // K (75) - 라이브 대시보드
    var kPressed = (_GLFW.glfwGetKey(win, 75) == 1)
    if (kPressed && !_kDown) {
        _kDown = true
        if (global.openStockBrowser) {
            global.openStockBrowser(player.getStringUUID())
        }
    }
    if (!kPressed) _kDown = false
})
