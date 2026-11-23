import { Action, ActionPanel, Form, Icon, popToRoot } from "@raycast/api";
import { useForm, usePromise } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import { deleteCalls, getCallSummary, listCalls, logCall } from "./lib/api";
import { addDays, formatDay, momentFromPicker, zurichToday } from "./lib/format";
import type { Call, CallLength } from "./lib/types";
import { CommonActions, perform, showError } from "./lib/ui";

const LENGTHS: { value: CallLength; title: string }[] = [
  { value: "short", title: "Short (under 15 minutes)" },
  { value: "medium", title: "Medium (15 minutes to 1 hour)" },
  { value: "long", title: "Long (over 1 hour)" },
];

async function load() {
  const today = zurichToday();
  // The last year's calls suggest callers, their topics and departments, like the app's panel.
  const [calls, summary] = await Promise.all([listCalls(addDays(today, -365), today), getCallSummary(today)]);
  return { calls: calls.reverse(), departments: summary.departments, today: summary.calls };
}

interface Values {
  caller: string;
  topic: string;
  department: string;
  length: string;
  solvedByMe: boolean;
  note: string;
  at: Date | null;
}

export default function LogCall() {
  const { data, isLoading, error } = usePromise(load, [], { onError: () => undefined });
  useEffect(() => {
    if (error) showError(error);
  }, [error]);

  const [callerSearch, setCallerSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");

  const { handleSubmit, itemProps, values, setValue } = useForm<Values>({
    initialValues: { caller: "", topic: "", department: "", length: "short", solvedByMe: false, note: "", at: null },
    validation: { caller: (value) => (value?.trim() ? undefined : "Who called?") },
    async onSubmit(values) {
      const logged = await perform(
        "Logging call…",
        () =>
          logCall({
            caller: values.caller.trim(),
            topic: values.topic.trim() || undefined,
            department: values.department || undefined,
            length: values.length as CallLength,
            solved_by_me: values.solvedByMe,
            note: values.note.trim() || undefined,
            at: values.at ? momentFromPicker(values.at) : undefined,
          }),
        (call) => ({
          title: "Call logged",
          message: describe(call),
          primaryAction: {
            title: "Undo",
            shortcut: { modifiers: ["cmd"], key: "z" },
            onAction: async (toast) => {
              await toast.hide();
              await perform(
                "Removing call…",
                () => deleteCalls([call.id]),
                () => ({ title: "Call removed" }),
              );
            },
          },
        }),
      );
      if (logged) await popToRoot({ clearSearchBar: true });
      return logged ? undefined : false;
    },
  });

  const calls = data?.calls ?? [];
  // Latest callers first; each once, in their most recent spelling.
  const callers = useMemo(() => unique(calls.map((call) => call.caller)), [calls]);
  // The chosen caller's topics first, then everyone's.
  const topics = useMemo(() => {
    const own = calls.filter((call) => same(call.caller, values.caller)).map((call) => call.topic ?? "");
    return unique([...own, ...calls.map((call) => call.topic ?? "")]).filter(Boolean);
  }, [calls, values.caller]);

  // Pick the department last used with the caller, as the app does.
  useEffect(() => {
    const last = calls.find((call) => same(call.caller, values.caller) && call.department);
    if (last?.department && data?.departments.includes(last.department)) setValue("department", last.department);
  }, [values.caller]);

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Log Call"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Call" icon={Icon.Phone} onSubmit={handleSubmit} />
          <Action
            title="Solved by Me"
            icon={Icon.CheckCircle}
            shortcut={{ modifiers: ["cmd"], key: "m" }}
            onAction={() => setValue("solvedByMe", !values.solvedByMe)}
          />
          <CommonActions />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        title="Caller"
        placeholder="Type a name"
        filtering
        throttle
        onSearchTextChange={setCallerSearch}
        {...itemProps.caller}
      >
        {/* Without an empty first item, Raycast would preselect the first caller. */}
        <Form.Dropdown.Item value="" title="Choose or type a caller" icon={Icon.Person} />
        <NewNameItem search={callerSearch} existing={callers} />
        {values.caller && !callers.some((name) => name === values.caller) && (
          <Form.Dropdown.Item value={values.caller} title={values.caller} icon={Icon.Person} />
        )}
        {callers.map((name) => (
          <Form.Dropdown.Item key={name} value={name} title={name} icon={Icon.Person} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown title="Topic" filtering throttle onSearchTextChange={setTopicSearch} {...itemProps.topic}>
        <Form.Dropdown.Item value="" title="No topic" icon={Icon.Minus} />
        <NewNameItem search={topicSearch} existing={topics} />
        {values.topic && !topics.includes(values.topic) && (
          <Form.Dropdown.Item value={values.topic} title={values.topic} icon={Icon.SpeechBubble} />
        )}
        {topics.map((name) => (
          <Form.Dropdown.Item key={name} value={name} title={name} icon={Icon.SpeechBubble} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown title="Department" {...itemProps.department}>
        <Form.Dropdown.Item value="" title="None" />
        {(data?.departments ?? []).map((name) => (
          <Form.Dropdown.Item key={name} value={name} title={name} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown title="Length" {...itemProps.length}>
        {LENGTHS.map((length) => (
          <Form.Dropdown.Item key={length.value} value={length.value} title={length.title} />
        ))}
      </Form.Dropdown>
      <Form.Checkbox
        label="Solved by me"
        info="Ticked when you solved the issue; unticked when the caller did. ⌘M toggles it."
        {...itemProps.solvedByMe}
      />
      <Form.TextField title="Note" placeholder="Optional" {...itemProps.note} />
      <Form.DatePicker title="When" info="Leave empty for now" {...itemProps.at} />
      {data && (
        <Form.Description
          text={`${data.today === 0 ? "No calls" : data.today === 1 ? "1 call" : `${data.today} calls`} logged today. Calls don't count as working time.`}
        />
      )}
    </Form>
  );
}

/** "Use “…”" for a name that isn't in the list yet. */
function NewNameItem({ search, existing }: { search: string; existing: string[] }) {
  const text = search.trim();
  if (!text || existing.some((name) => same(name, text))) return null;
  return <Form.Dropdown.Item value={text} title={`Use “${text}”`} icon={Icon.Plus} keywords={[text]} />;
}

function same(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

function unique(names: string[]): string[] {
  const seen: string[] = [];
  for (const name of names) if (!seen.some((other) => same(other, name))) seen.push(name);
  return seen;
}

function describe(call: Call): string {
  const parts = [call.caller, call.topic, call.department].filter(Boolean).join(" · ");
  return `${parts} (${call.length}, ${call.date === zurichToday() ? call.time : `${formatDay(call.date, "short")} ${call.time}`})`;
}
