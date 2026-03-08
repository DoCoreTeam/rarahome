"use client";

// 매크로 전용 사이드바 - SelectedCourses 기반 + RegisterButton 하단 추가 — michael
import { useEffect, useMemo, useState } from "react";
import { useTimetableStore } from "@/stores/timetable-store";
import { formatPrice, formatDays } from "@/lib/timetable-utils";
import type { Course } from "@/types";
import ExportModal from "@/components/export/ExportModal";
import RegisterButton from "@/components/macro/RegisterButton";

interface SelectedCoursesMacroProps {
  allCourses: Course[];
}

export default function SelectedCoursesMacro({
  allCourses,
}: SelectedCoursesMacroProps) {
  const { selectedIds, conflictIds, clearSelected, toggleCourse } =
    useTimetableStore();
  const [showExport, setShowExport] = useState(false);

  const selectedCourses = useMemo(
    () => allCourses.filter((c) => selectedIds.has(c.id)),
    [allCourses, selectedIds]
  );
  const totalPrice = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + c.price, 0),
    [selectedCourses]
  );
  const totalMaterialCost = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + (c.materialCost ?? 0), 0),
    [selectedCourses]
  );
  const hasConflict = conflictIds.size > 0;

  useEffect(() => {
    console.log(
      `[SelectedCoursesMacro] 선택 과목 변경 - ${selectedCourses.length}개`
    );
  }, [selectedCourses.length]);

  return (
    <>
      {showExport && (
        <ExportModal
          courses={selectedCourses}
          onClose={() => setShowExport(false)}
        />
      )}
      <aside className="w-full lg:w-72 flex-shrink-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm sticky top-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              선택한 과목
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                ({selectedCourses.length}개)
              </span>
            </h2>
            {selectedCourses.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExport(true)}
                  className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                  aria-label="이미지로 저장"
                >
                  이미지 저장
                </button>
                <button
                  onClick={() => {
                    console.log("[SelectedCoursesMacro] 전체 초기화");
                    clearSelected();
                  }}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  aria-label="선택 전체 초기화"
                >
                  초기화
                </button>
              </div>
            )}
          </div>

          {/* 충돌 경고 */}
          {hasConflict && (
            <div className="mx-3 mt-3 px-3 py-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                시간이 겹치는 과목이 있습니다!
              </p>
            </div>
          )}

          {/* 과목 목록 */}
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {selectedCourses.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                시간표에서 과목을 선택하세요
              </p>
            ) : (
              selectedCourses.map((course) => {
                const isConflict = conflictIds.has(course.id);
                return (
                  <div
                    key={course.id}
                    className={`flex items-start gap-2 p-2 rounded-md border ${
                      isConflict
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                        : "border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isConflict
                            ? "text-red-700 dark:text-red-400"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {course.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDays(course.days)} · {formatPrice(course.price)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCourse(course)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                      aria-label={`${course.name} 선택 해제`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 합계 금액 — michael */}
          {selectedCourses.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  월 수강료
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              {totalMaterialCost > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    교재(재료)비
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatPrice(totalMaterialCost)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  월 합계
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-base">
                  {formatPrice(totalPrice + totalMaterialCost)}
                </span>
              </div>
            </div>
          )}

          {/* 수강신청 매크로 버튼 — michael */}
          <div className="px-4 pb-4">
            <RegisterButton />
          </div>
        </div>
      </aside>
    </>
  );
}
