"use client";

import { Weekday, WEEKDAYS, WEEKDAY_LABELS } from "@/types";

interface MobileDayTabsProps {
  activeDay: Weekday;
  onDayChange: (day: Weekday) => void;
  courseCounts: Partial<Record<Weekday, number>>;
}

export default function MobileDayTabs({ activeDay, onDayChange, courseCounts }: MobileDayTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="요일 선택"
      className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg overflow-hidden"
    >
      {WEEKDAYS.map((day) => {
        const count = courseCounts[day] ?? 0;
        const isActive = activeDay === day;
        return (
          <button
            key={day}
            role="tab"
            onClick={() => {
              console.log(`[MobileDayTabs] 요일 변경: ${day}`);
              onDayChange(day);
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              isActive
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            aria-selected={isActive}
          >
            {WEEKDAY_LABELS[day]}
            {count > 0 && (
              <span className={`ml-1 text-xs px-1 py-0.5 rounded-full ${
                isActive ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700"
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
