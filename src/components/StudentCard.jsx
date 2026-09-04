function StudentCard({
  student,
  status,
  onToggle,
  onShowDetails,
}) {
  return (
    <div className={`student-card ${status || "unmarked"}`}>
      <div
        className="student-info clickable"
        onClick={() => onShowDetails(student)}
      >
        <div className="student-number">{student.id}</div>

        <div>
          <h3>{student.name}</h3>
          <p>{student.regNo}</p>
        </div>
      </div>

      <button
        className={`attendance-button ${status || ""}`}
        onClick={() => onToggle(student.id)}
      >
        {status === "present"
          ? "✓ PRESENT"
          : "MARK PRESENT"}
      </button>
    </div>
  );
}

export default StudentCard;