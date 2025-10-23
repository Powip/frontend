"use client";

import {
  Table,
  TableActions,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function ProductsTableSkeleton() {
  const skeletonRows = Array.from({ length: 5 });

  return (
    <Table>
      <TableHeader>
        <TableRow className="animate-pulse">
          <TableHead>
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-28 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-28 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-28 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-28 bg-gray-200 rounded"></div>
          </TableHead>
          <TableHead>
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {skeletonRows.map((_, i) => (
          <TableRow key={i} className="animate-pulse">
            <TableCell>
              <div className="h-4 w-16 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-20 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-28 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </TableCell>
            <TableCell>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </TableCell>
            <TableActions>
              <Button
                variant="table"
                size="icon"
                disabled
                className="bg-gray-200 w-8 h-8"
              />
              <Button
                variant="table"
                size="icon"
                disabled
                className="bg-gray-200 w-8 h-8"
              />
              <Button
                variant="table"
                size="icon"
                disabled
                className="bg-gray-200 w-8 h-8"
              />
            </TableActions>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
