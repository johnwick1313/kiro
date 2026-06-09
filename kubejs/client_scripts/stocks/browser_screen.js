// priority: 10
// ==========================================================
// 선릿밸리 주식 시스템 - 브라우저 열기 (외부 브라우저 방식)
// [client_scripts] 클라이언트 전용
// ==========================================================

const BASE_URL = 'http://localhost:3000'

// URL을 시스템 기본 브라우저로 열기
global.openStockBrowser = function(uuid) {
    try {
        var url = uuid ? (BASE_URL + '?uuid=' + uuid) : BASE_URL
        var URI = Java.loadClass('java.net.URI')
        var Desktop = Java.loadClass('java.awt.Desktop')
        Desktop.getDesktop().browse(URI.create(url))
    } catch(e) {
        if (Client.player) {
            Client.player.sendSystemMessage(Component.string('§e[주식] 브라우저에서 열어주세요: ' + BASE_URL))
        }
    }
}

// 오프라인 대시보드 (file:// 프로토콜)
global.openOfflineDashboard = function(uuid) {
    try {
        var File = Java.loadClass('java.io.File')
        var Desktop = Java.loadClass('java.awt.Desktop')
        var f = new File('kubejs/exports/dashboard.html')
        if (!f.exists()) {
            if (Client.player) {
                Client.player.sendSystemMessage(Component.string('§c[주식] 오프라인 대시보드 파일을 찾을 수 없습니다.'))
            }
            return
        }
        var url = f.toURI().toString()
        if (uuid) url = url + '?uuid=' + uuid
        var URI = Java.loadClass('java.net.URI')
        Desktop.getDesktop().browse(URI.create(url))
    } catch(e) {
        if (Client.player) {
            Client.player.sendSystemMessage(Component.string('§c[주식] 대시보드 열기 실패: ' + e))
        }
    }
}
