// afteredu 탭 주입 핵심 자동화 스크립트 — michael
// main world 실행, 3단계 폴백 클릭, 오버레이 UI 담당 — michael
// 주의: detectSuccess, findCourseButton, "이미 신청됨" 판별은 Phase 1 역공학 분석 전 임시 구현 — michael

console.log("[content-afteredu] 주입 완료 -", window.location.href);

// ============================================================
// 유틸리티: main world에서 JS 실행 (script 태그 주입)
// content script는 isolated world이므로 window.send() 등 직접 호출 불가 — michael
// ============================================================
function runInMainWorld(code, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const eventName = `rara_result_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // CSP 차단 시 이벤트가 영원히 안 오므로 타임아웃 필수 — michael
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error("runInMainWorld timeout (CSP 차단 가능성)"));
    }, timeoutMs);

    const script = document.createElement("script");
    script.textContent = `(function() {
      try {
        const result = (function() { ${code} })();
        window.dispatchEvent(new CustomEvent("${eventName}", {detail:{success:true,result:result}}));
      } catch(e) {
        window.dispatchEvent(new CustomEvent("${eventName}", {detail:{success:false,error:e.message}}));
      }
    })();`;

    window.addEventListener(
      eventName,
      (e) => {
        clearTimeout(timer);
        script.remove();
        if (e.detail.success) resolve(e.detail.result);
        else reject(new Error(e.detail.error));
      },
      { once: true }
    );

    document.head.appendChild(script);
  });
}

// ============================================================
// 유틸리티: 딜레이
// ============================================================
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return delay(minMs + Math.random() * (maxMs - minMs));
}

// ============================================================
// 유틸리티: URL 변경 감지 (최대 waitMs)
// ============================================================
function waitForUrlChange(originalUrl, waitMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.location.href !== originalUrl || Date.now() - start > waitMs) {
        clearInterval(interval);
        resolve(window.location.href);
      }
    }, 100);
  });
}

// ============================================================
// 유틸리티: DOM에 특정 셀렉터 나타날 때까지 대기
// ============================================================
function waitForDomText(selector, waitMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el || Date.now() - start > waitMs) {
        clearInterval(interval);
        resolve(el ? el.textContent : null);
      }
    }, 100);
  });
}

// ============================================================
// 오버레이 UI
// ============================================================
let overlay = null;
let overlayList = null;

function createOverlay(courses) {
  if (overlay) overlay.remove();

  overlay = document.createElement("div");
  overlay.id = "rara-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 99999;
    background: #1e293b;
    color: white;
    border-radius: 12px;
    padding: 16px;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    border: 1px solid #334155;
  `;

  const header = document.createElement("div");
  header.style.cssText =
    "font-weight: bold; font-size: 15px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #334155; color: #93c5fd;";
  header.textContent = "서이초 수강신청 자동화";
  overlay.appendChild(header);

  overlayList = document.createElement("div");
  overlayList.style.cssText =
    "display: flex; flex-direction: column; gap: 6px;";

  courses.forEach((course, i) => {
    const row = document.createElement("div");
    row.id = `rara-row-${i}`;
    row.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; padding: 4px 0;";
    row.innerHTML = `
      <span style="color:#e2e8f0">${course.name}</span>
      <span id="rara-status-${i}" style="color:#94a3b8; font-size:12px">대기</span>
    `;
    overlayList.appendChild(row);
  });

  overlay.appendChild(overlayList);
  document.body.appendChild(overlay);
  console.log("[content-afteredu] 오버레이 UI 생성 완료");
}

function updateOverlayStatus(index, status, message) {
  const el = document.getElementById(`rara-status-${index}`);
  if (!el) return;

  const styles = {
    running: { color: "#fbbf24", text: message || "처리 중..." },
    success: { color: "#4ade80", text: message || "신청 완료" },
    already: { color: "#fb923c", text: message || "이미 신청됨" },
    closed: { color: "#f87171", text: message || "마감" },
    notfound: { color: "#a78bfa", text: message || "버튼 없음" },
    error: { color: "#f87171", text: message || "오류" },
  };

  const s = styles[status] || styles.error;
  el.style.color = s.color;
  el.textContent = s.text;
  console.log(
    `[content-afteredu] 과목[${index}] 상태: ${status} - ${s.text}`
  );
}

function finalizeOverlay(results) {
  if (!overlay) return;

  const footer = document.createElement("div");
  const success = results.filter((r) => r.status === "success").length;
  footer.style.cssText =
    "margin-top: 12px; padding-top: 8px; border-top: 1px solid #334155; font-size: 12px; color: #94a3b8;";
  footer.textContent = `완료: ${success}/${results.length}개 신청 성공`;
  overlay.appendChild(footer);
  console.log("[content-afteredu] 전체 완료:", results);
}

// ============================================================
// 로그인 상태 확인
// 정확한 선택자는 Phase 1 분석 후 업데이트 필요 — michael
// ============================================================
function checkLogin() {
  if (
    window.location.href.includes("login") ||
    window.location.href.includes("Login")
  ) {
    return false;
  }
  // 로그인 폼 감지 (afteredu 실제 선택자로 업데이트 필요) — michael
  const loginForm = document.querySelector(
    "input[name='m_id'], input[type='password']"
  );
  if (loginForm) return false;
  return true;
}

// ============================================================
// 3단계 폴백 클릭 체인
// element.click() -> dispatchEvent -> window.send() 직접 호출 — michael
// ============================================================
async function clickWithFallback(button, siteId) {
  const originalUrl = window.location.href;

  // 1단계: element.click()
  console.log(
    `[content-afteredu] 클릭 1단계 (element.click) - siteId: ${siteId}`
  );
  button.click();
  await delay(500);

  if (await detectSuccess(originalUrl)) {
    console.log(`[content-afteredu] 1단계 성공 - siteId: ${siteId}`);
    return { success: true, method: 1 };
  }

  // 2단계: dispatchEvent(MouseEvent)
  console.log(
    `[content-afteredu] 클릭 2단계 (dispatchEvent) - siteId: ${siteId}`
  );
  button.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
    })
  );
  await delay(500);

  if (await detectSuccess(originalUrl)) {
    console.log(`[content-afteredu] 2단계 성공 - siteId: ${siteId}`);
    return { success: true, method: 2 };
  }

  // 3단계: window.send() 직접 호출 (main world)
  // afteredu의 send() 함수를 직접 호출하되, confirm 자동 승인 — michael
  console.log(
    `[content-afteredu] 클릭 3단계 (window.send 직접 호출) - siteId: ${siteId}`
  );
  try {
    await runInMainWorld(`
      if (typeof window.send === 'function') {
        window.confirm = function() { return true; };
        window.send('${siteId}', '');
        return 'called';
      } else {
        throw new Error('window.send 함수 없음');
      }
    `);
    await delay(1000);

    if (await detectSuccess(originalUrl)) {
      console.log(`[content-afteredu] 3단계 성공 - siteId: ${siteId}`);
      return { success: true, method: 3 };
    }
  } catch (err) {
    console.error(`[content-afteredu] 3단계 오류:`, err.message);
  }

  return { success: false, method: 0 };
}

// ============================================================
// 성공 감지 (URL 변경 or 성공 메시지)
// TODO: Phase 1 역공학 분석 후 실제 메시지 텍스트로 교체 — michael
// ============================================================
async function detectSuccess(originalUrl) {
  // URL이 변경됐으면 성공으로 간주
  if (window.location.href !== originalUrl) {
    console.log(
      `[content-afteredu] URL 변경 감지: ${originalUrl} -> ${window.location.href}`
    );
    return true;
  }

  // DOM에서 성공/실패 메시지 텍스트 탐색
  const bodyText = document.body.innerText;
  const successKeywords = [
    "신청이 완료",
    "신청완료",
    "접수되었습니다",
    "등록되었습니다",
  ];
  const failKeywords = ["마감", "정원초과", "신청불가"];

  for (const kw of successKeywords) {
    if (bodyText.includes(kw)) {
      console.log(`[content-afteredu] 성공 키워드 감지: "${kw}"`);
      return true;
    }
  }
  for (const kw of failKeywords) {
    if (bodyText.includes(kw)) {
      console.log(`[content-afteredu] 실패 키워드 감지: "${kw}"`);
      return false;
    }
  }

  return false;
}

// ============================================================
// 영역으로 이동 (class_list 호출)
// afteredu의 class_list() 함수를 main world에서 호출 — michael
// ============================================================
async function navigateToArea(areaName) {
  console.log(`[content-afteredu] 영역 이동 시작: ${areaName}`);

  // 1순위: <a> 태그에서 영역명 텍스트 탐색 → href로 직접 이동 (가장 안전) — michael
  const links = document.querySelectorAll("a");
  for (const a of links) {
    const text = (a.textContent || "").trim();
    if (text.includes(areaName)) {
      const href = a.href;
      console.log(
        `[content-afteredu] <a> 발견: "${text}" → ${href}`
      );
      if (href && href !== "#" && !href.startsWith("javascript")) {
        window.location.href = href;
        // 페이지 이동 후 컨텍스트 파괴됨 — 이후 코드 실행 안 됨 (상태는 이미 저장됨)
        await delay(5000);
        return;
      }
      // href 없으면 클릭
      a.click();
      await delay(5000);
      return;
    }
  }

  // 2순위: onclick 속성 가진 요소에서 텍스트 매칭 → click() 호출
  const onclickEls = document.querySelectorAll("[onclick]");
  for (const el of onclickEls) {
    const text = (el.textContent || "").trim();
    if (text.includes(areaName)) {
      console.log(
        `[content-afteredu] onclick 요소 클릭: "${text}" (${el.tagName})`
      );
      el.click();
      await delay(5000);
      return;
    }
  }

  // 3순위: class_list() 직접 호출 (fallback) — michael
  console.log(`[content-afteredu] DOM 요소 없음, class_list() 시도: ${areaName}`);
  await runInMainWorld(`
    if (typeof window.class_list === 'function') {
      window.class_list('${areaName}');
      return 'navigating';
    } else {
      throw new Error('window.class_list 함수 없음');
    }
  `);
  await delay(5000);
  console.log(`[content-afteredu] 영역 이동 시도 완료: ${areaName}`);
}

// ============================================================
// 과목 신청 버튼 찾기
// onclick="send('siteId','')" 패턴으로 탐색 — michael
// TODO: Phase 1 분석 후 실제 DOM 구조에 맞게 업데이트 — michael
// ============================================================
function findCourseButton(siteId) {
  const allButtons = document.querySelectorAll("[onclick]");
  for (const el of allButtons) {
    const onclick = el.getAttribute("onclick") || "";
    if (
      onclick.includes(`send('${siteId}'`) ||
      onclick.includes(`send("${siteId}"`)
    ) {
      console.log(
        `[content-afteredu] 신청 버튼 발견 - siteId: ${siteId}, element:`,
        el.tagName
      );
      return el;
    }
  }
  console.warn(
    `[content-afteredu] 신청 버튼 없음 - siteId: ${siteId} (기간 외 or 마감)`
  );
  return null;
}

// ============================================================
// sessionStorage 상태 머신
// class_list() 호출 후 전체 페이지 리로드 시 실행 컨텍스트가 파괴되므로
// 상태를 sessionStorage에 저장하여 재개 가능하도록 구현 — michael
// ============================================================
const STATE_KEY = "rara_state";

function saveState(state) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  console.log(
    `[content-afteredu] 상태 저장 - 영역[${state.currentAreaIndex}]: ${state.areaOrder[state.currentAreaIndex]}, 처리완료: ${state.results.length}개`
  );
}

function clearState() {
  sessionStorage.removeItem(STATE_KEY);
  console.log("[content-afteredu] 상태 초기화 완료");
}

function loadState() {
  const raw = sessionStorage.getItem(STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("[content-afteredu] 상태 파싱 실패:", e);
    clearState();
    return null;
  }
}

// ============================================================
// 영역 내 과목 처리 (공통 로직 — 신선 시작/재개 양쪽 사용)
// ============================================================
async function processAreaCourses(areaCourses, allCourses, results, dryRun = false) {
  for (const course of areaCourses) {
    const idx = allCourses.findIndex((c) => c.siteId === course.siteId);
    updateOverlayStatus(idx, "running", dryRun ? "탐색 중..." : "처리 중...");

    console.log(
      `[content-afteredu] ${dryRun ? "[드라이런] " : ""}과목 처리: ${course.name} (siteId: ${course.siteId})`
    );

    const button = findCourseButton(course.siteId);

    if (!button) {
      updateOverlayStatus(idx, "notfound", "버튼 없음");
      results.push({ ...course, status: "notfound" });
      console.log(`[content-afteredu] ${course.name} - 버튼 없음`);
      continue;
    }

    // 이미 신청됨 여부 확인 (버튼 텍스트로 판별)
    // TODO: Phase 1 분석 후 실제 조건으로 교체 — michael
    const buttonText = button.textContent.trim();
    if (buttonText.includes("취소") || buttonText.includes("신청완료")) {
      updateOverlayStatus(idx, "already", "이미 신청됨");
      results.push({ ...course, status: "already" });
      console.log(`[content-afteredu] ${course.name} - 이미 신청됨`);
      continue;
    }

    // 드라이런: 버튼 발견만 확인하고 실제 클릭 안 함 — michael
    if (dryRun) {
      updateOverlayStatus(idx, "success", `버튼 발견 (${buttonText || "신청"})`);
      results.push({ ...course, status: "success", dryRun: true });
      console.log(`[content-afteredu] [드라이런] ${course.name} - 버튼 발견: "${buttonText}"`);
      await delay(300);
      continue;
    }

    // 3단계 폴백 클릭
    const clickResult = await clickWithFallback(button, course.siteId);

    if (clickResult.success) {
      updateOverlayStatus(idx, "success", `신청 완료 (방법 ${clickResult.method})`);
      results.push({ ...course, status: "success", method: clickResult.method });
    } else {
      updateOverlayStatus(idx, "error", "신청 실패");
      results.push({ ...course, status: "error" });
    }

    // 과목 간 랜덤 딜레이 (500~1000ms) — michael
    await randomDelay(500, 1000);
  }
}

// ============================================================
// 메인 자동화 로직
// resumeState: null이면 신선 시작, 있으면 페이지 재로드 후 재개 — michael
// ============================================================
// ============================================================
// info.asp 안내 페이지 자동 통과
// 수강신청 확인 버튼 클릭 → 실제 강좌 목록 페이지로 이동 — michael
// ============================================================
// 반환값: true = 통과 성공 or 해당 없음, false = 접근 오류 페이지
async function passInfoPageIfNeeded() {
  const href = window.location.href;

  // 접근불가 오류 페이지 감지 — 이 경우 자동화 불가
  if (document.body && document.body.innerText.includes("페이지 접근불가")) {
    console.error("[content-afteredu] 페이지 접근불가 - 로그인 필요 또는 잘못된 URL");
    updateOverlayHeader("로그인이 필요합니다. 직접 afteredu에 로그인 후 다시 시도하세요.");
    return false;
  }

  // subscribe0.asp (영역 선택 페이지) 또는 이미 다른 페이지면 통과
  if (!href.includes("/register/info.asp")) {
    console.log(`[content-afteredu] info.asp 아님 (${href}) - 통과`);
    return true;
  }

  console.log("[content-afteredu] info.asp 안내 페이지 감지 - 자동 통과 시도");

  // "수강신청 확인" 버튼 탐색 — michael
  const buttons = document.querySelectorAll("input[type='button'], button, a");
  let confirmBtn = null;
  for (const btn of buttons) {
    const text = (btn.value || btn.textContent || "").trim();
    if (text.includes("수강신청 확인") || text.includes("강좌 확인")) {
      confirmBtn = btn;
      break;
    }
  }

  if (!confirmBtn) {
    console.warn("[content-afteredu] 수강신청 확인 버튼 없음 - 신청기간 확인 필요");
    updateOverlayHeader("수강신청 확인 버튼을 찾을 수 없습니다. 직접 클릭해주세요.");
    return false;
  }

  const currentUrl = window.location.href;
  console.log("[content-afteredu] 수강신청 확인 버튼 자동 클릭");
  confirmBtn.click();

  await waitForUrlChange(currentUrl, 5000);
  await delay(800);
  console.log("[content-afteredu] info.asp 통과 완료 ->", window.location.href);
  return true;
}

// 오버레이 헤더에 상태 메시지 표시 — michael
function updateOverlayHeader(message) {
  if (!overlay) return;
  const header = overlay.querySelector("div");
  if (header) {
    header.style.color = "#f87171";
    header.textContent = message;
  }
}

async function runRegistration(courses, resumeState = null, dryRun = false) {
  // resumeState에서 dryRun 복원 (sessionStorage 재개 시)
  if (resumeState && resumeState.dryRun !== undefined) dryRun = resumeState.dryRun;

  console.log(
    `[content-afteredu] 자동화 ${resumeState ? "재개" : "시작"} - ${courses.length}개 과목${dryRun ? " [드라이런 모드]" : ""}`
  );

  // 오버레이 생성
  createOverlay(courses);

  // 영역별 그룹화 먼저 수행 — michael
  const grouped = {};
  courses.forEach((course) => {
    if (!grouped[course.area]) grouped[course.area] = [];
    grouped[course.area].push(course);
  });

  const areaOrder = resumeState ? resumeState.areaOrder : Object.keys(grouped);
  const startAreaIndex = resumeState ? resumeState.currentAreaIndex : 0;
  const results = resumeState ? resumeState.results : [];

  console.log(
    `[content-afteredu] 영역 처리 순서: [${areaOrder.join(", ")}], 시작 인덱스: ${startAreaIndex}`
  );

  // info.asp면 상태 저장 후 "수강신청 확인" 클릭 → 페이지 이동 후 init()이 재개
  // 클릭 후 컨텍스트가 파괴되므로 먼저 상태를 저장해야 함 — michael
  if (!resumeState && window.location.href.includes("/register/info.asp")) {
    saveState({ courses, areaOrder, currentAreaIndex: 0, results, dryRun });
    const passed = await passInfoPageIfNeeded();
    if (!passed) {
      clearState();
      console.error("[content-afteredu] 페이지 통과 실패 - 자동화 중단");
      return;
    }
    // 여기까지 도달하면 소프트 네비게이션 → 상태 유지 (init이 subscribe0.asp에서 재개)
    return;
  }

  // window.confirm/alert 오버라이드 — CSP 차단 시 3초 후 타임아웃, 진행에는 영향 없음
  runInMainWorld(`
    window.confirm = function(msg) { console.log('[rara-main] confirm 자동 승인:', msg); return true; };
    window.alert = function(msg) { console.log('[rara-main] alert 무시:', msg); };
    return 'overridden';
  `).catch((e) => console.warn("[content-afteredu] confirm 오버라이드 실패 (무시):", e.message));

  // 재개 시: 이미 처리된 과목들 오버레이 복원
  if (results.length > 0) {
    results.forEach((r) => {
      const idx = courses.findIndex((c) => c.siteId === r.siteId);
      if (idx !== -1) updateOverlayStatus(idx, r.status);
    });
    console.log(`[content-afteredu] 이전 결과 복원 완료 - ${results.length}개`);
  }

  for (let areaIndex = startAreaIndex; areaIndex < areaOrder.length; areaIndex++) {
    const area = areaOrder[areaIndex];
    const areaCourses = grouped[area] || [];

    console.log(
      `[content-afteredu] === 영역 처리 시작: ${area} (${areaCourses.length}개) ===`
    );

    // 재개 모드에서 첫 번째 영역: 이미 해당 페이지에 있으므로 네비게이션 건너뜀
    const skipNavigation = resumeState !== null && areaIndex === startAreaIndex;

    if (!skipNavigation) {
      // 네비게이션 전 상태 저장 — class_list() 호출 시 전체 리로드 발생 가능
      // 리로드 후 init()이 이 상태를 읽어 runRegistration을 재개함 — michael
      saveState({ courses, areaOrder, currentAreaIndex: areaIndex, results, dryRun });

      // navigateToArea는 항상 페이지 이동을 시도함
      // 이동 성공 시: 컨텍스트 파괴 → init()이 저장된 상태로 재개
      // 이동 실패 시: 5초 대기 후 여기까지 도달 → 오류 처리
      await navigateToArea(area).catch((err) => {
        console.error(`[content-afteredu] 영역 이동 오류 (${area}):`, err.message);
      });

      // 5초 대기 후에도 여기까지 실행됐다면 페이지 이동이 실패한 것
      console.warn(`[content-afteredu] 영역 이동 실패 - ${area}: 다음 영역으로 건너뜀`);
      clearState();
      areaCourses.forEach((course) => {
        const idx = courses.findIndex((c) => c.siteId === course.siteId);
        updateOverlayStatus(idx, "error", "영역 이동 실패");
        results.push({ ...course, status: "error", error: "영역 이동 실패" });
      });
      continue;
    } else {
      console.log(
        `[content-afteredu] 재개 모드 - 현재 페이지가 이미 ${area} 영역`
      );
    }

    await processAreaCourses(areaCourses, courses, results, dryRun);
  }

  // 완료
  clearState();
  finalizeOverlay(results);
  console.log("[content-afteredu] 전체 자동화 완료:", results);
}

// ============================================================
// 초기화: sessionStorage 상태 확인 후 재개 or background 요청 — michael
// ============================================================
async function init() {
  console.log("[content-afteredu] 초기화 시작 -", window.location.href);

  // 1순위: sessionStorage에 저장된 상태 확인 (페이지 리로드 후 재개) — michael
  const savedState = loadState();
  if (savedState) {
    console.log(
      `[content-afteredu] 저장된 상태 발견 - 영역[${savedState.currentAreaIndex}] 재개 시작`
    );
    // 즉시 삭제: 재개 도중 또 리로드될 경우 saveState()가 새로 저장함
    clearState();
    runRegistration(savedState.courses, savedState);
    return;
  }

  // 2순위: background에 준비 완료 알림 -> courses 수신
  console.log("[content-afteredu] background에 REGISTRATION_READY 전송");
  chrome.runtime.sendMessage({ type: "REGISTRATION_READY" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[content-afteredu] background 응답 없음:",
        chrome.runtime.lastError.message
      );
      return;
    }

    if (!response || !response.courses) {
      console.log(
        "[content-afteredu] 전달받은 courses 없음 - 일반 접속으로 판단"
      );
      return;
    }

    console.log(
      `[content-afteredu] courses 수신 완료 - ${response.courses.length}개 (dryRun: ${response.dryRun})`
    );
    runRegistration(response.courses, null, !!response.dryRun);
  });
}

// DOM 로드 완료 후 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
