import { z, zodUndefinedModel } from "../../schema";
import { gmailService } from "../../services";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  listThreadsInputModel,
  listThreadsOutputModel,
  listThreadsFromDbInputModel,
  listThreadsFromDbOutputModel,
  getThreadInputModel,
  getThreadOutputModel,
  searchMessagesInputModel,
  searchMessagesOutputModel,
  sendMessageInputModel,
  sendMessageOutputModel,
  listDraftsInputModel,
  listDraftsOutputModel,
  getDraftInputModel,
  getDraftOutputModel,
  createDraftInputModel,
  createDraftOutputModel,
  updateDraftInputModel,
  updateDraftOutputModel,
  deleteDraftInputModel,
  deleteDraftOutputModel,
  listLabelsInputModel,
  listLabelsOutputModel,
  createLabelInputModel,
  createLabelOutputModel,
  deleteLabelInputModel,
  deleteLabelOutputModel,
} from "./model";

const TAGS = ["Gmail"];
const getPath = generatePath("/gmail");

export const gmailRouter = router({
  listThreads: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/threads"), tags: TAGS, protect: true } })
    .input(listThreadsInputModel)
    .output(listThreadsOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.listThreads(ctx.user.id, input);
    }),

  listThreadsFromDb: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/threads/db"), tags: TAGS, protect: true },
    })
    .input(listThreadsFromDbInputModel)
    .output(listThreadsFromDbOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.listThreadsFromDb(ctx.user.id, input);
    }),

  syncThreadMetadata: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/threads/sync"), tags: TAGS, protect: true },
    })
    .input(listThreadsInputModel)
    .output(listThreadsOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await gmailService.syncThreadMetadata(ctx.user.id, input);
    }),

  getThread: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/threads/{id}"), tags: TAGS, protect: true } })
    .input(getThreadInputModel)
    .output(getThreadOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.getThread(ctx.user.id, input);
    }),

  searchMessages: authenticatedProcedure
    .meta({
      openapi: { method: "GET", path: getPath("/messages/search"), tags: TAGS, protect: true },
    })
    .input(searchMessagesInputModel)
    .output(searchMessagesOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.searchMessages(ctx.user.id, input);
    }),

  sendMessage: authenticatedProcedure
    .meta({
      openapi: { method: "POST", path: getPath("/messages/send"), tags: TAGS, protect: true },
    })
    .input(sendMessageInputModel)
    .output(sendMessageOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await gmailService.sendMessage(ctx.user.id, input);
    }),

  listDrafts: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/drafts"), tags: TAGS, protect: true } })
    .input(listDraftsInputModel)
    .output(listDraftsOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.listDrafts(ctx.user.id, input);
    }),

  getDraft: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/drafts/{id}"), tags: TAGS, protect: true } })
    .input(getDraftInputModel)
    .output(getDraftOutputModel)
    .query(async ({ input, ctx }) => {
      return await gmailService.getDraft(ctx.user.id, input);
    }),

  createDraft: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/drafts"), tags: TAGS, protect: true } })
    .input(createDraftInputModel)
    .output(createDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await gmailService.createDraft(ctx.user.id, input);
    }),

  updateDraft: authenticatedProcedure
    .meta({ openapi: { method: "PUT", path: getPath("/drafts/{id}"), tags: TAGS, protect: true } })
    .input(updateDraftInputModel)
    .output(updateDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await gmailService.updateDraft(ctx.user.id, input);
    }),

  deleteDraft: authenticatedProcedure
    .meta({
      openapi: { method: "DELETE", path: getPath("/drafts/{id}"), tags: TAGS, protect: true },
    })
    .input(deleteDraftInputModel)
    .output(deleteDraftOutputModel)
    .mutation(async ({ input, ctx }) => {
      await gmailService.deleteDraft(ctx.user.id, input);
      return { success: true };
    }),

  listLabels: authenticatedProcedure
    .meta({ openapi: { method: "GET", path: getPath("/labels"), tags: TAGS, protect: true } })
    .input(zodUndefinedModel)
    .output(listLabelsOutputModel)
    .query(async ({ ctx }) => {
      return await gmailService.listLabels(ctx.user.id);
    }),

  createLabel: authenticatedProcedure
    .meta({ openapi: { method: "POST", path: getPath("/labels"), tags: TAGS, protect: true } })
    .input(createLabelInputModel)
    .output(createLabelOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await gmailService.createLabel(ctx.user.id, input);
    }),

  deleteLabel: authenticatedProcedure
    .meta({
      openapi: { method: "DELETE", path: getPath("/labels/{id}"), tags: TAGS, protect: true },
    })
    .input(deleteLabelInputModel)
    .output(deleteLabelOutputModel)
    .mutation(async ({ input, ctx }) => {
      await gmailService.deleteLabel(ctx.user.id, input);
      return { success: true };
    }),
});
