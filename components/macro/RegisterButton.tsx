"use client";

// 수강신청 매크로 실행 버튼 - Extension 감지 + postMessage 트리거 — michael
import { useCallback, useEffect, useState } from "react";
import { useTimetableStore } from "@/stores/timetable-store";

type ButtonState = "not-installed" | "no-courses" | "ready" | "running";

interface MacroCourse {
  siteId: string;
  name: string;
  area: string;
}

export default function RegisterButton() {
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [buttonState, setButtonState] = useState<ButtonState>("not-installed");
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const { _selectedCourses } = useTimetableStore();
  const selectedCount = _selectedCourses.length;

  // Extension 감지: data-rara-extension 속성 폴링 (100ms 간격, 최대 3초) — michael
  useEffect(() => {
    let elapsed = 0;
    const interval = setInterval(() => {
      const detected =
        document.documentElement.dataset.raraExtension === "true";
      if (detected) {
        console.log("[RegisterButton] Extension 감지됨");
        setExtensionInstalled(true);
        clearInterval(interval);
        return;
      }
      elapsed += 100;
      if (elapsed >= 3000) {
        console.log("[RegisterButton] Extension 미감지 (3초 타임아웃)");
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 버튼 상태 결정 — michael
  useEffect(() => {
    if (buttonState === "running") return;
    if (!extensionInstalled) {
      setButtonState("not-installed");
    } else if (selectedCount === 0) {
      setButtonState("no-courses");
    } else {
      setButtonState("ready");
    }
  }, [extensionInstalled, selectedCount, buttonState]);

  const handleClick = useCallback(() => {
    if (buttonState === "not-installed") {
      setShowInstallGuide(true);
      return;
    }
    if (buttonState !== "ready") return;

    setButtonState("running");

    // localStorage에서 직접 파싱하여 선택된 과목 추출 — michael
    try {
      const raw = localStorage.getItem("timetable-storage");
      if (!raw) {
        console.error("[RegisterButton] timetable-storage 없음");
        setButtonState("ready");
        return;
      }

      const parsed = JSON.parse(raw) as {
        state: { _selectedCourses: Array<{ id: string; name: string; area: string }> };
      };
      const courses: MacroCourse[] = parsed.state._selectedCourses.map((c) => ({
        siteId: c.id.replace("s-", ""),
        name: c.name,
        area: c.area,
      }));

      const names = courses.map((c) => c.name);
      console.log(
        `[RegisterButton] 수강신청 시작 - ${courses.length}개 과목: [${names.join(", ")}]`
      );

      window.postMessage(
        {
          type: "RARA_START_REGISTRATION",
          source: "rarahome",
          courses,
        },
        "*"
      );
    } catch (err) {
      console.error("[RegisterButton] localStorage 파싱 실패:", err);
      setButtonState("ready");
      return;
    }

    // 5초 후 running 상태 자동 해제 (Extension이 별도 응답을 보내지 않을 경우 대비) — michael
    setTimeout(() => {
      setButtonState((prev) => (prev === "running" ? "ready" : prev));
    }, 5000);
  }, [buttonState]);

  const baseClasses =
    "w-full rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";

  const renderButton = () => {
    switch (buttonState) {
      case "not-installed":
        return (
          <button
            onClick={handleClick}
            className={`${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600`}
          >
            <span className="block">Extension 설치 필요</span>
            <span className="block text-xs mt-0.5 text-blue-500 underline">
              설치 방법 보기
            </span>
          </button>
        );

      case "no-courses":
        return (
          <button
            disabled
            className={`${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed`}
          >
            과목을 먼저 선택하세요
          </button>
        );

      case "ready":
        return (
          <button
            onClick={handleClick}
            className={`${baseClasses} bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow focus:ring-blue-500`}
          >
            {"\uD83D\uDE80"} 수강신청 실행 ({selectedCount}개)
          </button>
        );

      case "running":
        return (
          <button
            disabled
            className={`${baseClasses} bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed flex items-center justify-center gap-2`}
          >
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            진행 중...
          </button>
        );
    }
  };

  return (
    <div className="mt-3">
      {renderButton()}

      {/* 설치 방법 인라인 모달 — michael */}
      {showInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Chrome Extension 설치 방법
              </h3>
              <button
                onClick={() => setShowInstallGuide(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="닫기"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <a
              href="/rara-extension.zip"
              download
              className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Extension 다운로드 (.zip)
            </a>
            <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>위 버튼으로 ZIP 다운로드 후 압축 해제</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Chrome{" "}
                  <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    chrome://extensions
                  </code>{" "}
                  접속
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>우측 상단 &quot;개발자 모드&quot; 켜기</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <span>&quot;압축 해제된 확장 프로그램 로드&quot; 클릭</span>
              </li>
              <li className="flex gap-2">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                  5
                </span>
                <span>압축 해제된 폴더 선택</span>
              </li>
            </ol>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="mt-5 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
