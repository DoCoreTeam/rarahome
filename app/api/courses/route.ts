import { NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import { join } from "path";
import type { Course } from "@/types";

const DATA_PATH = join(process.cwd(), "scraper", "data", "courses.json");

export async function GET() {
  console.log("[API] GET /api/courses - 과목 데이터 요청");

  try {
    // 파일 존재 여부 비동기 확인 (이벤트 루프 블로킹 방지)
    const exists = await access(DATA_PATH).then(() => true).catch(() => false);
    if (!exists) {
      console.warn("[API] courses.json 없음 - 빈 배열 반환");
      return NextResponse.json({
        courses: [],
        source: "empty",
        message: "스크래퍼를 실행하여 데이터를 수집하세요.",
      });
    }

    const raw = await readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as { courses: unknown; scrapedAt?: string };

    if (!Array.isArray(data.courses)) {
      console.error("[API] courses.json 구조 오류: courses가 배열이 아님");
      return NextResponse.json(
        { error: "데이터 형식 오류", detail: "courses 필드가 배열이어야 합니다." },
        { status: 500 }
      );
    }

    const courses = data.courses as Course[];
    console.log(
      `[API] 과목 ${courses.length}개 로드 완료 (수집시각: ${data.scrapedAt ?? "불명"})`
    );

    return NextResponse.json({
      courses,
      source: "file",
      scrapedAt: data.scrapedAt,
      total: courses.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("[API] 과목 데이터 로드 실패:", msg);
    return NextResponse.json(
      { error: "데이터 로드 실패", detail: msg },
      { status: 500 }
    );
  }
}
