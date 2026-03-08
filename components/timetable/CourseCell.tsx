"use client";

import { Course, Weekday } from "@/types";
import CourseCard from "./CourseCard";

interface CourseCellProps {
  courses: Course[];
  day: Weekday;
  timeSlot: string;
  selectedIds: Set<string>;
  conflictIds: Set<string>;
  onToggle: (courseId: string) => void;
}

export default function CourseCell({
  courses,
  day,
  timeSlot,
  selectedIds,
  conflictIds,
  onToggle,
}: CourseCellProps) {
  if (courses.length === 0) {
    return (
      <td className="border border-gray-200 dark:border-gray-700 p-1 min-h-[80px] align-top bg-gray-50/50 dark:bg-gray-900/50" />
    );
  }

  return (
    <td className="border border-gray-200 dark:border-gray-700 p-1 align-top w-full">
      <div className="flex flex-col gap-1">
        {courses.map((course) => (
          <CourseCard
            key={`${course.id}-${day}`}
            course={course}
            isSelected={selectedIds.has(course.id)}
            isConflict={conflictIds.has(course.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </td>
  );
}
