# 서이초 방과후 스크래퍼

## 실행 방법

### 1. 의존성 설치
```bash
npm install
npx playwright install chromium
```

### 2. 스크래퍼 실행
```bash
cd /Users/dohyeonkim/dev/rarahome
npx ts-node scraper/scrape-courses.ts
# 또는
npx tsx scraper/scrape-courses.ts
```

### 3. 결과 확인
- 수집된 데이터: `scraper/data/courses.json`

## 주의사항
- 수강신청 기간에만 데이터가 존재함
- 스크래핑 실패 시 `scraper/data/courses.json`에 샘플 데이터가 있으므로 개발 진행 가능
- 실제 사이트 UI 변경 시 셀렉터 수정 필요
