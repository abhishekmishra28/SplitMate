import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import API from "../services/api";

const AuthContext =
  createContext(null);

export function AuthProvider({
  children,
}) {

  const [user, setUser] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    const loadUser =
      async () => {

        try {

          const token =
            localStorage.getItem(
              "splitmate_token"
            );

          if (!token) {
            setLoading(false);
            return;
          }

          const response =
            await API.get(
              "/auth/me"
            );

          setUser(
            response.data.user
          );

        } catch (error) {

          localStorage.removeItem(
            "splitmate_token"
          );

          setUser(null);

        } finally {

          setLoading(false);
        }
      };

    loadUser();

  }, []);

  const login =
    async (
      email,
      password
    ) => {

      try {

        const response =
          await API.post(
            "/auth/login",
            {
              email,
              password,
            }
          );

        const {
          token,
          user,
        } =
          response.data;

        localStorage.setItem(
          "splitmate_token",
          token
        );

        setUser(user);

        return {
          success: true,
        };

      } catch (error) {

        return {
          success: false,

          error:
            error?.response?.data
              ?.message ||
            "Login failed",
        };
      }
    };

  const register =
    async (
      name,
      email,
      password
    ) => {

      try {

        const response =
          await API.post(
            "/auth/register",
            {
              name,
              email,
              password,
            }
          );

        const {
          token,
          user,
        } =
          response.data;

        localStorage.setItem(
          "splitmate_token",
          token
        );

        setUser(user);

        return {
          success: true,
        };

      } catch (error) {

        return {
          success: false,

          error:
            error?.response?.data
              ?.message ||
            "Registration failed",
        };
      }
    };

  const logout = () => {

    localStorage.removeItem(
      "splitmate_token"
    );

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {

  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
};