package com.studyos.analytics.controller;

import com.studyos.analytics.model.AttendanceSummary;
import com.studyos.analytics.model.ProductivityScore;
import com.studyos.analytics.model.TaskStats;
import com.studyos.analytics.service.AnalyticsService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Exposes read-only analytics derived from the same MongoDB "users" collection
 * used by the StudyOS Node/Express backend. Attendance and task data are read
 * from the embedded subjects[]/tasks[] arrays on each user document.
 */
@RestController
@RequestMapping("/api/analytics")
@CrossOrigin(origins = "*") // tighten this to your frontend origin in production
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/attendance-summary/{userId}")
    public AttendanceSummary attendanceSummary(@PathVariable String userId) {
        return analyticsService.getAttendanceSummary(userId);
    }

    @GetMapping("/task-stats/{userId}")
    public TaskStats taskStats(@PathVariable String userId) {
        return analyticsService.getTaskStats(userId);
    }

    @GetMapping("/productivity-score/{userId}")
    public ProductivityScore productivityScore(@PathVariable String userId) {
        return analyticsService.getProductivityScore(userId);
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoSuchElementException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadId(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "Invalid user id format: " + ex.getMessage()));
    }
}
