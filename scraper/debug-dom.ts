// DOM 구조 분석용 디버그 스크립트
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function debugDom() {
  const browser = await chromium.launch({ headless: true, slowMo: 500 });
  const page = await browser.newPage();
  const debugDir = join(process.cwd(), "scraper", "data");
  mkdirSync(debugDir, { recursive: true });

  try {
    // Step 1: 진입
    await page.goto("https://afteredu.kr/R1176782B0DDF4", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log("Step1 URL:", page.url());

    // Step 2: 수강신청 확인 클릭
    await page.click("text=수강신청 확인");
    await page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log("Step2 URL:", page.url());

    // subscribe0.asp HTML 저장
    const html0 = await page.content();
    writeFileSync(join(debugDir, "subscribe0.html"), html0);
    console.log("subscribe0.html 저장 완료 (크기:", html0.length, "bytes)");

    // 모든 클릭 가능한 요소 목록
    const clickables = await page.$$eval("a, button, [onclick], [class*='tab'], [class*='area'], [class*='menu']", els =>
      els.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 60),
        href: (el as HTMLAnchorElement).href,
        onclick: el.getAttribute("onclick"),
        className: el.className,
        id: el.id,
      })).filter(el => el.text && el.text.length > 0)
    );
    console.log("\n=== 클릭 가능한 요소들 ===");
    clickables.forEach((el, i) => console.log(`[${i}]`, JSON.stringify(el)));
    writeFileSync(join(debugDir, "clickables.json"), JSON.stringify(clickables, null, 2));

    // 영역 관련 텍스트 포함 요소
    console.log("\n=== '영역' 포함 요소들 ===");
    const areaEls = await page.$$eval("*", els =>
      els
        .filter(el => el.textContent?.includes("영역") && el.children.length === 0)
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 80),
          className: el.className,
          id: el.id,
          onclick: el.getAttribute("onclick"),
          href: (el as HTMLAnchorElement).href,
          parentTag: el.parentElement?.tagName,
          parentClass: el.parentElement?.className,
        }))
    );
    areaEls.forEach((el, i) => console.log(`[${i}]`, JSON.stringify(el)));
    writeFileSync(join(debugDir, "area-elements.json"), JSON.stringify(areaEls, null, 2));

    // 첫 번째 영역 클릭 시도 (기타영역)
    console.log("\n=== 기타영역 클릭 시도 ===");
    // 가장 유력한 셀렉터들 시도
    const selectors = [
      "text=기타영역",
      "a:has-text('기타')",
      "li:has-text('기타영역')",
      "td:has-text('기타영역')",
      "span:has-text('기타영역')",
    ];
    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      console.log(`  "${sel}" → ${count}개 발견`);
    }

    // 실제 기타영역 요소 클릭
    const areaEl = page.locator("text=기타영역").first();
    if (await areaEl.count() > 0) {
      await areaEl.click().catch(e => console.log("클릭 실패:", e.message));
      await page.waitForTimeout(3000);
      const html1 = await page.content();
      writeFileSync(join(debugDir, "after-area-click.html"), html1);
      console.log("after-area-click.html 저장");

      // 과목 카드/아코디언 관련 요소
      const courseEls = await page.$$eval("*", els =>
        els
          .filter(el => {
            const t = el.textContent?.trim() ?? "";
            return (t.includes("강사") || t.includes("수업일시") || t.includes("정원")) && el.children.length < 5;
          })
          .slice(0, 20)
          .map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().slice(0, 100),
            className: el.className,
            id: el.id,
          }))
      );
      console.log("\n=== 과목 관련 요소들 ===");
      courseEls.forEach((el, i) => console.log(`[${i}]`, JSON.stringify(el)));
      writeFileSync(join(debugDir, "course-elements.json"), JSON.stringify(courseEls, null, 2));

      // 토글/아코디언 버튼 찾기
      const toggleEls = await page.$$eval("button, [onclick], summary, [class*='toggle'], [class*='btn'], [class*='more']", els =>
        els.slice(0, 30).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().slice(0, 60),
          className: el.className,
          onclick: el.getAttribute("onclick"),
        })).filter(el => el.text)
      );
      console.log("\n=== 토글/버튼 요소들 ===");
      toggleEls.forEach((el, i) => console.log(`[${i}]`, JSON.stringify(el)));
      writeFileSync(join(debugDir, "toggle-elements.json"), JSON.stringify(toggleEls, null, 2));
    }

  } finally {
    await browser.close();
    console.log("\n디버그 완료. scraper/data/ 폴더의 JSON/HTML 파일을 확인하세요.");
  }
}

debugDom().catch(err => {
  console.error("오류:", err);
  process.exit(1);
});
