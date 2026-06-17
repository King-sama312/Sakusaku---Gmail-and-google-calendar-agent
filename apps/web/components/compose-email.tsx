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
import { useSendEmail, useCreateDraft, useUpdateDraft } from "~/hooks/api/gmail";

const composeSchema = z.object({
  to: z.string().min(1, "Recipient is required"),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

type ComposeFormValues = z.infer<typeof composeSchema>;

interface ComposeEmailProps {
  initialTo?: string;
  initialCc?: string;
  initialBcc?: string;
  initialSubject?: string;
  initialBody?: string;
  threadId?: string;
  draftId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ComposeEmail({
  initialTo = "",
  initialCc = "",
  initialBcc = "",
  initialSubject = "",
  initialBody = "",
  threadId,
  draftId,
  onSuccess,
  onCancel,
}: ComposeEmailProps) {
  const { mutateAsync: sendEmail, isPending: isSending } = useSendEmail();
  const { mutateAsync: saveDraft, isPending: isSavingDraft } = useCreateDraft();
  const { mutateAsync: updateDraft, isPending: isUpdatingDraft } = useUpdateDraft();

  const form = useForm<ComposeFormValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      to: initialTo,
      cc: initialCc,
      bcc: initialBcc,
      subject: initialSubject,
      body: initialBody,
    },
  });

  async function handleSend(values: ComposeFormValues) {
    try {
      await sendEmail({
        to: values.to,
        subject: values.subject,
        body: values.body,
        cc: values.cc || undefined,
        bcc: values.bcc || undefined,
        threadId,
      });
      onSuccess?.();
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Failed to send email",
      });
    }
  }

  async function handleSaveDraft(values: ComposeFormValues) {
    try {
      if (draftId) {
        await updateDraft({
          id: draftId,
          to: values.to,
          subject: values.subject,
          body: values.body,
          cc: values.cc || undefined,
          bcc: values.bcc || undefined,
        });
      } else {
        await saveDraft({
          to: values.to,
          subject: values.subject,
          body: values.body,
          cc: values.cc || undefined,
          bcc: values.bcc || undefined,
          threadId,
        });
      }
      onSuccess?.();
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Failed to save draft",
      });
    }
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
          name="bcc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>BCC</FormLabel>
              <FormControl>
                <Input placeholder="bcc@example.com" {...field} />
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
                <Textarea placeholder="Write your message..." className="min-h-32" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}
          <Button
            type="button"
            onClick={form.handleSubmit(handleSend)}
            disabled={isSending || isSavingDraft || isUpdatingDraft}
          >
            {isSending ? "Sending..." : "Send"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={form.handleSubmit(handleSaveDraft)}
            disabled={isSending || isSavingDraft || isUpdatingDraft}
          >
            {isUpdatingDraft ? "Updating..." : isSavingDraft ? "Saving..." : "Save draft"}
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
