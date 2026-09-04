import { useEffect, useState } from "react";
import Login from "./components/Login";
import AdminDashboard from "./AdminDashboard";
import StudentDashboard from "./StudentDashboard";
import { supabase } from "./lib/supabase";

function App() {
  // =====================================================
  // ADMIN AUTH SESSION
  // =====================================================

  const [session, setSession] = useState(null);

  // =====================================================
  // STUDENT LOGIN
  // =====================================================

  const [student, setStudent] = useState(null);

  // =====================================================
  // LOADING / ROLE
  // =====================================================

  const [authLoading, setAuthLoading] = useState(true);

  const [role, setRole] = useState(null);

  const [roleLoading, setRoleLoading] = useState(false);

  const [roleError, setRoleError] = useState("");

  // =====================================================
  // CHECK ADMIN AUTH SESSION
  // =====================================================

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Session error:",
          error
        );
      }

      if (!mounted) return;

      setSession(
        data?.session || null
      );

      setAuthLoading(false);
    }

    loadSession();

    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        // If an admin logs out,
        // clear the admin role.
        if (!newSession) {
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // =====================================================
  // ADMIN ROLE DETECTION
  // =====================================================

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      // -------------------------------------------------
      // No Supabase session means this is not an admin.
      // Student login does not use Supabase Auth.
      // -------------------------------------------------

      if (!session) {
        setRole(null);
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      setRoleError("");

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_current_user_role"
      );

      if (!mounted) return;

      if (error) {
        console.error(
          "Role detection error:",
          error
        );

        setRole(null);
        setRoleError(
          "Unable to determine your account role."
        );

        setRoleLoading(false);

        return;
      }

      if (data !== "admin") {
        console.error(
          "Unexpected account role:",
          data
        );

        setRole(null);
        setRoleError(
          "This account is not authorized as an admin."
        );

        setRoleLoading(false);

        return;
      }

      setRole("admin");
      setRoleLoading(false);
    }

    loadRole();

    return () => {
      mounted = false;
    };
  }, [session]);

  // =====================================================
  // LOGIN HANDLER
  // =====================================================

  function handleLogin(user) {
    // ---------------------------------------------------
    // STUDENT LOGIN
    // ---------------------------------------------------

    if (user?.role === "student") {
      console.log(
        "APP: Student login received:",
        user
      );

      setStudent(user);
      setRole("student");

      return;
    }

    // ---------------------------------------------------
    // ADMIN LOGIN
    // ---------------------------------------------------

    console.log(
      "APP: Admin login received:",
      user
    );

    // Admin session is already maintained
    // by Supabase Auth.
  }

  // =====================================================
  // STUDENT LOGOUT
  // =====================================================

  function handleStudentLogout() {
    console.log(
      "APP: Student logout"
    );

    setStudent(null);
    setRole(null);
  }

  // =====================================================
  // AUTH LOADING
  // =====================================================

  if (authLoading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // =====================================================
  // STUDENT DASHBOARD
  //
  // Student authentication is completely separate
  // from Supabase Auth.
  // =====================================================

  if (student && role === "student") {
    return (
      <StudentDashboard
        student={student}
        onLogout={handleStudentLogout}
      />
    );
  }

  // =====================================================
  // ADMIN LOGIN
  //
  // If there is no Supabase session and no student,
  // show the login page.
  // =====================================================

  if (!session) {
    return (
      <Login
        onLogin={handleLogin}
      />
    );
  }

  // =====================================================
  // ADMIN ROLE LOADING
  // =====================================================

  if (roleLoading) {
    return (
      <div className="loading-screen">
        <p>
          Loading your dashboard...
        </p>
      </div>
    );
  }

  // =====================================================
  // ADMIN ROLE ERROR
  // =====================================================

  if (roleError) {
    return (
      <div className="loading-screen">
        <div>
          <p>{roleError}</p>

          <button
            onClick={() =>
              supabase.auth.signOut()
            }
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // =====================================================
  // ADMIN DASHBOARD
  // =====================================================

  if (role === "admin") {
    return (
      <AdminDashboard
        session={session}
      />
    );
  }

  // =====================================================
  // FALLBACK
  // =====================================================

  return (
    <div className="loading-screen">
      <p>
        Unable to load dashboard.
      </p>

      <button
        onClick={() =>
          supabase.auth.signOut()
        }
      >
        Logout
      </button>
    </div>
  );
}

export default App;