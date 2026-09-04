# ClassTrack

A lightweight, real-time classroom attendance management system built for simple, fast, and reliable daily attendance tracking.

## Features

### Admin

* Secure admin login
* Mark students as Present
* Unmarked students are automatically marked Absent when attendance is finalized
* Finalized attendance days are locked
* View attendance history
* Search students
* View student-wise attendance statistics
* Copy Present List
* Copy Absent List
* Copy Full Attendance Record
* Save attendance records as TXT
* Monthly Excel attendance export
* Working day / holiday management
* 7 working hours per day
* Real-time attendance synchronization

### Student

* Student login using Register Number and Student Name
* View personal attendance records
* View attendance percentage
* View Present and Absent days
* View total, present, and absent hours

## Attendance Statistics

ClassTrack provides:

* Total Finalized Days
* Present Days
* Absent Days
* Attendance Percentage
* Total Hours
* Present Hours
* Absent Hours

Working days are calculated using **7 hours per day**.

## Monthly Excel Export

The monthly Excel report includes:

* Student-wise attendance
* Date-wise Present / Absent status
* Working days and holidays
* Monthly attendance totals
* Attendance percentage
* Total Hours
* Present Hours
* Absent Hours
* Excel formulas
* Professional formatting

A month can be exported only after all calendar dates in that month have been finalized as either working days or holidays.

## Tech Stack

* React
* Vite
* JavaScript
* CSS
* Supabase

  * PostgreSQL Database
  * Authentication
  * Row Level Security
  * Realtime
* xlsx-js-style

## Project Structure

```text
attendance-tracker/
├── public/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── StudentCard.jsx
│   │   └── Summary.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── utils/
│   │   └── attendance.js
│   ├── AdminDashboard.jsx
│   ├── StudentDashboard.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── Login.css
│   └── index.css
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Gopinathzues/classtrack.git
cd classtrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do **not** commit `.env` to GitHub.

### 4. Start the development server

```bash
npm run dev
```

The application will be available on the local development URL shown by Vite.

## Deployment

ClassTrack is designed to be deployed using:

* **Frontend:** Vercel
* **Database & Realtime:** Supabase
* **Source Code:** GitHub

The Supabase environment variables must be added to the Vercel project before deployment.

## Security

ClassTrack uses Supabase Row Level Security to protect attendance and student data.

The Supabase service-role key is never exposed in the frontend application.

## License

This project is intended for educational and classroom use.
