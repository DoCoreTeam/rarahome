export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI";

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
};

export const WEEKDAYS: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI"];

export interface Course {
  id: string;
  area: string;          // 강좌영역: "기타영역" | "예술영역" | "체육영역" | "컴퓨터영역"
  name: string;          // 강좌명
  grade: string;         // 대상학년: "1-2학년", "3-6학년", "1-6학년"
  teacher?: string;      // 강사명
  classroom?: string;    // 수강교실: "컴퓨터1실"
  startDate?: string;    // 개강일자 (YYYY-MM-DD)
  days: Weekday[];       // 수업 요일 (복수 가능)
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM"
  price: number;         // 월수강료 (원)
  termPrice?: number;    // 기수수강료 (원)
  materialCost?: number; // 교재(재료)비 (원)
  capacity: number;      // 정원
  enrolled: number;      // 현재 신청 인원
  remaining: number;     // 잔여석 (capacity - enrolled)
  available: boolean;    // 신청 가능 여부
}

export interface TimetableCell {
  timeSlot: string;      // "13:00-14:00"
  courses: Course[];
}

export interface ConflictInfo {
  courseId: string;
  conflictingCourseIds: string[];
}
