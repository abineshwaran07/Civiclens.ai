import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./lib/auth";
import Assistant from "./pages/Assistant";
import Complaint from "./pages/Complaint";
import Home from "./pages/Home";
import Login from "./pages/Login";
import MyComplaints from "./pages/MyComplaints";
import Schemes from "./pages/Schemes";
import Track from "./pages/Track";

// The officer desk pulls in the charting library, so it loads only when opened.
const Officer = lazy(() => import("./pages/Officer"));

function RequireLogin({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="schemes" element={<Schemes />} />
        <Route path="complaint" element={<Complaint />} />
        <Route path="track" element={<Track />} />
        <Route
          path="my"
          element={
            <RequireLogin>
              <MyComplaints />
            </RequireLogin>
          }
        />
        <Route
          path="officer"
          element={
            <Suspense fallback={null}>
              <Officer />
            </Suspense>
          }
        />
        <Route path="login" element={<Login mode="login" />} />
        <Route path="register" element={<Login mode="register" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
