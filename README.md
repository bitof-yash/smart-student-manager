# Smart Student Manager / StudyOS

StudyOS is a student productivity web app for tracking attendance, managing tasks, organizing a timetable, and staying focused with a built-in Pomodoro timer.

The project combines a static frontend in `public/` with a Node.js + Express + MongoDB backend in `backend/`.

## Features

- User signup and login
- JWT-based authentication
- Subject and attendance tracking
- Task management with priorities and due dates
- Weekly timetable view
- Pomodoro timer and focus tracking
- Productivity heatmap and progress stats
- AI-assisted timetable extraction support

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Auth: bcryptjs, jsonwebtoken

## Project Structure

```text
webtech_project/
  backend/
    server.js
  public/
    index.html
    login.html
    app.html
    css/
    js/
  package.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file in the project root:

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/studyos
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_api_key
```

3. Start MongoDB.

4. Run the backend:

```bash
npm start
```

5. Open the app in your browser:

```text
http://localhost:5050
```

## Notes

- Authentication is handled through the backend and MongoDB.
- The app is served by Express from the `public/` folder.
- Some student dashboard features may still rely on browser-side state depending on the current build version.

## Author

Yash Soren
