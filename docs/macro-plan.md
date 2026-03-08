# 수강신청 매크로 기획서

## 핵심 목표

> **rarahome.vercel.app에서 시간표를 짠 다음, 버튼 하나로 w2.afteredu.kr에 수강신청 자동 완료**

사용자가 터미널을 열거나 파일을 내보낼 필요 없이, 브라우저 안에서 모든 것이 끝나야 한다.

---

## 방식 비교 및 최종 선택

| 방식 | 뷰어→매크로 연동 | 설치 난이도 | 세션 공유 | 추천도 |
|------|------|------|------|------|
| **A. Chrome 확장 (Extension)** | 버튼 1클릭 | 개발자 모드 설치 | 자동 (같은 브라우저) | ★★★★★ |
| B. Playwright + CLI | JSON 내보내기 → 터미널 | Node.js 환경 필요 | Chrome 프로필 재사용 | ★★★☆☆ |
| C. 로컬 API 서버 | fetch 호출 가능 | 항상 서버 켜야 함 | 쿠키 전달 복잡 | ★★☆☆☆ |
| D. Vercel API + Puppeteer | 완전 자동 | 서버리스 제약 큼 | 불가 | ★☆☆☆☆ |

**→ A. Chrome Extension 채택**

이유:
- rarahome의 `localStorage`를 content script가 직접 읽을 수 있음
- afteredu 탭에서 이미 로그인된 브라우저 세션을 그대로 사용
- 사용자 입장: "수강신청 시작" 버튼 클릭 → 자동 완료
- 터미널, 파일 내보내기, Node.js 불필요

---

## 전체 아키텍처

```
rarahome.vercel.app                    Chrome Extension                    w2.afteredu.kr
─────────────────────                  ──────────────────                  ──────────────
시간표 선택 완료
        │
        │ content script가
        │ localStorage 읽음
        ▼
timetable-storage.state.selectedIds
= ["s-1283046", "s-1283052", ...]
        │
        │ chrome.runtime.sendMessage
        ▼
  [Extension Popup]
  "수강신청 시작" 버튼
        │
        │ chrome.tabs.create
        ▼
                                       background.js
                                       (service worker)
                                              │
                                              │ 새 탭 열기
                                              ▼
                                                                    subscribe0.asp
                                                                           │
                                                                    content script 주입
                                                                           │
                                                                    각 과목 순서대로:
                                                                    1. class_list(area) 호출
                                                                    2. 과목 ID로 신청 버튼 찾기
                                                                    3. 클릭 → 확인 팝업 처리
                                                                    4. 결과 기록
                                                                           │
                                              │ 결과 수신 ◄───────────────┘
                                              ▼
                                       [Extension Popup]
                                       성공/실패 목록 표시
```

---

## 프로젝트 구조 (신규)

```
rarahome/
├── extension/                        # Chrome Extension 루트
│   ├── manifest.json                 # Manifest V3 설정
│   ├── popup.html                    # 확장 팝업 UI
│   ├── popup.js                      # 팝업 로직 (선택 과목 조회, 신청 시작 버튼)
│   ├── background.js                 # Service Worker (탭 관리, 메시지 라우팅)
│   ├── content-rarahome.js           # rarahome 주입 스크립트 (localStorage 읽기)
│   └── content-afteredu.js          # afteredu 주입 스크립트 (신청 자동화)
├── scraper/
│   └── ...                          # 기존 스크래퍼 (변경 없음)
└── docs/
    └── macro-plan.md
```

---

## Extension 파일별 역할

### `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "서이초 방과후 수강신청 도우미",
  "permissions": ["storage", "tabs", "scripting", "activeTab"],
  "host_permissions": [
    "https://rarahome.vercel.app/*",
    "https://w2.afteredu.kr/*"
  ],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["https://rarahome.vercel.app/*"],
      "js": ["content-rarahome.js"]
    }
  ]
}
```

### `content-rarahome.js` (rarahome 페이지에 자동 주입)
- `localStorage.getItem("timetable-storage")` 파싱
- `state.selectedIds` (배열) + `state._selectedCourses` (과목 상세) 추출
- Extension popup에서 `chrome.tabs.sendMessage`로 요청하면 응답

### `popup.js` (Extension 팝업)
- 현재 탭이 rarahome이면 → content script에서 선택 과목 조회
- 과목 목록 표시 (이름, 요일, 시간)
- "수강신청 시작" 버튼 → background로 메시지 전송

### `background.js` (Service Worker)
- popup에서 신청 요청 수신
- `chrome.tabs.create({ url: "https://w2.afteredu.kr/subscribe0.asp" })`
- 탭 로드 완료 후 `content-afteredu.js` 실행 + 과목 목록 전달
- 결과 수집 후 popup에 전달

### `content-afteredu.js` (afteredu 페이지 자동화)
- background에서 전달받은 과목 ID 목록으로 신청 순서 결정
- 각 과목별:
  1. `class_list(areaName)` 호출로 영역 페이지 이동 (기존 스크래퍼 분석 결과 활용)
  2. 과목 ID 매칭: `send('${siteId}','')` 버튼 탐색
  3. 버튼 클릭 → confirm 팝업 자동 확인
  4. 성공/실패/마감 결과 기록
  5. 다음 과목 전 1~2초 랜덤 딜레이

---

## 데이터 흐름 (상세)

### 1단계: 선택 과목 읽기
```
rarahome localStorage:
{
  "state": {
    "selectedIds": ["s-1283046", "s-1283052"],
    "_selectedCourses": [
      { "id": "s-1283046", "name": "과학실험A", "area": "기타영역", ... },
      { "id": "s-1283052", "name": "로봇제작1A", "area": "기타영역", ... }
    ]
  }
}
```

### 2단계: 과목 ID → afteredu 사이트 ID 변환
```
"s-1283046" → siteId = "1283046"
신청 버튼: onclick="send('1283046','')"
```
이미 스크래퍼에서 이 ID 추출 방식을 확인 완료.

### 3단계: 영역별 그룹화 후 순서 실행
```
기타영역: [과학실험A(1283046), 로봇제작1A(1283052)]
예술영역: [...]

→ class_list("기타영역") 호출
→ 기타영역 과목 신청 완료
→ class_list("예술영역") 호출
→ ...
```
같은 영역을 한 번에 처리해 페이지 이동 최소화.

---

## 수강신청 사이트 분석 (구현 전 필수 확인)

> 스크래퍼 작성 시 파악한 내용 기반 — 신청 버튼 부분은 추가 분석 필요.

### 이미 파악된 것
- `class_list(areaName)` → 해당 영역 subscribe1.asp로 이동
- 과목 카드: `ul.application_list li > div.box_raund`
- 과목 ID: `send('siteId','')` onclick 속성에서 추출
- 로그인 필요: 미로그인 시 로그인 페이지로 리다이렉트

### 추가 확인 필요
- [ ] `send()` 함수 실제 동작 (form submit? fetch? location.href?)
- [ ] 신청 후 confirm 팝업 메시지 텍스트 ("신청하시겠습니까?" 등)
- [ ] 신청 성공 페이지/메시지 판별 방법
- [ ] 이미 신청된 과목의 버튼 상태 (disabled? 숨김?)
- [ ] CSRF 토큰 존재 여부 (form hidden input 확인)

---

## UI/UX 흐름 (사용자 관점)

```
1. rarahome.vercel.app 접속
2. 시간표에서 원하는 과목 선택 (기존 기능)
3. 수강신청 오픈 시간 대기
4. 오픈되면 Chrome Extension 아이콘 클릭
5. 팝업에서 선택된 과목 목록 확인
6. "수강신청 시작" 버튼 클릭
7. afteredu 탭이 자동으로 열리며 신청 진행
8. 팝업에 결과 표시:
   ✅ 과학실험A — 신청 완료
   ✅ 로봇제작1A — 신청 완료
   ❌ 브레인체스A — 마감 (잔여 0석)
```

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| rarahome 선택 과목 없음 | 팝업에서 안내 메시지 표시 |
| afteredu 미로그인 | 로그인 페이지 감지 → 팝업에 "먼저 로그인하세요" 표시 |
| 마감 과목 | 스킵 + 결과에 ❌ 표시 |
| 이미 신청됨 | 스킵 + 결과에 ⚠️ 표시 |
| 신청 중 네트워크 오류 | 1회 재시도 후 실패 기록 |
| 예상 외 페이지 | 중단 + 현재 URL 리포트 |

---

## 구현 순서

### Phase 1: afteredu 신청 흐름 역공학
- `send()` 함수 분석 (브라우저 개발자도구 → Network 탭)
- 신청 버튼 클릭 시 실제 요청 확인
- 성공/실패/마감 판별 로직 파악

### Phase 2: Extension 뼈대
- `manifest.json` 작성
- `popup.html/js` — rarahome localStorage 읽어서 과목 목록 표시

### Phase 3: 자동화 스크립트
- `content-afteredu.js` — 단일 과목 신청 함수
- `background.js` — 탭 관리 + 메시지 라우팅

### Phase 4: 연결 및 결과 표시
- 전체 흐름 통합 테스트
- 팝업 결과 UI

---

## 제약 사항

- Chrome 브라우저 전용 (Edge도 호환, Firefox는 별도 대응 필요)
- 사용자가 Chrome에 Extension을 수동 설치해야 함 (개발자 모드 또는 Chrome Web Store 등록)
- afteredu 로그인은 사용자가 직접 해야 함 (자동 로그인 불포함)
- 수강신청 기간 외에는 신청 버튼 자체가 없음 → 기간 중 테스트 필요
- afteredu 사이트 구조 변경 시 `content-afteredu.js` 재분석 필요
