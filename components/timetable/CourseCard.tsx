"use client";

import { Course } from "@/types";
import { formatPrice } from "@/lib/timetable-utils";

interface CourseCardProps {
  course: Course;
  isSelected: boolean;
  isConflict: boolean;
  isDisabled: boolean;
  onToggle: (courseId: string) => void;
}

export default function CourseCard({ course, isSelected, isConflict, isDisabled, onToggle }: CourseCardProps) {
  // 상태별 스타일 분기 — michael
  const getCardStyle = () => {
    if (!course.available) return "bg-gray-100 border-gray-200 opacity-60 dark:bg-gray-800";
    if (isDisabled) return "bg-gray-100 border-gray-200 opacity-40 dark:bg-gray-800 dark:border-gray-700";
    if (isConflict) return "bg-red-50 border-red-300 dark:bg-red-950";
    if (isSelected) return "bg-blue-50 border-blue-400 dark:bg-blue-950";
    return "bg-white border-gray-200 hover:border-blue-300 dark:bg-gray-800 dark:border-gray-600";
  };

  const handleClick = () => {
    if (!course.available || isDisabled) {
      console.log(`[CourseCard] 클릭 무시: ${course.name} (${!course.available ? "마감" : "시간 중복 비활성화"})`);
      return;
    }
    console.log(`[CourseCard] 과목 ${isSelected ? "해제" : "선택"}: ${course.name} (${course.id})`);
    onToggle(course.id);
  };

  return (
    <div
      className={`
        relative border rounded-lg p-2 cursor-pointer transition-all duration-200
        ${getCardStyle()}
        ${(course.available && !isDisabled) ? "active:scale-95" : "cursor-not-allowed"}
      `}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${course.name} ${isSelected ? "선택됨" : isDisabled ? "시간 중복으로 선택 불가" : "선택 안됨"}`}
      aria-disabled={isDisabled || !course.available}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* 충돌 아이콘 우선: 선택+충돌 동시 발생 시 겹침 방지 */}
      {isConflict ? (
        <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold leading-none">!</span>
        </div>
      ) : isSelected ? (
        <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      ) : null}

      {/* 강좌명 */}
      <p className={`font-semibold text-sm leading-tight ${!course.available ? "line-through text-gray-400" : "text-gray-900 dark:text-white"}`}>
        {course.name}
      </p>

      {/* 영역 + 학년 태그 — michael */}
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        <span className="inline-block px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {course.area}
        </span>
        <span className="inline-block px-1.5 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
          {course.grade}
        </span>
      </div>

      {/* 수강료 */}
      <p className={`mt-1 text-xs font-medium ${isConflict ? "text-red-600" : isSelected ? "text-blue-600" : "text-gray-600 dark:text-gray-400"}`}>
        {formatPrice(course.price)}/월
      </p>

      {/* 교재비 (있고 0이 아닐 때만) — michael */}
      {course.materialCost != null && course.materialCost > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          교재 {formatPrice(course.materialCost)}
        </p>
      )}

      {/* 교실 (있을 때만) — michael */}
      {course.classroom && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {course.classroom}
        </p>
      )}

      {/* 잔여석 (enrolled/capacity) — michael */}
      <p className={`text-xs mt-0.5 ${course.remaining === 0 ? "text-red-500" : course.remaining <= 3 ? "text-orange-500" : "text-gray-400"}`}>
        {course.remaining === 0 ? "마감" : `잔여 ${course.remaining}석`} ({course.enrolled}/{course.capacity})
      </p>

      {/* 마감 오버레이 */}
      {!course.available && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-200/50 dark:bg-gray-700/50">
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded dark:bg-gray-800">마감</span>
        </div>
      )}
    </div>
  );
}
