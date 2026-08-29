package com.studyos.analytics.model;

import org.springframework.data.annotation.Id;

/**
 * Maps to a subject entry embedded inside a user document's "subjects" array.
 * Matches the real StudyOS schema: { name, total, attended, color, _id }
 */
public class Subject {

    @Id
    private String id;
    private String name;
    private int total;
    private int attended;
    private String color;

    public Subject() {
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

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public int getAttended() {
        return attended;
    }

    public void setAttended(int attended) {
        this.attended = attended;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }
}
