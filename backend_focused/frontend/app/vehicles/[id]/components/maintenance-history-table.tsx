'use client';

import { forwardRef } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { TableVirtuoso, type TableComponents } from 'react-virtuoso';
import type { VehicleDetail } from '@/lib/api/types';
import { formatCost, formatDate } from '@/lib/format';

type HistoryRecord = VehicleDetail['maintenance_records'][number];

// Stable adapters preserve the virtualizer's measurements across parent renders.
const tableComponents: TableComponents<HistoryRecord, number> = {
  Scroller: forwardRef(function HistoryScroller(
    { children, style, tabIndex, 'data-virtuoso-scroller': virtuosoScroller },
    ref,
  ) {
    return (
      <TableContainer
        component={Paper}
        variant="outlined"
        ref={ref}
        style={style}
        tabIndex={tabIndex ?? 0}
        role="region"
        aria-label="Scrollable maintenance history"
        data-virtuoso-scroller={virtuosoScroller}
        data-testid="maintenance-history-scroll"
        sx={{
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        {children}
      </TableContainer>
    );
  }),
  Table: ({ children, style, context }) => (
    <Table
      style={style}
      aria-label="Vehicle maintenance history"
      aria-rowcount={context + 1}
      sx={{ minWidth: 900, tableLayout: 'fixed', borderCollapse: 'separate' }}
    >
      {children}
    </Table>
  ),
  TableHead: forwardRef(function HistoryHead({ children, style }, ref) {
    return (
      <TableHead ref={ref} style={style}>
        {children}
      </TableHead>
    );
  }),
  TableBody: forwardRef(function HistoryBody(
    { children, className, style, 'data-testid': testId },
    ref,
  ) {
    return (
      <TableBody ref={ref} className={className} style={style} data-testid={testId}>
        {children}
      </TableBody>
    );
  }),
  TableRow: ({
    children,
    style,
    'data-index': index,
    'data-item-index': itemIndex,
    'data-known-size': knownSize,
  }) => (
    <TableRow
      style={style}
      data-index={index}
      data-item-index={itemIndex}
      data-known-size={knownSize}
      aria-rowindex={index + 2}
    >
      {children}
    </TableRow>
  ),
  FillerRow: ({ height }) => (
    <TableRow aria-hidden="true">
      <TableCell colSpan={5} sx={{ height, p: 0, border: 0 }} />
    </TableRow>
  ),
};

function historyHeader() {
  return (
    <TableRow aria-rowindex={1}>
      <TableCell sx={{ width: 136 }}>Date</TableCell>
      <TableCell sx={{ width: '20%' }}>Service</TableCell>
      <TableCell sx={{ width: '24%' }}>Mechanic</TableCell>
      <TableCell align="right" sx={{ width: 120 }}>
        Cost
      </TableCell>
      <TableCell>Notes</TableCell>
    </TableRow>
  );
}

function historyCells(_index: number, record: HistoryRecord) {
  return (
    <>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(record.maintenance_date)}</TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere' }}>{record.maintenance_type}</TableCell>
      <TableCell sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">{record.mechanic.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {record.mechanic.certification_number}
        </Typography>
      </TableCell>
      <TableCell align="right">{formatCost(record.cost)}</TableCell>
      <TableCell sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {record.notes || '—'}
      </TableCell>
    </>
  );
}

function recordKey(_index: number, record: HistoryRecord) {
  return record.id;
}

export function MaintenanceHistoryTable({
  records,
}: {
  records: VehicleDetail['maintenance_records'];
}) {
  return (
    <TableVirtuoso
      data={records}
      context={records.length}
      components={tableComponents}
      computeItemKey={recordKey}
      fixedHeaderContent={historyHeader}
      itemContent={historyCells}
      style={{ height: 'min(65vh, 640px)' }}
    />
  );
}
