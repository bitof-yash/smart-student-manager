package com.studyos.analytics.model;

import java.util.List;

/**
 * Response DTO returned by /api/analytics/attendance-summary/{userId}
 */
public class AttendanceSummary {

    private String userId;
    private double overallAttendancePercent;
    private List<SubjectAttendance> bySubject;

    public AttendanceSummary() {
    }

    public AttendanceSummary(String userId, double overallAttendancePercent, List<SubjectAttendance> bySubject) {
        this.userId = userId;
        this.overallAttendancePercent = overallAttendancePercent;
        this.bySubject = bySubject;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public double getOverallAttendancePercent() {
        return overallAttendancePercent;
    }

    public void setOverallAttendancePercent(double overallAttendancePercent) {
        this.overallAttendancePercent = overallAttendancePercent;
    }

    public List<SubjectAttendance> getBySubject() {
        return bySubject;
    }

    public void setBySubject(List<SubjectAttendance> bySubject) {
        this.bySubject = bySubject;
    }

    public static class SubjectAttendance {
        private String subjectId;
        private String subjectName;
        private int totalClasses;
        private int attendedClasses;
        private double attendancePercent;

        public SubjectAttendance() {
        }

        public SubjectAttendance(String subjectId, String subjectName, int totalClasses,
                                  int attendedClasses, double attendancePercent) {
            this.subjectId = subjectId;
            this.subjectName = subjectName;
            this.totalClasses = totalClasses;
            this.attendedClasses = attendedClasses;
            this.attendancePercent = attendancePercent;
        }

        public String getSubjectId() {
            return subjectId;
        }

        public void setSubjectId(String subjectId) {
            this.subjectId = subjectId;
        }

        public String getSubjectName() {
            return subjectName;
        }

        public void setSubjectName(String subjectName) {
            this.subjectName = subjectName;
        }

        public int getTotalClasses() {
            return totalClasses;
        }

        public void setTotalClasses(int totalClasses) {
            this.totalClasses = totalClasses;
        }

        public int getAttendedClasses() {
            return attendedClasses;
        }

        public void setAttendedClasses(int attendedClasses) {
            this.attendedClasses = attendedClasses;
        }

        public double getAttendancePercent() {
            return attendancePercent;
        }

        public void setAttendancePercent(double attendancePercent) {
            this.attendancePercent = attendancePercent;
        }
    }
}
