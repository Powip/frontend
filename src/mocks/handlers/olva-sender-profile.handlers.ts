import { delay, HttpResponse, http } from "msw";
import type { OlvaSenderProfileResponseDto } from "@/features/olva/olva-sender-profile/dto/olva-sender-profile-response.dto";
import {
  buildOlvaSenderProfileList,
  buildOlvaSenderProfileResponse,
} from "@/features/olva/olva-sender-profile/test-utils/olva-sender-profile.fixtures";

// Wildcard prefix so it matches whatever NEXT_PUBLIC_API_INTEGRATIONS resolves to
const SENDER_PROFILES_PATH = "*/olva/sender-profiles";
const SENDER_PROFILE_PATH = `${SENDER_PROFILES_PATH}/:id`;
const SENDER_PROFILE_DEFAULT_PATH = `${SENDER_PROFILE_PATH}/default`;

function businessError(statusCode: number, code: string, error: string) {
  return HttpResponse.json(
    { statusCode, error, source: "olva", details: { code } },
    { status: statusCode },
  );
}

/**
 * List + set-default + archive handlers that share one in-memory list, so a story can click a
 * button and then see the list change after React Query refetches. Call it once per story:
 * every call starts from a fresh copy.
 */
export function createStatefulOlvaSenderProfileHandlers(
  initial: OlvaSenderProfileResponseDto[] = buildOlvaSenderProfileList(),
) {
  let profiles = initial.map((profile) => ({ ...profile }));

  return [
    http.get(SENDER_PROFILES_PATH, () => HttpResponse.json({ results: profiles })),

    http.put(SENDER_PROFILE_DEFAULT_PATH, async ({ params }) => {
      await delay(200);

      const target = profiles.find((profile) => profile.id === params.id);

      if (!target) return businessError(404, "SENDER_PROFILE_NOT_CONFIGURED", "Not found");

      profiles = profiles.map((profile) => ({ ...profile, isDefault: profile.id === target.id }));

      return HttpResponse.json(profiles.find((profile) => profile.id === target.id));
    }),

    http.delete(SENDER_PROFILE_PATH, async ({ params }) => {
      await delay(200);

      const target = profiles.find((profile) => profile.id === params.id);

      if (!target) return businessError(404, "SENDER_PROFILE_NOT_CONFIGURED", "Not found");
      if (target.isDefault) {
        return businessError(
          409,
          "SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT",
          "Cannot archive default",
        );
      }

      profiles = profiles.filter((profile) => profile.id !== target.id);

      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

export const olvaSenderProfileHandlers = {
  listEmpty: http.get(SENDER_PROFILES_PATH, () => HttpResponse.json({ results: [] })),

  listWithProfiles: http.get(SENDER_PROFILES_PATH, () =>
    HttpResponse.json({ results: buildOlvaSenderProfileList() }),
  ),

  createSuccess: http.post<never, Partial<OlvaSenderProfileResponseDto>>(
    SENDER_PROFILES_PATH,
    async ({ request }) => {
      const body = await request.json();

      await delay(300);

      return HttpResponse.json(buildOlvaSenderProfileResponse(body), { status: 201 });
    },
  ),

  createPending: http.post(SENDER_PROFILES_PATH, () => delay("infinite")),

  createDuplicateRuc: http.post(SENDER_PROFILES_PATH, () =>
    businessError(409, "SENDER_PROFILE_DUPLICATE_RUC", "Duplicate RUC"),
  ),

  createRucNotFound: http.post(SENDER_PROFILES_PATH, () =>
    businessError(422, "SENDER_PROFILE_RUC_NOT_FOUND_IN_OLVA", "RUC not found in Olva"),
  ),

  createLimitReached: http.post(SENDER_PROFILES_PATH, () =>
    businessError(409, "SENDER_PROFILE_LIMIT_REACHED", "Limit reached"),
  ),

  archiveFails: http.delete(SENDER_PROFILE_PATH, () =>
    businessError(409, "SENDER_PROFILE_CANNOT_ARCHIVE_DEFAULT", "Cannot archive default"),
  ),

  archivePending: http.delete(SENDER_PROFILE_PATH, () => delay("infinite")),
};
