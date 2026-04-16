import { useEffect, useState } from "react";
import "./App.css";
import { ProjectList } from "./components/project/ProjectList";
import { EditorLayout } from "./components/layout/EditorLayout";
import { useSettingsStore } from "./store/settingsStore";
import type { Book } from "./types";

type View = "projects" | "editor";

export default function App() {
  const [view, setView] = useState<View>("projects");
  const [activeProject, setActiveProject] = useState<Book | null>(null);
  const { theme, load, loaded } = useSettingsStore();

  useEffect(() => {
    if (!loaded) load();
  }, []);

  // Apply dark class to <html> based on theme setting
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else if (theme === "light") {
      html.classList.remove("dark");
    } else {
      // system: follow OS preference
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (dark: boolean) => dark ? html.classList.add("dark") : html.classList.remove("dark");
      apply(mq.matches);
      mq.addEventListener("change", (e) => apply(e.matches));
      return () => mq.removeEventListener("change", (e) => apply(e.matches));
    }
  }, [theme]);

  function openProject(project: Book) {
    setActiveProject(project);
    setView("editor");
  }

  function goBack() {
    setView("projects");
    setActiveProject(null);
  }

  if (view === "editor" && activeProject) {
    return <EditorLayout project={activeProject} onBack={goBack} />;
  }

  return <ProjectList onOpenProject={openProject} />;
}
