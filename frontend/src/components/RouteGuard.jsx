import { Navigate } from "react-router-dom";

// Admin route guard - only allows admins
export function AdminRoute({ children, session }) {
  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }
  
  if (session.user.role !== "Admin") {
    return <Navigate to="/reports" replace />;
  }
  
  return children;
}

// Resident route guard - only allows residents
export function ResidentRoute({ children, session }) {
  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }
  
  if (session.user.role === "Admin") {
    return <Navigate to="/admin/reports" replace />;
  }
  
  return children;
}

// Role-based redirect for home
export function HomeRoute({ children, session }) {
  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}