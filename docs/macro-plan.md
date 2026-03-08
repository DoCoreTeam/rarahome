# 수강신청 매크로 기획서

## 핵심 목표

> **rarahome.vercel.app에서 "수강신청 실행" 버튼 클릭 → afteredu 탭이 열리며 자동 신청 완료**

사용자가 터미널, 파일 내보내기, Extension 팝업을 따로 열 필요 없이
**뷰어 안의 버튼 하나로 모든 것이 끝나야 한다.**

---

## 왜 Chrome Extension이어야 하는가

브라우저 보안 정책(Same-Origin Policy)상, 일반 웹앱(rarahome)은
다른 도메인(afteredu)의 탭을 열어 그 안에서 버튼을 클릭하는 것이 **원천 불가**.

| 방법 | "버튼 클릭 → afteredu 자동화" 가능 여부 |
|------|-----------------------------------------|
| 일반 웹앱 fetch | ❌ CORS 차단 |
| window.open | ❌ 탭만 열림, 조작 불가 |
| 로컬 서버 (localhost API) | △ 가능하지만 항상 서버 켜야 함 |
| **Chrome Extension** | ✅ 탭 생성 + 스크립트 주입 + 세션 공유 모두 가능 |

---

## 전체 흐름

```
[rarahome.vercel.app]
──────────────────────────────────────────────
  시간표에서 과목 선택 완료
  사이드바: "수강신청 실행" 버튼 클릭
        │
        │ window.postMessage({
        │   type: "RARA_START_REGISTRATION",
        │   courseIds: ["s-1283046", "s-1283052"]
        │ })
        ▼

[content-rarahome.js — rarahome 페이지에 주입됨]
──────────────────────────────────────────────
  window 메시지 수신
  localStorage에서 _selectedCourses 상세 정보 보강
        │
        │ chrome.runtime.sendMessage({
        │   type: "START_REGISTRATION",
        │   courses: [{id, name, area, siteId}, ...]
        │ })
        ▼

[background.js — Service Worker]
──────────────────────────────────────────────
  메시지 수신
  chrome.tabs.create({
    url: "https://w2.afteredu.kr/subscribe0.asp"
  })
        │
        │ 탭 로드 완료 후 courses 목록 전달
        ▼

[content-afteredu.js — afteredu 탭에 주입됨]
──────────────────────────────────────────────
  로그인 상태 확인 (미로그인 시 중단 + 알림)

  영역별 그룹화:
    기타영역: [과학실험A(1283046), 로봇제작1A(1283052)]
    체육영역: [태권도(1283070)]

  각 과목 순서대로:
    1. class_list(areaName) 호출 → 영역 페이지 이동
    2. send('siteId','') 버튼 탐색
    3. 클릭 → confirm 팝업 자동 확인
    4. 성공/마감/이미신청 판별
    5. 1~2초 랜덤 딜레이 후 다음 과목
        │
        │ chrome.runtime.sendMessage({ type: "RESULT", results: [...] })
        ▼

[background.js → content-rarahome.js → rarahome 페이지]
──────────────────────────────────────────────
  결과를 rarahome UI에 표시:
    ✅ 과학실험A — 신청 완료
    ✅ 로봇제작1A — 신청 완료
    ❌ 브레인체스A — 마감 (잔여 0석)
```

---

## 프로젝트 구조

```
rarahome/
├── extension/
│   ├── manifest.json              # Manifest V3
│   ├── background.js              # Service Worker: 탭 관리, 메시지 라우팅
│   ├── content-rarahome.js        # rarahome 주입: 버튼 메시지 수신, 결과 표시
│   └── content-afteredu.js       # afteredu 주입: 실제 신청 자동화
├── components/
│   └── sidebar/
│       └── SelectedCourses.tsx    # "수강신청 실행" 버튼 추가 예정
└── docs/
    └── macro-plan.md
```

Extension 파일은 별도 빌드 없이 순수 JS로 작성.
`extension/` 폴더를 Chrome에 "압축 해제된 확장 프로그램 로드"로 설치.

---

## rarahome UI 변경 계획

### SelectedCourses 사이드바 하단에 추가

```
┌─────────────────────────────┐
│  선택한 과목 (3개)    초기화 │
├─────────────────────────────┤
│  과학실험A  수 13:10  ×      │
│  로봇제작1A 월 13:30  ×      │
│  태권도B    금 14:00  ×      │
├─────────────────────────────┤
│  월 수강료       ₩96,000    │
│  교재비          ₩131,000   │
│  합계            ₩227,000   │
├─────────────────────────────┤
│  [이미지 저장]               │
│  [🚀 수강신청 실행]          │  ← 신규
└─────────────────────────────┘
```

### "수강신청 실행" 버튼 동작

- Extension 미설치 상태: 버튼 클릭 시 "Extension을 먼저 설치해주세요" 안내 + 설치 방법 링크
- Extension 설치 상태: `window.postMessage`로 신청 시작 신호 전송
- Extension 설치 여부 감지: content script가 페이지에 `data-rara-extension="true"` 속성 주입 → 버튼이 이를 확인

---

## manifest.json 핵심 설정

```json
{
  "manifest_version": 3,
  "name": "서이초 방과후 수강신청 도우미",
  "version": "1.0.0",
  "permissions": ["tabs", "scripting"],
  "host_permissions": [
    "https://rarahome.vercel.app/*",
    "https://w2.afteredu.kr/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://rarahome.vercel.app/*"],
      "js": ["content-rarahome.js"],
      "run_at": "document_end"
    },
    {
      "matches": ["https://w2.afteredu.kr/*"],
      "js": ["content-afteredu.js"],
      "run_at": "document_end"
    }
  ]
}
```

---

## 데이터 구조 (Extension 내부 전달 메시지)

```js
// rarahome → background (신청 시작)
{
  type: "START_REGISTRATION",
  courses: [
    { siteId: "1283046", name: "과학실험A", area: "기타영역" },
    { siteId: "1283052", name: "로봇제작1A", area: "기타영역" },
    { siteId: "1283070", name: "태권도B",   area: "체육영역" }
  ]
}

// content-afteredu → background (결과)
{
  type: "REGISTRATION_RESULT",
  results: [
    { siteId: "1283046", name: "과학실험A", status: "success" },
    { siteId: "1283052", name: "로봇제작1A", status: "success" },
    { siteId: "1283070", name: "태권도B",   status: "closed" }
  ]
}

// status 값: "success" | "already" | "closed" | "error"
```

---

## afteredu 사이트 분석 (구현 전 필수 확인)

### 이미 파악된 것 (스크래퍼에서 확인)
- 영역 이동: `class_list(areaName)` JS 함수 호출
- 과목 ID: 각 과목 `send('siteId','')` onclick 속성
- DOM: `ul.application_list li > div.box_raund`

### 추가로 확인해야 할 것

- [ ] `send()` 함수 정체 — form submit인가, fetch인가, location 변경인가
      → 브라우저 개발자도구 Network 탭에서 실제 신청 버튼 클릭 시 확인
- [ ] 신청 완료 판별 — 성공 메시지 텍스트 or URL 변경 패턴
- [ ] 이미 신청된 과목 — 버튼 숨김? disabled? 다른 텍스트?
- [ ] 마감 과목 — 버튼 없음? 텍스트 변경?
- [ ] confirm 팝업 — `window.confirm()` 오버라이드로 자동 확인 가능 여부
- [ ] CSRF 토큰 — hidden input 존재 여부

---

## 에러 처리

| 상황 | content-afteredu.js 처리 | rarahome 표시 |
|------|--------------------------|---------------|
| 미로그인 | 즉시 중단 | "먼저 afteredu에 로그인하세요" |
| 마감 과목 | 스킵 | ❌ 과목명 — 마감 |
| 이미 신청됨 | 스킵 | ⚠️ 과목명 — 이미 신청됨 |
| 신청 버튼 없음 | 스킵 | ❓ 과목명 — 버튼 미발견 |
| 네트워크 오류 | 1회 재시도 | ❌ 과목명 — 오류 |

---

## 구현 순서

### Phase 1 — afteredu 신청 흐름 역공학 (선행 필수)
- 실제 수강신청 버튼 클릭 → Network 탭 분석
- `send()` 함수 구조 파악
- 성공/실패/마감 판별 로직 확정

### Phase 2 — Extension 뼈대
- `manifest.json`
- `content-rarahome.js`: postMessage 수신 + 결과 표시
- `background.js`: 탭 생성 + 메시지 라우팅

### Phase 3 — afteredu 자동화
- `content-afteredu.js`: 영역 이동 + 신청 버튼 클릭 + 결과 반환
- 단일 과목 신청 함수 → 전체 목록 순환

### Phase 4 — rarahome UI 연동
- "수강신청 실행" 버튼 (SelectedCourses.tsx)
- Extension 설치 여부 감지
- 결과 표시 UI

---

## 제약 사항

- Chrome 전용 (Edge 호환, Firefox 미지원)
- 사용자가 `extension/` 폴더를 Chrome에 수동 설치해야 함
- afteredu 로그인은 사용자가 직접 (자동 로그인 미포함)
- 수강신청 기간 외에는 신청 버튼 자체가 없음 → 기간 오픈 시 실사용 테스트 필요
- afteredu 사이트 구조 변경 시 `content-afteredu.js` 재분석 필요
