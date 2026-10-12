import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminPartner } from "@/features/partners/models/admin-partner";

// This component does not rank partners using unavailable financial metrics.
export function TopPartnersTable({
  partners,
  isLoading,
}: {
  partners: AdminPartner[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Partners consultados</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !partners ? (
          <Skeleton className="h-20" />
        ) : partners.length === 0 ? (
          <p>No hay partners en esta página.</p>
        ) : (
          <ul className="space-y-2">
            {partners.map((partner) => (
              <li key={partner.id}>
                <Link className="hover:underline" href={`/partners/admin/partners/${partner.id}`}>
                  {partner.displayName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
