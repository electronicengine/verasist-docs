import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}
