import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function RoleValidator({ expectedRole, currentRole, onLogout }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentRole && currentRole !== expectedRole) {
      console.log(`Role mismatch: expected ${expectedRole}, got ${currentRole}. Logging out...`);
      
      localStorage.removeItem("token");
      
      if (onLogout) {
        onLogout(null);
      }
      
      const roleKey =
        expectedRole === "Admin" ? "admin" :
        expectedRole === "Barangay Official" ? "barangay" :
        expectedRole === "Responder" ? "responder" :
        "resident";

      navigate(`/login?role=${roleKey}`, { replace: true });
    }
  }, [currentRole, expectedRole, navigate, onLogout]);

  return null;
}

export default RoleValidator;