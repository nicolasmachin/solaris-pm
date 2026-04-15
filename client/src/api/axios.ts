import axios from "axios";
import { toast } from "react-hot-toast";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("voltia-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → clear token and redirect to /login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("voltia-token");
      localStorage.removeItem("voltia-user");
      localStorage.removeItem("voltia-permissions");
      window.location.href = "/login";
    } else if (error.response?.status >= 500) {
      toast.error("Error interno del servidor. Intentá de nuevo en unos momentos.");
    }
    return Promise.reject(error);
  }
);
