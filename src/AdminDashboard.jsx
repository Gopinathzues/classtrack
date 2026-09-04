import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "./lib/supabase";

function emptyStats() {
  return {
    totalFinalizedDays: 0,
    presentDays: 0,
    absentDays: 0,
    attendancePercentage: "0.0",
    totalHours: 0,
    presentHours: 0,
    absentHours: 0,
  };
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const [year, month, day] = dateValue.split("-");

  return `${day} ${new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("en-IN", {
    month: "short",
  })} ${year}`;
}

function getDayName(dateValue) {
  if (!dateValue) return "-";

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
    }
  );
}

function getShortDate(dateValue) {
  if (!dateValue) return "-";

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function AdminDashboard({ session }) {


  // =====================================================
  // MONTHLY EXCEL EXPORT
  // =====================================================

  function getMonthDates(monthValue) {
    const [year, month] = monthValue
      .split("-")
      .map(Number);

    const lastDay = new Date(
      year,
      month,
      0
    ).getDate();

    const dates = [];

    for (let day = 1; day <= lastDay; day++) {
      dates.push(
        `${year}-${String(month).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`
      );
    }

    return dates;
  }

  function getMonthLabel(monthValue) {
    const [year, month] = monthValue
      .split("-")
      .map(Number);

    return new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  // =====================================================
  // STUDENTS
  // =====================================================

  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState("");

  // =====================================================
  // DATE
  // =====================================================

  const [date, setDate] = useState(() =>
    getLocalDateString()
  );

  const [dayOrder, setDayOrder] = useState("");
  const [dayType, setDayType] = useState("working");
  const [remark, setRemark] = useState("");

  // =====================================================
  // ATTENDANCE
  // =====================================================

  const [todayAttendance, setTodayAttendance] = useState({});
  const [isFinalized, setIsFinalized] = useState(false);
  const [workingHours, setWorkingHours] = useState(7);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceError, setAttendanceError] =
    useState("");

  // Prevent stale async attendance loads from overwriting
  // newer data when realtime events fire quickly.
  const attendanceLoadIdRef = useRef(0);

  // =====================================================
  // HISTORY
  // =====================================================

  const [savedDates, setSavedDates] = useState([]);

  // =====================================================
  // SEARCH
  // =====================================================

  const [search, setSearch] = useState("");
  const [excelMonth, setExcelMonth] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState("");
  // =====================================================
  // STUDENT MODAL
  // =====================================================

  const [selectedStudent, setSelectedStudent] =
    useState(null);

  // =====================================================
  // LIVE CLOCK
  // =====================================================

  const [currentTime, setCurrentTime] =
    useState(() => new Date());

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
  // LOAD STUDENTS
  // =====================================================

  async function loadStudents() {
    if (!session) return;

    setStudentsLoading(true);
    setStudentsError("");

    const { data, error } = await supabase
      .from("students")
      .select("id, reg_no, name, group_name")
      .eq("active", true)
      .order("id", {
        ascending: true,
      });

    if (error) {
      console.error("Students error:", error);

      setStudentsError(
        "Unable to load students from Supabase."
      );

      setStudents([]);
    } else {
      setStudents(
        (data || []).map((student) => ({
          id: student.id,
          regNo: student.reg_no,
          name: student.name,
          group: student.group_name,
        }))
      );
    }

    setStudentsLoading(false);
  }

  useEffect(() => {
    loadStudents();
  }, [session]);

  // =====================================================
  // LOAD ATTENDANCE FOR SELECTED DATE
  // =====================================================

  async function loadAttendance(selectedDate = date) {
    if (!session) return;

    const requestId = ++attendanceLoadIdRef.current;

    setAttendanceLoading(true);
    setAttendanceError("");

    try {
      const {
        data: dayData,
        error: dayError,
      } = await supabase
        .from("attendance_days")
        .select(
          "attendance_date, day_order, working_hours, is_finalized, day_type, remark"
        )
        .eq("attendance_date", selectedDate)
        .maybeSingle();

      if (dayError) {
        console.error(
          "Attendance day error:",
          dayError
        );

        if (requestId === attendanceLoadIdRef.current) {
          setAttendanceError(
            "Unable to load attendance day."
          );
        }

        return;
      }

      const {
        data: records,
        error: recordsError,
      } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("attendance_date", selectedDate);

      if (recordsError) {
        console.error(
          "Attendance records error:",
          recordsError
        );

        if (requestId === attendanceLoadIdRef.current) {
          setAttendanceError(
            "Unable to load attendance records."
          );
        }

        return;
      }

      // Ignore an older request if a newer realtime/date request
      // has already started.
      if (requestId !== attendanceLoadIdRef.current) {
        return;
      }

      const recordMap = {};

      (records || []).forEach((record) => {
        recordMap[record.student_id] =
          record.status;
      });

      setTodayAttendance(recordMap);

      setDayOrder(
        dayData?.day_order
          ? String(dayData.day_order)
          : ""
      );

      setWorkingHours(
        dayData?.day_type === "holiday"
          ? 0
          : Number(dayData?.working_hours || 7)
      );

      setDayType(
        dayData?.day_type || "working"
      );

      setRemark(
        dayData?.remark || ""
      );

      setIsFinalized(
        Boolean(dayData?.is_finalized)
      );
    } finally {
      if (requestId === attendanceLoadIdRef.current) {
        setAttendanceLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!session) return;

    loadAttendance(date);
  }, [session, date]);

  // =====================================================
  // LOAD FINALIZED HISTORY
  // =====================================================

  async function loadAttendanceDates() {
    if (!session) return;

    const { data, error } = await supabase
      .from("attendance_days")
      .select(
        "attendance_date, day_order, working_hours, day_type, remark"
      )
      .eq("is_finalized", true)
      .order("attendance_date", {
        ascending: false,
      });

    if (error) {
      console.error(
        "History error:",
        error
      );
      return;
    }

    setSavedDates(data || []);
  }

  useEffect(() => {
    if (!session) return;

    loadAttendanceDates();
  }, [session]);

  // =====================================================
  // REALTIME
  // =====================================================

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel(
        `admin-attendance-realtime-${date}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `attendance_date=eq.${date}`,
        },
        () => {
          loadAttendance(date);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_days",
          filter: `attendance_date=eq.${date}`,
        },
        () => {
          loadAttendance(date);
          loadAttendanceDates();
        }
      )
      .subscribe((status) => {
        console.log(
          "Realtime status:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, date]);

  // =====================================================
  // SEARCH
  // =====================================================

  const filteredStudents = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) {
      return students;
    }

    return students.filter(
      (student) =>
        student.name
          .toLowerCase()
          .includes(query) ||
        student.regNo
          .toLowerCase()
          .includes(query)
    );
  }, [students, search]);

  // =====================================================
  // PRESENT / ABSENT
  // =====================================================

  const presentStudents = students.filter(
    (student) =>
      todayAttendance[student.id] ===
      "present"
  );

  const absentStudents = students.filter(
    (student) =>
      todayAttendance[student.id] ===
      "absent"
  );

  const unmarkedStudents = students.filter(
    (student) =>
      !todayAttendance[student.id]
  );

  const presentCount =
    presentStudents.length;

  const absentCount = isFinalized
    ? absentStudents.length
    : unmarkedStudents.length;

  const totalStudents = students.length;

  const attendancePercentage =
    totalStudents > 0
      ? (presentCount / totalStudents) * 100
      : 0;

  // =====================================================
  // ATTENDANCE MESSAGE
  // =====================================================

  function getAttendanceMessage() {
    if (totalStudents === 0) {
      return "No students available";
    }

    if (attendancePercentage >= 90) {
      return "Excellent attendance";
    }

    if (attendancePercentage >= 75) {
      return "Good attendance";
    }

    if (attendancePercentage >= 50) {
      return "Attendance needs attention";
    }

    return "Low attendance";
  }

  // =====================================================
  // ENSURE ATTENDANCE DAY
  // =====================================================

  async function ensureAttendanceDay() {
    const { error } = await supabase
      .from("attendance_days")
      .upsert(
        {
          attendance_date: date,
          day_order: dayOrder
            ? Number(dayOrder)
            : 0,
          working_hours:
            dayType === "working"
              ? 7
              : 0,
          day_type: dayType,
          remark:
            remark.trim() || null,
        },
        {
          onConflict:
            "attendance_date",
        }
      );

    if (error) {
      console.error(
        "Ensure day error:",
        error
      );

      setAttendanceError(
        "Unable to save attendance day."
      );

      return false;
    }

    return true;
  }

  // =====================================================
  // SAVE DAY DETAILS
  // =====================================================

  async function saveDayDetails() {
    setAttendanceError("");

    if (isFinalized) {
      setAttendanceError(
        "This attendance day is finalized and locked."
      );
      return;
    }

    if (
      dayType === "holiday" &&
      !remark.trim()
    ) {
      setAttendanceError(
        "Please enter the holiday name in Remark."
      );
      return;
    }

    const dayReady =
      await ensureAttendanceDay();

    if (!dayReady) return;

    // Keep attendance_records exactly in sync with the current
    // open-day UI state. Save never creates Absent records.
    if (dayType === "holiday") {
      const { error: deleteError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("attendance_date", date);

      if (deleteError) {
        console.error(
          "Holiday attendance cleanup error:",
          deleteError
        );

        setAttendanceError(
          "Unable to clear attendance for the holiday."
        );
        return;
      }
    } else {
      const presentIds = new Set(
        Object.entries(todayAttendance)
          .filter(([, status]) => status === "present")
          .map(([studentId]) => String(studentId))
      );

      const { data: existingRecords, error: existingError } =
        await supabase
          .from("attendance_records")
          .select("student_id, status")
          .eq("attendance_date", date);

      if (existingError) {
        console.error(
          "Existing attendance error:",
          existingError
        );

        setAttendanceError(
          "Unable to synchronize attendance."
        );
        return;
      }

      const recordsToDelete = (existingRecords || [])
        .filter(
          (record) =>
            !presentIds.has(String(record.student_id))
        );

      if (recordsToDelete.length > 0) {
        const deleteResults = await Promise.all(
          recordsToDelete.map((record) =>
            supabase
              .from("attendance_records")
              .delete()
              .eq("attendance_date", date)
              .eq("student_id", record.student_id)
          )
        );

        const deleteError = deleteResults.find(
          (result) => result.error
        )?.error;

        if (deleteError) {
          console.error(
            "Attendance cleanup error:",
            deleteError
          );

          setAttendanceError(
            "Unable to remove unmarked attendance."
          );
          return;
        }
      }

      const presentRecords = students
        .filter((student) =>
          presentIds.has(String(student.id))
        )
        .map((student) => ({
          attendance_date: date,
          student_id: student.id,
          status: "present",
        }));

      if (presentRecords.length > 0) {
        const { error: presentError } = await supabase
          .from("attendance_records")
          .upsert(
            presentRecords,
            {
              onConflict:
                "attendance_date,student_id",
            }
          );

        if (presentError) {
          console.error(
            "Attendance save error:",
            presentError
          );

          setAttendanceError(
            "Unable to save attendance."
          );
          return;
        }
      }
    }

    const { error: dayError } = await supabase
      .from("attendance_days")
      .update({
        day_type: dayType,
        remark:
          remark.trim() || null,
        working_hours:
          dayType === "working"
            ? 7
            : 0,
      })
      .eq("attendance_date", date);

    if (dayError) {
      console.error(
        "Day details error:",
        dayError
      );

      setAttendanceError(
        "Unable to save day details."
      );
      return;
    }

    await loadAttendance(date);
    await loadAttendanceDates();

    alert(
      "Day details and attendance saved successfully."
    );
  }

  // =====================================================
  // TOGGLE PRESENT
  // =====================================================

  async function toggleAttendance(studentId) {
    setAttendanceError("");

    if (isFinalized) {
      setAttendanceError(
        "This attendance day is finalized and locked."
      );
      return;
    }

    if (dayType === "holiday") {
      setAttendanceError(
        "This is a holiday. Attendance cannot be marked."
      );
      return;
    }

    const currentStatus =
      todayAttendance[studentId];

    // Present -> Unmarked
    if (currentStatus === "present") {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .eq("attendance_date", date)
        .eq("student_id", studentId);

      if (error) {
        console.error(
          "Delete attendance error:",
          error
        );

        setAttendanceError(
          "Unable to update attendance."
        );
        return;
      }

      setTodayAttendance((previous) => {
        const updated = {
          ...previous,
        };

        delete updated[studentId];

        return updated;
      });

      return;
    }

    // Unmarked -> Present
    const dayReady =
      await ensureAttendanceDay();

    if (!dayReady) return;

    const { error } = await supabase
      .from("attendance_records")
      .upsert(
        {
          attendance_date: date,
          student_id: studentId,
          status: "present",
        },
        {
          onConflict:
            "attendance_date,student_id",
        }
      );

    if (error) {
      console.error(
        "Mark present error:",
        error
      );

      setAttendanceError(
        "Unable to mark student present."
      );
      return;
    }

    setTodayAttendance((previous) => ({
      ...previous,
      [studentId]: "present",
    }));
  }

  // =====================================================
  // DAY ORDER
  // =====================================================

  async function handleDayOrderChange(
    value
  ) {
    if (isFinalized) {
      setAttendanceError(
        "This attendance day is finalized and locked."
      );
      return;
    }

    setDayOrder(value);

    const dayReady =
      await ensureAttendanceDay();

    if (!dayReady) return;

    const { error } = await supabase
      .from("attendance_days")
      .update({
        day_order: value
          ? Number(value)
          : 0,
      })
      .eq("attendance_date", date);

    if (error) {
      console.error(
        "Day order error:",
        error
      );

      setAttendanceError(
        "Unable to save day order."
      );

      return;
    }
  }

  // =====================================================
  // FINALIZE
  // =====================================================

  async function finalizeAttendance() {
    setAttendanceError("");

    if (isFinalized) {
      setAttendanceError(
        "This attendance day is already finalized."
      );
      return;
    }

    if (
      dayType === "working" &&
      !dayOrder
    ) {
      setAttendanceError(
        "Please enter the Day Order before finalizing a working day."
      );
      return;
    }

    if (
      dayType === "holiday" &&
      !remark.trim()
    ) {
      setAttendanceError(
        "Please enter the holiday name in Remark."
      );
      return;
    }

    if (students.length === 0) {
      setAttendanceError(
        "No students are available."
      );
      return;
    }

    const confirmed = window.confirm(
      `Finalize attendance for ${formatDate(
        date
      )}?\n\nAll students not marked Present will be marked Absent.`
    );

    if (!confirmed) return;

    const dayReady =
      await ensureAttendanceDay();

    if (!dayReady) return;

    const {
      data: records,
      error,
    } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .eq(
        "attendance_date",
        date
      );

    if (error) {
      console.error(
        "Existing records error:",
        error
      );

      setAttendanceError(
        "Unable to read attendance records."
      );

      return;
    }

    const presentIds = new Set(
      (records || [])
        .filter(
          (record) =>
            record.status ===
            "present"
        )
        .map((record) =>
          String(record.student_id)
        )
    );

    const absentRecords =
      dayType === "working"
        ? students
          .filter(
            (student) =>
              !presentIds.has(
                String(student.id)
              )
          )
          .map((student) => ({
            attendance_date: date,
            student_id: student.id,
            status: "absent",
          }))
        : [];

    if (
      absentRecords.length > 0
    ) {
      const {
        error: absentError,
      } = await supabase
        .from("attendance_records")
        .upsert(
          absentRecords,
          {
            onConflict:
              "attendance_date,student_id",
          }
        );

      if (absentError) {
        console.error(
          "Absent records error:",
          absentError
        );

        setAttendanceError(
          "Unable to create absent records."
        );

        return;
      }
    }

    const {
      error: finalizeError,
    } = await supabase
      .from("attendance_days")
      .update({
        is_finalized: true,

        day_order:
          dayType === "working"
            ? Number(dayOrder)
            : 0,

        working_hours:
          dayType === "working"
            ? 7
            : 0,

        day_type: dayType,

        remark:
          remark.trim() || null,
      })
      .eq(
        "attendance_date",
        date
      );

    if (finalizeError) {
      console.error(
        "Finalize error:",
        finalizeError
      );

      setAttendanceError(
        "Unable to finalize attendance."
      );

      return;
    }

    await loadAttendance(date);
    await loadAttendanceDates();

    alert(
      "Attendance finalized successfully."
    );
  }

  // =====================================================
  // COPY HELPERS
  // =====================================================

  function createStudentList(
    studentsList
  ) {
    if (studentsList.length === 0) {
      return "None";
    }

    return studentsList
      .map(
        (student, index) =>
          `${index + 1}. ${student.name}`
      )
      .join("\n");
  }

  // =====================================================
  // FULL RECORD
  // =====================================================

  function createAttendanceRecord() {
    const itPresent =
      presentStudents.filter(
        (student) =>
          student.group === "IT"
      );

    const itCsPresent =
      presentStudents.filter(
        (student) =>
          student.group === "IT-CS"
      );

    const itAbsent =
      absentStudents.filter(
        (student) =>
          student.group === "IT"
      );

    const itCsAbsent =
      absentStudents.filter(
        (student) =>
          student.group === "IT-CS"
      );

    return `Day Order - ${dayOrder || "-"
      }

*${formatDate(date)}* *|* *${getDayName(date)}*

Present:

*IT*

${createStudentList(itPresent)}

*IT-CS*

${createStudentList(itCsPresent)}

Absent:

*IT*

${createStudentList(itAbsent)}

*IT-CS*

${createStudentList(itCsAbsent)}`;
  }

  // =====================================================
  // COPY PRESENT
  // =====================================================

  async function copyPresentList() {
    const itStudents =
      presentStudents.filter(
        (student) =>
          student.group === "IT"
      );

    const itCsStudents =
      presentStudents.filter(
        (student) =>
          student.group === "IT-CS"
      );

    const message = `*Day Order - ${dayOrder || "-"
      }*

*${formatDate(date)}* *|* *${getDayName(date)}*

*IT*

${createStudentList(itStudents)}

*IT-CS*

${createStudentList(
        itCsStudents
      )}`;

    try {
      await navigator.clipboard.writeText(
        message
      );

      alert(
        "Present list copied!"
      );
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      alert(
        "Unable to copy present list."
      );
    }
  }

  // =====================================================
  // COPY ABSENT
  // =====================================================

  async function copyAbsentList() {
    if (!isFinalized) {
      alert(
        "Finalize attendance before copying the Absent list."
      );
      return;
    }

    const itStudents =
      absentStudents.filter(
        (student) =>
          student.group === "IT"
      );

    const itCsStudents =
      absentStudents.filter(
        (student) =>
          student.group === "IT-CS"
      );

    const message = `*Day Order - ${dayOrder || "-"
      }*

*${formatDate(date)}* *|* *${getDayName(date)}*

*IT*

${createStudentList(itStudents)}

*IT-CS*

${createStudentList(
        itCsStudents
      )}`;

    try {
      await navigator.clipboard.writeText(
        message
      );

      alert(
        "Absent list copied!"
      );
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      alert(
        "Unable to copy absent list."
      );
    }
  }

  // =====================================================
  // COPY FULL RECORD
  // =====================================================

  async function copyFullRecord() {
    if (!isFinalized) {
      alert(
        "Finalize attendance before copying the full record."
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(
        createAttendanceRecord()
      );

      alert(
        "Attendance record copied!"
      );
    } catch (error) {
      console.error(
        "Clipboard error:",
        error
      );

      alert(
        "Unable to copy attendance record."
      );
    }
  }

  // =====================================================
  // SAVE TXT
  // =====================================================

  function saveAsTxt() {
    if (!isFinalized) {
      alert(
        "Finalize attendance before saving the record."
      );
      return;
    }

    const content =
      createAttendanceRecord();

    const blob = new Blob(
      [content],
      {
        type: "text/plain;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `attendance-${date}.txt`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  // =====================================================
  // STUDENT STATISTICS
  // =====================================================

  const getStudentAttendance = useCallback(
    async function getStudentAttendance(student) {
      const {
      data: finalizedDays,
      error: daysError,
    } = await supabase
      .from("attendance_days")
      .select(
        "attendance_date, working_hours, day_type"
      )
      .eq("is_finalized", true)
      .eq("day_type", "working")
      .order(
        "attendance_date",
        {
          ascending: true,
        }
      );

    if (daysError) {
      console.error(
        "Statistics days error:",
        daysError
      );

      return emptyStats();
    }

    const days =
      finalizedDays || [];

    if (days.length === 0) {
      return emptyStats();
    }

    const dates = days.map(
      (day) =>
        day.attendance_date
    );

    const {
      data: records,
      error: recordsError,
    } = await supabase
      .from("attendance_records")
      .select(
        "attendance_date, status"
      )
      .eq(
        "student_id",
        student.id
      )
      .in(
        "attendance_date",
        dates
      );

    if (recordsError) {
      console.error(
        "Statistics records error:",
        recordsError
      );

      return emptyStats();
    }

    const recordMap = {};

    (records || []).forEach(
      (record) => {
        recordMap[
          record.attendance_date
        ] = record.status;
      }
    );

    const totalFinalizedDays =
      days.length;

    const presentDays =
      days.filter(
        (day) =>
          recordMap[
          day.attendance_date
          ] === "present"
      ).length;

    const absentDays =
      totalFinalizedDays -
      presentDays;

    const attendancePercentage =
      totalFinalizedDays > 0
        ? (
          (presentDays /
            totalFinalizedDays) *
          100
        ).toFixed(1)
        : "0.0";

    const totalHours =
      days.reduce(
        (sum, day) =>
          sum +
          Number(
            day.working_hours || 7
          ),
        0
      );

    const presentHours =
      days.reduce(
        (sum, day) => {
          if (
            recordMap[
            day.attendance_date
            ] === "present"
          ) {
            return (
              sum +
              Number(
                day.working_hours ||
                7
              )
            );
          }

          return sum;
        },
        0
      );

    const absentHours =
      totalHours -
      presentHours;

    return {
      totalFinalizedDays,
      presentDays,
      absentDays,
      attendancePercentage,
      totalHours,
      presentHours,
      absentHours,
    };
    },
    []
  );

  async function exportMonthlyExcel() {
    setExcelError("");
    setExcelLoading(true);

    try {
      const monthDates =
        getMonthDates(excelMonth);

      const {
        data: monthDays,
        error: daysError,
      } = await supabase
        .from("attendance_days")
        .select(
          "attendance_date, day_order, working_hours, is_finalized, day_type, remark"
        )
        .gte(
          "attendance_date",
          monthDates[0]
        )
        .lte(
          "attendance_date",
          monthDates[monthDates.length - 1]
        )
        .order("attendance_date", {
          ascending: true,
        });

      if (daysError) {
        console.error(
          "Monthly Excel days error:",
          daysError
        );

        setExcelError(
          "Unable to load monthly attendance days."
        );

        return;
      }

      const dayMap = {};

      (monthDays || []).forEach((day) => {
        dayMap[day.attendance_date] = day;
      });

      // ---------------------------------------------------
      // MONTH MUST BE COMPLETELY FINALIZED
      // ---------------------------------------------------

      const unfinishedDates = monthDates.filter(

        (dateValue) => {

          const day = dayMap[dateValue];

          return !day || !day.is_finalized;

        }

      );


      if (unfinishedDates.length > 0) {

        throw new Error(

          `This month is not fully finished. ${unfinishedDates.length} date(s) are still not finalized.`

        );

      }


      const {
        data: monthRecords,
        error: recordsError,
      } = await supabase
        .from("attendance_records")
        .select(
          "attendance_date, student_id, status"
        )
        .gte(
          "attendance_date",
          monthDates[0]
        )
        .lte(
          "attendance_date",
          monthDates[monthDates.length - 1]
        );

      if (recordsError) {
        console.error(
          "Monthly Excel records error:",
          recordsError
        );

        setExcelError(
          "Unable to load monthly attendance records."
        );

        return;
      }

      const recordMap = {};

      (monthRecords || []).forEach(
        (record) => {
          if (!recordMap[record.attendance_date]) {
            recordMap[record.attendance_date] = {};
          }

          recordMap[record.attendance_date][
            record.student_id
          ] = record.status;
        }
      );

      // ---------------------------------------------------
      // WORKING DAYS
      // ---------------------------------------------------

      const workingDays =
        monthDates.filter(
          (dateValue) =>
            dayMap[dateValue]?.day_type ===
            "working"
        );

      const holidayDays =
        monthDates.filter(
          (dateValue) =>
            dayMap[dateValue]?.day_type ===
            "holiday"
        );

      // ---------------------------------------------------
      // EXCEL DATA
      // ---------------------------------------------------

      const headerRow = [
        "Register Number",
        "Student Name",
        "Group",
        ...monthDates.map((dateValue) => {
          const day = dayMap[dateValue];

          if (day?.day_type === "holiday") {
            return `${getShortDate(
              dateValue
            )}\nHOLIDAY${day.remark
                ? `\n${day.remark}`
                : ""
              }`;
          }

          return `${getShortDate(
            dateValue
          )}${day?.day_order
              ? `\nDO ${day.day_order}`
              : ""
            }`;
        }),
        "Total Working Days",
        "Present Days",
        "Absent Days",
        "Attendance %",
        "Total Hours",
        "Present Hours",
        "Absent Hours",
      ];

      // Build working hours row matching header positions
      const workingHoursRowValues = [
        "", "", "Working Hours", // Label offset under Group column
        ...monthDates.map((dateValue) => {
          const day = dayMap[dateValue];
          return day?.day_type === "working" ? Number(day.working_hours || 7) : 0;
        }),
        "", "", "", "", "", "", ""
      ];

      const worksheetData = [
        [
          `MONTHLY ATTENDANCE — ${getMonthLabel(
            excelMonth
          )}`,
        ],
        [],
        headerRow,
        workingHoursRowValues,
      ];

      students.forEach((student, studentIndex) => {
        const rowNumber = studentIndex + 5; // Student rows start at Excel row 5

        const row = [
          student.regNo,
          student.name,
          student.group,
        ];

        monthDates.forEach(
          (dateValue) => {
            const day =
              dayMap[dateValue];

            if (
              day?.day_type ===
              "holiday"
            ) {
              row.push("HOLIDAY");
              return;
            }

            const status =
              recordMap[
              dateValue
              ]?.[student.id];

            row.push(
              status === "present"
                ? "Present"
                : "Absent"
            );
          }
        );

        const firstAttendanceColumn = 4;
        const lastAttendanceColumn =
          firstAttendanceColumn +
          monthDates.length -
          1;

        const firstColumnLetter =
          XLSX.utils.encode_col(
            firstAttendanceColumn - 1
          );

        const lastColumnLetter =
          XLSX.utils.encode_col(
            lastAttendanceColumn - 1
          );

        const totalWorkingDaysColumn =
          lastAttendanceColumn + 1;

        const presentDaysColumn =
          totalWorkingDaysColumn + 1;

        const absentDaysColumn =
          totalWorkingDaysColumn + 2;

        const attendancePercentageColumn =
          totalWorkingDaysColumn + 3;

        const totalHoursColumn =
          totalWorkingDaysColumn + 4;

        const presentHoursColumn =
          totalWorkingDaysColumn + 5;

        const absentHoursColumn =
          totalWorkingDaysColumn + 6;

        const totalWorkingDaysLetter =
          XLSX.utils.encode_col(
            totalWorkingDaysColumn - 1
          );

        const presentDaysLetter =
          XLSX.utils.encode_col(
            presentDaysColumn - 1
          );

        const absentDaysLetter =
          XLSX.utils.encode_col(
            absentDaysColumn - 1
          );

        const totalHoursLetter =
          XLSX.utils.encode_col(
            totalHoursColumn - 1
          );

        const presentHoursLetter =
          XLSX.utils.encode_col(
            presentHoursColumn - 1
          );

        const absentHoursLetter =
          XLSX.utils.encode_col(
            absentHoursColumn - 1
          );

        row.push({
          f: `COUNTIF(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber},"<>HOLIDAY")`,
        });

        row.push({
          f: `COUNTIF(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber},"Present")`,
        });

        row.push({
          f: `COUNTIF(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber},"Absent")`,
        });

        row.push({
          f: `IF(${totalWorkingDaysLetter}${rowNumber}=0,0,${presentDaysLetter}${rowNumber}/${totalWorkingDaysLetter}${rowNumber})`,
        });

        // Fixed formulas referencing Row 4 for working hours
        row.push({
          f: `SUMPRODUCT(--(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber}<>"HOLIDAY"),${firstColumnLetter}$4:${lastColumnLetter}$4)`,
        });

        row.push({
          f: `SUMPRODUCT(--(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber}="Present"),${firstColumnLetter}$4:${lastColumnLetter}$4)`,
        });

        row.push({
          f: `SUMPRODUCT(--(${firstColumnLetter}${rowNumber}:${lastColumnLetter}${rowNumber}="Absent"),${firstColumnLetter}$4:${lastColumnLetter}$4)`,
        });

        worksheetData.push(row);
      });

      // ---------------------------------------------------
      // CREATE WORKSHEET
      // ---------------------------------------------------

      const worksheet =
        XLSX.utils.aoa_to_sheet(
          worksheetData
        );

      // ---------------------------------------------------
      // WORKING-HOURS ROW
      // ---------------------------------------------------

      const workingHoursRow = 3;

      const workingHoursCells = monthDates
        .map((dateValue, index) => {
          const columnLetter =
            XLSX.utils.encode_col(
              3 + index
            );

          const day =
            dayMap[dateValue];

          return {
            columnLetter,
            hours:
              day?.day_type === "working"
                ? Number(day.working_hours || 7)
                : 0,
          };
        });

      // ---------------------------------------------------
      // MERGE TITLE
      // ---------------------------------------------------

      worksheet["A1"] = {
        v: `MONTHLY ATTENDANCE — ${getMonthLabel(
          excelMonth
        )}`,
        t: "s",
      };

      worksheet["A2"] = {
        v: `Working Days: ${workingDays.length} | Holidays: ${holidayDays.length}`,
        t: "s",
      };

      // ---------------------------------------------------
      // COLUMN WIDTHS
      // ---------------------------------------------------

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 12 },
        ...monthDates.map(() => ({
          wch: 14,
        })),
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 15 },
        { wch: 15 },
      ];

      // ---------------------------------------------------
      // ROW HEIGHTS
      // ---------------------------------------------------

      worksheet["!rows"] = [
        { hpt: 26 },
        { hpt: 20 },
        { hpt: 42 },
      ];

      // ---------------------------------------------------
      // MERGE TITLE
      // ---------------------------------------------------

      worksheet["!merges"] = [
        {
          s: { r: 0, c: 0 },
          e: {
            r: 0,
            c: headerRow.length - 1,
          },
        },
        {
          s: { r: 1, c: 0 },
          e: {
            r: 1,
            c: headerRow.length - 1,
          },
        },
      ];

      // ---------------------------------------------------
      // FORMAT CELLS
      // ---------------------------------------------------

      const range =
        XLSX.utils.decode_range(
          worksheet["!ref"]
        );

      for (
        let rowIndex = range.s.r;
        rowIndex <= range.e.r;
        rowIndex++
      ) {
        for (
          let colIndex = range.s.c;
          colIndex <= range.e.c;
          colIndex++
        ) {
          const cellAddress =
            XLSX.utils.encode_cell({
              r: rowIndex,
              c: colIndex,
            });

          if (!worksheet[cellAddress]) {
            continue;
          }

          worksheet[cellAddress].s = {
            alignment: {
              vertical: "center",
              horizontal:
                colIndex < 3
                  ? "left"
                  : "center",
              wrapText: true,
            },
            border: {
              top: {
                style: "thin",
                color: {
                  rgb: "D1D5DB",
                },
              },
              bottom: {
                style: "thin",
                color: {
                  rgb: "D1D5DB",
                },
              },
              left: {
                style: "thin",
                color: {
                  rgb: "D1D5DB",
                },
              },
              right: {
                style: "thin",
                color: {
                  rgb: "D1D5DB",
                },
              },
            },
          };
        }
      }

      // Title
      worksheet["A1"].s = {
        font: {
          bold: true,
          sz: 16,
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
      };

      worksheet["A2"].s = {
        font: {
          bold: true,
          sz: 11,
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
        },
      };

      // Header
      for (
        let column = 0;
        column < headerRow.length;
        column++
      ) {
        const cellAddress =
          XLSX.utils.encode_cell({
            r: 2,
            c: column,
          });

        if (worksheet[cellAddress]) {
          worksheet[cellAddress].s = {
            font: {
              bold: true,
              sz: 10,
            },
            alignment: {
              horizontal: "center",
              vertical: "center",
              wrapText: true,
            },
            border: {
              top: {
                style: "thin",
                color: {
                  rgb: "9CA3AF",
                },
              },
              bottom: {
                style: "thin",
                color: {
                  rgb: "9CA3AF",
                },
              },
              left: {
                style: "thin",
                color: {
                  rgb: "9CA3AF",
                },
              },
              right: {
                style: "thin",
                color: {
                  rgb: "9CA3AF",
                },
              },
            },
          };
        }
      }

      // Percentage formatting
      const percentageColumn =
        3 +
        monthDates.length +
        3;

      for (
        let rowIndex = 3;
        rowIndex <=
        students.length + 2;
        rowIndex++
      ) {
        const address =
          XLSX.utils.encode_cell({
            r: rowIndex,
            c: percentageColumn,
          });

        if (worksheet[address]) {
          worksheet[address].z =
            "0.0%";
        }
      }

      // ---------------------------------------------------
      // FREEZE PANES
      // ---------------------------------------------------

      worksheet["!freeze"] = {
        xSplit: 3,
        ySplit: 3,
      };

      // ---------------------------------------------------
      // CREATE WORKBOOK
      // ---------------------------------------------------

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Monthly Attendance"
      );

      // ---------------------------------------------------
      // DOWNLOAD
      // ---------------------------------------------------

      XLSX.writeFile(
        workbook,
        `attendance-${excelMonth}.xlsx`
      );
    } catch (error) {
      console.error(
        "Monthly Excel export error:",
        error
      );

      setExcelError(
        error?.message ||
        "Unable to generate the monthly Excel file."
      );
    } finally {
      setExcelLoading(false);
    }
  }
  // =====================================================
  // LOGOUT
  // =====================================================

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // =====================================================
  // LOADING
  // =====================================================

  if (studentsLoading) {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div
            style={styles.spinner}
          ></div>

          <p
            style={styles.loadingText}
          >
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // STUDENT ERROR
  // =====================================================

  if (studentsError) {
    return (
      <div style={styles.loadingPage}>
        <div
          style={{
            ...styles.loadingCard,
            textAlign: "center",
          }}
        >
          <strong
            style={{
              color: "#111827",
              fontSize: "15px",
            }}
          >
            Unable to load dashboard
          </strong>

          <p
            style={{
              ...styles.loadingText,
              marginTop: "6px",
            }}
          >
            {studentsError}
          </p>

          <button
            type="button"
            onClick={loadStudents}
            style={styles.retryButton}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div style={styles.page}>
      {/* =================================================
          HEADER
      ================================================== */}

      <header style={styles.header}>
        <div
          style={styles.headerContent}
        >
          <div>
            <div
              style={styles.brand}
            >
              Attendance Tracker
            </div>

            <h1
              style={
                styles.headerTitle
              }
            >
              Admin Dashboard
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

        <section
          style={styles.clockCard}
        >
          <div
            style={styles.clockTime}
          >
            {clockTime}
          </div>

          <div
            style={styles.clockDate}
          >
            {clockDate}
          </div>
        </section>

        {/* =================================================
            WELCOME
        ================================================== */}

        <section
          style={
            styles.welcomeSection
          }
        >
          <p
            style={
              styles.welcomeLabel
            }
          >
            Welcome back
          </p>

          <h2
            style={
              styles.welcomeName
            }
          >
            Class Representative
          </h2>

          <p
            style={
              styles.welcomeText
            }
          >
            Manage today's attendance.
          </p>
        </section>

        {/* =================================================
            ATTENDANCE DAY DETAILS
        ================================================== */}

        <section
          style={
            styles.dayDetailsCard
          }
        >
          <div
            style={
              styles.cardHeader
            }
          >
            <div>
              <h2
                style={
                  styles.cardTitle
                }
              >
                Attendance
              </h2>

              <p
                style={
                  styles.cardSubtitle
                }
              >
                Attendance day details
              </p>
            </div>

            <span
              style={{
                ...styles.statusBadge,
                ...(isFinalized
                  ? styles.finalizedBadge
                  : dayType === "holiday"
                    ? styles.holidayBadge
                    : styles.openBadge),
              }}
            >
              {isFinalized
                ? dayType === "holiday"
                  ? "Holiday"
                  : "Finalized"
                : dayType === "holiday"
                  ? "Holiday"
                  : "Open"}
            </span>
          </div>

          <div
            style={
              styles.dayPreview
            }
          >
            <div>
              <span
                style={
                  styles.smallLabel
                }
              >
                Date
              </span>

              <strong
                style={
                  styles.previewValue
                }
              >
                {getShortDate(date)}
              </strong>
            </div>

            <div>
              <span
                style={
                  styles.smallLabel
                }
              >
                Day
              </span>

              <strong
                style={
                  styles.previewValue
                }
              >
                {getDayName(date)}
              </strong>
            </div>
          </div>

          <div
            style={
              styles.formGroup
            }
          >
            <label
              style={styles.label}
            >
              Choose Date
            </label>

            <input
              type="date"
              value={date}
              disabled={isFinalized}
              onChange={(event) =>
                setDate(
                  event.target.value
                )
              }
              style={styles.input}
            />
          </div>

          <div
            style={
              styles.twoColumn
            }
          >
            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.label
                }
              >
                Day Type
              </label>

              <select
                value={dayType}
                disabled={isFinalized}
                onChange={(event) =>
                  setDayType(
                    event.target.value
                  )
                }
                style={
                  styles.input
                }
              >
                <option value="working">
                  Working Day
                </option>

                <option value="holiday">
                  Holiday
                </option>
              </select>
            </div>

            <div
              style={
                styles.formGroup
              }
            >
              <label
                style={
                  styles.label
                }
              >
                Day Order
              </label>

              <input
                type="number"
                min="1"
                max="10"
                placeholder="Order"
                value={dayOrder}
                disabled={
                  isFinalized ||
                  dayType ===
                  "holiday"
                }
                onChange={(event) =>
                  handleDayOrderChange(
                    event.target.value
                  )
                }
                style={
                  styles.input
                }
              />
            </div>
          </div>

          <div
            style={
              styles.formGroup
            }
          >
            <label
              style={styles.label}
            >
              Remark
            </label>

            <input
              type="text"
              placeholder={
                dayType ===
                  "holiday"
                  ? "e.g. Diwali"
                  : "Optional"
              }
              value={remark}
              disabled={isFinalized}
              onChange={(event) =>
                setRemark(
                  event.target.value
                )
              }
              style={styles.input}
            />
          </div>

          {attendanceError && (
            <div
              style={
                styles.errorBox
              }
            >
              <div
                style={
                  styles.errorIcon
                }
              >
                !
              </div>

              <div>
                <strong
                  style={
                    styles.errorTitle
                  }
                >
                  Attendance update
                </strong>

                <p
                  style={
                    styles.errorText
                  }
                >
                  {attendanceError}
                </p>
              </div>
            </div>
          )}

          {!isFinalized && (
            <button
              type="button"
              onClick={
                saveDayDetails
              }
              style={
                styles.primaryButton
              }
            >
              Save Day Details
            </button>
          )}

          {isFinalized && (
            <div
              style={
                styles.lockedMessage
              }
            >
              🔒 This attendance day
              is finalized and locked.
            </div>
          )}
        </section>

        {/* =================================================
            HISTORY
        ================================================== */}

        {savedDates.length > 0 && (
          <section
            style={
              styles.historyCard
            }
          >
            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Attendance History
                </h2>

                <p
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Select a finalized date
                </p>
              </div>
            </div>

            <select
              value={date}
              onChange={(event) =>
                setDate(
                  event.target.value
                )
              }
              style={
                styles.historySelect
              }
            >
              <option value={date}>
                {getShortDate(date)} —{" "}
                {getDayName(date)}
              </option>

              {savedDates
                .filter(
                  (record) =>
                    record.attendance_date !==
                    date
                )
                .map((record) => {
                  const savedDate =
                    record.attendance_date;

                  return (
                    <option
                      key={savedDate}
                      value={savedDate}
                    >
                      {getShortDate(
                        savedDate
                      )}{" "}
                      —{" "}
                      {getDayName(
                        savedDate
                      )}
                      {record.day_type ===
                        "holiday"
                        ? ` — Holiday${record.remark
                          ? `: ${record.remark}`
                          : ""
                        }`
                        : ""}
                    </option>
                  );
                })}
            </select>
          </section>
        )}

        {/* =================================================
            HOLIDAY
        ================================================== */}

        {dayType === "holiday" ? (
          <section
            style={
              styles.holidayCard
            }
          >
            <div
              style={
                styles.holidayIcon
              }
            >
              •
            </div>

            <div>
              <h2
                style={
                  styles.sectionTitle
                }
              >
                Holiday
              </h2>

              <p
                style={
                  styles.sectionSubtitle
                }
              >
                {remark ||
                  "Enter a holiday remark above."}
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* =================================================
                TODAY'S ATTENDANCE
            ================================================== */}

            <section
              style={
                styles.section
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.sectionTitle
                    }
                  >
                    Today's Attendance
                  </h2>

                  <p
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    {isFinalized
                      ? "Finalized attendance"
                      : "Mark students present"}
                  </p>
                </div>
              </div>

              <div
                style={
                  styles.attendanceCard
                }
              >
                <div
                  style={
                    styles.attendanceMain
                  }
                >
                  <div
                    style={{
                      ...styles.percentageCircle,
                      background: `conic-gradient(
                        #4f46e5 ${(attendancePercentage /
                          100) *
                        360
                        }deg,
                        #eef0f5 ${(attendancePercentage /
                          100) *
                        360
                        }deg
                      )`,
                    }}
                  >
                    <strong
                      style={
                        styles.percentageValue
                      }
                    >
                      {attendancePercentage.toFixed(
                        0
                      )}
                      %
                    </strong>
                  </div>

                  <div
                    style={
                      styles.attendanceMessage
                    }
                  >
                    <strong
                      style={
                        styles.attendanceStatus
                      }
                    >
                      {getAttendanceMessage()}
                    </strong>

                    <span
                      style={
                        styles.attendanceDescription
                      }
                    >
                      {presentCount} present
                      {isFinalized
                        ? ` • ${absentCount} absent`
                        : ` • ${unmarkedStudents.length} unmarked`}
                    </span>
                  </div>
                </div>

                <div
                  style={
                    styles.attendanceSummary
                  }
                >
                  <div
                    style={
                      styles.summaryItem
                    }
                  >
                    <span
                      style={{
                        ...styles.summaryIndicator,
                        ...styles.presentIndicator,
                      }}
                    ></span>

                    <div>
                      <span
                        style={
                          styles.summaryLabel
                        }
                      >
                        Present
                      </span>

                      <strong
                        style={
                          styles.summaryValue
                        }
                      >
                        {presentCount}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={
                      styles.summaryDivider
                    }
                  ></div>

                  <div
                    style={
                      styles.summaryItem
                    }
                  >
                    <span
                      style={{
                        ...styles.summaryIndicator,
                        ...styles.absentIndicator,
                      }}
                    ></span>

                    <div>
                      <span
                        style={
                          styles.summaryLabel
                        }
                      >
                        {isFinalized
                          ? "Absent"
                          : "Unmarked"}
                      </span>

                      <strong
                        style={
                          styles.summaryValue
                        }
                      >
                        {absentCount}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={
                  styles.totalDaysCard
                }
              >
                <div>
                  <span
                    style={
                      styles.totalDaysLabel
                    }
                  >
                    Total Students
                  </span>

                  <strong
                    style={
                      styles.totalDaysValue
                    }
                  >
                    {totalStudents}
                  </strong>
                </div>

                <div
                  style={
                    styles.totalStudentSide
                  }
                >
                  <span
                    style={
                      styles.totalDaysLabel
                    }
                  >
                    Working Hours
                  </span>

                  <strong
                    style={
                      styles.totalDaysValue
                    }
                  >
                    {workingHours}h
                  </strong>
                </div>
              </div>
            </section>

            {/* =================================================
                SEARCH
            ================================================== */}

            <section
              style={
                styles.section
              }
            >
              <div
                style={
                  styles.searchCard
                }
              >
                <div
                  style={
                    styles.searchIcon
                  }
                >
                  ⌕
                </div>

                <input
                  type="text"
                  placeholder="Search name or register number..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  style={
                    styles.searchInput
                  }
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    style={
                      styles.clearButton
                    }
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </section>

            {/* =================================================
                STUDENT LIST
            ================================================== */}

            <section
              style={
                styles.section
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.sectionTitle
                    }
                  >
                    Students
                  </h2>

                  <p
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    Tap a student for
                    attendance details
                  </p>
                </div>

                <span
                  style={
                    styles.studentCountBadge
                  }
                >
                  {filteredStudents.length}
                </span>
              </div>

              <div
                style={
                  styles.studentList
                }
              >
                {filteredStudents.map(
                  (student) => {
                    const status =
                      todayAttendance[
                      student.id
                      ];

                    return (
                      <div
                        key={
                          student.id
                        }
                        style={{
                          ...styles.studentCard,
                          ...(status ===
                            "present"
                            ? styles.studentCardPresent
                            : {}),
                          ...(status ===
                            "absent"
                            ? styles.studentCardAbsent
                            : {}),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudent(
                              student
                            )
                          }
                          style={
                            styles.studentIdentityButton
                          }
                        >
                          <div
                            style={
                              styles.studentAvatar
                            }
                          >
                            {student.name
                              ?.charAt(
                                0
                              )
                              ?.toUpperCase() ||
                              "S"}
                          </div>

                          <div
                            style={
                              styles.studentIdentity
                            }
                          >
                            <strong
                              style={
                                styles.studentName
                              }
                            >
                              {student.name}
                            </strong>

                            <span
                              style={
                                styles.studentMeta
                              }
                            >
                              {student.regNo}
                              {" • "}
                              {student.group}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={
                            isFinalized ||
                            dayType === "holiday"
                          }
                          onClick={() =>
                            toggleAttendance(
                              student.id
                            )
                          }
                          style={{
                            ...styles.attendanceButton,
                            ...(status ===
                              "present"
                              ? styles.attendanceButtonPresent
                              : {}),
                            ...(status ===
                              "absent"
                              ? styles.attendanceButtonAbsent
                              : {}),
                            ...(isFinalized
                              ? styles.attendanceButtonLocked
                              : {}),
                          }}
                        >
                          {status ===
                            "present"
                            ? "Present"
                            : status ===
                              "absent"
                              ? "Absent"
                              : "Mark Present"}
                        </button>
                      </div>
                    );
                  }
                )}

                {filteredStudents.length ===
                  0 && (
                    <div
                      style={
                        styles.emptyCard
                      }
                    >
                      <strong>
                        No students found
                      </strong>

                      <span>
                        Try another name or
                        register number.
                      </span>
                    </div>
                  )}
              </div>
            </section>
          </>
        )}

        {/* =================================================
            FINALIZE
        ================================================== */}

        {!isFinalized && (
          <section
            style={
              styles.section
            }
          >
            <button
              type="button"
              onClick={
                finalizeAttendance
              }
              style={
                styles.finalizeButton
              }
            >
              {dayType === "holiday"
                ? "Finalize Holiday"
                : "Finalize Attendance"}
            </button>
          </section>
        )}

        {/* =================================================
            EXPORT ACTIONS
        ================================================== */}

        {dayType === "working" && (
          <section
            style={
              styles.section
            }
          >
            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Attendance Records
                </h2>

                <p
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Copy or save the finalized
                  record
                </p>
              </div>
            </div>

            <div
              style={
                styles.exportGrid
              }
            >
              <button
                type="button"
                onClick={
                  copyPresentList
                }
                style={{
                  ...styles.exportButton,
                  ...styles.presentExport,
                }}
              >
                Copy Present List
              </button>

              <button
                type="button"
                onClick={
                  copyAbsentList
                }
                style={{
                  ...styles.exportButton,
                  ...styles.absentExport,
                }}
              >
                Copy Absent List
              </button>

              <button
                type="button"
                onClick={
                  copyFullRecord
                }
                style={{
                  ...styles.exportButton,
                  ...styles.recordExport,
                }}
              >
                Copy Full Record
              </button>

              <button
                type="button"
                onClick={saveAsTxt}
                style={{
                  ...styles.exportButton,
                  ...styles.txtExport,
                }}
              >
                Save as TXT
              </button>
            </div>
          </section>
        )}
        {/* =================================================
            MONTHLY EXCEL
        ================================================== */}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>
                Monthly Excel
              </h2>

              <p style={styles.sectionSubtitle}>
                Download the completed monthly attendance report
              </p>
            </div>
          </div>

          <div style={styles.monthlyExcelCard}>
            <label style={styles.label}>
              Select Month
            </label>

            <input
              type="month"
              value={excelMonth}
              onChange={(event) => {
                setExcelMonth(event.target.value);
                setExcelError("");
              }}
              style={styles.input}
              disabled={excelLoading}
            />

            <button
              type="button"
              onClick={exportMonthlyExcel}
              disabled={excelLoading}
              style={{
                ...styles.monthlyExcelButton,
                ...(excelLoading
                  ? styles.monthlyExcelButtonDisabled
                  : {}),
              }}
            >
              {excelLoading
                ? "Generating Excel..."
                : "Download Monthly Excel"}
            </button>

            {excelError && (
              <div style={styles.monthlyExcelError}>
                {excelError}
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            STUDENT DETAILS MODAL
        ================================================== */}

        {selectedStudent && (
          <StudentDetails
            student={
              selectedStudent
            }
            getStudentAttendance={
              getStudentAttendance
            }
            onClose={() =>
              setSelectedStudent(null)
            }
          />
        )}
      </main>

      {/* =================================================
          FOOTER
      ================================================== */}

      <footer
        style={styles.footer}
      >
        <span>
          Attendance Tracker
        </span>

        <span
          style={
            styles.footerDot
          }
        >
          •
        </span>

        <span>
          Admin Portal
        </span>
      </footer>
    </div>
  );
}

// =======================================================
// STUDENT DETAILS MODAL
// =======================================================

function StudentDetails({
  student,
  getStudentAttendance,
  onClose,
}) {
  const [stats, setStats] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setStats(null);

    async function loadStats() {
      const result =
        await getStudentAttendance(
          student
        );

      if (mounted) {
        setStats(result);
        setLoading(false);
      }
    }

    loadStats();

    return () => {
      mounted = false;
    };
  }, [
    student.id,
    getStudentAttendance,
  ]);

  return (
    <div
      style={
        styles.modalOverlay
      }
      onClick={onClose}
    >
      <div
        style={
          styles.modalCard
        }
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div
          style={
            styles.modalHeader
          }
        >
          <div
            style={
              styles.modalIdentity
            }
          >
            <div
              style={
                styles.modalAvatar
              }
            >
              {student.name
                ?.charAt(0)
                ?.toUpperCase() ||
                "S"}
            </div>

            <div>
              <h2
                style={
                  styles.modalTitle
                }
              >
                {student.name}
              </h2>

              <p
                style={
                  styles.modalSubtitle
                }
              >
                {student.regNo} •{" "}
                {student.group}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={
              styles.closeButton
            }
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading || !stats ? (
          <div
            style={
              styles.modalLoading
            }
          >
            <div
              style={
                styles.smallSpinner
              }
            ></div>

            <span>
              Loading attendance...
            </span>
          </div>
        ) : (
          <>
            <div
              style={
                styles.modalAttendanceHero
              }
            >
              <div
                style={{
                  ...styles.modalPercentageCircle,
                  background: `conic-gradient(
                    #4f46e5 ${(Number(
                    stats.attendancePercentage
                  ) /
                      100) *
                    360
                    }deg,
                    #eef0f5 ${(Number(
                      stats.attendancePercentage
                    ) /
                      100) *
                    360
                    }deg
                  )`,
                }}
              >
                <strong
                  style={
                    styles.modalPercentageValue
                  }
                >
                  {
                    stats.attendancePercentage
                  }
                  %
                </strong>
              </div>

              <div>
                <strong
                  style={
                    styles.modalAttendanceTitle
                  }
                >
                  {Number(
                    stats.attendancePercentage
                  ) >= 90
                    ? "Excellent attendance"
                    : Number(
                      stats.attendancePercentage
                    ) >= 75
                      ? "Good attendance"
                      : Number(
                        stats.attendancePercentage
                      ) >= 65
                        ? "Attendance needs attention"
                        : "Low attendance"}
                </strong>

                <span
                  style={
                    styles.modalAttendanceText
                  }
                >
                  Overall attendance
                </span>
              </div>
            </div>

            <div
              style={
                styles.modalGrid
              }
            >
              <div
                style={
                  styles.modalStatCard
                }
              >
                <span>
                  Total Finalized Days
                </span>

                <strong>
                  {
                    stats.totalFinalizedDays
                  }
                </strong>
              </div>

              <div
                style={{
                  ...styles.modalStatCard,
                  ...styles.modalPresent,
                }}
              >
                <span>
                  Present Days
                </span>

                <strong>
                  {stats.presentDays}
                </strong>
              </div>

              <div
                style={{
                  ...styles.modalStatCard,
                  ...styles.modalAbsent,
                }}
              >
                <span>
                  Absent Days
                </span>

                <strong>
                  {stats.absentDays}
                </strong>
              </div>

              <div
                style={
                  styles.modalStatCard
                }
              >
                <span>
                  Total Hours
                </span>

                <strong>
                  {stats.totalHours}
                </strong>
              </div>

              <div
                style={{
                  ...styles.modalStatCard,
                  ...styles.modalPresent,
                }}
              >
                <span>
                  Present Hours
                </span>

                <strong>
                  {stats.presentHours}
                </strong>
              </div>

              <div
                style={{
                  ...styles.modalStatCard,
                  ...styles.modalAbsent,
                }}
              >
                <span>
                  Absent Hours
                </span>

                <strong>
                  {stats.absentHours}
                </strong>
              </div>
            </div>
          </>
        )}
      </div>
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
    zIndex: 20,
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
  // DAY DETAILS
  // =====================================================

  dayDetailsCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "18px",
    marginBottom: "16px",
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.04)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "15px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "750",
    color: "#111827",
  },

  cardSubtitle: {
    margin:
      "3px 0 0",
    fontSize: "11px",
    color: "#8a92a3",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    padding:
      "6px 9px",
    fontSize: "10px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  openBadge: {
    background: "#fef3c7",
    color: "#92400e",
  },

  finalizedBadge: {
    background: "#dcfce7",
    color: "#166534",
  },

  holidayBadge: {
    background: "#f3f4f6",
    color: "#4b5563",
  },

  dayPreview: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "10px",
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "13px",
    marginBottom: "16px",
  },

  smallLabel: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
    marginBottom: "4px",
  },

  previewValue: {
    display: "block",
    fontSize: "13px",
    color: "#111827",
  },

  formGroup: {
    marginBottom: "12px",
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "10px",
  },

  label: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
    fontWeight: "600",
    marginBottom: "5px",
  },

  input: {
    width: "100%",
    minHeight: "44px",
    border:
      "1px solid #dfe3ea",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    padding:
      "10px 12px",
    fontSize: "12px",
    outline: "none",
    boxSizing: "border-box",
  },

  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "11px",
    background: "#374151",
    color: "#ffffff",
    minHeight: "44px",
    padding:
      "11px 14px",
    fontSize: "12px",
    fontWeight: "750",
    cursor: "pointer",
    marginTop: "2px",
  },

  lockedMessage: {
    background: "#f3f4f6",
    border:
      "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "11px 12px",
    fontSize: "11px",
    color: "#6b7280",
    textAlign: "center",
    marginTop: "3px",
  },

  // =====================================================
  // ERROR
  // =====================================================

  errorBox: {
    background: "#fff7f7",
    border:
      "1px solid #fecaca",
    borderRadius: "12px",
    padding: "12px",
    marginBottom: "12px",
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
    lineHeight: 1.4,
  },

  // =====================================================
  // HISTORY
  // =====================================================

  historyCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "16px",
    marginBottom: "24px",
    boxShadow:
      "0 3px 12px rgba(15, 23, 42, 0.035)",
  },

  historySelect: {
    width: "100%",
    minHeight: "44px",
    border:
      "1px solid #dfe3ea",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#111827",
    padding:
      "9px 11px",
    fontSize: "12px",
    outline: "none",
  },

  // =====================================================
  // SECTIONS
  // =====================================================

  section: {
    marginBottom: "26px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
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
    lineHeight: 1.4,
  },

  // =====================================================
  // HOLIDAY
  // =====================================================

  holidayCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "17px",
    marginBottom: "26px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  holidayIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#f3f4f6",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
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
    minWidth: 0,
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
      "13px 15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
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

  totalStudentSide: {
    textAlign: "right",
  },

  // =====================================================
  // SEARCH
  // =====================================================

  searchCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "13px",
    minHeight: "46px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding:
      "0 12px",
    boxShadow:
      "0 2px 8px rgba(15, 23, 42, 0.025)",
  },

  searchIcon: {
    color: "#9ca3af",
    fontSize: "20px",
    lineHeight: 1,
    transform: "rotate(-20deg)",
  },

  searchInput: {
    flex: 1,
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "12px",
    minWidth: 0,
  },

  clearButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    fontSize: "18px",
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  },

  // =====================================================
  // STUDENT LIST
  // =====================================================

  studentCountBadge: {
    background: "#eef2ff",
    color: "#4f46e5",
    borderRadius: "999px",
    padding:
      "5px 9px",
    fontSize: "10px",
    fontWeight: "800",
  },

  studentList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  studentCard: {
    background: "#ffffff",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e8eaf0",
    borderRadius: "14px",
    padding: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    boxShadow:
      "0 2px 8px rgba(15, 23, 42, 0.02)",
  },

  studentCardPresent: {
    borderColor: "#bbf7d0",
    background: "#fcfffd",
  },

  studentCardAbsent: {
    borderColor: "#fecaca",
    background: "#fffdfd",
  },

  studentIdentityButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
    textAlign: "left",
    cursor: "pointer",
  },

  studentAvatar: {
    width: "38px",
    height: "38px",
    minWidth: "38px",
    borderRadius: "11px",
    background: "#eef2ff",
    color: "#4f46e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    fontWeight: "800",
  },

  studentIdentity: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },

  studentName: {
    display: "block",
    fontSize: "13px",
    color: "#111827",
    fontWeight: "750",
    overflowWrap: "anywhere",
  },

  studentMeta: {
    display: "block",
    fontSize: "10px",
    color: "#8a92a3",
  },

  attendanceButton: {
    border: "none",
    borderRadius: "10px",
    background: "#f3f4f6",
    color: "#374151",
    minHeight: "37px",
    padding:
      "8px 11px",
    fontSize: "10px",
    fontWeight: "800",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  attendanceButtonPresent: {
    background: "#dcfce7",
    color: "#166534",
  },

  attendanceButtonAbsent: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  attendanceButtonLocked: {
    cursor: "not-allowed",
    opacity: 0.8,
  },

  emptyCard: {
    background: "#ffffff",
    border:
      "1px solid #e8eaf0",
    borderRadius: "14px",
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    color: "#6b7280",
    fontSize: "12px",
    textAlign: "center",
  },

  // =====================================================
  // FINALIZE
  // =====================================================

  finalizeButton: {
    width: "100%",
    border: "none",
    borderRadius: "13px",
    minHeight: "48px",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow:
      "0 4px 12px rgba(79, 70, 229, 0.18)",
  },

  // =====================================================
  // EXPORT
  // =====================================================

  exportGrid: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "9px",
  },

  exportButton: {
    width: "100%",
    border: "none",
    borderRadius: "11px",
    minHeight: "44px",
    color: "#ffffff",
    padding:
      "10px 8px",
    fontSize: "10px",
    fontWeight: "750",
    cursor: "pointer",
  },

  presentExport: {
    background: "#15803d",
  },

  absentExport: {
    background: "#dc2626",
  },

  recordExport: {
    background: "#374151",
  },

  txtExport: {
    background: "#111827",
  },
  monthlyExcelCard: {
    background: "#ffffff",
    border: "1px solid #e8eaf0",
    borderRadius: "14px",
    padding: "15px",
    boxShadow:
      "0 2px 8px rgba(15, 23, 42, 0.025)",
  },

  monthlyExcelButton: {
    width: "100%",
    border: "none",
    borderRadius: "11px",
    minHeight: "46px",
    marginTop: "10px",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: "800",
    cursor: "pointer",
  },

  monthlyExcelButtonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  monthlyExcelError: {
    marginTop: "10px",
    background: "#fff7f7",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "10px 11px",
    color: "#b91c1c",
    fontSize: "11px",
    lineHeight: 1.4,
  },

  // =====================================================
  // MODAL
  // =====================================================

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(15, 23, 42, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 1000,
  },

  modalCard: {
    width: "100%",
    maxWidth: "430px",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "18px",
    boxShadow:
      "0 20px 50px rgba(0, 0, 0, 0.20)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
  },

  modalIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    minWidth: 0,
  },

  modalAvatar: {
    width: "46px",
    height: "46px",
    minWidth: "46px",
    borderRadius: "13px",
    background: "#eef2ff",
    color: "#4f46e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "800",
  },

  modalTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: "750",
    color: "#111827",
    overflowWrap: "anywhere",
  },

  modalSubtitle: {
    margin:
      "3px 0 0",
    fontSize: "11px",
    color: "#8a92a3",
  },

  closeButton: {
    border: "none",
    background: "#f3f4f6",
    color: "#374151",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    fontSize: "23px",
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  },

  modalAttendanceHero: {
    background:
      "linear-gradient(145deg, #ffffff 0%, #fafaff 100%)",
    border:
      "1px solid #e8eaf0",
    borderRadius: "16px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "10px",
  },

  modalPercentageCircle: {
    width: "82px",
    height: "82px",
    minWidth: "82px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modalPercentageValue: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "19px",
    fontWeight: "800",
    color: "#111827",
  },

  modalAttendanceTitle: {
    display: "block",
    fontSize: "14px",
    color: "#111827",
  },

  modalAttendanceText: {
    display: "block",
    marginTop: "4px",
    fontSize: "10px",
    color: "#8a92a3",
  },

  modalGrid: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "9px",
  },

  modalStatCard: {
    background: "#f9fafb",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#e8eaf0",
    borderRadius: "12px",
    padding: "13px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  modalStatCardSpan: {
    fontSize: "10px",
    color: "#8a92a3",
  },

  modalPresent: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  modalAbsent: {
    background: "#fef2f2",
    borderColor: "#fecaca",
  },

  modalLoading: {
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    color: "#6b7280",
    fontSize: "11px",
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

  smallSpinner: {
    width: "22px",
    height: "22px",
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

  retryButton: {
    border: "none",
    background: "#374151",
    color: "#ffffff",
    borderRadius: "9px",
    padding:
      "9px 14px",
    fontSize: "11px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "5px",
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

export default AdminDashboard;