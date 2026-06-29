import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Birthdays from "./pages/Birthdays";
import Settings from "./pages/Settings";

function Protected({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  return loggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Protected><Birthdays /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
