// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩 (K=라이브, J=오프라인)
// [client_scripts] 클라이언트 전용
// ==========================================================

// GLFW를 파일 상단에서 한 번만 로드 (매 틱마다 로드하면 느림)
var _GLFW = null
try {
    _GLFW = Java.loadClass('org.lwjgl.glfw.GLFW')
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
    var uuid = player.getStringUUID()

    // J (74) - 오프라인 대시보드
    var jPressed = (_GLFW.glfwGetKey(win, 74) == 1)
    if (jPressed) {
        if (!_jDown) {
            _jDown = true
            if (global.openOfflineDashboard) global.openOfflineDashboard(uuid)
        }
    } else {
        _jDown = false
    }

    // K (75) - 라이브 대시보드
    var kPressed = (_GLFW.glfwGetKey(win, 75) == 1)
    if (kPressed) {
        if (!_kDown) {
            _kDown = true
            if (global.openStockBrowser) global.openStockBrowser(uuid)
        }
    } else {
        _kDown = false
    }
})
