import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProgramCase, ProgramCaseResultTone } from "@/features/partners/models/program-case";

interface ProgramCasesTableProps {
  cases: ProgramCase[] | undefined;
  isLoading: boolean;
}

const TONE_CLASS: Record<ProgramCaseResultTone, string> = {
  neutral: "",
  success: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
  warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  danger: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
};

export function ProgramCasesTable({ cases, isLoading }: ProgramCasesTableProps) {
  if (isLoading || !cases) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/4">Caso</TableHead>
          <TableHead>Qué pasa</TableHead>
          <TableHead className="w-1/4">Resultado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((programCase) => (
          <TableRow key={programCase.id}>
            <TableCell className="font-medium text-foreground">{programCase.title}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{programCase.description}</TableCell>
            <TableCell>
              {programCase.resultTone === "neutral" ? (
                <span className="text-sm text-foreground">{programCase.result}</span>
              ) : (
                <Badge variant="outline" className={TONE_CLASS[programCase.resultTone]}>
                  {programCase.result}
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
