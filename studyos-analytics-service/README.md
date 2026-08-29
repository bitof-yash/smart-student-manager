# StudyOS Analytics Service (Java / Spring Boot)

A small Java Spring Boot microservice that adds analytics endpoints to StudyOS,
reading directly from the same MongoDB database used by the existing
Node.js/Express backend.

This service does **not** replace the Node backend — it sits alongside it:

```
studyos/
  backend/         Node.js + Express + MongoDB (auth, tasks, attendance, timetable, Pomodoro)
  public/          Static HTML/CSS/JS frontend
  studyos-analytics-service/   <-- this service (Java + Spring Boot)
```

## What it does

StudyOS stores attendance and tasks as **embedded arrays inside each user
document** in the `users` collection (`subjects[]` with `total`/`attended`
counts per subject, and `tasks[]`) rather than as separate top-level
collections. This service reads that same `users` collection directly and
exposes derived, read-only analytics that aren't computed anywhere else in
the app:

- `GET /api/analytics/attendance-summary/{userId}` — per-subject and overall
  attendance percentage
- `GET /api/analytics/task-stats/{userId}` — completed vs pending tasks,
  completion rate, pending tasks broken down by priority
- `GET /api/analytics/productivity-score/{userId}` — a single 0–100 score
  combining attendance consistency and task completion rate

## Tech Stack

- Java 17
- Spring Boot 3.3 (Spring Web, Spring Data MongoDB)
- Maven

## Setup

### 1. Install prerequisites

- **Java 17 (JDK)** — download from https://adoptium.net (Temurin 17)
- **Maven** — download from https://maven.apache.org/download.cgi
  (or use the Maven wrapper if you generate one with `mvn -N wrapper:wrapper`)

Verify installs:

```bash
java -version
mvn -version
```

### 2. Configure the database connection

Edit `src/main/resources/application.properties` if your MongoDB URI differs
from the default used by the Node backend:

```properties
spring.data.mongodb.uri=mongodb://127.0.0.1:27017/studyos
```

### 3. Run it

Make sure MongoDB is running locally (same as required for the Node backend), then:

```bash
cd studyos-analytics-service
mvn spring-boot:run
```

The service starts on **http://localhost:8081** (the Node backend keeps
running separately on its own port, e.g. 5050).

### 4. Test an endpoint

```bash
curl http://localhost:8081/api/analytics/attendance-summary/<some-user-id>
```

## Notes

- Field names in `Attendance.java` / `Task.java` are written to match the
  fields StudyOS already stores (userId, subjectId, subjectName, date,
  status / title, priority, dueDate, completed). If your Mongoose schema
  uses slightly different field names, adjust the model classes accordingly.
- CORS is currently open (`@CrossOrigin(origins = "*")`) for local
  development; restrict this before any real deployment.
