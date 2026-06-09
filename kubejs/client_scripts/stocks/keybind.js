// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩
// [client_scripts] 클라이언트 전용
// ==========================================================

// KubeJS 2001 (1.20.1) 방식: KeybindEvent 사용 불가 시 tick + GLFW
var _kDown = false
var _jDown = false

ClientEvents.tick(function(event) {
    var player = Client.player
    if (!player || Client.screen) return

    try {
        var GLFW = Java.loadClass('org.lwjgl.glfw.GLFW')
        var mc = Client.getMinecraft()
        var win = mc.getWindow().getWindow()
        var uuid = player.getStringUUID()

        // K (75) - 라이브 서버 대시보드
        if (GLFW.glfwGetKey(win, GLFW.GLFW_KEY_J) == GLFW.GLFW_PRESS) {
            if (!_jDown) {
                _jDown = true
                if (global.openOfflineDashboard) global.openOfflineDashboard(uuid)
            }
        } else {
            _jDown = false
        }

        // K (75) - 라이브 대시보드
        if (GLFW.glfwGetKey(win, GLFW.GLFW_KEY_K) == GLFW.GLFW_PRESS) {
            if (!_kDown) {
                _kDown = true
                if (global.openStockBrowser) global.openStockBrowser(uuid)
            }
        } else {
            _kDown = false
        }
    } catch(e) {
        // 첫 에러만 로깅 (스팸 방지)
        if (!global._stockKeyErrLogged) {
            console.error('[StockKeybind] ' + e)
            global._stockKeyErrLogged = true
        }
    }
})
