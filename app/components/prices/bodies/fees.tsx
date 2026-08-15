import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatCurrency } from "~/lib/utils";
import {
  NumInput,
  type FeesScheduleView,
} from "~/components/prices/shared";
export function FeesBody({
  schedule,
  editing,
}: {
  schedule: FeesScheduleView;
  editing: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <input type="hidden" name="lineCount" value={schedule.lines.length} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead className="text-right">Fee GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedule.lines.map((line, index) => (
            <TableRow key={line.sortOrder}>
              <TableCell className="tabular-nums">
                {editing ? (
                  <NumInput
                    name={`line_${index}_sortOrder`}
                    defaultValue={line.sortOrder}
                  />
                ) : (
                  line.sortOrder
                )}
              </TableCell>
              <TableCell>
                {editing ? (
                  <Input
                    name={`line_${index}_name`}
                    defaultValue={line.name}
                    className="h-7"
                    required
                  />
                ) : (
                  line.name
                )}
              </TableCell>
              <TableCell className="text-right">
                {editing ? (
                  <NumInput
                    name={`line_${index}_fee`}
                    defaultValue={line.fee}
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatCurrency(line.fee)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {editing ? (
                  <NumInput
                    name={`line_${index}_feeGst`}
                    defaultValue={line.feeGst}
                  />
                ) : (
                  <span className="tabular-nums">
                    {formatCurrency(line.feeGst)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
