// rarahome /macro 페이지 주입 스크립트 — michael
// Extension 설치 표시 및 postMessage -> background 릴레이 담당 — michael

console.log("[content-rarahome] 주입 완료 - rarahome.vercel.app/macro");

// Extension 설치 표시: 웹앱이 이 속성으로 Extension 유무를 판별 — michael
document.documentElement.dataset.raraExtension = "true";

// rarahome 페이지로부터 수강신청 시작 메시지 수신
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== "RARA_START_REGISTRATION") return;
  if (event.data.source !== "rarahome") return;

  const courses = event.data.courses;
  console.log(
    `[content-rarahome] 수강신청 시작 메시지 수신 - ${courses.length}개 과목:`,
    courses.map((c) => c.name)
  );

  // background service worker에 전달
  chrome.runtime.sendMessage(
    {
      type: "START_REGISTRATION",
      courses: courses,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[content-rarahome] background 전달 실패:",
          chrome.runtime.lastError.message
        );
        return;
      }
      console.log("[content-rarahome] background 전달 성공:", response);
    }
  );
});

console.log("[content-rarahome] postMessage 리스너 등록 완료");
