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

  // CSP 우회: MAIN world에서 수강신청 nav 클릭 — michael
  if (message.type === "EXEC_MAIN_CLICK_NAV") {
    const tabId = sender.tab.id;
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        for (var i = 0, els = document.querySelectorAll("a"); i < els.length; i++) {
          var t = (els[i].textContent || "").trim();
          if (t === "수강신청" || t === "강좌수강신청") {
            console.log("[rara-main] 수강신청 nav 클릭:", els[i].href || "(onclick)");
            els[i].click();
            return t;
          }
        }
        return null;
      },
    }).then((results) => {
      sendResponse({ ok: true, result: results?.[0]?.result ?? null });
    }).catch((e) => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // CSP 우회: MAIN world에서 영역 클릭 — michael
  if (message.type === "EXEC_MAIN_CLICK_AREA") {
    const tabId = sender.tab.id;
    const area = message.area;
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (area) => {
        // 1순위: class_list() 직접 호출 — michael
        if (typeof class_list === "function") {
          console.log("[rara-main] class_list 직접 호출:", area);
          class_list(area);
          return "direct:" + area;
        }
        // 2순위: a[onclick] → a → [onclick] → li 탐색 후 클릭
        var selectors = ["a[onclick]", "a", "[onclick]", "li"];
        for (var s = 0; s < selectors.length; s++) {
          var els = document.querySelectorAll(selectors[s]);
          for (var i = 0; i < els.length; i++) {
            var t = (els[i].textContent || "").trim();
            if (t.indexOf(area) !== -1 && t.length < 40) {
              console.log("[rara-main] 영역 클릭:", t, els[i].tagName, selectors[s]);
              els[i].click();
              return "click:" + t;
            }
          }
        }
        return null;
      },
      args: [area],
    }).then((results) => {
      sendResponse({ ok: true, result: results?.[0]?.result ?? null });
    }).catch((e) => {
      console.error("[background] EXEC_MAIN_CLICK_AREA 실패:", e);
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // CSP 우회: MAIN world에서 confirm 오버라이드 — michael
  if (message.type === "EXEC_MAIN_OVERRIDE_CONFIRM") {
    const tabId = sender.tab.id;
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => { window.confirm = () => true; window.alert = () => {}; },
    }).then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // CSP 우회: MAIN world에서 send() 호출 — michael
  if (message.type === "EXEC_MAIN_SEND") {
    const tabId = sender.tab.id;
    const siteId = message.siteId;
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (siteId) => {
        if (typeof window.send === "function") {
          window.confirm = () => true;
          window.send(siteId, "");
          return "called";
        }
        return "no_send";
      },
      args: [siteId],
    }).then((results) => {
      sendResponse({ ok: true, result: results?.[0]?.result ?? "error" });
    }).catch((e) => {
      sendResponse({ ok: false, error: e.message });
    });
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
      url: "http://AfterEdu.kr/R1176782B0DDF4",
      active: true,
    });

    registrationSession = {
      courses,
      tabId: tab.id,
      status: "tab_created",
      dryRun: !!dryRun,
      entryUrl: "http://AfterEdu.kr/R1176782B0DDF4",
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
  sendResponse({
    courses: registrationSession.courses,
    dryRun: registrationSession.dryRun,
    entryUrl: registrationSession.entryUrl,
  });
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
