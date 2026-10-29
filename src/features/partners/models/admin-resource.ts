import type z from "zod";
import type {
  adminResourceMetadataCommandSchema,
  adminResourceRevisionCommandSchema,
  adminResourceSchema,
  adminResourcesPageSchema,
  adminResourceTransitionCommandSchema,
} from "../schemas/admin-resources.schema";

export type AdminResource = z.infer<typeof adminResourceSchema>;
export type AdminResourcesPage = z.infer<typeof adminResourcesPageSchema>;
export type AdminResourceMetadataCommand = z.infer<typeof adminResourceMetadataCommandSchema>;
export type AdminResourceRevisionCommand = z.infer<typeof adminResourceRevisionCommandSchema>;
export type AdminResourceTransitionCommand = z.infer<typeof adminResourceTransitionCommandSchema>;
export type AdminResourceTransition = "publish" | "unpublish" | "archive";
