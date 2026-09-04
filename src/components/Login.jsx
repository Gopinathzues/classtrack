import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../Login.css";

function Login({ onLogin }) {
  const [loginType, setLoginType] = useState("admin");

  const [email, setEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [registerNumber, setRegisterNumber] = useState("");
  const [studentName, setStudentName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchLoginType(type) {
    setLoginType(type);
    setError("");

    setEmail("");
    setAdminPassword("");

    setRegisterNumber("");
    setStudentName("");
  }

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      // =====================================================
      // ADMIN LOGIN
      // =====================================================
      if (loginType === "admin") {
        const adminEmail = email.trim();

        if (!adminEmail) {
          setError("Please enter your admin email.");
          return;
        }

        if (!adminPassword) {
          setError("Please enter your admin password.");
          return;
        }

        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: adminEmail,
            password: adminPassword,
          });

        if (loginError) {
          console.error("Admin login error:", loginError);
          setError("Invalid login credentials.");
          return;
        }

        onLogin?.(data.user);
        return;
      }

      // =====================================================
      // STUDENT LOGIN
      // Register Number = Username
      // Student Name    = Password
      // =====================================================

      const regNo = registerNumber.trim();
      const password = studentName;

      if (!regNo) {
        setError("Please enter your register number.");
        return;
      }

      if (!password) {
        setError("Please enter your student name.");
        return;
      }

      // -----------------------------------------------------
      // TEMPORARY DEBUG INFORMATION
      // -----------------------------------------------------

      console.log(
        "SUPABASE URL:",
        import.meta.env.VITE_SUPABASE_URL
      );

      console.log("REG NO:", regNo);
      console.log("STUDENT NAME:", password);

      // -----------------------------------------------------
      // STUDENT LOGIN RPC
      // -----------------------------------------------------

      const { data, error: studentLoginError } =
        await supabase.rpc("student_login", {
          p_reg_no: regNo,
          p_password: password,
        });

      console.log("RPC DATA:", data);
      console.log("RPC ERROR:", studentLoginError);

      // -----------------------------------------------------
      // RPC ERROR
      // -----------------------------------------------------

      if (studentLoginError) {
        console.error(
          "Student login RPC error:",
          studentLoginError
        );

        setError("Unable to login. Please try again.");
        return;
      }

      // -----------------------------------------------------
      // NO MATCHING STUDENT
      // -----------------------------------------------------

      if (!data || data.length === 0) {
        console.log(
          "Student login returned no matching student."
        );

        setError(
          "Invalid register number or student name."
        );

        return;
      }

      // -----------------------------------------------------
      // LOGIN SUCCESS
      // -----------------------------------------------------

      const loggedInStudent = data[0];

      console.log(
        "STUDENT LOGIN SUCCESS:",
        loggedInStudent
      );

      onLogin?.({
        ...loggedInStudent,
        role: "student",
      });
    } catch (error) {
      console.error(
        "Unexpected login error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={handleLogin}
      >
        <h1>Attendance Tracker</h1>

        <p>
          {loginType === "admin"
            ? "Admin Login"
            : "Student Login"}
        </p>

        {/* =================================================
            LOGIN TYPE
        ================================================== */}

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${
              loginType === "admin" ? "active" : ""
            }`}
            onClick={() => switchLoginType("admin")}
            disabled={loading}
          >
            Admin
          </button>

          <button
            type="button"
            className={`login-tab ${
              loginType === "student" ? "active" : ""
            }`}
            onClick={() => switchLoginType("student")}
            disabled={loading}
          >
            Student
          </button>
        </div>

        {/* =================================================
            ADMIN LOGIN
        ================================================== */}

        {loginType === "admin" && (
          <>
            <input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              required
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Admin Password"
              value={adminPassword}
              onChange={(event) =>
                setAdminPassword(event.target.value)
              }
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </>
        )}

        {/* =================================================
            STUDENT LOGIN
        ================================================== */}

        {loginType === "student" && (
          <>
            <input
              type="text"
              placeholder="Register Number"
              value={registerNumber}
              onChange={(event) =>
                setRegisterNumber(event.target.value)
              }
              autoComplete="username"
              required
              disabled={loading}
            />

            <input
              type="password"
              placeholder="Student Name"
              value={studentName}
              onChange={(event) =>
                setStudentName(event.target.value)
              }
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </>
        )}

        {/* =================================================
            ERROR
        ================================================== */}

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        {/* =================================================
            LOGIN BUTTON
        ================================================== */}

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Logging in..."
            : "Login"}
        </button>
      </form>
    </div>
  );
}

export default Login;