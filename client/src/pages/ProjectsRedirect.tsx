import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../api/projects.api";
import { Spinner } from "../components/ui/Spinner";

export function ProjectsRedirect() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  useEffect(() => {
    if (data && data.length > 0) {
      navigate(`/projects/${data[0].id}`, { replace: true });
    }
  }, [data, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-[var(--color-text-secondary)]">No hay proyectos activos</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          Crear proyecto
        </button>
      </div>
    );
  }

  return null;
}
