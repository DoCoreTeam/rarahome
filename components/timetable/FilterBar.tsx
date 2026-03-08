"use client";

interface FilterBarProps {
  areas: string[];
  selectedArea: string;
  onAreaChange: (area: string) => void;
  grades: string[];
  selectedGrade: string;
  onGradeChange: (grade: string) => void;
  showOnlySelected: boolean;
  onToggleShowSelected: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  scrapedAt?: string;
  totalCourses?: number;
  filteredCount?: number;
}

export default function FilterBar({
  areas,
  selectedArea,
  onAreaChange,
  grades,
  selectedGrade,
  onGradeChange,
  showOnlySelected,
  onToggleShowSelected,
  onRefresh,
  isLoading,
  scrapedAt,
  totalCourses,
  filteredCount,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* 영역 필터 */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
          강좌영역:
        </label>
        <select
          value={selectedArea}
          onChange={(e) => {
            console.log(`[FilterBar] 영역 변경: ${e.target.value}`);
            onAreaChange(e.target.value);
          }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="강좌영역 선택"
        >
          <option value="">전체</option>
          {areas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>

      {/* 대상학년 필터 — michael */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
          대상학년:
        </label>
        <select
          value={selectedGrade}
          onChange={(e) => {
            console.log(`[FilterBar] 학년 변경: ${e.target.value}`);
            onGradeChange(e.target.value);
          }}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="대상학년 선택"
        >
          <option value="">전체</option>
          {grades.map((grade) => (
            <option key={grade} value={grade}>{grade}</option>
          ))}
        </select>
      </div>

      {/* 선택된 과목만 보기 토글 */}
      <button
        onClick={() => {
          console.log(`[FilterBar] 선택 과목만 보기 토글: ${!showOnlySelected}`);
          onToggleShowSelected();
        }}
        className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
          showOnlySelected
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400"
        }`}
        aria-pressed={showOnlySelected}
      >
        선택 과목만 보기
      </button>

      {/* 데이터 갱신 버튼 */}
      <button
        onClick={() => {
          console.log("[FilterBar] 데이터 갱신 요청");
          onRefresh();
        }}
        disabled={isLoading}
        className="ml-auto text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        {isLoading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        데이터 갱신
      </button>

      {/* 과목 수 표시 */}
      {totalCourses != null && (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {filteredCount != null && filteredCount !== totalCourses
            ? `${filteredCount} / 총 ${totalCourses}개`
            : `총 ${totalCourses}개`}
        </span>
      )}

      {/* 수집 시각 표시 */}
      {scrapedAt && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          수집: {new Date(scrapedAt).toLocaleString("ko-KR")}
        </span>
      )}
    </div>
  );
}
