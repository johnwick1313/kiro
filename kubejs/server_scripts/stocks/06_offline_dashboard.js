// priority: 40
// ==========================================================
// 선릿밸리 주식 시스템 - 오프라인 자가완결형 HTML 대시보드 생성기
// ==========================================================
// Node 브릿지 서버 없이도 마크 내(MCEF) 또는 일반 브라우저에서
// file:// 로 바로 열 수 있는, 데이터가 내장된 단일 HTML 파일을 생성합니다.
// - 외부 의존성 0 (Chart.js CDN 대신 인라인 SVG 스파크라인)
// - 매 가격 갱신마다 파일을 다시 써서 최신 시세 반영
// - 페이지는 8초마다 자동 새로고침
// - 읽기 전용 (매수/매도는 인게임 !주식 명령어 사용)
// ==========================================================

var _Files = Java.loadClass('java.nio.file.Files')
var _Paths = Java.loadClass('java.nio.file.Paths')
var _StandardCharsets = Java.loadClass('java.nio.charset.StandardCharsets')

// ── 페이지 CSS (한국 주식앱 스타일, 라이트 기본 + 다크) ──
var DASH_CSS = [
':root{--bg:#fff;--bg2:#f7f8fa;--bg3:#eef0f4;--bd:#e5e8ef;--hl:rgba(0,0,0,.06);--tx:#1a1d24;--mut:#8b95a7;--up:#e22c3a;--down:#2f6bff;--accent:#3b82f6;--mono:"JetBrains Mono",ui-monospace,monospace;--font:"Inter",system-ui,sans-serif}',
'[data-theme=dark]{--bg:#0f1117;--bg2:#161b27;--bg3:#1e2535;--bd:#2a3347;--hl:rgba(255,255,255,.05);--tx:#e8eaf0;--mut:#7b869e;--up:#ff5260;--down:#4d8dff}',
'*{box-sizing:border-box;margin:0;padding:0}',
'body{background:var(--bg);color:var(--tx);font-family:var(--font);font-size:13px;padding-bottom:40px}',
'.top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--bd);position:sticky;top:0;background:var(--bg);z-index:10}',
'.brand{font-size:16px;font-weight:800}.brand b{color:var(--up)}',
'.top-right{display:flex;align-items:center;gap:14px}',
'.tag{font-size:11px;color:var(--mut)}',
'.tg{width:32px;height:32px;border-radius:8px;border:1px solid var(--bd);background:var(--bg2);color:var(--tx);cursor:pointer;font-size:15px}',
'.wrap{max-width:1100px;margin:0 auto;padding:18px 20px;display:grid;grid-template-columns:1fr 320px;gap:18px}',
'@media(max-width:860px){.wrap{grid-template-columns:1fr}}',
'.card{background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:16px;margin-bottom:16px}',
'.card h3{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--mut);margin-bottom:12px}',
'table{width:100%;border-collapse:collapse}',
'th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--bd)}',
'td{padding:9px 10px;border-bottom:1px solid var(--hl);font-family:var(--mono);font-size:12px}',
'tr:last-child td{border-bottom:none}',
'.sym{font-weight:700}.nm{color:var(--mut);font-size:10px;font-family:var(--font)}',
'.up{color:var(--up)}.down{color:var(--down)}',
'.big{font-family:var(--mono);font-size:26px;font-weight:700}',
'.lbl{font-size:11px;color:var(--mut);margin-bottom:10px}',
'.row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:var(--mut)}',
'.row b{font-family:var(--mono);color:var(--tx)}',
'.divider{height:1px;background:var(--bd);margin:10px 0}',
'.badge-buy{background:rgba(226,44,58,.12);color:var(--up);padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700}',
'.badge-sell{background:rgba(47,107,255,.12);color:var(--down);padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700}',
'.note{background:rgba(217,145,0,.1);border:1px solid #d99100;color:#a06a00;border-radius:8px;padding:10px 14px;font-size:12px;margin:0 20px 8px;max-width:1100px;margin-left:auto;margin-right:auto}',
'[data-theme=dark] .note{color:#f5b942}',
'.empty{color:var(--mut);text-align:center;padding:14px;font-size:12px}',
'.foot{text-align:center;color:var(--mut);font-size:11px;padding:14px}'
].join('\n')

// ── 페이지 JS (브라우저에서 실행, 내장 DATA 사용) ──
var DASH_JS = [
'var D=window.__DATA__||{prices:{},meta:{},players:{}};',
'var U=(D.currency&&D.currency.unit)||"G";',
'function applyTheme(t){if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}else{document.documentElement.removeAttribute("data-theme");}localStorage.setItem("sunlit-theme",t);var b=document.getElementById("tg");if(b)b.textContent=(t==="dark"?"\\u2600\\ufe0f":"\\ud83c\\udf19");}',
'applyTheme(localStorage.getItem("sunlit-theme")||"light");',
'function tg(){applyTheme((localStorage.getItem("sunlit-theme")||"light")==="dark"?"light":"dark");}',
'function fmtG(n){return (Number(n)||0).toLocaleString("ko-KR",{minimumFractionDigits:2,maximumFractionDigits:2})+" "+U;}',
'function fmtP(n){n=Number(n)||0;return (n>=0?"+":"")+n.toFixed(2)+"%";}',
'function cl(n){return (Number(n)||0)>=0?"up":"down";}',
'function esc(s){return String(s).replace(/[&<>]/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;"})[c];});}',
'function spark(h,up){if(!h||h.length<2)return "";var v=h.map(function(x){return x.p;});var mn=Math.min.apply(null,v),mx=Math.max.apply(null,v),w=110,ht=30,rg=(mx-mn)||1;var p=v.map(function(val,i){var x=i/(v.length-1)*w;var y=ht-((val-mn)/rg)*ht;return x.toFixed(1)+","+y.toFixed(1);}).join(" ");return "<svg width=\\""+w+"\\" height=\\""+ht+"\\" viewBox=\\"0 0 "+w+" "+ht+"\\"><polyline fill=\\"none\\" stroke=\\""+(up?"var(--up)":"var(--down)")+"\\" stroke-width=\\"1.5\\" points=\\""+p+"\\"/></svg>";}',
'function uuidParam(){return new URLSearchParams(location.search).get("uuid");}',
'function renderMarket(){var st=(D.meta&&D.meta.stocks)||[];var rows=st.map(function(s){var pr=D.prices[s.symbol]||{};var c=pr.change||0;return "<tr><td><span class=\\"sym\\">"+esc(s.symbol)+"</span><div class=\\"nm\\">"+esc(s.name||"")+"</div></td><td>"+spark(pr.history,c>=0)+"</td><td style=\\"text-align:right\\">"+fmtG(pr.current)+"</td><td class=\\""+cl(c)+"\\" style=\\"text-align:right\\">"+fmtP(c)+"</td></tr>";}).join("");document.getElementById("mkt").innerHTML=rows||"<tr><td colspan=4 class=empty>시세 데이터 없음</td></tr>";}',
'function renderAccount(){var id=uuidParam();var box=document.getElementById("acc");var p=id&&D.players?D.players[id]:null;if(!p){box.innerHTML="<div class=empty>계좌 정보 없음<br>(인게임에서 !주식 웹 으로 자동로그인 링크를 사용하세요)</div>";document.getElementById("uname").textContent="미접속";return;}document.getElementById("uname").textContent=p.username||"-";var cash=p.balance||0,val=cash,cost=0;var hold=[];Object.keys(p.portfolio||{}).forEach(function(sym){var sh=p.portfolio[sym];var avg=(p.avgCost||{})[sym]||0;var price=((D.prices[sym]||{}).current)||0;var v=price*sh,ct=avg*sh;val+=v;cost+=ct;hold.push({sym:sym,sh:sh,avg:avg,v:v,pl:v-ct,plp:ct>0?(v-ct)/ct*100:0});});var pl=val-cash-cost;var plp=cost>0?pl/cost*100:0;box.innerHTML="<div class=big>"+fmtG(cash)+"</div><div class=lbl>현금 잔고</div><div class=divider></div><div class=row><span>총 자산</span><b>"+fmtG(val)+"</b></div><div class=row><span>투자원금</span><b>"+fmtG(cost)+"</b></div><div class=row><span>평가손익</span><b class=\\""+cl(pl)+"\\">"+(pl>=0?"+":"")+fmtG(pl)+"</b></div><div class=row><span>수익률</span><b class=\\""+cl(plp)+"\\">"+fmtP(plp)+"</b></div>";var hl=document.getElementById("hold");hl.innerHTML=hold.length?hold.map(function(h){return "<tr><td class=sym>"+esc(h.sym)+"</td><td style=\\"text-align:right\\">"+h.sh+"주</td><td style=\\"text-align:right\\">"+fmtG(h.v)+"</td><td class=\\""+cl(h.pl)+"\\" style=\\"text-align:right\\">"+fmtP(h.plp)+"</td></tr>";}).join(""):"<tr><td colspan=4 class=empty>보유 종목 없음</td></tr>";var tx=(p.transactions||[]).slice(0,15);document.getElementById("hist").innerHTML=tx.length?tx.map(function(t){return "<tr><td>"+new Date(t.at).toLocaleString("ko-KR",{hour12:false})+"</td><td><span class=\\""+(t.type==="buy"?"badge-buy":"badge-sell")+"\\">"+(t.type==="buy"?"매수":"매도")+"</span></td><td class=sym>"+esc(t.symbol)+"</td><td style=\\"text-align:right\\">"+t.shares+"주</td><td style=\\"text-align:right\\">"+fmtG(t.price)+"</td></tr>";}).join(""):"<tr><td colspan=5 class=empty>거래내역 없음</td></tr>";}',
'document.getElementById("tg").addEventListener("click",tg);',
'renderMarket();renderAccount();',
'document.getElementById("upd").textContent=new Date(D.lastUpdate||Date.now()).toLocaleTimeString("ko-KR",{hour12:false});',
'setTimeout(function(){location.reload();},8000);'
].join('\n')

// ── HTML 본문 골격 ──
function buildOfflineHtml(payload) {
    var head = [
        '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Sunlit Exchange (오프라인)</title>',
        '<style>', DASH_CSS, '</style></head><body>'
    ].join('\n')

    var body = [
        '<div class="top"><div class="brand">Sunlit<b>Exchange</b></div>',
        '<div class="top-right"><span class="tag">오프라인 · <span id="upd">--</span> · <span id="uname">미접속</span></span>',
        '<button class="tg" id="tg" title="테마 전환">🌙</button></div></div>',
        '<div class="note">📖 읽기 전용 오프라인 모드입니다. 매수/매도는 게임 내 <b>!주식 매수/매도</b> 명령어를 사용하세요. (8초마다 자동 새로고침)</div>',
        '<div class="wrap">',
        '  <div><div class="card"><h3>실시간 시세 (' + (payload.currency ? payload.currency.label : '') + ')</h3>',
        '    <table><thead><tr><th>종목</th><th>추이</th><th style="text-align:right">현재가</th><th style="text-align:right">변동률</th></tr></thead><tbody id="mkt"></tbody></table></div>',
        '    <div class="card"><h3>최근 거래내역</h3><table><thead><tr><th>시간</th><th>구분</th><th>종목</th><th style="text-align:right">수량</th><th style="text-align:right">단가</th></tr></thead><tbody id="hist"></tbody></table></div>',
        '  </div>',
        '  <div><div class="card"><h3>내 계좌</h3><div id="acc"></div></div>',
        '    <div class="card"><h3>보유 종목</h3><table><tbody id="hold"></tbody></table></div>',
        '  </div>',
        '</div>',
        '<div class="foot">Sunlit Exchange · KubeJS 오프라인 대시보드 · 데이터 내장형</div>'
    ].join('\n')

    var tail = [
        '<script>window.__DATA__=' + JSON.stringify(payload) + ';</script>',
        '<script>', DASH_JS, '</script>',
        '</body></html>'
    ].join('\n')

    return head + '\n' + body + '\n' + tail
}

// ── 데이터 수집 + 파일 쓰기 ──
global.writeOfflineDashboard = function () {
    if (!global.STOCK_CONFIG.offlineDashboardEnabled) return
    try {
        var data = global.getStockData()

        var players = {}
        Object.keys(data.players || {}).forEach(function (uuid) {
            var p = data.players[uuid]
            players[uuid] = {
                username:     p.username,
                balance:      p.balance,
                portfolio:    p.portfolio || {},
                avgCost:      p.avgCost || {},
                transactions: (p.transactions || []).slice(0, 30),
            }
        })

        var payload = {
            prices:     data.prices || {},
            meta:       data.meta || {},
            players:    players,
            lastUpdate: data.lastUpdate || Date.now(),
            currency:   { unit: global.Currency.unit(), label: global.Currency.label() },
        }

        var html = buildOfflineHtml(payload)
        var path = _Paths.get(global.STOCK_CONFIG.offlineDashboardPath)
        _Files.write(path, java.lang.String(html).getBytes(_StandardCharsets.UTF_8))
    } catch (e) {
        console.error('[StockSystem] 오프라인 대시보드 생성 오류: ' + e)
    }
}

// 가격 갱신 주기에 맞춰 대시보드 재생성
var _dashTick = 0
ServerEvents.tick(function (event) {
    _dashTick++
    if (_dashTick < global.STOCK_CONFIG.updateIntervalTicks) return
    _dashTick = 0
    global.writeOfflineDashboard()
})

// 서버 로드 직후 1회 생성
ServerEvents.loaded(function (event) {
    global.writeOfflineDashboard()
    console.info('[StockSystem] 오프라인 대시보드 생성: ' + global.STOCK_CONFIG.offlineDashboardPath)
})
