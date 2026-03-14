import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { useGetMe } from "@workspace/api-client-react";

export function useAuth() {
  const { user, token, setUser, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  const { data, isError, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
    },
  });

  useEffect(() => {
    if (!token) {
      setIsInitializing(false);
      return;
    }

    if (!isLoading) {
      if (data) {
        setUser(data);
      } else if (isError) {
        logout();
      }
      setIsInitializing(false);
    }
  }, [token, data, isError, isLoading, setUser, logout]);

  return {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isInitializing,
  };
}
