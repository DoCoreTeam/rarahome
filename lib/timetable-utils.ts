import type { Course, Weekday } from "@/types";
import { WEEKDAY_LABELS } from "@/types";

/**
 * 시간 문자열("HH:MM")을 분 단위 숫자로 변환
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * 두 과목이 같은 요일+시간에 겹치는지 확인
 */
export function hasTimeConflict(a: Course, b: Course): boolean {
  const sharedDays = a.days.filter((d) => b.days.includes(d));
  if (sharedDays.length === 0) return false;

  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);

  return aStart < bEnd && bStart < aEnd;
}

/**
 * 과목 배열에서 겹치는 과목 ID 쌍을 반환
 */
export function findConflicts(selected: Course[]): Set<string> {
  const conflictSet = new Set<string>();
  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      if (hasTimeConflict(selected[i], selected[j])) {
        conflictSet.add(selected[i].id);
        conflictSet.add(selected[j].id);
      }
    }
  }
  return conflictSet;
}

/**
 * 과목 배열에서 유니크한 시간 슬롯 목록을 정렬하여 반환
 */
export function extractTimeSlots(courses: Course[]): string[] {
  const slots = new Set<string>();
  courses.forEach((c) => slots.add(`${c.startTime}-${c.endTime}`));
  return Array.from(slots).sort((a, b) => {
    const [aStart] = a.split("-");
    const [bStart] = b.split("-");
    return timeToMinutes(aStart) - timeToMinutes(bStart);
  });
}

/**
 * 과목 배열을 주간 시간표 구조로 변환
 * timeSlot -> Weekday -> Course[]
 */
export function buildTimetableMap(
  courses: Course[]
): Map<string, Map<Weekday, Course[]>> {
  const map = new Map<string, Map<Weekday, Course[]>>();

  courses.forEach((course) => {
    const slot = `${course.startTime}-${course.endTime}`;
    if (!map.has(slot)) map.set(slot, new Map());
    const dayMap = map.get(slot)!;

    course.days.forEach((day) => {
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(course);
    });
  });

  return map;
}

/**
 * 수강료를 한국 원화 형식으로 포맷
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * 요일 배열을 한글로 변환
 */
export function formatDays(days: Weekday[]): string {
  return days.map((d) => WEEKDAY_LABELS[d]).join("/");
}
