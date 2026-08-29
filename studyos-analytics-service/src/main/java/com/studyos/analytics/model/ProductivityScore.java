package com.studyos.analytics.model;

/**
 * Response DTO returned by /api/analytics/productivity-score/{userId}
 *
 * A simple weighted score (0-100) combining attendance consistency and
 * task completion rate, giving the student a single number to track
 * alongside the existing Pomodoro/focus stats in StudyOS.
 */
public class ProductivityScore {

    private String userId;
    private double attendanceComponent;   // 0-100
    private double taskComponent;         // 0-100
    private double overallScore;          // weighted combination, 0-100
    private String remark;

    public ProductivityScore() {
    }

    public ProductivityScore(String userId, double attendanceComponent, double taskComponent,
                              double overallScore, String remark) {
        this.userId = userId;
        this.attendanceComponent = attendanceComponent;
        this.taskComponent = taskComponent;
        this.overallScore = overallScore;
        this.remark = remark;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public double getAttendanceComponent() {
        return attendanceComponent;
    }

    public void setAttendanceComponent(double attendanceComponent) {
        this.attendanceComponent = attendanceComponent;
    }

    public double getTaskComponent() {
        return taskComponent;
    }

    public void setTaskComponent(double taskComponent) {
        this.taskComponent = taskComponent;
    }

    public double getOverallScore() {
        return overallScore;
    }

    public void setOverallScore(double overallScore) {
        this.overallScore = overallScore;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
