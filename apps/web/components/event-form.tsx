"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useCreateEvent, useUpdateEvent } from "~/hooks/api/calendar";

const eventFormSchema = z.object({
  summary: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().optional(),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().optional(),
  attendees: z.string().optional(),
  colorId: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface EventFormProps {
  event?: {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { date?: string; dateTime?: string; timeZone?: string };
    end?: { date?: string; dateTime?: string; timeZone?: string };
    attendees?: { email?: string }[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EventForm({ event, onSuccess, onCancel }: EventFormProps) {
  const { mutateAsync: createEvent, isPending: isCreating } = useCreateEvent();
  const { mutateAsync: updateEvent, isPending: isUpdating } = useUpdateEvent();

  const defaultStart = event?.start?.date ?? event?.start?.dateTime ?? "";
  const defaultEnd = event?.end?.date ?? event?.end?.dateTime ?? "";

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      summary: event?.summary ?? "",
      description: event?.description ?? "",
      location: event?.location ?? "",
      startDate: defaultStart.slice(0, 10),
      startTime: defaultStart.length > 10 ? defaultStart.slice(11, 16) : "",
      endDate: defaultEnd.slice(0, 10),
      endTime: defaultEnd.length > 10 ? defaultEnd.slice(11, 16) : "",
      attendees:
        event?.attendees
          ?.map((a) => a.email)
          .filter(Boolean)
          .join(", ") ?? "",
      colorId: "",
    },
  });

  async function handleSubmit(values: EventFormValues) {
    const start = values.startTime
      ? `${values.startDate}T${values.startTime}:00`
      : values.startDate;
    const end = values.endTime ? `${values.endDate}T${values.endTime}:00` : values.endDate;

    const attendees = values.attendees
      ? values.attendees
          .split(",")
          .map((e) => ({ email: e.trim() }))
          .filter((a) => a.email)
      : undefined;

    if (event?.id) {
      await updateEvent({
        eventId: event.id,
        summary: values.summary,
        description: values.description || undefined,
        location: values.location || undefined,
        start: values.startTime ? { dateTime: start } : { date: start },
        end: values.endTime ? { dateTime: end } : { date: end },
        attendees,
        colorId: values.colorId || undefined,
      });
    } else {
      await createEvent({
        summary: values.summary,
        description: values.description || undefined,
        location: values.location || undefined,
        start: values.startTime ? { dateTime: start } : { date: start },
        end: values.endTime ? { dateTime: end } : { date: end },
        attendees,
        colorId: values.colorId || undefined,
      });
    }
    onSuccess?.();
  }

  const isPending = isCreating || isUpdating;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Event title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Event description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input placeholder="Event location" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="attendees"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Attendees</FormLabel>
              <FormControl>
                <Input placeholder="email1@example.com, email2@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="colorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">Blue</SelectItem>
                  <SelectItem value="2">Green</SelectItem>
                  <SelectItem value="3">Purple</SelectItem>
                  <SelectItem value="4">Red</SelectItem>
                  <SelectItem value="5">Yellow</SelectItem>
                  <SelectItem value="6">Orange</SelectItem>
                  <SelectItem value="7">Turquoise</SelectItem>
                  <SelectItem value="8">Gray</SelectItem>
                  <SelectItem value="9">Bold Blue</SelectItem>
                  <SelectItem value="10">Bold Green</SelectItem>
                  <SelectItem value="11">Bold Red</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2 justify-end">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : event?.id ? "Update Event" : "Create Event"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
