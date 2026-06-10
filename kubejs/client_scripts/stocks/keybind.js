// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩 (K=라이브, J=오프라인)
// [client_scripts] 클라이언트 전용
// ==========================================================

// KubeJS 2001 client_scripts에서 키 감지하는 방법:
// ClientEvents.tick 내에서 event.player/Client 사용
// GLFW 대신 Minecraft의 InputConstants 또는 직접 keyMapping 체크

var _kDown = false
var _jDown = false
var _initDone = false
var _InputConstants = null

ClientEvents.tick(function(event) {
    // 첫 틱에서 한 번만 InputConstants 로드 시도
    if (!_initDone) {
        _initDone = true
        try {
            _InputConstants = Java.loadClass('com.mojang.blaze3d.platform.InputConstants')
            console.info('[StockKeybind] InputConstants 로드 성공. K=대시보드, J=오프라인')
        } catch(e) {
            console.error('[StockKeybind] InputConstants 로드 실패: ' + e)
            // GLFW 시도
            try {
                _InputConstants = Java.loadClass('org.lwjgl.glfw.GLFW')
                console.info('[StockKeybind] GLFW 폴백 로드 성공')
            } catch(e2) {
                console.error('[StockKeybind] GLFW도 실패: ' + e2)
                console.error('[StockKeybind] 키바인딩 비활성화됨. 인게임 !주식 명령어를 사용하세요.')
            }
        }
    }

    if (!_InputConstants) return

    var player = Client.player
    if (!player || Client.screen) return

    try {
        var mc = Client.getMinecraft()
        var window = mc.getWindow().getWindow()

        // isKeyDown 사용 (InputConstants 방식)
        var kPressed = false
        var jPressed = false

        if (_InputConstants.isKeyDown) {
            // com.mojang.blaze3d.platform.InputConstants
            kPressed = _InputConstants.isKeyDown(window, 75)
            jPressed = _InputConstants.isKeyDown(window, 74)
        } else if (_InputConstants.glfwGetKey) {
            // org.lwjgl.glfw.GLFW
            kPressed = (_InputConstants.glfwGetKey(window, 75) == 1)
            jPressed = (_InputConstants.glfwGetKey(window, 74) == 1)
        }

        // J - 오프라인 대시보드
        if (jPressed && !_jDown) {
            _jDown = true
            if (global.openOfflineDashboard) {
                global.openOfflineDashboard(player.getStringUUID())
            } else {
                player.sendSystemMessage(Component.literal('\u00a7e[주식] 인게임 명령어 !주식 를 사용하세요.'))
            }
        }
        if (!jPressed) _jDown = false

        // K - 라이브 대시보드
        if (kPressed && !_kDown) {
            _kDown = true
            if (global.openStockBrowser) {
                global.openStockBrowser(player.getStringUUID())
            } else {
                player.sendSystemMessage(Component.literal('\u00a7e[주식] 브라우저 모듈이 로드되지 않았습니다.'))
            }
        }
        if (!kPressed) _kDown = false
    } catch(e) {
        // 에러 1회만 출력
        if (!global._stockKeyErr) {
            global._stockKeyErr = true
            console.error('[StockKeybind] tick 에러: ' + e)
        }
    }
})
