// 서이초등학교 방과후 수강신청 스크래퍼
// 실제 DOM 구조 기반 (debug-dom.ts 분석 결과):
//   subscribe0.asp → class_list(영역명) → subscribe1.asp → ul.application_list li
//   상세 정보는 ul.desc.list_tab_view 에 이미 존재 (아코디언 클릭 불필요)
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const KOREAN_DAY_MAP: Record<string, string> = {
  "월요일": "MON", "화요일": "TUE", "수요일": "WED", "목요일": "THU", "금요일": "FRI",
};

// "수요일 (13:10 - 14:30), 금요일 (13:10 - 14:30)" 파싱
function parseSchedule(text: string): { days: string[]; startTime: string; endTime: string } | null {
  const regex = /([월화수목금]요일)\s*\((\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\)/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return null;
  const days = matches.map(m => KOREAN_DAY_MAP[m[1]]).filter(Boolean);
  const startTime = matches[0][2];
  const endTime = matches[0][3];
  if (matches.length > 1 && matches.some(m => m[2] !== startTime || m[3] !== endTime)) {
    console.warn(`  [Parser] 요일별 시간 다름 - 첫번째 시간 사용: "${text}"`);
  }
  return { days, startTime, endTime };
}

// "0 /21명" → { enrolled: 0, capacity: 21 }
function parseCapacity(text: string): { enrolled: number; capacity: number } {
  const match = text.replace(/\s/g, "").match(/(\d+)\/(\d+)명/);
  if (!match) return { enrolled: 0, capacity: 0 };
  return { enrolled: parseInt(match[1]), capacity: parseInt(match[2]) };
}

// "₩32,000원(기수수강료 ₩80,000)" → { monthly: 32000, term: 80000 }
function parsePrice(text: string): { monthly: number; term?: number } {
  const nums = [...text.matchAll(/[\d,]+/g)]
    .map(m => parseInt(m[0].replace(/,/g, "")))
    .filter(n => n > 0);
  return { monthly: nums[0] ?? 0, term: nums[1] };
}

// "₩45,000원" → 45000
function parseMaterialCost(text: string): number {
  const match = text.match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, "")) : 0;
}

async function scrape(): Promise<void> {
  console.log("[Scraper] ===== 서이초 방과후 스크래퍼 시작 =====");

  const browser = await chromium.launch({ headless: true, slowMo: 300 });
  const allCourses: Record<string, unknown>[] = [];
  let courseIndex = 0;

  try {
    const page = await browser.newPage();

    // Step 1: 진입 → subscribe0.asp
    console.log("\n[Step 1] 사이트 접속...");
    await page.goto("https://afteredu.kr/R1176782B0DDF4", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    console.log(`  URL: ${page.url()}`);

    // Step 2: 수강신청 확인 클릭 → subscribe0.asp
    // click과 waitForNavigation을 동시에 시작해야 navigation 이벤트를 놓치지 않음
    console.log("\n[Step 2] '수강신청 확인' 클릭...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {}),
      page.click("text=수강신청 확인"),
    ]);
    await page.waitForTimeout(2000);
    console.log(`  URL: ${page.url()}`);

    // Step 3: 강좌영역 목록 확인
    const areas = await page.$$eval("ul.category li a[onclick*='class_list']", els =>
      els.map(el => ({
        name: el.textContent?.trim().replace(/\s*\(\d+\)/, "").trim() ?? "",
        fullText: el.textContent?.trim() ?? "",
      }))
    );
    console.log(`\n[Step 3] 강좌영역: ${areas.map(a => a.fullText).join(", ")}`);

    if (areas.length === 0) {
      console.error("[Scraper] 강좌영역을 찾지 못했습니다.");
      const html = await page.content();
      writeFileSync(join(process.cwd(), "scraper", "data", "debug-subscribe0.html"), html);
      return;
    }

    // Step 4: 각 영역 순회
    for (const area of areas) {
      console.log(`\n[Step 4] 영역 "${area.fullText}" 처리 중...`);

      // class_list() 호출 → subscribe1.asp로 POST 이동
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {}),
        page.evaluate((areaName) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).class_list(areaName);
        }, area.name),
      ]);
      await page.waitForTimeout(2000);
      console.log(`  URL: ${page.url()}`);

      // Step 5: 과목 파싱 (아코디언 클릭 불필요 - 상세 정보가 HTML에 이미 존재)
      const courses = await page.$$eval("ul.application_list li", (items) => {
        return items.map((li) => {
          // 과목명
          const name = li.querySelector("div.list_tab strong")?.textContent?.trim() ?? "";
          // 정원 (enrolled/capacity)
          const countText = li.querySelector("span.count")?.textContent?.trim() ?? "";
          // 과목 ID from send('ID','')
          const sendOnclick = li.querySelector("span.btn.decision a[onclick]")?.getAttribute("onclick") ?? "";
          const idMatch = sendOnclick.match(/send\('(\d+)'/);
          const courseId = idMatch?.[1] ?? "";
          // 신청 가능 여부 (신청하기 버튼 존재 여부)
          const hasApplyBtn = !!li.querySelector("span.btn.decision a[onclick*='send(']");

          // 상세 정보 (ul.desc.list_tab_view li em 기준)
          const details: Record<string, string> = {};
          li.querySelectorAll("ul.desc li").forEach((detailLi) => {
            const em = detailLi.querySelector("em");
            if (!em) return;
            const key = em.textContent?.trim() ?? "";
            // em 제거 후 남은 텍스트
            const clone = detailLi.cloneNode(true) as Element;
            clone.querySelector("em")?.remove();
            clone.querySelector("a.btn_on2")?.remove(); // 강의자료 링크 제거
            const val = clone.textContent?.replace(/[\t\n]/g, " ").replace(/\s+/g, " ").replace(/^[\s:]+/, "").trim() ?? "";
            details[key] = val;
          });

          return { name, countText, courseId, hasApplyBtn, details };
        }).filter(c => c.name); // 과목명 없는 항목 제거
      });

      console.log(`  과목 ${courses.length}개 발견`);

      for (const raw of courses) {
        const scheduleText = raw.details["수업일시"] ?? "";
        const schedule = parseSchedule(scheduleText);
        if (!schedule || schedule.days.length === 0) {
          console.warn(`  수업일시 파싱 실패: "${scheduleText}" (과목: ${raw.name})`);
          continue;
        }

        const { enrolled, capacity } = parseCapacity(raw.countText);
        const { monthly, term } = parsePrice(raw.details["월수강료"] ?? "");
        const materialCost = parseMaterialCost(raw.details["교재(재료)비"] ?? "");

        const course = {
          id: raw.courseId ? `s-${raw.courseId}` : `course-${String(++courseIndex).padStart(3, "0")}`,
          area: area.name,
          name: raw.name,
          grade: raw.details["대상학년"] ?? "",
          teacher: raw.details["강사명"]?.split(/\s{2,}/)[0].trim(),
          classroom: raw.details["수강교실"] ?? undefined,
          startDate: raw.details["개강일자"] ?? undefined,
          days: schedule.days,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          price: monthly,
          termPrice: term,
          materialCost: materialCost || undefined,
          capacity,
          enrolled,
          remaining: capacity - enrolled,
          available: raw.hasApplyBtn && (capacity - enrolled) > 0,
        };

        allCourses.push(course);
        console.log(`  ✓ ${course.name} (${course.days.join(",")}) ${course.startTime}-${course.endTime} ${course.price}원 [잔여${course.remaining}]`);
      }

      // 다음 영역을 위해 subscribe0.asp로 돌아가기
      if (areas.indexOf(area) < areas.length - 1) {
        console.log("  → subscribe0.asp 로 돌아가는 중...");
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {}),
          page.evaluate(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).subscribe();
          }),
        ]);
        await page.waitForTimeout(2000);
      }
    }

  } catch (err) {
    console.error("[Scraper] 치명적 오류:", err);
  } finally {
    await browser.close();
  }

  // 결과 저장
  const outputDir = join(process.cwd(), "scraper", "data");
  mkdirSync(outputDir, { recursive: true });

  const areaCount = (areaName: string) => allCourses.filter(c => c.area === areaName).length;
  const output = {
    courses: allCourses,
    scrapedAt: new Date().toISOString(),
    source: "w2.afteredu.kr",
    total: allCourses.length,
    areas: {
      "기타영역": areaCount("기타영역"),
      "예술영역": areaCount("예술영역"),
      "체육영역": areaCount("체육영역"),
      "컴퓨터영역": areaCount("컴퓨터영역"),
    },
  };

  writeFileSync(join(outputDir, "courses.json"), JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[Scraper] ===== 완료 =====`);
  console.log(`[Scraper] 총 ${allCourses.length}개 과목 수집`);
  console.log(`[Scraper] 영역별: 기타(${areaCount("기타영역")}) 예술(${areaCount("예술영역")}) 체육(${areaCount("체육영역")}) 컴퓨터(${areaCount("컴퓨터영역")})`);

  if (allCourses.length === 0) {
    console.warn("[Scraper] 수집된 과목이 0개입니다. debug-subscribe0.html 확인 필요.");
  }
}

scrape().catch(err => {
  console.error("[Scraper] 프로세스 오류:", err);
  process.exit(1);
});
