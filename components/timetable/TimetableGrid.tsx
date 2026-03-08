"use client";

import { Course, Weekday, WEEKDAYS, WEEKDAY_LABELS } from "@/types";
import { buildTimetableMap, extractTimeSlots } from "@/lib/timetable-utils";
import { useMemo } from "react";
import CourseCell from "./CourseCell";

interface TimetableGridProps {
  courses: Course[];
  selectedIds: Set<string>;
  conflictIds: Set<string>;
  disabledIds: Set<string>;
  activeDay: Weekday | null;
  onToggle: (courseId: string) => void;
}

export default function TimetableGrid({
  courses,
  selectedIds,
  conflictIds,
  disabledIds,
  activeDay,
  onToggle,
}: TimetableGridProps) {
  const timetableMap = useMemo(() => {
    console.log(`[TimetableGrid] 시간표 재계산 - 과목 ${courses.length}개`);
    return buildTimetableMap(courses);
  }, [courses]);

  const timeSlots = useMemo(() => extractTimeSlots(courses), [courses]);

  // activeDay가 null이면 전체 요일 표시 (데스크탑), 아니면 해당 요일만 (모바일) — michael
  const visibleDays: Weekday[] = activeDay ? [activeDay] : WEEKDAYS;

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg className="w-16 h-16 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-lg font-medium">과목 데이터가 없습니다</p>
        <p className="text-sm mt-1">스크래퍼를 실행하거나 데이터를 직접 입력하세요</p>
      </div>
    );
  }

  // 모바일(단일 요일)은 min-w 불필요 - 빈 공간 방지
  const tableMinWidth = activeDay ? "w-full" : "min-w-[600px]";

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <table className={`w-full border-collapse text-sm ${tableMinWidth}`} aria-label="방과후 수업 시간표">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-gray-600 dark:text-gray-300 font-semibold w-16 whitespace-nowrap text-xs">
              시간
            </th>
            {visibleDays.map((day) => (
              <th
                key={day}
                className="border border-gray-200 dark:border-gray-700 px-2 py-2 text-center text-gray-600 dark:text-gray-300 font-semibold min-w-[110px] text-sm"
              >
                {WEEKDAY_LABELS[day]}요일
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.length === 0 ? (
            <tr>
              <td colSpan={visibleDays.length + 1} className="text-center py-8 text-gray-400">
                시간표 데이터가 없습니다
              </td>
            </tr>
          ) : (
            timeSlots.map((slot) => {
              const dayMap = timetableMap.get(slot);
              return (
                <tr key={slot} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors">
                  <td className="border border-gray-200 dark:border-gray-700 px-1 py-2 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 whitespace-nowrap w-16">
                    {slot.split("-")[0]}
                    <br />
                    <span className="text-gray-400">~{slot.split("-")[1]}</span>
                  </td>
                  {visibleDays.map((day) => (
                    <CourseCell
                      key={`${slot}-${day}`}
                      courses={dayMap?.get(day) ?? []}
                      day={day}
                      timeSlot={slot}
                      selectedIds={selectedIds}
                      conflictIds={conflictIds}
                      disabledIds={disabledIds}
                      onToggle={onToggle}
                    />
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
