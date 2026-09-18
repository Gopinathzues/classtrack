# ClassTrack

A real-time attendance management system built to simplify daily attendance tracking, student access, attendance analytics, and monthly reporting.

ClassTrack was developed to solve a real attendance-management problem in a college environment, with a focus on reducing manual work and maintaining reliable attendance records.

## 🚀 Live Demo

[[ClassTrack Live Demo](YOUR_VERCEL_URL)](https://clastrack.vercel.app/)

## 💻 GitHub

[GitHub Repository](https://github.com/Gopinathzues/classtrack.git)

---

## 📌 Features

### 👨‍💼 Admin

- Secure admin login
- View all students
- Search students by name or register number
- Mark students as Present
- Automatically mark unmarked students as Absent during finalization
- Finalize attendance for a day
- Prevent changes after attendance is finalized
- Working day / holiday management
- Day order management
- Attendance remarks
- Attendance history
- Attendance summary
- Present student list
- Absent student list
- Copy attendance records
- Save attendance records as TXT
- Student-wise attendance statistics
- Total working hours
- Present hours
- Absent hours
- Monthly Excel report generation

### 📱 WhatsApp Attendance Automation

ClassTrack supports direct attendance marking from the attendance message received through WhatsApp.

The admin can paste the attendance message directly into ClassTrack.

The system automatically:

1. Detects the student names from the message
2. Detects the student group
3. Removes WhatsApp formatting
4. Ignores `(od)` annotations
5. Handles differences in capitalization and spacing
6. Matches names with registered students
7. Handles student initials
8. Automatically marks matched students as Present

No preview or additional Apply button is required.

Example:

```text
Gopinath (od)
````

can match a registered student such as:

```text
Gopinath M
```

and automatically mark the student as Present.

### 🎓 Student

* Student login using register number and name
* View personal attendance
* View present and absent days
* View attendance percentage
* View total working hours
* View present hours
* View absent hours
* Mobile-friendly dashboard

### ⚡ Real-Time Updates

Attendance changes are synchronized using Supabase Realtime, allowing multiple admin screens to stay updated without manually refreshing the page.

---

## 📊 Attendance Calculation

ClassTrack uses a working-day-based attendance system.

Each working day contains:

```text
7 working hours
```

For example:

```text
Total Finalized Working Days = 5
Present Days = 4
Absent Days = 1

Attendance = 4 / 5 × 100
           = 80%

Total Hours = 5 × 7
            = 35 hours

Present Hours = 4 × 7
              = 28 hours

Absent Hours = 1 × 7
             = 7 hours
```

Holidays do not contribute to attendance calculations.

---

## 📑 Monthly Excel Reports

ClassTrack can generate monthly attendance reports containing:

* Student register number
* Student name
* Daily attendance status
* Working days
* Holidays
* Monthly present days
* Monthly absent days
* Attendance percentage
* Total working hours
* Present hours
* Absent hours
* Excel formulas
* Formatted monthly report

Monthly reports are generated only after the selected month has been completely finalized.

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* JavaScript
* CSS

### Backend / Database

* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Realtime
* PostgreSQL RPC Functions
* Row Level Security (RLS)

### Reporting

* xlsx-js-style

### Deployment & Development

* Git
* GitHub
* Vercel
* VS Code

---

## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      ClassTrack     │
                    │     React + Vite    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
        ┌───────▼────────┐           ┌────────▼────────┐
        │     Admin      │           │     Student     │
        │    Dashboard   │           │    Dashboard    │
        └───────┬────────┘           └────────┬────────┘
                │                             │
                └──────────────┬──────────────┘
                               │
                       ┌───────▼────────┐
                       │    Supabase    │
                       │                │
                       │  PostgreSQL    │
                       │  Auth          │
                       │  Realtime      │
                       │  RPC           │
                       │  RLS           │
                       └───────┬────────┘
                               │
                       ┌───────▼────────┐
                       │ Attendance Data │
                       │ Students       │
                       │ Daily Records  │
                       └────────────────┘
```

---

## 🔐 Security

ClassTrack uses Supabase security features to protect attendance data.

* Supabase Authentication for administrators
* PostgreSQL Row Level Security (RLS)
* Admin-only database operations
* Secure RPC functions
* Student credentials stored as password hashes
* No Supabase service-role key is exposed to the frontend
* Finalized attendance records are protected from modification

---

## 📁 Project Structure

```text
attendance-tracker/
│
├── public/
│
├── src/
│   ├── components/
│   ├── lib/
│   │   └── supabase.js
│   │
│   ├── AdminDashboard.jsx
│   ├── StudentDashboard.jsx
│   ├── Login.jsx
│   ├── Login.css
│   └── ...
│
├── .env
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

---

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Gopinathzues/classtrack.git
```

### 2. Navigate to the project

```bash
cd classtrack
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do not commit secret or service-role keys.

### 5. Start the development server

```bash
npm run dev
```

### 6. Build for production

```bash
npm run build
```

---

## 🌐 Deployment

The application is deployed using Vercel.

The frontend is connected to Supabase for:

* Authentication
* Database operations
* Real-time attendance synchronization
* Secure database access

---

## 🎯 Project Goals

ClassTrack was built with the following goals:

* Reduce manual attendance entry
* Make attendance management easier for class representatives and administrators
* Provide students with direct access to their attendance
* Reduce errors during daily attendance entry
* Simplify monthly attendance reporting
* Maintain reliable and protected attendance records
* Provide a practical real-world application rather than a purely academic demo

---

## 🧠 What I Learned

Building ClassTrack provided hands-on experience with:

* React application development
* Component-based UI design
* PostgreSQL database design
* Supabase integration
* Authentication
* Row Level Security
* Database RPC functions
* Real-time data synchronization
* Attendance data modeling
* Data validation
* Excel report generation
* Debugging production issues
* Git and GitHub workflows
* Vercel deployment
* Building and maintaining a real multi-user application

---

## 📸 Screenshots

Add screenshots of:

* Admin login
* Admin dashboard
* WhatsApp attendance paste section
* Attendance summary
* Student dashboard
* Monthly Excel report

---

## 👨‍💻 Developer

**Gopinath M**

Final Year B.Tech Information Technology

GitHub: [Gopinathzues](https://github.com/Gopinathzues)

---

## 📄 License

This project is developed as a real-world application and learning project.

````
