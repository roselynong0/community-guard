import React from "react";
import { Navigate } from "react-router-dom";

// Component to protect admin routes
function AdminRouteGuard({ session, children }) {
  if (!session) {
    return <Navigate to="/login?role=admin" replace />;
  }

  if (session.user?.role !== "Admin") {
    return <Navigate to="/home" replace />;
  }

  return children;
}

export default AdminRouteGuard;