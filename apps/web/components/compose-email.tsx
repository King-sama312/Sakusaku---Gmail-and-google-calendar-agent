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
import { useSendEmail, useCreateDraft } from "~/hooks/api/gmail";

const composeSchema = z.object({
  to: z.string().min(1, "Recipient is required"),
  cc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

type ComposeFormValues = z.infer<typeof composeSchema>;

interface ComposeEmailProps {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  threadId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ComposeEmail({
  initialTo = "",
  initialSubject = "",
  initialBody = "",
  threadId,
  onSuccess,
  onCancel,
}: ComposeEmailProps) {
  const { mutateAsync: sendEmail, isPending: isSending } = useSendEmail();
  const { mutateAsync: saveDraft, isPending: isSavingDraft } = useCreateDraft();

  const form = useForm<ComposeFormValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      to: initialTo,
      cc: "",
      subject: initialSubject,
      body: initialBody,
    },
  });

  async function handleSend(values: ComposeFormValues) {
    await sendEmail({
      to: values.to,
      subject: values.subject,
      body: values.body,
      cc: values.cc || undefined,
      threadId,
    });
    onSuccess?.();
  }

  async function handleSaveDraft(values: ComposeFormValues) {
    await saveDraft({
      to: values.to,
      subject: values.subject,
      body: values.body,
      cc: values.cc || undefined,
      threadId,
    });
    onSuccess?.();
  }

  return (
    <Form {...form}>
      <form className="space-y-4">
        <FormField
          control={form.control}
          name="to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>To</FormLabel>
              <FormControl>
                <Input placeholder="recipient@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CC</FormLabel>
              <FormControl>
                <Input placeholder="cc@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input placeholder="Subject" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Body</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write your message..."
                  className="min-h-32"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={form.handleSubmit(handleSend)}
            disabled={isSending || isSavingDraft}
          >
            {isSending ? "Sending..." : "Send"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={form.handleSubmit(handleSaveDraft)}
            disabled={isSending || isSavingDraft}
          >
            {isSavingDraft ? "Saving..." : "Save draft"}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
