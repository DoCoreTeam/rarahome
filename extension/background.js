// Service Worker - 탭 생성 및 메시지 라우팅 — michael
// content-rarahome -> background -> content-afteredu 메시지 흐름 관리 — michael

console.log("[background] Service Worker 시작");

// 현재 진행 중인 등록 세션 상태
let registrationSession = null; // { courses, tabId, status }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "[background] 메시지 수신:",
    message.type,
    "from:",
    sender.tab?.url || "extension"
  );

  if (message.type === "START_REGISTRATION") {
    handleStartRegistration(message.courses, sendResponse, message.dryRun);
    return true; // 비동기 응답
  }

  if (message.type === "REGISTRATION_READY") {
    // content-afteredu가 준비됐다고 알려왔을 때 courses 전달
    handleAfterEduReady(sender.tab.id, sendResponse);
    return true;
  }
});

async function handleStartRegistration(courses, sendResponse, dryRun = false) {
  console.log(
    `[background] 수강신청 ${dryRun ? "드라이런" : "시작"} - ${courses.length}개:`,
    courses.map((c) => c.name)
  );

  // 기존 세션 있으면 경고
  if (registrationSession && registrationSession.status === "running") {
    console.warn("[background] 이미 진행 중인 세션이 있습니다");
    sendResponse({ success: false, error: "이미 진행 중" });
    return;
  }

  // afteredu 탭 생성
  try {
    const tab = await chrome.tabs.create({
      url: "https://w3.afteredu.kr/register/info.asp",
      active: true,
    });

    registrationSession = {
      courses,
      tabId: tab.id,
      status: "tab_created",
      dryRun: !!dryRun,
    };

    console.log(`[background] afteredu 탭 생성 완료 - tabId: ${tab.id}`);
    sendResponse({ success: true, tabId: tab.id });
  } catch (err) {
    console.error("[background] 탭 생성 실패:", err);
    sendResponse({ success: false, error: err.message });
  }
}

function handleAfterEduReady(tabId, sendResponse) {
  console.log(`[background] content-afteredu 준비 완료 - tabId: ${tabId}`);

  if (!registrationSession) {
    console.warn("[background] 세션 없음 - 진행할 courses 없음");
    sendResponse({ courses: null });
    return;
  }

  if (registrationSession.tabId !== tabId) {
    console.warn(
      `[background] 탭 ID 불일치 - 세션: ${registrationSession.tabId}, 요청: ${tabId}`
    );
    sendResponse({ courses: null });
    return;
  }

  registrationSession.status = "running";
  console.log(
    `[background] courses 전달 - ${registrationSession.courses.length}개 (dryRun: ${registrationSession.dryRun})`
  );
  sendResponse({ courses: registrationSession.courses, dryRun: registrationSession.dryRun });
}

// 탭 닫히면 세션 정리
chrome.tabs.onRemoved.addListener((tabId) => {
  if (registrationSession && registrationSession.tabId === tabId) {
    console.log(
      `[background] 등록 탭 닫힘 - 세션 정리 (tabId: ${tabId})`
    );
    registrationSession = null;
  }
});
