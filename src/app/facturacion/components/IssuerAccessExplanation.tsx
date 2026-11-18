import type { SunatIssuerAccessBlockCategory } from "@/features/sunat/sunat-issuer-access/dto/sunat-issuer-access-block-response.dto";
import {
  getIssuerAccessError,
  getIssuerAccessSteps,
} from "@/features/sunat/sunat-issuer-access/utils/issuer-access-errors";

interface IssuerAccessExplanationProps {
  sunatCode: string | null;
  /** SUNAT's own message, shown as it came. */
  sunatMessage: string | null;
  /** SOL user the RUC sends with, when known. */
  solUser?: string | null;
  /** Used only when the code is not in the catalog. */
  category?: SunatIssuerAccessBlockCategory;
}

const FALLBACK_TITLES: Record<SunatIssuerAccessBlockCategory, string> = {
  CREDENTIALS: "SUNAT no acepta el usuario o la clave SOL de este RUC",
  AUTHORIZATION: "SUNAT no autoriza a este usuario o RUC a enviar comprobantes electrónicos",
};

/**
 * Explains, in the taxpayer's terms, why SUNAT refused the issuer: what
 * SUNAT said, which SOL user was used and what to do about it.
 */
export function IssuerAccessExplanation({
  sunatCode,
  sunatMessage,
  solUser = null,
  category = "AUTHORIZATION",
}: IssuerAccessExplanationProps) {
  const error = getIssuerAccessError(sunatCode);
  const title = error?.title ?? FALLBACK_TITLES[category];

  return (
    <div className="space-y-2">
      <p>
        <span className="font-semibold">{title}.</span>
        {sunatCode && <> Código {sunatCode} de SUNAT.</>}
        {error && <> {error.cause}</>}
      </p>

      <p>
        {sunatMessage && <>SUNAT respondió: «{sunatMessage}». </>}
        {solUser && (
          <>
            Usuario SOL con el que se envía: <span className="font-semibold">{solUser}</span>.
          </>
        )}
      </p>

      {error && (
        <div>
          <p className="font-semibold">
            Qué hacer{error.fixedIn === "SUNAT" ? " (se corrige en SUNAT, no en Powip)" : ""}:
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {getIssuerAccessSteps(error, solUser).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
