// priority: 100
// ==========================================================
// 선릿밸리 주식 시스템 - 종목 및 설정
// ==========================================================
// 이 파일은 우선순위가 높아 다른 스크립트보다 먼저 로드됩니다.
// global.STOCKS, global.STOCK_CONFIG 를 정의합니다.

// 종목 리스트 (선릿밸리 컨셉에 맞춰 농업/광업/마법 위주)
global.STOCKS = [
    // 농업 섹터
    { symbol: 'WHEAT', name: '황금밀 농장 주식회사',  basePrice:   50, volatility: 0.05, trend: 0.02, sector: '농업'   },
    { symbol: 'CRRT',  name: '당근 코퍼레이션',        basePrice:   30, volatility: 0.06, trend: 0.01, sector: '농업'   },
    { symbol: 'PUMP',  name: '핼러윈 호박 인더스트리', basePrice:   80, volatility: 0.15, trend: 0.05, sector: '농업'   },
    { symbol: 'BERRY', name: '달콤한 베리 농원',       basePrice:   45, volatility: 0.08, trend: 0.03, sector: '농업'   },

    // 축산/수산 섹터
    { symbol: 'MILK',  name: '행복한 젖소 목장',       basePrice:   70, volatility: 0.05, trend: 0.015, sector: '축산업' },
    { symbol: 'FISH',  name: '바다 어업 협동조합',     basePrice:   90, volatility: 0.07, trend: 0.02, sector: '수산업' },

    // 광업/제조 섹터
    { symbol: 'WOOD',  name: '대지 목재',              basePrice:   40, volatility: 0.03, trend: 0.01, sector: '임업'   },
    { symbol: 'IRON',  name: '철강 제련소',            basePrice:  200, volatility: 0.04, trend: 0.01, sector: '광업'   },
    { symbol: 'GOLD',  name: '골드 볼트',              basePrice:  500, volatility: 0.08, trend: 0.03, sector: '광업'   },
    { symbol: 'DIAM',  name: '다이아 럭셔리',          basePrice: 2000, volatility: 0.10, trend: 0.04, sector: '광업'   },

    // 마법 섹터 (변동성 큼, 고수익 고위험)
    { symbol: 'MGCR',  name: '마나 크리스탈',          basePrice: 1500, volatility: 0.20, trend: 0.08, sector: '마법'   },
    { symbol: 'STAR',  name: '별빛 연금술',            basePrice: 3000, volatility: 0.25, trend: 0.10, sector: '마법'   },
]

// 글로벌 설정값
global.STOCK_CONFIG = {
    // 가격 갱신 주기 (틱 단위, 20틱 = 1초)
    updateIntervalTicks: 200,           // 10초마다 갱신

    // 신규 플레이어 시작 잔고 (Gold 단위)
    startingBalance: 1000,

    // 에메랄드 1개 -> 골드 변환 비율
    goldPerEmerald: 100,

    // 에메랄드 블록 1개 -> 골드 변환 비율
    goldPerEmeraldBlock: 900,

    // 사용 통화 아이템
    currencyItem: 'minecraft:emerald',
    currencyBlockItem: 'minecraft:emerald_block',

    // KubeJS 데이터 파일 경로 (모드팩의 kubejs 폴더 기준)
    exportPath: 'kubejs/exports/stocks_state.json',
    ordersPath: 'kubejs/exports/stocks_orders.json',
    auditPath:  'kubejs/exports/stocks_audit.json',

    // 차트용 가격 히스토리 보관 길이
    historyLength: 60,

    // 거래 수수료 (%)
    tradeFee: 0.5,

    // 가격 클램프 (basePrice 대비 최소/최대 배수)
    minPriceMultiplier: 0.2,
    maxPriceMultiplier: 5.0,
}

console.info('[StockSystem] 설정 로드 완료. 종목 수: ' + global.STOCKS.length)
