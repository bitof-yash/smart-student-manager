package com.studyos.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the StudyOS Analytics microservice.
 *
 * This is a small, standalone Java/Spring Boot service that reads the same
 * MongoDB collections used by the main StudyOS (Node.js/Express) backend and
 * exposes derived analytics — attendance percentages, task completion stats,
 * and a weekly productivity score — over a REST API.
 */
@SpringBootApplication
public class StudyosAnalyticsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudyosAnalyticsServiceApplication.class, args);
    }
}
