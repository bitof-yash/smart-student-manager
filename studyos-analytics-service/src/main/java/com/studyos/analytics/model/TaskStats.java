package com.studyos.analytics.model;

import java.util.Map;

/**
 * Response DTO returned by /api/analytics/task-stats/{userId}
 */
public class TaskStats {

    private String userId;
    private int totalTasks;
    private int completedTasks;
    private int pendingTasks;
    private double completionRatePercent;
    private Map<String, Long> pendingByPriority; // e.g. {"high": 3, "medium": 5, "low": 2}

    public TaskStats() {
    }

    public TaskStats(String userId, int totalTasks, int completedTasks, int pendingTasks,
                      double completionRatePercent, Map<String, Long> pendingByPriority) {
        this.userId = userId;
        this.totalTasks = totalTasks;
        this.completedTasks = completedTasks;
        this.pendingTasks = pendingTasks;
        this.completionRatePercent = completionRatePercent;
        this.pendingByPriority = pendingByPriority;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public int getTotalTasks() {
        return totalTasks;
    }

    public void setTotalTasks(int totalTasks) {
        this.totalTasks = totalTasks;
    }

    public int getCompletedTasks() {
        return completedTasks;
    }

    public void setCompletedTasks(int completedTasks) {
        this.completedTasks = completedTasks;
    }

    public int getPendingTasks() {
        return pendingTasks;
    }

    public void setPendingTasks(int pendingTasks) {
        this.pendingTasks = pendingTasks;
    }

    public double getCompletionRatePercent() {
        return completionRatePercent;
    }

    public void setCompletionRatePercent(double completionRatePercent) {
        this.completionRatePercent = completionRatePercent;
    }

    public Map<String, Long> getPendingByPriority() {
        return pendingByPriority;
    }

    public void setPendingByPriority(Map<String, Long> pendingByPriority) {
        this.pendingByPriority = pendingByPriority;
    }
}
