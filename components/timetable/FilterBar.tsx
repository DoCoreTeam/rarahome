"use client";

interface FilterBarProps {
  areas: string[];
  selectedArea: string;
  onAreaChange: (area: string) => void;
  selectedGrade: number | null;
  onGradeChange: (grade: number | null) => void;
  showOnlySelected: boolean;
  onToggleShowSelected: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  scrapedAt?: string;
  totalCourses?: number;
  filteredCount?: number;
}

const CHILD_GRADES = [1, 2, 3, 4, 5, 6];

export default function FilterBar({
  areas,
  selectedArea,
  onAreaChange,
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
    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
      {/* 1행: 영역 선택 + 과목수 + 갱신 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">영역</label>
        <select
          value={selectedArea}
          onChange={(e) => onAreaChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="강좌영역 선택"
        >
          <option value="">전체</option>
          {areas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>

        {/* 과목 수 */}
        {totalCourses != null && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {filteredCount != null && filteredCount !== totalCourses
              ? `${filteredCount} / 총 ${totalCourses}개`
              : `총 ${totalCourses}개`}
          </span>
        )}

        {/* 갱신 버튼 (우측 끝) */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="ml-auto text-xs px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          aria-label="데이터 갱신"
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          갱신
        </button>
      </div>

      {/* 2행: 내 아이 학년 + 선택 과목만 보기 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">내 아이</span>
        <div className="flex gap-1 flex-wrap" role="group" aria-label="학년 선택">
          <button
            onClick={() => onGradeChange(null)}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              selectedGrade === null
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
            }`}
            aria-pressed={selectedGrade === null}
          >
            전체
          </button>
          {CHILD_GRADES.map((g) => (
            <button
              key={g}
              onClick={() => onGradeChange(selectedGrade === g ? null : g)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                selectedGrade === g
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
              }`}
              aria-pressed={selectedGrade === g}
              aria-label={`${g}학년`}
            >
              {g}학년
            </button>
          ))}
        </div>

        <button
          onClick={onToggleShowSelected}
          className={`ml-auto text-xs px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
            showOnlySelected
              ? "bg-blue-500 text-white border-blue-500"
              : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400"
          }`}
          aria-pressed={showOnlySelected}
        >
          선택만 보기
        </button>
      </div>

      {/* 수집 시각 (있을 때만) */}
      {scrapedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          수집: {new Date(scrapedAt).toLocaleString("ko-KR")}
        </p>
      )}
    </div>
  );
}
