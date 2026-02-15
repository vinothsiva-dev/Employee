// src/components/ui/data-table.tsx
import * as React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    ColumnFiltersState,
    SortingState,
    getFilteredRowModel,
    getSortedRowModel,
} from '@tanstack/react-table';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    meta?: any; statusActive?: any;
    handleSort: (field: any) => void; handleStatus: (field: any) => void;
    isLoading?: boolean;
}

export function DataTable<TData, TValue>({
    columns,
    data,
    meta, statusActive,
    handleSort, handleStatus,
    isLoading,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
        meta: meta,
    });

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <>
                                        {header.column.columnDef.header == "Dealer" || header.column.columnDef.header == "Customer" ?
                                            <TableHead key={header.id} onClick={() => handleSort(header.column.columnDef.header == "Dealer" ? "dealerName" : "customerName")} className='pt-[8px] cursor-pointer'>
                                                <div className="flex items-center gap-2">
                                                    {header.isPlaceholder
                                                        ? null
                                                        : flexRender(
                                                            header.column.columnDef.header,
                                                            header.getContext()
                                                        )}
                                                </div>
                                            </TableHead> : header.column.columnDef.header == "Status" ?
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <TableHead className="cursor-pointer">
                                                            <div className="flex items-center gap-2">
                                                                Status
                                                                <ArrowUpDown className="h-4 w-4" />
                                                            </div>
                                                        </TableHead>
                                                    </DropdownMenuTrigger>

                                                    <DropdownMenuContent className="w-44">

                                                        {/* RADIO GROUP STARTS */}
                                                        <DropdownMenuPrimitive.RadioGroup
                                                            value={statusActive}          // selected value (optional)
                                                            onValueChange={(value) => handleStatus(value)}
                                                        >

                                                            <DropdownMenuPrimitive.RadioItem
                                                                value="Active"
                                                                className="cursor-pointer px-2 py-1 flex items-center"
                                                            >
                                                                Active
                                                            </DropdownMenuPrimitive.RadioItem>

                                                            <DropdownMenuPrimitive.RadioItem
                                                                value="Extension"
                                                                className="cursor-pointer px-2 py-1 flex items-center"
                                                            >
                                                                Extension
                                                            </DropdownMenuPrimitive.RadioItem>

                                                            <DropdownMenuPrimitive.RadioItem
                                                                value="Expired"
                                                                className="cursor-pointer px-2 py-1 flex items-center"
                                                            >
                                                                Expired
                                                            </DropdownMenuPrimitive.RadioItem>

                                                        </DropdownMenuPrimitive.RadioGroup>
                                                        {/* RADIO GROUP ENDS */}

                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                :
                                                <TableHead key={header.id}>
                                                    <>
                                                        {console.log(header.column.columnDef.header, "header.column.columnDef.header")}
                                                        {header.isPlaceholder
                                                            ? null
                                                            : flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}

                                                    </>

                                                </TableHead>}
                                        {/* <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead> */}
                                    </>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                {columns.map((_, j) => (
                                    <TableCell key={j}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && 'selected'}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No results found for AMC Info.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}