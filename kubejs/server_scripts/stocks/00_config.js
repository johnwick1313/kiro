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
    // 커스텀 종목 파일 경로 (웹 관리자 페이지에서 추가/삭제)
    customStocksPath: 'kubejs/exports/stocks_custom.json',
    // OP 목록 파일 경로
    opsPath: 'kubejs/exports/stocks_ops.json',
    // 가격 갱신 주기 (틱 단위, 20틱 = 1초)
    updateIntervalTicks: 200,           // 10초마다 갱신

    // 신규 플레이어 시작 잔고 (주식계좌 내부 단위 = G)
    startingBalance: 1000,

    // ── 레거시 호환 필드 (currency.mode === 'emerald' 일 때 사용) ──
    goldPerEmerald: 100,            // 에메랄드 1개 -> 골드
    goldPerEmeraldBlock: 900,       // 에메랄드 블록 1개 -> 골드
    currencyItem: 'minecraft:emerald',
    currencyBlockItem: 'minecraft:emerald_block',

    // ==========================================================
    // 화폐(모드팩 통화) 연동 설정
    // ==========================================================
    // 주식계좌 잔고는 항상 내부 단위(G)로 관리하고,
    // "충전/출금" 시 아래에 설정한 모드팩 화폐와 1:1(또는 비율)로 환전합니다.
    // (실제 증권 계좌 입출금과 동일한 브로커리지 모델)
    //
    // mode 별 동작:
    //   'lightmans'  - Lightman's Currency 코인 (선릿밸리 모드팩 기본 화폐)
    //   'item'       - 임의의 단일 아이템 (예: minecraft:emerald)
    //   'emerald'    - 레거시 에메랄드 모드 (위 goldPerEmerald 사용)
    //   'scoreboard' - 스코어보드 점수를 화폐로 사용 (다른 경제 모드 연동용)
    //   'command'    - 임의의 명령어로 입출금 위임 (모든 경제 모드 브릿지)
    currency: {
        mode: 'lightmans',

        // 화면/메시지에 표시할 화폐 단위명
        unit: 'G',

        // ── Create: Numismatics 코인 체계 ──
        // 선릿밸리 모드팩은 Numismatics를 사용합니다.
        // Spur = 1, Bevel = 8, Sprocket = 16, Cog = 64, Crown = 512, Sun = 4096
        // numismatics_utils 추가 코인이 있을 수 있음 - /kubejs hand 로 확인 후 추가
        coins: [
            { id: 'numismatics:spur',     value: 1     },
            { id: 'numismatics:bevel',    value: 8     },
            { id: 'numismatics:sprocket', value: 16    },
            { id: 'numismatics:cog',      value: 64    },
            { id: 'numismatics:crown',    value: 512   },
            { id: 'numismatics:sun',      value: 4096  },
            // numismatics_utils 추가 코인 (ID 확인 후 수정)
            // { id: 'numismatics_utils:coin_1', value: ??? },
            // { id: 'numismatics_utils:coin_2', value: ??? },
            // { id: 'numismatics_utils:coin_3', value: ??? },
        ],

        // ── mode: 'scoreboard' ──
        scoreboardObjective: 'money',   // /scoreboard objectives add money dummy
        scoreboardPerG: 1,              // 점수 1점 = ? G

        // ── mode: 'command' ──
        // {player} {amount} 가 치환됩니다. (amount = 화폐 단위 정수)
        depositQueryCmd:    'lightmanscurrency money get {player}',  // 참고용
        withdrawGiveCmd:    'lightmanscurrency money give {player} {amount}',
        depositTakeCmd:     'lightmanscurrency money take {player} {amount}',
    },

    // KubeJS 데이터 파일 경로 (모드팩의 kubejs 폴더 기준)
    exportPath: 'kubejs/exports/stocks_state.json',
    ordersPath: 'kubejs/exports/stocks_orders.json',
    auditPath:  'kubejs/exports/stocks_audit.json',

    // ── 오프라인 대시보드 (Node 서버 없이 마크 내/브라우저에서 직접 열기) ──
    // 매 가격 갱신마다 데이터가 내장된 자가완결형 HTML 파일을 생성합니다.
    // file:// 로 MCEF 또는 일반 브라우저에서 바로 열 수 있습니다. (읽기 전용)
    offlineDashboardEnabled: true,
    offlineDashboardPath: 'kubejs/exports/dashboard.html',

    // ── 임베디드 HTTP 서버 (마크 JVM 내장, 별도 Node 서버 불필요) ──
    // KubeJS 가 마인크래프트 안에서 직접 작은 웹 서버를 띄웁니다.
    // 매수/매도/관리자까지 전체 기능을 Node 없이 사용할 수 있습니다.
    // (JDK 의 com.sun.net.httpserver 사용. 일부 최소화된 런타임엔 없을 수 있음)
    httpServerEnabled: true,
    httpServerPort: 3000,           // MCEF/브라우저가 접속할 포트 (Node 서버와 동일)
    httpServerHost: '0.0.0.0',      // 0.0.0.0 = 로컬 + LAN 모두 허용
    httpWebRoot: 'kubejs/web',      // 정적 웹 자산 폴더 (index.html 등)

    // 차트용 가격 히스토리 보관 길이
    historyLength: 60,

    // 거래 수수료 (%)
    tradeFee: 0.5,

    // 가격 클램프 (basePrice 대비 최소/최대 배수)
    minPriceMultiplier: 0.2,
    maxPriceMultiplier: 5.0,
}

console.info('[StockSystem] 설정 로드 완료. 종목 수: ' + global.STOCKS.length)
