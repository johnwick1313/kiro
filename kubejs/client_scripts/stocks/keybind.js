// priority: 5
// ==========================================================
// 선릿밸리 주식 시스템 - 키 바인딩 & 채팅 훅
// [client_scripts] 클라이언트 전용
// ==========================================================

// K 키로 대시보드 열기
ClientEvents.tick(event => {
    const mc = Java.type('net.minecraft.client.Minecraft').getInstance()
    if (!mc || !mc.player || mc.screen) return

    // InputConstants 로 K 키 감지
    try {
        const InputConstants = Java.type('com.mojang.blaze3d.platform.InputConstants')
        const win = mc.getWindow().getWindow()
        if (InputConstants.isKeyDown(win, 75 /* K */)) {
            // 한번만 실행되도록 (토글 방지)
            if (!global._kKeyWasDown) {
                global._kKeyWasDown = true
                const uuid = mc.player.getStringUUID ? mc.player.getStringUUID() : (mc.player.getUUID ? mc.player.getUUID().toString() : null)
                global.openStockBrowser(uuid)
            }
        } else {
            global._kKeyWasDown = false
        }
    } catch(e) {}
})
