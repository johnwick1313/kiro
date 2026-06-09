// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩 & 채팅 훅
// [client_scripts] 클라이언트 전용
// ==========================================================

// K 키 = 라이브 서버 대시보드 / J 키 = 오프라인 대시보드 (서버 불필요)
ClientEvents.tick(event => {
    const mc = Java.loadClass('net.minecraft.client.Minecraft').getInstance()
    if (!mc || !mc.player || mc.screen) return

    try {
        const InputConstants = Java.loadClass('com.mojang.blaze3d.platform.InputConstants')
        const win = mc.getWindow().getWindow()
        const uuid = mc.player.getStringUUID ? mc.player.getStringUUID() : (mc.player.getUUID ? mc.player.getUUID().toString() : null)

        // K (75) - 라이브 서버 대시보드 (매수/매도 가능)
        if (InputConstants.isKeyDown(win, 75 /* K */)) {
            if (!global._kKeyWasDown) {
                global._kKeyWasDown = true
                global.openStockBrowser(uuid)
            }
        } else {
            global._kKeyWasDown = false
        }

        // J (74) - 오프라인 대시보드 (Node 서버 없이, 읽기 전용)
        if (InputConstants.isKeyDown(win, 74 /* J */)) {
            if (!global._jKeyWasDown) {
                global._jKeyWasDown = true
                global.openOfflineDashboard(uuid)
            }
        } else {
            global._jKeyWasDown = false
        }
    } catch(e) {}
})
