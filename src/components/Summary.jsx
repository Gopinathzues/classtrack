function Summary({ total, present, absent }) {
  const percentage = total
    ? ((present / total) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="summary">
      <div>
        <span>Total</span>
        <strong>{total}</strong>
      </div>

      <div className="present-summary">
        <span>Present</span>
        <strong>{present}</strong>
      </div>

      <div className="absent-summary">
        <span>Absent</span>
        <strong>{absent}</strong>
      </div>

      <div>
        <span>Attendance</span>
        <strong>{percentage}%</strong>
      </div>
    </div>
  );
}

export default Summary;