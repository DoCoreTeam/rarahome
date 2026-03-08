"use client";

// 메인 페이지 - 시간표 뷰어 레이아웃 및 데이터 페칭 — michael
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTimetableStore } from "@/stores/timetable-store";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import FilterBar from "@/components/timetable/FilterBar";
import MobileDayTabs from "@/components/timetable/MobileDayTabs";
import SelectedCourses from "@/components/sidebar/SelectedCourses";
import { isGradeIncluded } from "@/lib/timetable-utils";
import type { Course, Weekday } from "@/types";

interface CoursesApiResponse {
  courses: Course[];
  source: "file" | "empty";
  scrapedAt?: string;
  total?: number;
  message?: string;
}

async function fetchCourses(): Promise<CoursesApiResponse> {
  console.log("[Page] 과목 데이터 페칭 시작");
  const res = await fetch("/api/courses");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[Page] 과목 데이터 페칭 실패:", err);
    throw new Error(err.error ?? "데이터 로드 실패");
  }
  const data = await res.json();
  console.log(`[Page] 과목 데이터 수신: ${data.total ?? 0}개`);
  return data;
}

export default function Home() {
  const {
    selectedIds,
    conflictIds,
    selectedArea,
    showOnlySelected,
    setSelectedArea,
    toggleShowOnlySelected,
    toggleCourse,
  } = useTimetableStore();

  const [mobileDay, setMobileDay] = useState<Weekday>("MON");
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery<CoursesApiResponse>({
    queryKey: ["courses"],
    queryFn: fetchCourses,
  });

  // data?.courses를 useMemo로 안정화: data가 undefined인 동안 매 렌더마다 새 빈 배열 생성 방지
  const allCourses = useMemo(() => data?.courses ?? [], [data]);

  const areas = useMemo(() => {
    const set = new Set(allCourses.map((c) => c.area));
    return Array.from(set).sort();
  }, [allCourses]);

  const filteredCourses = useMemo(() => {
    let courses = allCourses;
    if (selectedArea) {
      courses = courses.filter((c) => c.area === selectedArea);
    }
    if (selectedGrade !== null) {
      // 대상학년 범위에 내 아이 학년이 포함되는 과목만 표시
      courses = courses.filter((c) => isGradeIncluded(c.grade, selectedGrade));
    }
    if (showOnlySelected) {
      courses = courses.filter((c) => selectedIds.has(c.id));
    }
    return courses;
  }, [allCourses, selectedArea, selectedGrade, showOnlySelected, selectedIds]);

  // 모바일 탭 뱃지용 요일별 과목 수 — michael
  const dayCourseCounts = useMemo(() => {
    const counts: Partial<Record<Weekday, number>> = {};
    filteredCourses.forEach((c) => {
      c.days.forEach((d) => {
        counts[d] = (counts[d] ?? 0) + 1;
      });
    });
    return counts;
  }, [filteredCourses]);

  const handleToggle = useCallback((courseId: string) => {
    const course = allCourses.find((c) => c.id === courseId);
    if (!course) {
      console.warn(`[Page] 과목 ID 없음: ${courseId}`);
      return;
    }
    toggleCourse(course);
  }, [allCourses, toggleCourse]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            서이초 방과후 시간표 뷰어
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            과목을 탭해서 담고, 중복 시간대를 확인하세요
          </p>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-3 py-3 space-y-3">
        {/* 에러 표시 */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : "데이터 로드 실패"}
            </p>
          </div>
        )}

        {/* 데이터 없음 안내 */}
        {data?.source === "empty" && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {data.message}
            </p>
          </div>
        )}

        {/* 필터바 */}
        <FilterBar
          areas={areas}
          selectedArea={selectedArea}
          onAreaChange={setSelectedArea}
          selectedGrade={selectedGrade}
          onGradeChange={(g) => {
            console.log(`[Page] 학년 필터: ${g !== null ? `${g}학년` : "전체"}`);
            setSelectedGrade(g);
          }}
          showOnlySelected={showOnlySelected}
          onToggleShowSelected={toggleShowOnlySelected}
          onRefresh={() => {
            console.log("[Page] 수동 갱신");
            refetch();
          }}
          isLoading={isLoading}
          scrapedAt={data?.scrapedAt}
          totalCourses={data?.total}
          filteredCount={filteredCourses.length}
        />

        {/* 메인 레이아웃: 시간표 + 사이드바 */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* 시간표 영역 */}
          <div className="flex-1 min-w-0">
            {/* 모바일: 요일 탭 */}
            <div className="lg:hidden mb-0">
              <MobileDayTabs
                activeDay={mobileDay}
                onDayChange={setMobileDay}
                courseCounts={dayCourseCounts}
              />
            </div>

            {/* 로딩 스켈레톤 */}
            {isLoading && (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* 시간표 그리드 */}
            {!isLoading && (
              <>
                {/* 데스크탑: 전체 요일 표시 */}
                <div className="hidden lg:block">
                  <TimetableGrid
                    courses={filteredCourses}
                    selectedIds={selectedIds}
                    conflictIds={conflictIds}
                    activeDay={null}
                    onToggle={handleToggle}
                  />
                </div>
                {/* 모바일: 선택된 요일만 표시 */}
                <div className="lg:hidden">
                  <TimetableGrid
                    courses={filteredCourses}
                    selectedIds={selectedIds}
                    conflictIds={conflictIds}
                    activeDay={mobileDay}
                    onToggle={handleToggle}
                  />
                </div>
              </>
            )}
          </div>

          {/* 사이드바 */}
          <SelectedCourses allCourses={allCourses} />
        </div>
      </div>
    </main>
  );
}
