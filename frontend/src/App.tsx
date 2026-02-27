import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DashboardLayout } from "./components/DashboardLayout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { ReportMissing } from "./pages/citizen/ReportMissing";
import { MyRequests } from "./pages/citizen/MyRequests";
import { PoliceDashboard } from "./pages/police/PoliceDashboard";
import { RequestDetail } from "./pages/police/RequestDetail";
import { CaseMap } from "./pages/CaseMap";
import { TipPage } from "./pages/TipPage";
import { Chat } from "./pages/Chat";
import { BountyResult } from "./pages/BountyResult";
import { Toaster } from "./components/ui/sonner";
import type { ReactNode } from "react";

function ProtectedRoute({
  children,
  role,
}: {
  children: ReactNode;
  role?: "CITIZEN" | "POLICE";
}) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (role && user?.role !== role) return <Navigate to="/" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role === "POLICE") return <Navigate to="/police/dashboard" />;
  return <Navigate to="/citizen/requests" />;
}

function AuthenticatedApp() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        {/* Citizen Routes */}
        <Route
          path="/citizen/report"
          element={
            <ProtectedRoute role="CITIZEN">
              <ReportMissing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citizen/requests"
          element={
            <ProtectedRoute role="CITIZEN">
              <MyRequests />
            </ProtectedRoute>
          }
        />

        {/* Police Routes */}
        <Route
          path="/police/dashboard"
          element={
            <ProtectedRoute role="POLICE">
              <PoliceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/police/requests/:id"
          element={
            <ProtectedRoute role="POLICE">
              <RequestDetail />
            </ProtectedRoute>
          }
        />

        {/* Shared — any authenticated user */}
        <Route
          path="/case-map"
          element={
            <ProtectedRoute>
              <CaseMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* Bounty result — after PhonePe redirect */}
        <Route
          path="/bounty/result"
          element={
            <ProtectedRoute>
              <BountyResult />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </DashboardLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes — no sidebar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/tip/:caseId" element={<TipPage />} />

      {/* All other routes — sidebar layout */}
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <AuthenticatedApp />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
