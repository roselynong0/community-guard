import React from "react";
import { Navigate } from "react-router-dom";

function ResidentRouteGuard({ session, children }) {
  if (!session) {
    return <Navigate to="/login?role=resident" replace />;
  }

  if (session.user?.role === "Admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

export default ResidentRouteGuard;