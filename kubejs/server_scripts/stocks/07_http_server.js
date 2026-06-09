// priority: 30
// ==========================================================
// 선릿밸리 주식 시스템 - 임베디드 HTTP 서버 (비활성화됨)
// ==========================================================
// KubeJS 2001의 클래스 필터가 java.nio.file.Files, com.sun.net.httpserver 등을
// 차단하므로 임베디드 HTTP 서버는 사용할 수 없습니다.
//
// 대안:
// 1. Node.js 웹 서버 (web-gui/server.js) 를 별도로 실행
// 2. J키 오프라인 대시보드 사용 (06_offline_dashboard.js → JSON 데이터)
// 3. 인게임 !주식 명령어로 매수/매도
// ==========================================================

;(function () {
    var CFG = global.STOCK_CONFIG
    if (!CFG) return

    if (CFG.httpServerEnabled) {
        console.warn('[StockHttp] 임베디드 HTTP 서버는 KubeJS 클래스 필터로 인해 사용할 수 없습니다.')
        console.warn('[StockHttp] -> Node 서버(web-gui/server.js)를 별도 실행하거나, 인게임 명령어를 사용하세요.')
    }
})()
