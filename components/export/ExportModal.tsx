"use client";

import { useRef, useCallback, useMemo } from "react";
import type { Course } from "@/types";
import { WEEKDAYS, WEEKDAY_LABELS } from "@/types";
import {
  buildTimetableMap,
  extractTimeSlots,
  formatPrice,
  formatDays,
} from "@/lib/timetable-utils";

interface ExportModalProps {
  courses: Course[];
  onClose: () => void;
}

// 영역별 색상
const AREA_COLORS: Record<string, string> = {
  기타영역: "#3b82f6",
  예술영역: "#a855f7",
  체육영역: "#22c55e",
  컴퓨터영역: "#f59e0b",
};

function getAreaColor(area: string) {
  return AREA_COLORS[area] ?? "#6b7280";
}

export default function ExportModal({ courses, onClose }: ExportModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const timetableMap = useMemo(() => buildTimetableMap(courses), [courses]);
  const timeSlots = useMemo(() => extractTimeSlots(courses), [courses]);
  const totalPrice = useMemo(
    () => courses.reduce((s, c) => s + c.price, 0),
    [courses]
  );
  const totalMaterialCost = useMemo(
    () => courses.reduce((s, c) => s + (c.materialCost ?? 0), 0),
    [courses]
  );

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const link = document.createElement("a");
    const today = new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "");
    link.download = `서이초-방과후-수강신청-${today}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">수강신청 확인표 미리보기</h2>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="text-sm px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              이미지 저장
            </button>
            <button
              onClick={onClose}
              className="text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 캡처 대상 카드 */}
        <div ref={cardRef} className="p-6 bg-white" style={{ fontFamily: "sans-serif" }}>
          {/* 타이틀 */}
          <div className="mb-5 pb-4 border-b-2 border-gray-800">
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>
              서이초등학교 방과후 수강신청
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              선택 과목 {courses.length}개 &nbsp;·&nbsp; {new Date().toLocaleDateString("ko-KR")} 기준
            </p>
          </div>

          {/* 주간 시간표 */}
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            주간 시간표
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: 20,
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={{ ...thStyle, width: 72 }}>시간</th>
                {WEEKDAYS.map((day) => (
                  <th key={day} style={thStyle}>{WEEKDAY_LABELS[day]}요일</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot) => {
                const dayMap = timetableMap.get(slot);
                const [start, end] = slot.split("-");
                return (
                  <tr key={slot}>
                    <td style={{ ...tdStyle, textAlign: "center", backgroundColor: "#f9fafb", color: "#4b5563" }}>
                      <span style={{ fontWeight: 600 }}>{start}</span>
                      <br />
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>~{end}</span>
                    </td>
                    {WEEKDAYS.map((day) => {
                      const dayCourses = dayMap?.get(day) ?? [];
                      return (
                        <td key={day} style={{ ...tdStyle, verticalAlign: "top", padding: 4 }}>
                          {dayCourses.map((course) => {
                            const color = getAreaColor(course.area);
                            return (
                              <div
                                key={course.id}
                                style={{
                                  backgroundColor: color + "15",
                                  border: `1.5px solid ${color}60`,
                                  borderRadius: 6,
                                  padding: "4px 6px",
                                  marginBottom: 3,
                                }}
                              >
                                <p style={{ fontWeight: 700, color: "#111827", fontSize: 12, margin: 0 }}>
                                  {course.name}
                                </p>
                                <p style={{ color: color, fontSize: 11, margin: 0 }}>{course.grade}</p>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 과목 상세 목록 */}
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            과목 상세
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={{ ...thStyle, textAlign: "left" }}>과목명</th>
                <th style={{ ...thStyle, textAlign: "left" }}>영역</th>
                <th style={{ ...thStyle, textAlign: "left" }}>대상</th>
                <th style={{ ...thStyle, textAlign: "left" }}>요일/시간</th>
                <th style={{ ...thStyle, textAlign: "right" }}>월 수강료</th>
                <th style={{ ...thStyle, textAlign: "right" }}>교재비</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course, i) => (
                <tr key={course.id} style={{ backgroundColor: i % 2 === 1 ? "#f9fafb" : "white" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{course.name}</td>
                  <td style={{ ...tdStyle, color: getAreaColor(course.area) }}>{course.area}</td>
                  <td style={{ ...tdStyle, color: "#6b7280" }}>{course.grade}</td>
                  <td style={{ ...tdStyle, color: "#6b7280" }}>
                    {formatDays(course.days)} {course.startTime}~{course.endTime}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                    {formatPrice(course.price)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", color: "#6b7280" }}>
                    {course.materialCost ? formatPrice(course.materialCost) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#eff6ff", fontWeight: 700 }}>
                <td colSpan={4} style={{ ...tdStyle, color: "#1e40af" }}>합계</td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#1e40af" }}>
                  {formatPrice(totalPrice)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", color: "#1e40af" }}>
                  {totalMaterialCost > 0 ? formatPrice(totalMaterialCost) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* 비용 요약 */}
          <div
            style={{
              backgroundColor: "#eff6ff",
              border: "1.5px solid #bfdbfe",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "#1d4ed8" }}>
              <p style={{ margin: 0 }}>월 수강료 {formatPrice(totalPrice)}</p>
              {totalMaterialCost > 0 && (
                <p style={{ margin: "2px 0 0", color: "#6b7280" }}>
                  교재비 {formatPrice(totalMaterialCost)} (최초 1회)
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#3b82f6" }}>총 납부 예정</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e3a8a" }}>
                {formatPrice(totalPrice + totalMaterialCost)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: 600,
  color: "#374151",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "6px 8px",
  color: "#111827",
};
