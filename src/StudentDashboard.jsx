import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(`${dateValue}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDayName(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(`${dateValue}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
  });
}

function StudentDashboard({ student, onLogout }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // LIVE CLOCK
  // =====================================================

  const [currentTime, setCurrentTime] = useState(
    new Date()
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const clockTime = currentTime.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  );

  const clockDate = currentTime.toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    }
  );

  // =====================================================
  // LOAD ATTENDANCE
  // =====================================================

  async function loadStudentAttendance() {
    if (!student?.reg_no || !student?.name) {
      setError("Student information is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: attendanceError } =
        await supabase.rpc("get_student_attendance", {
          p_reg_no: student.reg_no,
          p_password: student.name,
        });

      console.log(
        "STUDENT ATTENDANCE DATA:",
        data
      );

      console.log(
        "STUDENT ATTENDANCE ERROR:",
        attendanceError
      );

      if (attendanceError) {
        console.error(
          "Student attendance error:",
          attendanceError
        );

        setError(
          "Unable to load attendance. Please try again."
        );

        return;
      }

      setDays(data || []);
    } catch (error) {
      console.error(
        "Unexpected attendance error:",
        error
      );

      setError(
        "Something went wrong while loading attendance."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudentAttendance();
  }, [student]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const statistics = useMemo(() => {
    const workingDays = days.filter(
      (day) => day.day_type === "working"
    );

    const totalFinalizedDays =
      workingDays.length;

    const presentDays = workingDays.filter(
      (day) => day.status === "present"
    ).length;

    const absentDays =
      totalFinalizedDays - presentDays;

    const totalHours = workingDays.reduce(
      (total, day) =>
        total + Number(day.working_hours || 7),
      0
    );

    const presentHours = workingDays
      .filter(
        (day) => day.status === "present"
      )
      .reduce(
        (total, day) =>
          total + Number(day.working_hours || 7),
        0
      );

    const absentHours = workingDays
      .filter(
        (day) => day.status === "absent"
      )
      .reduce(
        (total, day) =>
          total + Number(day.working_hours || 7),
        0
      );

    const attendancePercentage =
      totalFinalizedDays > 0
        ? (presentDays / totalFinalizedDays) * 100
        : 0;

    return {
      totalFinalizedDays,
      presentDays,
      absentDays,
      totalHours,
      presentHours,
      absentHours,
      attendancePercentage,
    };
  }, [days]);

  // =====================================================
  // ATTENDANCE MESSAGE
  // =====================================================

  function getAttendanceMessage() {
    const percentage =
      statistics.attendancePercentage;

    if (statistics.totalFinalizedDays === 0) {
      return "No attendance data yet";
    }

    if (percentage >= 90) {
      return "Excellent attendance";
    }

    if (percentage >= 75) {
      return "Good attendance";
    }

    if (percentage >= 65) {
      return "Attendance needs attention";
    }

    return "Low attendance";
  }

  // =====================================================
  // CALENDAR
  // =====================================================

  const [calendarMonth, setCalendarMonth] =
    useState(() => {
      const now = new Date();

      return new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
    });

  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(
      year,
      month,
      1
    );

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    /*
      Convert Sunday = 0 into Monday = 0.
      Monday → 0
      Tuesday → 1
      ...
      Sunday → 6
    */
    const startingDay =
      (firstDay.getDay() + 6) % 7;

    const calendarDays = [];

    // Empty cells before month starts
    for (
      let index = 0;
      index < startingDay;
      index++
    ) {
      calendarDays.push(null);
    }

    // Actual month dates
    for (
      let dayNumber = 1;
      dayNumber <= daysInMonth;
      dayNumber++
    ) {
      const date = new Date(
        year,
        month,
        dayNumber
      );

      const yearString =
        date.getFullYear();

      const monthString = String(
        date.getMonth() + 1
      ).padStart(2, "0");

      const dayString = String(
        date.getDate()
      ).padStart(2, "0");

      const dateKey =
        `${yearString}-${monthString}-${dayString}`;

      const attendanceRecord =
        days.find(
          (item) =>
            item.attendance_date === dateKey
        );

      calendarDays.push({
        date: dayNumber,
        dateKey,
        record: attendanceRecord || null,
      });
    }

    return calendarDays;
  }, [calendarMonth, days]);

  const calendarMonthName =
    calendarMonth.toLocaleDateString(
      "en-IN",
      {
        month: "long",
        year: "numeric",
      }
    );

  function changeMonth(amount) {
    setCalendarMonth(
      (previousMonth) =>
        new Date(
          previousMonth.getFullYear(),
          previousMonth.getMonth() + amount,
          1
        )
    );
  }

  function goToCurrentMonth() {
    const now = new Date();

    setCalendarMonth(
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )
    );
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {
    onLogout?.();
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>

          <p style={styles.loadingText}>
            Loading your attendance...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <div style={styles.page}>

      {/* =================================================
          HEADER
      ================================================== */}

      <header style={styles.header}>

        <div style={styles.headerContent}>

          <div>
            <div style={styles.brand}>
              Attendance Tracker
            </div>

            <h1 style={styles.headerTitle}>
              Student Dashboard
            </h1>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            Logout
          </button>

        </div>

      </header>

      {/* =================================================
          MAIN
      ================================================== */}

      <main style={styles.container}>

        {/* =================================================
            LIVE CLOCK
        ================================================== */}

        <section style={styles.clockCard}>

          <div style={styles.clockTime}>
            {clockTime}
          </div>

          <div style={styles.clockDate}>
            {clockDate}
          </div>

        </section>

        {/* =================================================
            WELCOME
        ================================================== */}

        <section style={styles.welcomeSection}>

          <p style={styles.welcomeLabel}>
            Welcome back
          </p>

          <h2 style={styles.welcomeName}>
            {student?.name || "-"}
          </h2>

          <p style={styles.welcomeText}>
            Here is your attendance overview.
          </p>

        </section>

        {/* =================================================
            STUDENT PROFILE
        ================================================== */}

        <section style={styles.profileCard}>

          <div style={styles.profileTop}>

            <div style={styles.profileAvatar}>
              {student?.name
                ?.charAt(0)
                ?.toUpperCase() || "S"}
            </div>

            <div style={styles.profileIdentity}>

              <h2 style={styles.studentName}>
                {student?.name || "-"}
              </h2>

              <span style={styles.studentRole}>
                Student
              </span>

            </div>

          </div>

          <div style={styles.profileDivider}></div>

          <div style={styles.profileDetails}>

            <div style={styles.profileDetail}>

              <span style={styles.detailLabel}>
                Register Number
              </span>

              <strong style={styles.detailValue}>
                {student?.reg_no || "-"}
              </strong>

            </div>

            <div style={styles.profileDetail}>

              <span style={styles.detailLabel}>
                Group
              </span>

              <strong style={styles.detailValue}>
                {student?.group_name || "-"}
              </strong>

            </div>

          </div>

        </section>

        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div style={styles.errorBox}>

            <div style={styles.errorIcon}>
              !
            </div>

            <div>
              <strong style={styles.errorTitle}>
                Unable to load attendance
              </strong>

              <p style={styles.errorText}>
                {error}
              </p>
            </div>

          </div>
        )}

        {/* =================================================
            ATTENDANCE OVERVIEW
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>

            <div>
              <h2 style={styles.sectionTitle}>
                Attendance
              </h2>

              <p style={styles.sectionSubtitle}>
                Finalized working days
              </p>
            </div>

          </div>

          <div style={styles.attendanceCard}>

            <div style={styles.attendanceMain}>

              <div
                style={{
                  ...styles.percentageCircle,
                  background: `conic-gradient(
                    #4f46e5 ${
                      (statistics.attendancePercentage /
                        100) *
                      360
                    }deg,
                    #eef0f5 ${
                      (statistics.attendancePercentage /
                        100) *
                      360
                    }deg
                  )`,
                }}
              >

                <strong
                  style={styles.percentageValue}
                >
                  {statistics.attendancePercentage.toFixed(
                    0
                  )}
                  %
                </strong>

              </div>

              <div style={styles.attendanceMessage}>

                <strong
                  style={styles.attendanceStatus}
                >
                  {getAttendanceMessage()}
                </strong>

                <span
                  style={
                    styles.attendanceDescription
                  }
                >
                  Overall attendance percentage
                </span>

              </div>

            </div>

            <div style={styles.attendanceSummary}>

              <div style={styles.summaryItem}>

                <span
                  style={{
                    ...styles.summaryIndicator,
                    ...styles.presentIndicator,
                  }}
                ></span>

                <div>
                  <span style={styles.summaryLabel}>
                    Present
                  </span>

                  <strong style={styles.summaryValue}>
                    {statistics.presentDays}
                  </strong>
                </div>

              </div>

              <div style={styles.summaryDivider}></div>

              <div style={styles.summaryItem}>

                <span
                  style={{
                    ...styles.summaryIndicator,
                    ...styles.absentIndicator,
                  }}
                ></span>

                <div>
                  <span style={styles.summaryLabel}>
                    Absent
                  </span>

                  <strong style={styles.summaryValue}>
                    {statistics.absentDays}
                  </strong>
                </div>

              </div>

            </div>

          </div>

          {/* TOTAL FINALIZED DAYS */}

          <div style={styles.totalDaysCard}>

            <div>

              <span style={styles.totalDaysLabel}>
                Total Finalized Days
              </span>

              <strong style={styles.totalDaysValue}>
                {statistics.totalFinalizedDays}
              </strong>

            </div>

          </div>

        </section>

        {/* =================================================
            HOURS
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>

            <div>
              <h2 style={styles.sectionTitle}>
                Attendance Hours
              </h2>

              <p style={styles.sectionSubtitle}>
                Based on 7 working hours per day
              </p>
            </div>

          </div>

          <div style={styles.hoursGrid}>

            <div style={styles.hourCard}>

              <span style={styles.hourLabel}>
                Total
              </span>

              <strong style={styles.hourValue}>
                {statistics.totalHours}
              </strong>

              <span style={styles.hourUnit}>
                hours
              </span>

            </div>

            <div style={styles.hourCard}>

              <span style={styles.hourLabel}>
                Present
              </span>

              <strong style={styles.hourValue}>
                {statistics.presentHours}
              </strong>

              <span style={styles.hourUnit}>
                hours
              </span>

            </div>

            <div style={styles.hourCard}>

              <span style={styles.hourLabel}>
                Absent
              </span>

              <strong style={styles.hourValue}>
                {statistics.absentHours}
              </strong>

              <span style={styles.hourUnit}>
                hours
              </span>

            </div>

          </div>

        </section>

        {/* =================================================
            MONTHLY ATTENDANCE CALENDAR
        ================================================== */}

        <section style={styles.section}>

          <div style={styles.sectionHeader}>

            <div>
              <h2 style={styles.sectionTitle}>
                Attendance History
              </h2>

              <p style={styles.sectionSubtitle}>
                Monthly attendance calendar
              </p>
            </div>

          </div>

          <div style={styles.calendarCard}>

            {/* CALENDAR HEADER */}

            <div style={styles.calendarHeader}>

              <button
                type="button"
                onClick={() =>
                  changeMonth(-1)
                }
                style={styles.monthButton}
                aria-label="Previous month"
              >
                ‹
              </button>

              <div style={styles.monthTitle}>
                {calendarMonthName}
              </div>

              <button
                type="button"
                onClick={() =>
                  changeMonth(1)
                }
                style={styles.monthButton}
                aria-label="Next month"
              >
                ›
              </button>

            </div>

            <button
              type="button"
              onClick={goToCurrentMonth}
              style={styles.todayButton}
            >
              Current Month
            </button>

            {/* WEEK DAYS */}

            <div style={styles.weekHeader}>

              {[
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
                "Sun",
              ].map((day) => (
                <div
                  key={day}
                  style={styles.weekDay}
                >
                  {day}
                </div>
              ))}

            </div>

            {/* CALENDAR GRID */}

            <div style={styles.calendarGrid}>

              {calendarData.map(
                (calendarDay, index) => {

                  if (!calendarDay) {
                    return (
                      <div
                        key={`empty-${index}`}
                        style={styles.emptyCalendarCell}
                      ></div>
                    );
                  }

                  const record =
                    calendarDay.record;

                  const isPresent =
                    record?.status ===
                    "present";

                  const isAbsent =
                    record?.status ===
                    "absent";

                  const isHoliday =
                    record?.day_type ===
                    "holiday";

                  return (
                    <div
                      key={calendarDay.dateKey}
                      style={{
                        ...styles.calendarCell,

                        ...(isPresent
                          ? styles.presentCalendarCell
                          : {}),

                        ...(isAbsent
                          ? styles.absentCalendarCell
                          : {}),

                        ...(isHoliday
                          ? styles.holidayCalendarCell
                          : {}),
                      }}
                    >

                      <span
                        style={
                          styles.calendarDate
                        }
                      >
                        {calendarDay.date}
                      </span>

                      {isPresent && (
                        <span
                          style={
                            styles.presentTick
                          }
                        >
                          ✓
                        </span>
                      )}

                      {isAbsent && (
                        <span
                          style={
                            styles.absentCross
                          }
                        >
                          ✕
                        </span>
                      )}

                      {isHoliday && (
                        <span
                          style={
                            styles.holidayDot
                          }
                        >
                          •
                        </span>
                      )}

                    </div>
                  );
                }
              )}

            </div>

            {/* LEGEND */}

            <div style={styles.calendarLegend}>

              <div style={styles.legendItem}>

                <span
                  style={{
                    ...styles.legendMark,
                    ...styles.presentLegend,
                  }}
                >
                  ✓
                </span>

                <span>
                  Present
                </span>

              </div>

              <div style={styles.legendItem}>

                <span
                  style={{
                    ...styles.legendMark,
                    ...styles.absentLegend,
                  }}
                >
                  ✕
                </span>

                <span>
                  Absent
                </span>

              </div>

              <div style={styles.legendItem}>

                <span
                  style={{
                    ...styles.legendMark,
                    ...styles.holidayLegend,
                  }}
                >
                  •
                </span>

                <span>
                  Holiday
                </span>

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* =================================================
          FOOTER
      ================================================== */}

      <footer style={styles.footer}>

        <span>
          Attendance Tracker
        </span>

        <span style={styles.footerDot}>
          •
        </span>

        <span>
          Student Portal
        </span>

      </footer>

    </div>
  );
}

// =======================================================
// STYLES
// =======================================================

const styles = {

  // =====================================================
  // PAGE
  // =====================================================

  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflowX: "hidden",
  },

  // =====================================================
  // HEADER
  // =====================================================

  header: {
    background: "#ffffff",
    borderBottom:
      "1px solid #e8eaf0",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },

  headerContent: {
    width: "100%",
    maxWidth: "680px",
    margin: "0 auto",
    padding:
      "15px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    boxSizing: "border-box",
  },

  brand: {
    fontSize: "10px",
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginBottom: "3px",
  },

  headerTitle: {
    margin: 0,
    fontSize: "18px",
    lineHeight: 1.2,
    fontWeight: "750",
    color: "#111827",
  },

  logoutButton: {
    border:
      "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#374151",
    borderRadius: "9px",
    padding:
      "9px 13px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
    minHeight: "38px",
    flexShrink: 0,
  },

  // =====================================================
  // MAIN
  // =====================================================

  container: {
    width: "100%",
    maxWidth: "680px",
    margin: "0 auto",
    padding:
      "18px 16px 36px",
    boxSizing: "border-box",
  },

  // =====================================================
  // CLOCK
  // =====================================================

  clockCard: {
    background:
      "linear-gradient(145deg, #171717, #252525)",
    border:
      "1px solid #363636",
    borderRadius: "12px",
    padding:
      "14px 16px",
    marginBottom: "19px",
    boxShadow:
      "0 4px 12px rgba(0, 0, 0, 0.10)",
  },

  clockTime: {
    fontSize: "28px",
    lineHeight: 1,
    fontWeight: "500",
    letterSpacing: "0.5px",
    color: "#ffffff",
    fontVariantNumeric:
      "tabular-nums",
  },

  clockDate: {
    marginTop: "7px",
    fontSize: "12px",
    color: "#c7c7c7",
  },

  // =====================================================
  // WELCOME
  // =====================================================

  welcomeSection: {
    marginBottom: "18px",
  },

  welcomeLabel: {
    margin: 0,
    fontSize: "12px",
    color: "#6b7280",
    fontWeight: "600",
  },

  welcomeName: {
    margin:
      "3px 0 0",
    fontSize: "25px",
    lineHeight: 1.15,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: "-0.5px",
  },

  welcomeText: {
    margin:
      "5px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },

  // =====================================================
  // PROFILE
  // =====================================================

  profileCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "24px",
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.04)",
  },

  profileTop: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
  },

  profileAvatar: {
    width: "50px",
    height: "50px",
    minWidth: "50px",
    borderRadius: "14px",
    background: "#eef2ff",
    color: "#4f46e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    fontWeight: "800",
  },

  profileIdentity: {
    minWidth: 0,
  },

  studentName: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "750",
    color: "#111827",
    wordBreak: "break-word",
  },

  studentRole: {
    display: "block",
    marginTop: "3px",
    fontSize: "11px",
    color: "#6b7280",
  },

  profileDivider: {
    height: "1px",
    background: "#eef0f4",
    margin:
      "16px 0",
  },

  profileDetails: {
    display: "grid",
    gridTemplateColumns:
      "1fr 0.7fr",
    gap: "14px",
  },

  profileDetail: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
  },

  detailLabel: {
    fontSize: "10px",
    color: "#9ca3af",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.35px",
  },

  detailValue: {
    fontSize: "13px",
    color: "#111827",
    overflowWrap: "anywhere",
  },

  // =====================================================
  // ERROR
  // =====================================================

  errorBox: {
    background: "#fff7f7",
    border:
      "1px solid #fecaca",
    borderRadius: "12px",
    padding: "13px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },

  errorIcon: {
    width: "25px",
    height: "25px",
    minWidth: "25px",
    borderRadius: "50%",
    background: "#fee2e2",
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "13px",
  },

  errorTitle: {
    display: "block",
    fontSize: "12px",
    color: "#991b1b",
  },

  errorText: {
    margin:
      "3px 0 0",
    fontSize: "11px",
    color: "#b91c1c",
  },

  // =====================================================
  // SECTIONS
  // =====================================================

  section: {
    marginBottom: "26px",
  },

  sectionHeader: {
    marginBottom: "11px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "750",
    color: "#111827",
  },

  sectionSubtitle: {
    margin:
      "3px 0 0",
    fontSize: "11px",
    color: "#8a92a3",
  },

  // =====================================================
  // ATTENDANCE
  // =====================================================

  attendanceCard: {
    background:
      "linear-gradient(145deg, #ffffff 0%, #fafaff 100%)",
    border:
      "1px solid #e8eaf0",
    borderRadius: "17px",
    padding: "20px",
    boxShadow:
      "0 4px 14px rgba(15, 23, 42, 0.04)",
  },

  attendanceMain: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },

  percentageCircle: {
    width: "92px",
    height: "92px",
    minWidth: "92px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  percentageValue: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    color: "#111827",
    fontWeight: "800",
  },

  attendanceMessage: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  attendanceStatus: {
    fontSize: "15px",
    color: "#111827",
  },

  attendanceDescription: {
    fontSize: "11px",
    color: "#8a92a3",
    lineHeight: 1.4,
  },

  attendanceSummary: {
    marginTop: "20px",
    paddingTop: "17px",
    borderTop:
      "1px solid #eef0f4",
    display: "flex",
    alignItems: "center",
  },

  summaryItem: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },

  summaryIndicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },

  presentIndicator: {
    background: "#10b981",
  },

  absentIndicator: {
    background: "#ef4444",
  },

  summaryLabel: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
    marginBottom: "2px",
  },

  summaryValue: {
    display: "block",
    fontSize: "17px",
    color: "#111827",
  },

  summaryDivider: {
    width: "1px",
    height: "32px",
    background: "#eef0f4",
    margin:
      "0 18px",
  },

  totalDaysCard: {
    marginTop: "10px",
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "13px",
    padding:
      "14px 16px",
  },

  totalDaysLabel: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
    marginBottom: "2px",
  },

  totalDaysValue: {
    display: "block",
    fontSize: "18px",
    color: "#111827",
  },

  // =====================================================
  // HOURS
  // =====================================================

  hoursGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(3, 1fr)",
    gap: "9px",
  },

  hourCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "13px",
    padding:
      "14px 12px",
    boxShadow:
      "0 2px 8px rgba(15, 23, 42, 0.025)",
    minWidth: 0,
  },

  hourLabel: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
    marginBottom: "5px",
  },

  hourValue: {
    display: "inline-block",
    fontSize: "21px",
    lineHeight: 1,
    color: "#111827",
  },

  hourUnit: {
    display: "block",
    marginTop: "4px",
    fontSize: "9px",
    color: "#a1a7b3",
  },

  // =====================================================
  // CALENDAR
  // =====================================================

  calendarCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "16px",
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.035)",
  },

  calendarHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },

  monthTitle: {
    fontSize: "15px",
    fontWeight: "750",
    color: "#111827",
    textAlign: "center",
    flex: 1,
  },

  monthButton: {
    width: "34px",
    height: "34px",
    border:
      "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#374151",
    borderRadius: "9px",
    fontSize: "22px",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  todayButton: {
    display: "block",
    margin:
      "10px auto 16px",
    border: "none",
    background: "#f3f4f6",
    color: "#4f46e5",
    borderRadius: "8px",
    padding:
      "6px 10px",
    fontSize: "10px",
    fontWeight: "700",
    cursor: "pointer",
  },

  weekHeader: {
    display: "grid",
    gridTemplateColumns:
      "repeat(7, 1fr)",
    gap: "4px",
    marginBottom: "6px",
  },

  weekDay: {
    textAlign: "center",
    fontSize: "9px",
    fontWeight: "700",
    color: "#9ca3af",
    padding:
      "5px 0",
  },

  calendarGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(7, 1fr)",
    gap: "5px",
  },

  emptyCalendarCell: {
    minHeight: "43px",
  },

  calendarCell: {
    minHeight: "43px",
    borderRadius: "9px",
    background: "#fafafa",
    border:
      "1px solid #f0f1f4",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: "2px",
  },

  calendarDate: {
    fontSize: "11px",
    fontWeight: "650",
    color: "#374151",
    lineHeight: 1,
  },

  presentCalendarCell: {
    background: "#ecfdf5",
    border:
      "1px solid #bbf7d0",
  },

  absentCalendarCell: {
    background: "#fef2f2",
    border:
      "1px solid #fecaca",
  },

  holidayCalendarCell: {
    background: "#f3f4f6",
    border:
      "1px solid #e5e7eb",
  },

  presentTick: {
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    background: "#10b981",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: "800",
    lineHeight: 1,
  },

  absentCross: {
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    background: "#ef4444",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "9px",
    fontWeight: "800",
    lineHeight: 1,
  },

  holidayDot: {
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    background: "#d1d5db",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    lineHeight: 1,
  },

  calendarLegend: {
    marginTop: "17px",
    paddingTop: "13px",
    borderTop:
      "1px solid #eef0f4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    flexWrap: "wrap",
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "9px",
    color: "#6b7280",
  },

  legendMark: {
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "9px",
    fontWeight: "800",
  },

  presentLegend: {
    background: "#10b981",
    color: "#ffffff",
  },

  absentLegend: {
    background: "#ef4444",
    color: "#ffffff",
  },

  holidayLegend: {
    background: "#d1d5db",
    color: "#6b7280",
    fontSize: "14px",
  },

  // =====================================================
  // LOADING
  // =====================================================

  loadingPage: {
    minHeight: "100vh",
    background: "#f6f7fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  loadingCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "13px",
  },

  spinner: {
    width: "28px",
    height: "28px",
    border:
      "3px solid #e5e7eb",
    borderTop:
      "3px solid #4f46e5",
    borderRadius: "50%",
  },

  loadingText: {
    margin: 0,
    fontSize: "12px",
    color: "#6b7280",
  },

  // =====================================================
  // FOOTER
  // =====================================================

  footer: {
    width: "100%",
    borderTop:
      "1px solid #e8eaf0",
    background: "#ffffff",
    padding:
      "18px 16px",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    fontSize: "10px",
    color: "#9ca3af",
  },

  footerDot: {
    color: "#d1d5db",
  },
};

export default StudentDashboard;