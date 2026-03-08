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

// background를 통해 MAIN world 실행 (CSP 우회) — michael
function execMainClickArea(area) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "EXEC_MAIN_CLICK_AREA", area }, (res) => {
      if (chrome.runtime.lastError) { resolve({ ok: false }); return; }
      resolve(res || { ok: false });
    });
  });
}
function execMainOverrideConfirm() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "EXEC_MAIN_OVERRIDE_CONFIRM" }, (res) => {
      if (chrome.runtime.lastError) { resolve({ ok: false }); return; }
      resolve(res || { ok: false });
    });
  });
}
function execMainSend(siteId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "EXEC_MAIN_SEND", siteId }, (res) => {
      if (chrome.runtime.lastError) { resolve({ ok: false, result: "error" }); return; }
      resolve(res || { ok: false, result: "error" });
    });
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
async function handleInfoPage(courses, areaOrder, dryRun, entryUrl) {
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
  saveState({ phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun, entryUrl });
  console.log("[rara] 수강신청 확인 클릭");
  btn.click();
  // 컨텍스트 파괴 예정
}

// --- subscribe0.asp: 해당 영역 <a> 링크 찾아서 직접 이동 ---
async function handleAreaSelect(state) {
  const { courses, areaOrder, currentAreaIndex, results, dryRun, entryUrl } = state;
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
  saveState({ phase: "COURSE_LIST", courses, areaOrder, currentAreaIndex, results, dryRun, entryUrl });

  // background → MAIN world에서 클릭 (CSP 우회) — michael
  console.log(`[rara] MAIN world 클릭 시도: ${area}`);
  const res = await execMainClickArea(area);
  if (!res.ok || !res.result) {
    console.warn("[rara] MAIN world 클릭 실패 — fallback click()");
    targetEl.click();
  } else {
    console.log(`[rara] MAIN world 클릭/호출 성공: "${res.result}"`);
  }

  // 페이지 이동(full reload) or AJAX 업데이트 대기 — michael
  await delay(2000);

  // URL이 subscribe0.asp 그대로이면 AJAX 방식 → 인라인으로 과목 목록 처리
  if (window.location.href.includes("subscribe0.asp")) {
    console.log("[rara] AJAX 방식 감지 — 인라인으로 과목 목록 처리");
    await handleCourseList({ ...state, phase: "COURSE_LIST" });
  }
  // URL 변경됐으면 새 페이지에서 sessionStorage로 자동 재개
}

// --- 과목 목록 페이지: 버튼 찾아서 신청 ---
async function handleCourseList(state) {
  const { courses, areaOrder, currentAreaIndex, results, dryRun, entryUrl } = state;
  const area = areaOrder[currentAreaIndex];
  const grouped = groupByArea(courses);
  const areaCourses = grouped[area] || [];

  console.log(`[rara] 과목 목록 처리 — ${area}, ${areaCourses.length}개`);
  setHeader(`신청 중: ${area}`);

  // confirm/alert 오버라이드 (MAIN world via background) — michael
  await execMainOverrideConfirm();

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

    // 실제 신청: MAIN world에서 send() 호출 → 실패 시 element.click()
    console.log(`[rara] 신청 시도: ${course.name} (siteId:${course.siteId})`);
    const sendRes = await execMainSend(course.siteId);
    if (!sendRes.ok || sendRes.result === "no_send" || sendRes.result === "error") {
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
    saveState({ phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: nextIndex, results, dryRun, entryUrl });
    await goToAreaSelect(entryUrl);
  } else {
    clearState();
    const successCount = results.filter((r) => r.status === "success").length;
    setHeader(`완료! ${successCount}/${courses.length}개 신청 성공`, "#4ade80");
    setFooter(`${dryRun ? "[드라이런] " : ""}모든 영역 처리 완료`);
    console.log("[rara] 전체 완료:", results);
  }
}

// --- 신청 후 다음 영역 선택 페이지로 복귀 ---
async function goToAreaSelect(entryUrl) {
  // MAIN world에서 nav "수강신청" 클릭 시도 (CSP 우회)
  const res = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "EXEC_MAIN_CLICK_NAV" }, (r) => {
      if (chrome.runtime.lastError) { resolve({ ok: false }); return; }
      resolve(r || { ok: false });
    });
  });

  if (res.ok && res.result) {
    console.log("[rara] 수강신청 nav 클릭 성공:", res.result);
    return;
  }

  // fallback: 원래 학교 entry URL로 이동 (session 유지)
  const dest = entryUrl || "http://AfterEdu.kr/R1176782B0DDF4";
  console.log("[rara] fallback: entryUrl로 이동", dest);
  window.location.href = dest;
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
    setHeader("접근불가 — 로그인 필요", "#f87171");
    setFooter("afteredu.kr 에 먼저 로그인 후 다시 실행하세요");
    // 로그인 링크 버튼 추가
    const footer = document.getElementById("rara-footer");
    if (footer) {
      footer.innerHTML = `
        <div style="margin-top:8px;font-size:12px;color:#94a3b8;">afteredu에 로그인 후 매크로를 다시 실행하세요</div>
        <a href="https://www.afteredu.kr/member/login.asp" target="_blank"
           style="display:block;margin-top:8px;padding:6px 12px;background:#3b82f6;color:white;border-radius:6px;text-align:center;text-decoration:none;font-size:12px;">
          afteredu 로그인 페이지 열기
        </a>
      `;
    }
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

  const { courses, dryRun, entryUrl } = res;
  const areaOrder = Object.keys(groupByArea(courses));
  console.log("[rara] courses 수신:", courses.length, "개 / 영역:", areaOrder, "/ entryUrl:", entryUrl);

  createOverlay(courses);

  if (href.includes("/register/info.asp") || href.includes("/register/info_screen.asp")) {
    await handleInfoPage(courses, areaOrder, !!dryRun, entryUrl);
  } else if (href.includes("/register/subscribe0.asp")) {
    const state = { phase: "SELECT_AREA", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun: !!dryRun, entryUrl };
    await handleAreaSelect(state);
  } else {
    const state = { phase: "COURSE_LIST", courses, areaOrder, currentAreaIndex: 0, results: [], dryRun: !!dryRun, entryUrl };
    await handleCourseList(state);
  }
}

// DOM 준비 후 실행
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
