/**
 * The backend body is strict: sending `ruc` (or any other key) is rejected, because a RUC
 * cannot be changed (another RUC is another profile). At least one field is required.
 */
export interface UpdateOlvaSenderProfileRequestDto {
  label?: string;
  email?: string;
  firstNames?: string;
  lastName?: string;
  // null removes the phone override
  phone?: string | null;
}
