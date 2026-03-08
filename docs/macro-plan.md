# 수강신청 매크로 기획서

## 개요

시간표 뷰어에서 선택한 과목들을 w2.afteredu.kr에 자동으로 수강신청하는 매크로.
**전제**: 사용자가 직접 브라우저에서 로그인된 상태여야 함 (세션 공유 방식).

---

## 방식 비교 및 선택

| 방식 | 장점 | 단점 | 추천도 |
|------|------|------|--------|
| **A. Playwright + 기존 Chrome 프로필** | 현재 scraper 코드 재사용, 로그인 세션 공유 | Node.js 실행 환경 필요, 사용자가 터미널 실행 | ★★★★☆ |
| B. Chrome 확장(Extension) | 브라우저 내에서 직접 실행, 세션 자동 공유 | 별도 설치 필요, 개발 복잡도 높음 | ★★★☆☆ |
| C. 북마클릿(Bookmarklet) | 설치 불필요, 브라우저에서 바로 실행 | 코드 크기 제한, 유지보수 어려움 | ★★☆☆☆ |
| D. Next.js API + 서버 Puppeteer | 완전 자동화 가능 | 서버에서 세션 재현 불가 (쿠키 전달 필요) | ★★☆☆☆ |

**→ A. Playwright + 기존 Chrome 프로필 채택**
이미 `scraper/scrape-courses.ts`에 Playwright 코드가 있으므로 구조 재사용 가능.

---

## 아키텍처

```
rarahome/
├── scraper/
│   ├── scrape-courses.ts        # 기존 스크래퍼
│   └── register-courses.ts      # 신규: 수강신청 매크로 (구현 대상)
├── docs/
│   └── macro-plan.md            # 이 파일
└── package.json                 # "register" 스크립트 추가 예정
```

---

## 데이터 흐름

```
[시간표 뷰어 - 과목 선택]
        ↓
[localStorage: selectedIds = Set<"s-1283046", ...>]
        ↓
[매크로 실행: npx tsx scraper/register-courses.ts]
        ↓
[courses.json에서 selectedIds와 매칭 → 신청할 과목 목록 확정]
        ↓
[Playwright: 기존 Chrome 프로필 열기 (로그인 세션 유지)]
        ↓
[w2.afteredu.kr 접속 → 각 과목 신청 버튼 클릭]
        ↓
[결과 리포트 출력]
```

---

## 입력: 선택된 과목 ID 전달 방법 (2가지 옵션)

### 옵션 1: 파일 경유 (권장)
1. 시간표 뷰어에 "수강신청 목록 내보내기" 버튼 추가
2. 클릭 시 `selected-courses.json` 다운로드
3. 매크로가 해당 파일을 읽어 신청 대상 결정

```json
// selected-courses.json (예시)
{
  "exportedAt": "2026-03-09T12:00:00",
  "courses": [
    { "id": "s-1283046", "name": "과학실험A", "days": ["WED"], "startTime": "13:10" },
    { "id": "s-1283052", "name": "로봇제작1A", "days": ["MON"], "startTime": "13:30" }
  ]
}
```

### 옵션 2: CLI 인수
```bash
npx tsx scraper/register-courses.ts --ids s-1283046,s-1283052
```

---

## 수강신청 사이트 분석 (필요한 역공학 작업)

> **주의**: 구현 전 아래 항목을 직접 분석해야 함.

### 1. 신청 버튼 DOM 구조 파악
- 현재 스크래퍼에서 파악한 과목 ID: `send('ID','')` onclick 속성에서 추출
- 신청 버튼이 `send()` 함수를 호출하는 것으로 추정
- 실제 `send()` 함수가 무엇을 하는지 (form submit? fetch?) 확인 필요

### 2. 신청 흐름 파악
예상 흐름 (확인 필요):
```
subscribe0.asp (영역 선택)
  → subscribe1.asp (과목 목록)
    → [신청 버튼 클릭]
      → 확인 팝업 또는 페이지 이동
        → 완료 메시지
```

### 3. 확인 필요 항목
- [ ] 로그인 상태 확인 방법 (리다이렉트 URL, 쿠키명)
- [ ] 신청 버튼 클릭 후 실제 HTTP 요청 (Network 탭으로 확인)
- [ ] 중복 신청 시 에러 메시지
- [ ] 마감된 과목 신청 시 응답
- [ ] CSRF 토큰 존재 여부

---

## 매크로 실행 시나리오

### 정상 흐름
1. `selected-courses.json` 로드
2. Chrome 기존 프로필로 브라우저 실행 (`--user-data-dir` 옵션)
3. w2.afteredu.kr 접속 → 로그인 상태 확인
4. 미로그인 시: 로그인 페이지 대기 (사용자가 수동 로그인 후 계속)
5. 각 과목 순서대로:
   - 해당 영역 페이지로 이동
   - 과목 ID로 신청 버튼 찾기
   - 클릭 → 확인 → 결과 기록
6. 결과 요약 출력

### 에러 처리 시나리오
| 상황 | 처리 |
|------|------|
| 이미 신청됨 | 스킵 + 로그 |
| 마감 (잔여 0) | 경고 + 스킵 |
| 네트워크 오류 | 3회 재시도 |
| 로그인 만료 | 중단 + 사용자 안내 |
| 예상치 못한 팝업 | 스크린샷 저장 + 중단 |

---

## 신중히 고려할 사항

### 기술적 리스크
- **봇 감지**: 너무 빠른 클릭은 차단될 수 있음 → 각 신청 사이 1~3초 랜덤 딜레이 필요
- **세션 만료**: 장시간 대기 후 신청 시 로그인이 풀릴 수 있음
- **수강신청 기간**: 신청 기간이 아닐 때는 버튼 자체가 없음

### 윤리적 고려
- 이 매크로는 **단일 사용자(학부모 본인)**의 신청을 자동화하는 것
- 다수 계정 동시 신청이나 시스템 과부하 유발 목적이 아님
- 수강신청 오픈 시 빠르게 클릭하기 어려운 상황(이동 중 등)을 보조하는 용도

---

## 구현 순서 (우선순위)

1. **Phase 1**: 사이트 신청 흐름 역공학 분석 (`debug-register.ts` 작성)
   - 신청 버튼 DOM 확인
   - 신청 후 HTTP 요청/응답 확인
   - 결과 판정 로직 파악

2. **Phase 2**: 핵심 신청 함수 구현 (`register-courses.ts`)
   - Chrome 프로필 연동
   - 단일 과목 신청 함수
   - 로그인 상태 확인

3. **Phase 3**: 시간표 뷰어 연동
   - "수강신청 목록 내보내기" 버튼 (UI)
   - `selected-courses.json` 생성 로직

4. **Phase 4**: 결과 리포트
   - 터미널 출력
   - 결과 JSON 저장

---

## package.json 추가 스크립트 (예정)

```json
{
  "scripts": {
    "register": "npx tsx scraper/register-courses.ts",
    "register:dry": "npx tsx scraper/register-courses.ts --dry-run"
  }
}
```

`--dry-run`: 실제 클릭 없이 신청 대상 목록만 출력 (검증용)

---

## 제약 사항 정리

- 매크로는 **로컬 실행 전용** (Vercel 배포 불포함)
- Chrome 브라우저 + Playwright 설치 필요
- 수강신청 기간 중에만 유효
- 과목 ID(`s-{siteId}`)는 스크래퍼 실행 시점 기준 → 신청 기간 직전 재스크래핑 권장
