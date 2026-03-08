# 수강신청 매크로 기획서

## 핵심 목표

> **/macro 페이지에서 시간표를 짜고 "수강신청 실행" → afteredu 탭이 열리며 그 안에서 자동 진행**

- `/` (일반 공유용): 시간표 뷰어만. 매크로 버튼 없음
- `/macro` (개인 전용): 시간표 뷰어 + "수강신청 실행" 버튼 포함
- 수강신청 기간 전에도 버튼이 존재해야 함 (시뮬레이션/준비 목적)
- afteredu 탭이 열리면 그 탭에서 신청이 진행되는 걸 사용자가 확인
- 결과는 afteredu 탭에서 확인 (rarahome으로 결과 역전송 불필요)

---

## 왜 Chrome Extension이어야 하는가

일반 웹앱은 다른 도메인의 탭을 열어 그 안에서 버튼을 클릭하는 것이 불가 (Same-Origin Policy).
Extension만이 `chrome.tabs.create` + content script 주입으로 afteredu 탭을 직접 조작 가능.

---

## 자동화 방식: JavaScript DOM 조작 (마우스 미사용)

### 커서는 움직이지 않는다

Extension content script는 **JavaScript로 DOM을 직접 조작**한다.
실제 마우스 커서를 움직이거나 클릭하는 것이 아님.

```
Playwright/Selenium   →  OS 레벨 마우스 이동 + 클릭 시뮬레이션  →  커서가 실제로 움직임
Chrome Extension      →  element.click() JS 호출               →  커서 전혀 안 움직임
```

### 동작 특성

| 항목 | 내용 |
|------|------|
| 마우스 커서 | 움직이지 않음 |
| 브라우저 창 포커스 | 불필요 (탭이 백그라운드여도 동작) |
| 실행 속도 | 매우 빠름 (딜레이는 의도적으로 삽입) |
| 사용자 입력처럼 보이는가 | 아니오 — `isTrusted: false` |

### isTrusted 문제

브라우저는 사람이 직접 클릭한 이벤트에 `isTrusted: true`를 붙이고,
`element.click()`으로 발생한 이벤트에는 `isTrusted: false`를 붙임.

일부 사이트는 이를 체크해 봇 클릭을 거부함.

**afteredu(w2.afteredu.kr) 대응 방침:**
- 학교 방과후 신청 사이트 수준에서는 isTrusted 검사를 하지 않을 가능성이 높음
- Phase 1 역공학 분석 시 `send()` 함수 내부에서 `event.isTrusted` 체크 여부 확인 필수
- 만약 체크한다면: `InputEvent`, `PointerEvent`를 직접 생성해 `dispatchEvent()`로 우회 가능
  (이 방식도 Extension content script에서 완전히 가능)

---

## 라우트 구조

```
rarahome.vercel.app/          → 일반 시간표 뷰어 (공유용, 매크로 없음)
rarahome.vercel.app/macro     → 매크로 전용 페이지 (개인용)
```

`/macro`는 별도 Next.js 페이지(`app/macro/page.tsx`)로 구현.
일반 뷰어와 동일한 시간표 기능에 "수강신청 실행" 버튼만 추가.
URL을 모르면 접근 불가 — 별도 인증 불필요 (obscurity로 충분).

---

## 전체 흐름

```
[rarahome.vercel.app/macro]
──────────────────────────────────────────────
  시간표에서 과목 선택 완료
  "수강신청 실행" 버튼 클릭
        │
        │ window.postMessage({
        │   type: "RARA_START_REGISTRATION",
        │   courses: [{siteId, name, area}, ...]
        │ })
        ▼

[content-rarahome.js — /macro 페이지에 주입됨]
──────────────────────────────────────────────
  postMessage 수신
  localStorage에서 _selectedCourses 상세 보강
        │
        │ chrome.runtime.sendMessage(courses 목록)
        ▼

[background.js — Service Worker]
──────────────────────────────────────────────
  chrome.tabs.create({
    url: "https://w2.afteredu.kr/subscribe0.asp"
  })
        │
        │ 탭 로드 완료 후 content-afteredu.js에 courses 전달
        ▼

[content-afteredu.js — afteredu 탭에서 실행]
──────────────────────────────────────────────
  사용자가 afteredu 탭을 보는 상태에서 자동 진행:

  로그인 상태 확인 (미로그인 시 alert 후 중단)

  영역별 그룹화 후 순서대로:
    1. class_list(areaName) → 영역 페이지 이동
    2. send('siteId','') 버튼 탐색 및 클릭
    3. confirm 팝업 자동 처리
    4. 결과 페이지/메시지 확인
    5. 1~2초 랜덤 딜레이

  진행 상황을 afteredu 페이지 상단에 오버레이로 표시:
    ┌──────────────────────────┐
    │ 🤖 수강신청 자동 진행 중  │
    │ ✅ 과학실험A — 완료       │
    │ ⏳ 로봇제작1A — 처리 중   │
    │ ─ 태권도B — 대기          │
    └──────────────────────────┘

  모든 신청 완료 후 오버레이 최종 결과로 업데이트
```

---

## 프로젝트 구조

```
rarahome/
├── app/
│   ├── page.tsx               # 기존 일반 뷰어 (변경 없음)
│   └── macro/
│       └── page.tsx           # 신규: 매크로 전용 페이지 (동일 뷰어 + 버튼)
├── components/
│   └── macro/
│       └── RegisterButton.tsx # "수강신청 실행" 버튼 컴포넌트
├── extension/
│   ├── manifest.json
│   ├── background.js
│   ├── content-rarahome.js    # /macro 페이지 전용 주입
│   └── content-afteredu.js   # afteredu 탭 자동화
└── docs/
    └── macro-plan.md
```

---

## /macro 페이지 UI

일반 뷰어와 동일하되, SelectedCourses 사이드바 하단에 추가:

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
│                              │
│  ┌──────────────────────┐   │
│  │ 🚀 수강신청 실행      │   │  ← 항상 표시 (기간 외에도)
│  └──────────────────────┘   │
│                              │
│  Extension 미설치 시:        │
│  "Extension 설치 필요"       │
│  [설치 방법 보기]            │
└─────────────────────────────┘
```

### "수강신청 실행" 버튼 상태

| 상태 | 버튼 표시 | 클릭 시 |
|------|-----------|---------|
| Extension 미설치 | 버튼 비활성 + 설치 안내 | 설치 방법 모달 |
| Extension 설치됨 + 과목 선택 없음 | 버튼 비활성 | 무반응 |
| Extension 설치됨 + 과목 선택됨 | 버튼 활성 (파란색) | afteredu 탭 열기 + 자동화 시작 |
| 자동화 진행 중 | 버튼 비활성 + "진행 중..." | 무반응 |

### Extension 설치 여부 감지
content-rarahome.js가 /macro 페이지 로드 시
`document.documentElement.dataset.raraExtension = "true"` 주입
→ RegisterButton 컴포넌트가 이 속성 존재 여부로 설치 상태 판단

---

## Simulation 모드

수강신청 기간이 아닐 때 버튼을 눌러도 동일하게 afteredu 탭이 열리고
content-afteredu.js가 신청 버튼을 탐색함.

- 버튼이 존재하지 않으면 → "신청 버튼 없음 (기간 외 또는 마감)" 오버레이 표시
- 버튼이 있으면 (기간 중) → 실제 신청 진행
- 별도 dry-run 플래그 없이 그냥 실행하면 됨 (버튼 없으면 아무 일 없음)

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
      "matches": ["https://rarahome.vercel.app/macro*"],
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

content-rarahome.js는 `/macro` 경로에만 주입 (일반 `/` 경로 제외).

---

## afteredu 탭 오버레이 UI (content-afteredu.js가 주입)

```
페이지 상단 고정 오버레이 (z-index: 99999):

┌────────────────────────────────────────┐
│ 🤖 서이초 수강신청 자동화              │
├────────────────────────────────────────┤
│ ✅ 과학실험A          신청 완료        │
│ ✅ 로봇제작1A         신청 완료        │
│ ❌ 브레인체스A        마감             │
│ ⏳ 태권도B            처리 중...       │
└────────────────────────────────────────┘
```

사용자가 afteredu 탭에서 자동화 진행 상황을 실시간으로 확인.
rarahome으로 결과를 되돌려 보내지 않음.

---

## afteredu 사이트 분석 (구현 전 필수 확인)

### 이미 파악된 것 (스크래퍼에서 확인)
- 영역 이동: `class_list(areaName)` JS 함수 호출
- 과목 ID: `send('siteId','')` onclick 속성
- DOM: `ul.application_list li > div.box_raund`

### 추가로 확인해야 할 것

- [ ] `send()` 함수 정체 — form submit? fetch? location 변경?
      → Network 탭에서 실제 신청 버튼 클릭 시 확인
- [ ] 신청 완료 판별 — 성공 메시지 텍스트 or URL 변경 패턴
- [ ] 이미 신청된 과목 — 버튼 상태 변화
- [ ] 마감 과목 — 버튼 없음? 텍스트 변경?
- [ ] confirm 팝업 — `window.confirm` 오버라이드 자동 처리 가능 여부
- [ ] 신청 기간 외 — 버튼 자체가 없는지, disabled인지

---

## 에러 처리 (afteredu 탭 오버레이에 표시)

| 상황 | 처리 |
|------|------|
| 미로그인 | 즉시 중단 + "로그인 후 다시 시도하세요" |
| 마감 과목 | 스킵 + ❌ 마감 |
| 이미 신청됨 | 스킵 + ⚠️ 이미 신청됨 |
| 신청 버튼 없음 (기간 외) | 스킵 + ❓ 버튼 없음 |
| 네트워크 오류 | 1회 재시도 후 ❌ 오류 |

---

## 구현 순서

### Phase 1 — afteredu 신청 흐름 역공학 (선행 필수)
- 실제 신청 버튼 클릭 → Network 탭 분석
- `send()` 함수 구조 파악
- 성공/실패/마감 판별 로직 확정

### Phase 2 — Next.js /macro 페이지
- `app/macro/page.tsx` 생성 (일반 뷰어 복사 + 버튼 추가)
- `components/macro/RegisterButton.tsx` (Extension 감지 + postMessage)

### Phase 3 — Chrome Extension 뼈대
- `manifest.json`
- `content-rarahome.js`: postMessage 수신 → background로 전달
- `background.js`: 탭 생성 + courses 전달

### Phase 4 — afteredu 자동화
- `content-afteredu.js`: 오버레이 UI + 신청 자동화 로직

---

## 제약 사항

- Chrome 전용 (Edge 호환, Firefox 미지원)
- `/macro` URL을 아는 사람만 접근 가능 (별도 인증 없음)
- Extension은 개발자 모드로 수동 설치 (`extension/` 폴더 로드)
- afteredu 로그인은 사용자가 직접 수행
- afteredu 사이트 구조 변경 시 `content-afteredu.js` 재분석 필요
- 수강신청 기간 외에는 실제 신청 불가 (시뮬레이션은 가능)
