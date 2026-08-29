package com.studyos.analytics.model;

import org.springframework.data.annotation.Id;

/**
 * Maps to a task entry embedded inside a user document's "tasks" array.
 * Matches the real StudyOS schema: { title, subject, priority, date, completed, createdAt, _id }
 */
public class TaskItem {

    @Id
    private String id;
    private String title;
    private String subject;
    private String priority; // "low" | "medium" | "high"
    private String date;     // stored as a plain string, e.g. "2026-08-30"
    private boolean completed;
    private String createdAt;

    public TaskItem() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
