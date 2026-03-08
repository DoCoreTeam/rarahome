// afteredu 수강신청 자동화 — michael
// 흐름: info.asp → subscribe0.asp(영역선택) → 과목목록 → 신청 → subscribe0.asp(다음영역)

console.log("[rara] content-afteredu 주입:", window.location.href);

// ============================================================
// sessionStorage 상태 머신 키
// ============================================================
const STATE_KEY = "rara_state";

function saveState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  console.log("[rara] 상태 저장:", state.phase, "영역:", state.areaOrder?.[state.currentAreaIndex]);
}
function clearState() {
  sessionStorage.removeItem(STATE_KEY);
}
function loadState() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    clearState();
    return null;
  }
}

// ============================================================
// 유틸
// ============================================================
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function groupByArea(courses) {
  const g = {};
  courses.forEach((c) => {
    if (!g[c.area]) g[c.area] = [];
    g[c.area].push(c);
  });
  return g;
}

// main world 스크립트 주입 (CSP 차단 시 3초 타임아웃) — michael
function runInMainWorld(code, ms = 3000) {
  return new Promise((resolve, reject) => {
    const id = `rara_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error("timeout"));
    }, ms);
    const script = document.createElement("script");
    script.textContent = `(function(){try{const r=(function(){${code}})();window.dispatchEvent(new CustomEvent("${id}",{detail:{ok:true,r:r}}))}catch(e){window.dispatchEvent(new CustomEvent("${id}",{detail:{ok:false,e:e.message}}))}})();`;
    window.addEventListener(id, (e) => {
      clearTimeout(timer);
      script.remove();
      e.detail.ok ? resolve(e.detail.r) : reject(new Error(e.detail.e));
    }, { once: true });
    document.head.appendChild(script);
  });
}

// ============================================================
// 오버레이 UI
// ============================================================
let overlay = null;

function createOverlay(courses) {
  document.getElementById("rara-overlay")?.remove();
  overlay = document.createElement("div");
  overlay.id = "rara-overlay";
  overlay.style.cssText = `
    position:fixed;top:10px;right:10px;z-index:99999;
    background:#1e293b;color:white;border-radius:12px;
    padding:16px;min-width:280px;max-width:380px;
    font-family:-apple-system,sans-serif;font-size:14px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid #334155;
  `;
  overlay.innerHTML = `
    <div id="rara-header" style="font-weight:bold;font-size:15px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #334155;color:#93c5fd;">
      서이초 수강신청 자동화
    </div>
    <div id="rara-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    <div id="rara-footer" style="margin-top:10px;font-size:12px;color:#64748b;"></div>
  `;
  document.body.appendChild(overlay);

  const list = document.getElementById("rara-list");
  courses.forEach((c, i) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:3px 0;";
    row.innerHTML = `
      <span style="color:#e2e8f0">${c.name}</span>
      <span id="rara-s-${i}" style="color:#64748b;font-size:12px">대기</span>
    `;
    list.appendChild(row);
  });
  console.log("[rara] 오버레이 생성:", courses.length, "개 과목");
}

function setStatus(courses, siteId, status, msg) {
  const idx = courses.findIndex((c) => c.siteId === siteId);
  if (idx === -1) return;
  const el = document.getElementById(`rara-s-${idx}`);
  if (!el) return;
  const colors = { running:"#fbbf24", success:"#4ade80", already:"#fb923c", notfound:"#a78bfa", error:"#f87171" };
  el.style.color = colors[status] || "#94a3b8";
  el.textContent = msg || status;
  console.log(`[rara] [${status}] ${msg || ""} — siteId:${siteId}`);
}

function setHeader(msg, color = "#93c5fd") {
  const el = document.getElementById("rara-header");
  if (el) { el.textContent = msg; el.style.color = color; }
}

function setFooter(msg) {
  const el = document.getElementById("rara-footer");
  if (el) el.textContent = msg;
}

function restoreOverlayResults(courses, results) {
  results.forEach((r) => setStatus(courses, r.siteId, r.status, r.msg || r.status));
}

// ============================================================
// background에서 courses 요청
// ============================================================
function fetchCoursesFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "REGISTRATION_READY" }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("[rara] background 응답 없음:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(res || null);
    });
  });
}

// ============================================================
// 페이지별 핸들러
// ============================================================

// --- info.asp: "수강신청 확인" 클릭 후 subscribe0.asp로 이동 ---
async function handleInfoPage(courses, areaOrder, dryRun) {
  console.log("[rara] info.asp 처리");

  if (document.body.innerText.includes("페이지 접근불가")) {
    setHeader("접근불가 — 로그인 필요", "#f87171");
    return;
  }

  // 수강신청 확인 버튼 탐색
  let btn = null;
  for (const el of document.querySelectorAll("a, button, input[type='button']")) {
    const t = (el.value || el.textContent || "").trim();
    if (t.includes("수강신청 확인") || t.includes("강좌 확인")) { btn = el; break; }
  }

  if (!btn) {
    setHeader("수강신청 확인 버튼 없음", "#f87171");
    console.warn("[rara] 수강신청 확인 버튼 없음");
    return;
  }

  // 클릭 전 상태 저장 → 이동 후 subscribe0.asp에서 재개
  saveState({ phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun });
  console.log("[rara] 수강신청 확인 클릭");
  btn.click();
  // 컨텍스트 파괴 예정
}

// --- subscribe0.asp: 해당 영역 <a> 링크 찾아서 직접 이동 ---
async function handleAreaSelect(state) {
  const { courses, areaOrder, currentAreaIndex, results, dryRun } = state;
  const area = areaOrder[currentAreaIndex];

  console.log(`[rara] 영역 선택 페이지 — ${area} (${currentAreaIndex + 1}/${areaOrder.length})`);
  setHeader(`영역 이동 중: ${area}`);
  setFooter(`${currentAreaIndex + 1} / ${areaOrder.length} 영역`);

  // 영역 텍스트 포함된 요소 탐색 — <a>, [onclick], li, div 순으로 시도
  // href 조건 없음: javascript:void(0) 이나 # 이어도 click() 으로 동작 — michael
  let targetEl = null;
  for (const el of document.querySelectorAll("a, [onclick], li, td, div")) {
    const t = (el.textContent || "").trim();
    if (t.includes(area) && t.length < 40) {
      targetEl = el;
      console.log(`[rara] 영역 요소 발견: "${t}" (${el.tagName}) href="${el.href || el.getAttribute("onclick") || "없음"}"`);
      break;
    }
  }

  if (!targetEl) {
    setHeader(`영역 요소 없음: ${area}`, "#f87171");
    console.error("[rara] 영역 요소 없음:", area);
    clearState();
    return;
  }

  // 이동 전 상태 저장 → 과목 목록 페이지에서 재개
  saveState({ phase: "COURSE_LIST", courses, areaOrder, currentAreaIndex, results, dryRun });

  // main world에서 클릭 실행 (isolated world click은 onclick 핸들러 미트리거) — michael
  const result = await runInMainWorld(`
    var els = document.querySelectorAll("a, [onclick], li, td, div");
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || "").trim();
      if (t.indexOf("${area}") !== -1 && t.length < 40) {
        console.log("[rara-main] 영역 클릭:", t, els[i].tagName);
        els[i].click();
        return t;
      }
    }
    return null;
  `, 3000).catch((e) => {
    console.warn("[rara] runInMainWorld 실패:", e.message);
    return null;
  });

  if (!result) {
    // fallback: content script에서 직접 click
    console.log("[rara] fallback click()");
    targetEl.click();
  }
  // 클릭 후 페이지 이동 → 컨텍스트 파괴 예정
}

// --- 과목 목록 페이지: 버튼 찾아서 신청 ---
async function handleCourseList(state) {
  const { courses, areaOrder, currentAreaIndex, results, dryRun } = state;
  const area = areaOrder[currentAreaIndex];
  const grouped = groupByArea(courses);
  const areaCourses = grouped[area] || [];

  console.log(`[rara] 과목 목록 처리 — ${area}, ${areaCourses.length}개`);
  setHeader(`신청 중: ${area}`);

  // confirm/alert 오버라이드 (CSP 차단 시 무시)
  runInMainWorld(`window.confirm=()=>true;window.alert=()=>{};return 'ok';`).catch(() => {});

  for (const course of areaCourses) {
    setStatus(courses, course.siteId, "running", "탐색 중...");

    // 버튼 탐색: onclick에 siteId 포함된 요소
    let btn = null;
    for (const el of document.querySelectorAll("[onclick]")) {
      const oc = el.getAttribute("onclick") || "";
      if (oc.includes(`'${course.siteId}'`) || oc.includes(`"${course.siteId}"`)) {
        btn = el;
        break;
      }
    }

    if (!btn) {
      setStatus(courses, course.siteId, "notfound", "버튼 없음");
      results.push({ siteId: course.siteId, status: "notfound", msg: "버튼 없음" });
      console.log(`[rara] 버튼 없음: ${course.name} (siteId:${course.siteId})`);
      continue;
    }

    // 이미 신청됨 확인
    const btnText = (btn.value || btn.textContent || "").trim();
    if (btnText.includes("취소") || btnText.includes("신청완료")) {
      setStatus(courses, course.siteId, "already", "이미 신청됨");
      results.push({ siteId: course.siteId, status: "already", msg: "이미 신청됨" });
      console.log(`[rara] 이미 신청됨: ${course.name}`);
      continue;
    }

    if (dryRun) {
      setStatus(courses, course.siteId, "success", `버튼 발견: "${btnText}"`);
      results.push({ siteId: course.siteId, status: "success", msg: `버튼 발견` });
      console.log(`[rara] [드라이런] 버튼 발견: ${course.name} — "${btnText}"`);
      await delay(200);
      continue;
    }

    // 실제 신청: window.send() 직접 호출 시도 → 실패 시 element.click()
    console.log(`[rara] 신청 시도: ${course.name} (siteId:${course.siteId})`);
    const called = await runInMainWorld(`
      if (typeof window.send === 'function') {
        window.confirm = () => true;
        window.send('${course.siteId}', '');
        return 'called';
      }
      return 'no_send';
    `).catch(() => "error");

    if (called === "no_send") {
      btn.click();
    }

    await delay(1000);

    // 성공 여부 판단 (URL 변경 or 키워드)
    const success = await checkSuccess();
    if (success) {
      setStatus(courses, course.siteId, "success", "신청 완료");
      results.push({ siteId: course.siteId, status: "success", msg: "신청 완료" });
    } else {
      setStatus(courses, course.siteId, "error", "신청 실패");
      results.push({ siteId: course.siteId, status: "error", msg: "신청 실패" });
    }

    await delay(500);
  }

  // 이 영역 완료 — 다음 영역이 있으면 subscribe0.asp로 복귀
  const nextIndex = currentAreaIndex + 1;
  if (nextIndex < areaOrder.length) {
    console.log(`[rara] 다음 영역으로: ${areaOrder[nextIndex]}`);
    saveState({ phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: nextIndex, results, dryRun });
    // 상단 "수강신청" 탭 클릭하거나 직접 subscribe0.asp 이동
    await goToAreaSelect();
  } else {
    clearState();
    const successCount = results.filter((r) => r.status === "success").length;
    setHeader(`완료! ${successCount}/${courses.length}개 신청 성공`, "#4ade80");
    setFooter(`${dryRun ? "[드라이런] " : ""}모든 영역 처리 완료`);
    console.log("[rara] 전체 완료:", results);
  }
}

// --- 신청 후 다음 영역 선택 페이지로 복귀 ---
async function goToAreaSelect() {
  // 상단 nav의 "수강신청" 링크 탐색
  for (const a of document.querySelectorAll("a")) {
    const t = (a.textContent || "").trim();
    if (t === "수강신청" && a.href && !a.href.endsWith("#")) {
      console.log("[rara] 수강신청 nav 클릭:", a.href);
      window.location.href = a.href;
      return;
    }
  }
  // fallback: subscribe0.asp 직접 이동
  const base = window.location.origin;
  console.log("[rara] fallback: subscribe0.asp 직접 이동");
  window.location.href = base + "/register/subscribe0.asp";
}

// --- 성공 여부 판단 ---
async function checkSuccess() {
  const bodyText = document.body.innerText;
  const successKw = ["신청이 완료", "신청완료", "접수되었습니다", "등록되었습니다"];
  const failKw = ["마감", "정원초과", "신청불가", "신청기간이 아닙니다"];
  for (const kw of successKw) if (bodyText.includes(kw)) return true;
  for (const kw of failKw) if (bodyText.includes(kw)) return false;
  return false;
}

// ============================================================
// 초기화 진입점
// ============================================================
async function init() {
  const href = window.location.href;
  console.log("[rara] 초기화 — URL:", href);

  // 접근불가 체크
  if (document.body?.innerText.includes("페이지 접근불가")) {
    console.warn("[rara] 페이지 접근불가");
    createOverlay([]);
    setHeader("접근불가 — 로그인 후 다시 시도", "#f87171");
    return;
  }

  const savedState = loadState();

  // ── 저장된 상태로 재개 ──────────────────────────────────────
  if (savedState) {
    console.log("[rara] 저장된 상태 재개:", savedState.phase);
    clearState();
    createOverlay(savedState.courses);
    restoreOverlayResults(savedState.courses, savedState.results);

    if (savedState.phase === "SELECT_AREA") {
      await handleAreaSelect(savedState);
    } else if (savedState.phase === "COURSE_LIST") {
      await handleCourseList(savedState);
    }
    return;
  }

  // ── 신선 시작: background에서 courses 수신 ───────────────────
  const res = await fetchCoursesFromBackground();
  if (!res?.courses) {
    console.log("[rara] courses 없음 — 일반 접속");
    return;
  }

  const { courses, dryRun } = res;
  const areaOrder = Object.keys(groupByArea(courses));
  console.log("[rara] courses 수신:", courses.length, "개 / 영역:", areaOrder);

  createOverlay(courses);

  if (href.includes("/register/info.asp")) {
    await handleInfoPage(courses, areaOrder, !!dryRun);
  } else if (href.includes("/register/subscribe0.asp")) {
    // info.asp 없이 바로 subscribe0.asp에 도달한 경우
    const state = { phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun: !!dryRun };
    await handleAreaSelect(state);
  } else {
    // 다른 페이지에서 시작된 경우 (예: 이미 특정 영역 페이지)
    const state = { phase: "COURSE_LIST", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun: !!dryRun };
    await handleCourseList(state);
  }
}

// DOM 준비 후 실행
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
