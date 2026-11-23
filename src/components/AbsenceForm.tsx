import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { useForm } from "@raycast/utils";
import { recordAbsences } from "../lib/absences";
import { listAbsenceCategories } from "../lib/api";
import { dayFromPicker, pickerDate, zurichToday } from "../lib/format";
import { showError, useWorkTracker } from "../lib/ui";

interface Values {
  from: Date | null;
  to: Date | null;
  category: string;
  halfDay: boolean;
}

/** Record an absence (vacation by default) on every working day of a range. */
export function AbsenceForm({ from, category, onSaved }: { from?: string; category?: string; onSaved?: () => void }) {
  const { pop } = useNavigation();
  const { data: categories, isLoading } = useWorkTracker(listAbsenceCategories, []);
  const start = from ?? zurichToday();
  const { handleSubmit, itemProps, values } = useForm<Values>({
    initialValues: { from: pickerDate(start), to: pickerDate(start), category: category ?? "vacation", halfDay: false },
    validation: {
      from: (value) => (value ? undefined : "Pick the first day"),
      to: (value) => (value ? undefined : "Pick the last day"),
    },
    async onSubmit(values) {
      const first = dayFromPicker(values.from!);
      const last = dayFromPicker(values.to!);
      if (last < first) {
        await showError(new Error("The last day is before the first."), "Can't record");
        return false;
      }
      const chosen = categories?.find((c) => (c.category_id ?? c.category) === values.category);
      const recorded = await recordAbsences({
        from: first,
        to: last,
        category: values.category,
        categoryName: chosen?.category_name ?? chosen?.category ?? values.category,
        halfDay: values.halfDay,
        onChange: onSaved,
      });
      if (!recorded) return false;
      // Back to the list, which stays open, so the toast's Undo keeps working.
      pop();
    },
  });
  const active = (categories ?? []).filter((c) => !c.archived);
  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Record Absence"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Record Absence" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown title="Category" {...itemProps.category}>
        {active.length === 0 && <Form.Dropdown.Item value="vacation" title="Vacation" />}
        {active.map((c) => (
          <Form.Dropdown.Item
            key={c.category_id ?? c.category}
            value={c.category_id ?? c.category}
            title={c.category_name ?? c.category}
          />
        ))}
      </Form.Dropdown>
      <Form.DatePicker title="From" type={Form.DatePicker.Type.Date} {...itemProps.from} />
      <Form.DatePicker title="To" type={Form.DatePicker.Type.Date} {...itemProps.to} />
      <Form.Checkbox label="Half days" {...itemProps.halfDay} />
      <Form.Description
        text={`Weekends, days without scheduled hours and full-day public holidays are skipped. An absence already on a day is replaced (you are asked first).${
          values.from && values.to && dayFromPicker(values.to) < dayFromPicker(values.from)
            ? "\n\nThe last day is before the first."
            : ""
        }`}
      />
    </Form>
  );
}
