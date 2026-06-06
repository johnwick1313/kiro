# 선릿밸리 주식 시스템 (Sunlit Exchange)

선릿밸리 모드팩에서 작동하는 **KubeJS 기반 인게임 주식 거래 시스템** + **웹 GUI 대시보드** 입니다.

```
+-------------------------+        +------------------------+        +----------------------+
|  Minecraft + KubeJS     |  JSON  |  Node.js 브릿지 서버    |  HTTP  |  웹 브라우저 대시보드  |
|  · 가격 시뮬레이션      | <----> |  · 파일 IO              | <----> |  · 차트, 매수/매도   |
|  · 매수/매도 명령어      |        |  · /api/state, /order  |        |  · 사이버펑크 UI     |
|  · 채팅 명령어 (!주식)   |        +------------------------+        +----------------------+
+-------------------------+
```

## 기능

### 인게임
- **12종목** 시세 시뮬레이션 (농업/축산/수산/임업/광업/마법 섹터)
- 매 10초마다 가격 갱신 (랜덤워크 + 사이클 + 호재/악재 쇼크)
- 한글/영문 채팅 명령어 (`!주식 매수 WHEAT 5`)
- **모드팩 화폐 연동** — Lightman's Currency 코인(선릿밸리 기본) ↔ 주식계좌 입출금
- 평단가/평가손익 자동 계산
- 거래 내역 저장 (개인 50건 + 전체 감사 500건)

### 웹 대시보드
- 실시간 시세 + 변동률 + 가격 변동 펄스 애니메이션
- Chart.js 라인 차트 (60틱 히스토리)
- 종목 클릭 시 상세 보기 (고가/저가/섹터)
- 섹터별 필터링
- 포트폴리오 패널 (현금/투자원금/평가손익/총자산)
- 웹에서 매수/매도 주문 (KubeJS 가 다음 틱에 체결)
- **한국 주식앱 스타일 UI** — 라이트 테마 기본 + 다크 테마 토글 (상승=빨강 / 하락=파랑)

### 오프라인 모드 (Node 서버 불필요)
- KubeJS 가 매 갱신마다 **데이터가 내장된 자가완결형 HTML 파일**(`kubejs/exports/dashboard.html`)을 생성
- 외부 의존성 0 (Chart.js CDN 대신 인라인 SVG 스파크라인, 인터넷 불필요)
- MCEF 또는 일반 브라우저에서 `file://` 로 바로 열기 (8초마다 자동 새로고침, 읽기 전용)
- 인게임 **J 키** 또는 `!주식 오프라인` 명령어로 열기 (라이브 서버 대시보드는 **K 키**)

---

## 설치 방법

### 1. KubeJS 스크립트 설치

선릿밸리 모드팩 인스턴스의 **`kubejs/server_scripts/`** 폴더에 `stocks/` 디렉토리를 통째로 복사합니다.

```
<모드팩 인스턴스>/
└── kubejs/
    ├── server_scripts/
    │   └── stocks/                   <-- 이 저장소의 kubejs/server_scripts/stocks/ 복사
    │       ├── 00_config.js
    │       ├── 01_storage.js
    │       ├── 02_engine.js
    │       ├── 03_trading.js
    │       ├── 04_commands.js
    │       └── 05_events.js
    └── exports/                      <-- 자동 생성됨
        ├── stocks_state.json
        ├── stocks_orders.json
        ├── stocks_responses.json
        └── stocks_audit.json
```

**모드팩 실행 방법**
1. 마인크래프트 모드팩 실행 (싱글플레이 또는 서버)
2. 월드 진입
3. 콘솔/로그에서 `[StockSystem] 초기화 완료` 메시지 확인
4. 채팅창에 `!주식 도움말` 입력

> 만약 스크립트가 적용되지 않는다면 인게임에서 `/kubejs reload server_scripts` 명령어로 리로드하세요.

### 2. 웹 대시보드 실행

> **요구사항**: Node.js 18 이상

```bash
cd web-gui
npm install
KUBEJS_PATH="<모드팩 인스턴스>/kubejs" npm start
```

또는 환경변수 없이 실행하려면 `web-gui/`와 `kubejs/`를 같은 부모 디렉토리에 두세요 (기본 경로: `../kubejs`).

**Windows PowerShell 예시**
```powershell
cd web-gui
npm install
$env:KUBEJS_PATH = "C:\Users\YourName\curseforge\minecraft\Instances\Sunlit Valley\kubejs"
npm start
```

브라우저에서 **http://localhost:3000** 접속.

---

## 사용 방법

### 인게임 명령어

| 명령어 | 영문 별칭 | 설명 |
|--------|----------|------|
| `!주식 도움말`            | `!stock help`            | 명령어 목록 |
| `!주식 목록`              | `!stock list`            | 모든 종목 시세 |
| `!주식 시세 [심볼]`        | `!stock quote [SYM]`     | 특정 종목 상세 |
| `!주식 매수 [심볼] [수량]` | `!stock buy [SYM] [N]`   | 매수 주문 |
| `!주식 매도 [심볼] [수량]` | `!stock sell [SYM] [N]`  | 매도 주문 |
| `!주식 포트폴리오`        | `!stock portfolio`       | 보유 종목 + 평가손익 |
| `!주식 잔고`              | `!stock balance`         | 보유 골드 |
| `!주식 충전 [금액]`        | `!stock deposit [G]`     | 모드팩 화폐 → 주식계좌 입금 |
| `!주식 출금 [금액]`        | `!stock withdraw [G]`    | 주식계좌 → 모드팩 화폐 출금 |
| `!주식 거래내역`          | `!stock history`         | 최근 거래 10건 |
| `!주식 웹`                | `!stock web`             | 라이브 서버 대시보드 링크 (K키) |
| `!주식 오프라인`          | `!stock offline`         | 서버 없이 보는 대시보드 (J키) |

### 종목 리스트

| 심볼  | 이름                  | 시작가   | 변동성 | 섹터    |
|------|----------------------|---------|-------|---------|
| WHEAT | 황금밀 농장 주식회사    | 50 G    | 낮음   | 농업    |
| CRRT  | 당근 코퍼레이션         | 30 G    | 보통   | 농업    |
| PUMP  | 핼러윈 호박 인더스트리   | 80 G    | 높음   | 농업    |
| BERRY | 달콤한 베리 농원        | 45 G    | 보통   | 농업    |
| MILK  | 행복한 젖소 목장        | 70 G    | 낮음   | 축산    |
| FISH  | 바다 어업 협동조합       | 90 G    | 보통   | 수산    |
| WOOD  | 대지 목재              | 40 G    | 매우낮음 | 임업  |
| IRON  | 철강 제련소            | 200 G   | 낮음   | 광업    |
| GOLD  | 골드 볼트              | 500 G   | 보통   | 광업    |
| DIAM  | 다이아 럭셔리           | 2000 G  | 높음   | 광업    |
| MGCR  | 마나 크리스탈           | 1500 G  | 매우높음 | 마법  |
| STAR  | 별빛 연금술            | 3000 G  | 극단   | 마법    |

신규 플레이어는 **1000 G** 로 시작합니다. 거래 수수료는 **0.5%**.

### 웹 대시보드 사용
1. 브라우저에서 http://localhost:3000 접속
2. 우측 상단 입력창에 **마인크래프트 닉네임** 입력 후 [로그인]
   - (먼저 인게임에 1회 접속해야 데이터가 생성됩니다)
3. 좌측에서 종목 클릭 → 중앙에 차트 표시
4. 수량 입력 후 [매수] 또는 [매도] 클릭
5. 최대 10초 후 (다음 틱) 체결 → 인게임 채팅에도 결과 표시

---

## 설정 변경

`kubejs/server_scripts/stocks/00_config.js` 에서 조절 가능:

```js
global.STOCK_CONFIG = {
    updateIntervalTicks: 200,   // 가격 갱신 주기 (200틱 = 10초)
    startingBalance:    1000,   // 신규 시작 잔고
    goldPerEmerald:      100,   // 에메랄드당 골드
    tradeFee:            0.5,   // 수수료 %
    historyLength:        60,   // 차트 히스토리 길이
    minPriceMultiplier:  0.2,   // 최저가 = basePrice × 0.2
    maxPriceMultiplier:  5.0,   // 최고가 = basePrice × 5.0
}
```

새 종목 추가도 `STOCKS` 배열에 객체 하나 추가하면 됩니다.

---

## 화폐(모드팩 통화) 연동

주식계좌 잔고는 항상 내부 단위(**G**)로 관리되고, **충전/출금** 시 모드팩의 실제 화폐와 환전됩니다 (실제 증권 계좌 입출금과 동일한 브로커리지 모델). `00_config.js` 의 `currency` 블록에서 모드를 선택합니다.

| 모드 | 설명 |
|------|------|
| `lightmans` | **Lightman's Currency 코인 (선릿밸리 모드팩 기본 화폐)** — copper/iron/gold/emerald/diamond/netherite(=iridium) 코인을 액면가에 따라 자동 분해/합산 |
| `item` | 임의의 단일 아이템 (예: `minecraft:emerald`) |
| `emerald` | 레거시 에메랄드 모드 (1 에메랄드 = 100 G) |
| `scoreboard` | 스코어보드 점수를 화폐로 사용 (다른 경제 모드 연동용) |
| `command` | 임의의 명령어로 입출금 위임 (모든 경제 모드 브릿지) |

```js
currency: {
    mode: 'lightmans',   // 선릿밸리 기본
    unit: 'G',
    coins: [
        { id: 'lightmanscurrency:coin_copper',    value: 1     },
        { id: 'lightmanscurrency:coin_iron',      value: 10    },
        { id: 'lightmanscurrency:coin_gold',      value: 100   },
        { id: 'lightmanscurrency:coin_emerald',   value: 1000  },
        { id: 'lightmanscurrency:coin_diamond',   value: 10000 },
        { id: 'lightmanscurrency:coin_netherite', value: 100000 },
    ],
}
```

> **코인 ID 확인 방법**: 인게임에서 코인을 손에 들고 `/kubejs hand` 를 실행하면 정확한 아이템 ID 가 채팅에 출력됩니다. 모드팩 버전에 따라 ID/액면가가 다를 수 있으니 위 `coins` 목록을 맞게 조정하세요. (선릿밸리는 netherite 코인을 **Iridium Coin** 으로 리네임했지만 내부 ID 는 `coin_netherite` 인 경우가 많습니다.)

---

## 오프라인 대시보드 (Node 서버 없이)

Node 브릿지 서버를 실행하지 않아도, KubeJS 가 매 가격 갱신마다 **데이터가 통째로 내장된 단일 HTML 파일**을 `kubejs/exports/dashboard.html` 에 생성합니다.

- **여는 방법 1 (인게임)**: **J 키** 를 누르거나 `!주식 오프라인` 명령어 → MCEF 인게임 브라우저로 열림
- **여는 방법 2 (외부)**: 파일 탐색기에서 `kubejs/exports/dashboard.html` 더블클릭 → 기본 브라우저로 열림
- 외부 의존성이 전혀 없어 **인터넷이 없어도** 동작하며, 8초마다 자동 새로고침되어 최신 시세를 반영합니다.
- **읽기 전용**입니다. 매수/매도는 게임 내 `!주식 매수/매도` 명령어를 사용하세요. (전체 매매 UI 가 필요하면 아래 라이브 서버를 실행)

`00_config.js`:
```js
offlineDashboardEnabled: true,                       // 끄려면 false
offlineDashboardPath: 'kubejs/exports/dashboard.html',
```

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|------|------------|
| 웹에서 "시세 파일을 찾을 수 없습니다" | `KUBEJS_PATH` 가 잘못됨. 모드팩 인스턴스 폴더 안의 `kubejs/` 절대경로를 지정하세요. |
| `!주식` 명령어가 채팅에 그대로 출력됨 | KubeJS 스크립트 미로드. `/kubejs reload server_scripts` 실행 후 재접속. |
| 가격이 바뀌지 않음 | 서버가 일시정지됐거나 (싱글플레이) 콘솔에서 `[StockSystem] 가격 갱신 오류` 확인. |
| 웹에서 매수했는데 체결이 안됨 | 게임이 실행 중이어야 합니다. 최대 10초(`updateIntervalTicks`) 대기. |
| 한글이 깨짐 | KubeJS 스크립트 파일을 **UTF-8** 로 저장했는지 확인. |

---

## 디렉토리 구조

```
.
├── kubejs/
│   ├── server_scripts/
│   │   └── stocks/
│   │       ├── 00_config.js            # 종목 정의 + 글로벌 설정 + 화폐 설정
│   │       ├── 00b_currency.js         # 모드팩 화폐 연동 어댑터
│   │       ├── 01_storage.js           # JsonIO 영속성
│   │       ├── 02_engine.js            # 가격 시뮬레이션
│   │       ├── 03_trading.js           # 매수/매도 + 웹 주문 처리
│   │       ├── 04_commands.js          # !주식 채팅 명령어
│   │       ├── 05_events.js            # 틱/로드/로그인 이벤트
│   │       └── 06_offline_dashboard.js # 오프라인 자가완결형 HTML 생성
│   ├── client_scripts/
│   │   └── stocks/
│   │       ├── browser_screen.js       # MCEF 인게임 브라우저 (K=라이브, J=오프라인)
│   │       └── keybind.js              # K/J 키 바인딩
│   └── exports/                        # 자동 생성 (state/orders/dashboard.html 등)
├── web-gui/
│   ├── server.js                # Express 브릿지 서버 (라이브/매매 모드)
│   ├── package.json
│   └── public/
│       ├── index.html           # 대시보드 마크업
│       ├── styles.css           # 라이트/다크 테마 (한국 주식앱 스타일)
│       └── app.js               # 폴링 + Chart.js + 테마 토글
└── README.md
```

## 라이선스
MIT. 자유롭게 수정/배포하세요.
