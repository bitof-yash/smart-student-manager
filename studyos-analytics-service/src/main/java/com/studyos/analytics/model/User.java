package com.studyos.analytics.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * Maps to the real "users" collection used by the StudyOS Node/Express backend.
 * Attendance and tasks are NOT separate collections — they live as embedded
 * arrays inside each user document (subjects[].total / subjects[].attended
 * for attendance, tasks[] for the task list).
 */
@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String name;
    private String email;
    private int xp;
    private int streak;

    private List<Subject> subjects;
    private List<TaskItem> tasks;

    public User() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public int getXp() {
        return xp;
    }

    public void setXp(int xp) {
        this.xp = xp;
    }

    public int getStreak() {
        return streak;
    }

    public void setStreak(int streak) {
        this.streak = streak;
    }

    public List<Subject> getSubjects() {
        return subjects;
    }

    public void setSubjects(List<Subject> subjects) {
        this.subjects = subjects;
    }

    public List<TaskItem> getTasks() {
        return tasks;
    }

    public void setTasks(List<TaskItem> tasks) {
        this.tasks = tasks;
    }
}
