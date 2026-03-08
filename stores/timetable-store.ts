import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type { Course, Weekday } from "@/types";
import { findConflicts } from "@/lib/timetable-utils";

interface TimetableState {
  selectedIds: Set<string>;
  selectedArea: string;
  showOnlySelected: boolean;
  activeDay: Weekday | null;
  _selectedCourses: Course[];
  conflictIds: Set<string>;

  toggleCourse: (course: Course) => void;
  clearSelected: () => void;
  setSelectedArea: (area: string) => void;
  toggleShowOnlySelected: () => void;
  setActiveDay: (day: Weekday | null) => void;
}

// Set → 배열 직렬화를 직렬화/역직렬화 시점에서 처리하는 custom storage
// onRehydrateStorage state mutation 대신 getItem에서 올바른 타입으로 복원
type PersistedData = {
  selectedIds: string[]; // JSON에서는 배열로 저장
  _selectedCourses: Course[];
  selectedArea: string;
};

const customStorage: PersistStorage<Partial<TimetableState>> = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const raw = JSON.parse(str) as { state: PersistedData; version?: number };
      const ids = raw.state.selectedIds ?? [];
      const courses = raw.state._selectedCourses ?? [];
      console.log(`[Store] 로컬스토리지 복원: ${ids.length}개 과목 선택됨`);
      return {
        state: {
          selectedIds: new Set(ids),
          _selectedCourses: courses,
          selectedArea: raw.state.selectedArea ?? "",
          conflictIds: findConflicts(courses), // 복원 시점에 충돌 재계산
        },
        version: raw.version,
      };
    } catch {
      console.warn("[Store] 로컬스토리지 파싱 실패 - 초기화");
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    const state = value.state as Partial<TimetableState>;
    const serializable = {
      state: {
        selectedIds: [...(state.selectedIds ?? new Set<string>())],
        _selectedCourses: state._selectedCourses ?? [],
        selectedArea: state.selectedArea ?? "",
      },
      version: value.version,
    };
    localStorage.setItem(name, JSON.stringify(serializable));
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export const useTimetableStore = create<TimetableState>()(
  persist(
    (set, get) => ({
      selectedIds: new Set<string>(),
      selectedArea: "",
      showOnlySelected: false,
      activeDay: null,
      _selectedCourses: [],
      conflictIds: new Set<string>(),

      toggleCourse: (course: Course) => {
        const { selectedIds, _selectedCourses } = get();
        const isSelected = selectedIds.has(course.id);

        let newIds: Set<string>;
        let newCourses: Course[];

        if (isSelected) {
          console.log(`[Store] 과목 해제: ${course.name} (${course.id})`);
          newIds = new Set([...selectedIds].filter((id) => id !== course.id));
          newCourses = _selectedCourses.filter((c) => c.id !== course.id);
        } else {
          console.log(`[Store] 과목 선택: ${course.name} (${course.id})`);
          newIds = new Set([...selectedIds, course.id]);
          newCourses = [..._selectedCourses, course];
        }

        const newConflicts = findConflicts(newCourses);
        console.log(
          `[Store] 현재 선택: ${newIds.size}개, 충돌: ${newConflicts.size}개`
        );

        set({
          selectedIds: newIds,
          _selectedCourses: newCourses,
          conflictIds: newConflicts,
        });
      },

      clearSelected: () => {
        console.log("[Store] 선택 초기화");
        set({
          selectedIds: new Set(),
          _selectedCourses: [],
          conflictIds: new Set(),
        });
      },

      setSelectedArea: (area: string) => {
        console.log(`[Store] 강좌영역 변경: "${area || "전체"}"`);
        set({ selectedArea: area });
      },

      toggleShowOnlySelected: () => {
        const current = get().showOnlySelected;
        console.log(`[Store] 선택 과목만 보기: ${!current}`);
        set({ showOnlySelected: !current });
      },

      setActiveDay: (day: Weekday | null) => {
        console.log(`[Store] 활성 요일 변경: ${day ?? "전체"}`);
        set({ activeDay: day });
      },
    }),
    {
      name: "timetable-storage",
      storage: customStorage,
      // conflictIds, showOnlySelected, activeDay는 세션마다 초기화
      partialize: (state) => ({
        selectedIds: state.selectedIds,
        _selectedCourses: state._selectedCourses,
        selectedArea: state.selectedArea,
      }),
    }
  )
);
