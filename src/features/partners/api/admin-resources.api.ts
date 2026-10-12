import axios from "axios";
import { API } from "@/lib/api";
import type {
  AdminResourceMetadataCommand,
  AdminResourceRevisionCommand,
  AdminResourceTransition,
  AdminResourceTransitionCommand,
} from "../models/admin-resource";
import {
  adminResourceMetadataCommandSchema,
  adminResourceRevisionCommandSchema,
  adminResourceSchema,
  adminResourcesPageSchema,
  adminResourceTransitionCommandSchema,
} from "../schemas/admin-resources.schema";
import type { AdminPageRequest, AdminReadRequest } from "./admin-partners.api";

export const adminResourcesClient = axios.create({ timeout: 10_000 });
const endpoint = () => `${API.partners}/admin/resources`;
type WriteRequest<T> = AdminReadRequest & { command: T; idempotencyKey: string };
function options(request: AdminReadRequest & { idempotencyKey?: string }) {
  return {
    signal: request.signal,
    headers: {
      Authorization: `Bearer ${request.accessToken}`,
      ...(request.idempotencyKey ? { "Idempotency-Key": request.idempotencyKey } : {}),
    },
  };
}
export async function requestAdminResources(request: AdminPageRequest) {
  const { data } = await adminResourcesClient.get<unknown>(endpoint(), {
    ...options(request),
    params: {
      ...(request.cursor ? { cursor: request.cursor } : {}),
      ...(request.limit !== undefined ? { limit: request.limit } : {}),
    },
  });
  return adminResourcesPageSchema.parse(data);
}
export async function requestCreateAdminResource(
  request: WriteRequest<AdminResourceMetadataCommand>,
) {
  const { data } = await adminResourcesClient.post<unknown>(
    endpoint(),
    adminResourceMetadataCommandSchema.parse(request.command),
    options(request),
  );
  return adminResourceSchema.parse(data);
}
export async function requestReviseAdminResource(
  request: WriteRequest<AdminResourceRevisionCommand> & { resourceId: string },
) {
  const { data } = await adminResourcesClient.post<unknown>(
    `${endpoint()}/${encodeURIComponent(request.resourceId)}/revise`,
    adminResourceRevisionCommandSchema.parse(request.command),
    options(request),
  );
  return adminResourceSchema.parse(data);
}
export async function requestTransitionAdminResource(
  request: WriteRequest<AdminResourceTransitionCommand> & {
    resourceId: string;
    transition: AdminResourceTransition;
  },
) {
  const { data } = await adminResourcesClient.post<unknown>(
    `${endpoint()}/${encodeURIComponent(request.resourceId)}/${request.transition}`,
    adminResourceTransitionCommandSchema.parse(request.command),
    options(request),
  );
  return adminResourceSchema.parse(data);
}
