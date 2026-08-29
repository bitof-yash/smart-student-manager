package com.studyos.analytics.service;

import com.studyos.analytics.model.AttendanceSummary;
import com.studyos.analytics.model.ProductivityScore;
import com.studyos.analytics.model.Subject;
import com.studyos.analytics.model.TaskItem;
import com.studyos.analytics.model.TaskStats;
import com.studyos.analytics.model.User;
import com.studyos.analytics.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final UserRepository userRepository;

    public AnalyticsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    private User loadUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("No user found with id " + userId));
    }

    public AttendanceSummary getAttendanceSummary(String userId) {
        User user = loadUser(userId);
        List<Subject> subjects = user.getSubjects() == null ? List.of() : user.getSubjects();

        List<AttendanceSummary.SubjectAttendance> subjectSummaries = new ArrayList<>();
        int totalClasses = 0;
        int totalAttended = 0;

        for (Subject subject : subjects) {
            int total = subject.getTotal();
            int attended = subject.getAttended();
            double percent = total == 0 ? 0.0 : round((attended * 100.0) / total);

            subjectSummaries.add(new AttendanceSummary.SubjectAttendance(
                    subject.getId(), subject.getName(), total, attended, percent));

            totalClasses += total;
            totalAttended += attended;
        }

        double overallPercent = totalClasses == 0 ? 0.0 : round((totalAttended * 100.0) / totalClasses);

        return new AttendanceSummary(userId, overallPercent, subjectSummaries);
    }

    public TaskStats getTaskStats(String userId) {
        User user = loadUser(userId);
        List<TaskItem> tasks = user.getTasks() == null ? List.of() : user.getTasks();

        int total = tasks.size();
        int completed = (int) tasks.stream().filter(TaskItem::isCompleted).count();
        int pending = total - completed;
        double completionRate = total == 0 ? 0.0 : round((completed * 100.0) / total);

        Map<String, Long> pendingByPriority = tasks.stream()
                .filter(t -> !t.isCompleted())
                .collect(Collectors.groupingBy(
                        t -> t.getPriority() == null ? "unspecified" : t.getPriority(),
                        Collectors.counting()));

        return new TaskStats(userId, total, completed, pending, completionRate, pendingByPriority);
    }

    public ProductivityScore getProductivityScore(String userId) {
        AttendanceSummary attendanceSummary = getAttendanceSummary(userId);
        TaskStats taskStats = getTaskStats(userId);

        double attendanceComponent = attendanceSummary.getOverallAttendancePercent();
        double taskComponent = taskStats.getCompletionRatePercent();

        // Weighted 50/50 between attendance consistency and task completion.
        double overall = round((attendanceComponent * 0.5) + (taskComponent * 0.5));

        String remark;
        if (overall >= 80) {
            remark = "Excellent — keep it up!";
        } else if (overall >= 60) {
            remark = "Good, but there's room to improve consistency.";
        } else if (overall >= 40) {
            remark = "Needs attention — attendance or task completion is slipping.";
        } else {
            remark = "Low productivity this period — consider reviewing your schedule.";
        }

        return new ProductivityScore(userId, attendanceComponent, taskComponent, overall, remark);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
