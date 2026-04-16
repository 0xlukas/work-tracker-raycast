import { Form, ActionPanel, Action, showToast, Toast, popToRoot, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import { getAllProjects } from "./lib/queries";
import { insertSegment, getOrCreateOtherProject } from "./lib/mutations";
import { makeDateZurich, getZurichComponents } from "./lib/dates";
import type { Project } from "./lib/types";

export default function AddEntry() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [startHour, setStartHour] = useState("09");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("17");
  const [endMinute, setEndMinute] = useState("00");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const allProjects = await getAllProjects();
        setProjects(allProjects);
        // Default to "Other" project
        const other = allProjects.find((p) => p.name === "Other");
        if (other) {
          setSelectedProject(String(other.id));
        } else if (allProjects.length > 0) {
          setSelectedProject(String(allProjects[0].id));
        }
      } catch (error) {
        showToast({ style: Toast.Style.Failure, title: "Failed to load projects", message: String(error) });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  function handleSubmit() {
    const sH = parseInt(startHour);
    const sM = parseInt(startMinute);
    const eH = parseInt(endHour);
    const eM = parseInt(endMinute);

    // Validation
    const startMinutes = sH * 60 + sM;
    const endMinutes = eH * 60 + eM;
    if (endMinutes <= startMinutes) {
      showToast({ style: Toast.Style.Failure, title: "End time must be after start time" });
      return;
    }

    try {
      const now = new Date();
      const { year, month, day } = getZurichComponents(now);
      const todayDate = makeDateZurich(year, month, day);
      const startTime = makeDateZurich(year, month, day, sH, sM);
      const endTime = makeDateZurich(year, month, day, eH, eM);

      let projectId: number;
      if (selectedProject) {
        projectId = parseInt(selectedProject);
      } else {
        projectId = getOrCreateOtherProject();
      }

      insertSegment(todayDate, startTime, endTime, projectId);

      const duration = (endMinutes - startMinutes) / 60;
      const projectName = projects.find((p) => p.id === projectId)?.name ?? "Other";
      showToast({
        style: Toast.Style.Success,
        title: "Entry added",
        message: `${duration.toFixed(1)}h for ${projectName}`,
      });
      popToRoot();
    } catch (error) {
      showToast({ style: Toast.Style.Failure, title: "Failed to add entry", message: String(error) });
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  const dateStr = new Intl.DateTimeFormat("en-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Compute preview duration
  const startMin = parseInt(startHour) * 60 + parseInt(startMinute);
  const endMin = parseInt(endHour) * 60 + parseInt(endMinute);
  const durationPreview = endMin > startMin ? `${((endMin - startMin) / 60).toFixed(1)}h` : "---";

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Add Work Entry"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Entry" icon={Icon.Plus} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Date" text={dateStr} />

      <Form.Separator />

      <Form.Dropdown id="startHour" title="Start Hour" value={startHour} onChange={setStartHour}>
        {hours.map((h) => (
          <Form.Dropdown.Item key={h} value={h} title={h} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="startMinute" title="Start Minute" value={startMinute} onChange={setStartMinute}>
        {minutes.map((m) => (
          <Form.Dropdown.Item key={m} value={m} title={m} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      <Form.Dropdown id="endHour" title="End Hour" value={endHour} onChange={setEndHour}>
        {hours.map((h) => (
          <Form.Dropdown.Item key={h} value={h} title={h} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown id="endMinute" title="End Minute" value={endMinute} onChange={setEndMinute}>
        {minutes.map((m) => (
          <Form.Dropdown.Item key={m} value={m} title={m} />
        ))}
      </Form.Dropdown>

      <Form.Description title="Duration" text={durationPreview} />

      <Form.Separator />

      <Form.Dropdown id="project" title="Project" value={selectedProject} onChange={setSelectedProject}>
        {projects.map((p) => (
          <Form.Dropdown.Item key={p.id} value={String(p.id)} title={p.name} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
