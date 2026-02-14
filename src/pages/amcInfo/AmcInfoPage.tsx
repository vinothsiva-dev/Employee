// src/app/amc-info/page.tsx
"use client";

import * as React from "react";
import { useMemo, useEffect, useState } from "react";
// Import your custom API instance
import { api } from "@/lib/axios";
import { AmcInfo, AmcFormValues, EntityOption } from "@/types/amc";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AmcTable } from "@/components/amc-table";
import { AmcForm } from "@/components/amc-form";
import { useToast } from "@/toast/ToastProvider";
import { useSidebar } from "@/components/ui/sidebar";
import axios from "axios";

interface PaginationMeta {
  totalRecords: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
// --- Configuration ---

const API_BASE_PATH = "/api/amcInfo";
const DEFAULT_PAGE_SIZE = 100;

export default function AmcInfoPage() {
  const toast = useToast();
  const [amcList, setAmcList] = useState<AmcInfo[]>([]);
  const [amcListSub, setAmcListSub] = useState<AmcInfo[]>([]);
  const [dealers, setDealers] = useState<EntityOption[]>([]);
  const [customers, setCustomers] = useState<EntityOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [metaSub, setMetaSub] = useState<PaginationMeta>({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingAmc, setEditingAmc] = useState<AmcInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("customerName");
  const [statusActive, setStatusActive] = useState("Active");
  const [sortOrder, setSortOrder] = useState("desc");
  // 1. DATA FETCHING (GET)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    const year = date.getFullYear();
    return `${day}-${month}-${year}`; // 21-JUN-2025
  };
  const STATUS_ORDER: Record<string, number> = {
    Active: 1,
    Extension: 2,
    Expired: 3,
    Inactive: 4,
    Others: 5,
  };
  const fetchAmcList = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Construct the query string from state
      // const params = {
      //     page: currentPage,
      //     limit: pageSize,
      //     search: searchTerm, // Passed to backend
      //     sortBy: sortBy,     // Passed to backend
      //     sortOrder: sortOrder, // Passed to backend
      // };

      const [amcRes, dealerRes, customerRes] = await Promise.all([
        // Pass pagination parameters to the AMC list endpoint
        api.get<{ data: AmcInfo[]; meta: PaginationMeta }>(
          `${API_BASE_PATH}?page=${currentPage}&limit=${DEFAULT_PAGE_SIZE}&search=${searchTerm}&sortBy=${sortBy}&sortOrder=${sortOrder}`
        ),
        api.get<EntityOption[]>(`${API_BASE_PATH}/dealers`),
        api.get<EntityOption[]>(`${API_BASE_PATH}/customers`),
      ]);


      // alert("after api call")s
      const newEntryOption: EntityOption = { id: "new", name: "[+ New Entry]" };

      setDealers([...dealerRes.data, newEntryOption]);
      setCustomers([...customerRes.data, newEntryOption]);
      const formattedData = amcRes?.data?.data?.map((item: any) => ({
        ...item,
        amcFrom: formatDate(item.amcFrom),
        amcTo: formatDate(item.amcTo),
      }));

      console.log(amcRes.data.data, formattedData, "data for the  Amc");
      const sortedList = [...formattedData].sort((a, b) => {
        // if one matches selected field → that goes first
        if (a.status === statusActive && b.status !== statusActive) return -1;
        if (b.status === statusActive && a.status !== statusActive) return 1;

        // else normal priority ordering
        const aOrder = STATUS_ORDER[a.status] ?? 999;
        const bOrder = STATUS_ORDER[b.status] ?? 999;
        return aOrder - bOrder;
      });
      setAmcList(sortedList);
      setMeta(amcRes.data.meta as any);

      setAmcListSub(sortedList);
      setMetaSub(amcRes.data.meta as any);
    } catch (err) {
      console.error("API Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortOrder, sortBy]); // Dependencies updated

  // Trigger fetch when any relevant state changes
  useEffect(() => {
    fetchAmcList();
    // alert("the effect")
  }, [currentPage, sortBy, sortOrder]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    setPage(newPage);
  };
  const handleSearchChange = async (event: any) => {
    let value = event.target.value;
    setSearchTerm(value);
    if (value) {
      const filtered = amcListSub.filter((item) =>
        Object.values(item).some((field) =>
          String(field).toLowerCase().includes(value.toLowerCase())
        )
      );
      console.log(filtered, "filter");
      if (!filtered.length) {
        setIsLoading(true);
        try {
          const [amcRes, dealerRes, customerRes] = await Promise.all([
            // Pass pagination parameters to the AMC list endpoint
            api.get<{ data: AmcInfo[]; meta: PaginationMeta }>(
              `${API_BASE_PATH}?page=${1}&limit=${DEFAULT_PAGE_SIZE}&search=${value}&sortBy=${sortBy}&sortOrder=${sortOrder}`
            ),
            api.get<EntityOption[]>(`${API_BASE_PATH}/dealers`),
            api.get<EntityOption[]>(`${API_BASE_PATH}/customers`),
          ]);
          const newEntryOption: EntityOption = {
            id: "new",
            name: "[+ New Entry]",
          };

          const formattedData = amcRes?.data?.data?.map((item: any) => ({
            ...item,
            amcFrom: formatDate(item.amcFrom),
            amcTo: formatDate(item.amcTo),
          }));
          console.log(amcRes.data.data, formattedData, "data for the  Amc1");
          const sortedList = [...formattedData].sort((a, b) => {
            // if one matches selected field → that goes first
            if (a.status === statusActive && b.status !== statusActive)
              return -1;
            if (b.status === statusActive && a.status !== statusActive)
              return 1;

            // else normal priority ordering
            const aOrder = STATUS_ORDER[a.status] ?? 999;
            const bOrder = STATUS_ORDER[b.status] ?? 999;
            return aOrder - bOrder;
          });
          setAmcList(sortedList);
          setAmcListSub((prev) => [...prev, ...sortedList]);
        } catch (err) {
          console.error("API Error:", err);
        } finally {
          setIsLoading(false);
        }
      } else {
        const sortedList = [...filtered].sort((a, b) => {
          // if one matches selected field → that goes first
          if (a.status === statusActive && b.status !== statusActive) return -1;
          if (b.status === statusActive && a.status !== statusActive) return 1;

          // else normal priority ordering
          const aOrder = STATUS_ORDER[a.status] ?? 999;
          const bOrder = STATUS_ORDER[b.status] ?? 999;
          return aOrder - bOrder;
        });
        setAmcList(sortedList);
      }
    } else {
      const sortedList = [...amcListSub].sort((a, b) => {
        // if one matches selected field → that goes first
        if (a.status === statusActive && b.status !== statusActive) return -1;
        if (b.status === statusActive && a.status !== statusActive) return 1;

        // else normal priority ordering
        const aOrder = STATUS_ORDER[a.status] ?? 999;
        const bOrder = STATUS_ORDER[b.status] ?? 999;
        return aOrder - bOrder;
      });
      setAmcList(sortedList);
    }

    setCurrentPage(currentPage); // Reset to the first page when searching
  };
  // Helper to find the database ID of an entity by its displayed name.
  const findOptionIdByName = (
    options: EntityOption[],
    name: string
  ): string => {
    return options.find((o) => o.name === name)?.id || "";
  };

  const handleEdit = (amc: AmcInfo) => {
    setEditingAmc(amc);
    setIsSheetOpen(true);
  };

  // 2. FORM SUBMISSION (CREATE/UPDATE - POST/PUT)
  const handleSubmit = async (formData: AmcFormValues) => {
    setIsSubmitting(true);
    const method = editingAmc ? "PUT" : "POST";
    const url = editingAmc
      ? `${API_BASE_PATH}/${editingAmc.id}`
      : API_BASE_PATH;

    try {
      await api({ method, url, data: formData });

      // Re-fetch dropdowns if a new entity was created
      if (formData.dealer === "new" || formData.customer === "new") {
        await Promise.all([
          api.get<EntityOption[]>(`${API_BASE_PATH}/dealers`).then((res) => {
            const newEntryOption: EntityOption = {
              id: "new",
              name: "[+ New Entry]",
            };
            setDealers([...res.data, newEntryOption]);
          }),
          api.get<EntityOption[]>(`${API_BASE_PATH}/customers`).then((res) => {
            const newEntryOption: EntityOption = {
              id: "new",
              name: "[+ New Entry]",
            };
            setCustomers([...res.data, newEntryOption]);
          }),
        ]);
      }

      // Instead of manually manipulating the 'data' state, we simply refresh the current view
      // This is safer and more reliable with pagination enabled.
      await fetchAmcList();

      toast.success(
        `${editingAmc ? "Updated" : "Created"} AMC record successfully!`
      );

      setIsSheetOpen(false);
      setEditingAmc(null);
    } catch (error) {
      // ... (error handling remains the same)
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      setEditingAmc(null);
      setIsSheetOpen(false);
    } else {
      setIsSheetOpen(true);
    }
  };

  // Prepare initial form state for editing
  const initialFormState: Partial<AmcFormValues> | undefined = useMemo(() => {
    if (!editingAmc) return undefined;

    // Map the table data back to the form structure using the dynamic lists
    return {
      dealer: findOptionIdByName(dealers, editingAmc.dealerName),
      customer: findOptionIdByName(customers, editingAmc.customerName),
      description: editingAmc.description,
      status: editingAmc.status,
      amcFrom: editingAmc.amcFrom,
      amcTo: editingAmc.amcTo,
      amcMonth: editingAmc.amcMonth,
      newDealerName: editingAmc.dealerName,
      newCustomerName: editingAmc.customerName,
    };
  }, [editingAmc, dealers, customers]);

  if (isLoading && amcList.length === 0) {
    return (
      <div className="container mx-auto py-10 text-center">
        <p className="text-xl font-medium text-sky-600">
          Loading data, please wait...
        </p>
      </div>
    );
  }
  const { state } = useSidebar();

  const handleSort = (field: any) => {
    console.log(field, sortBy)
    if (sortBy == field) {
      // alert("hi")
      // If the same field is clicked, toggle the order
      setSortOrder(sortOrder == "asc" ? "desc" : "asc");
    } else {
      // If a ne
      // w field is  clicked, set it and default to 'desc'
      // alert("am here")/
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1); // Always reset to page 1 when changing sort
  };

  const handleStatus = (field: string) => {
    console.log(field, "selected");
    setStatusActive(field);

    const sortedList = [...amcList].sort((a, b) => {
      // if one matches selected field → that goes first
      if (a.status === field && b.status !== field) return -1;
      if (b.status === field && a.status !== field) return 1;

      // else normal priority ordering
      const aOrder = STATUS_ORDER[a.status] ?? 999;
      const bOrder = STATUS_ORDER[b.status] ?? 999;
      return aOrder - bOrder;
    });

    setAmcList(sortedList);
  };

  // Helper function to render the sort icon

  return (
    <div
      className={`py-4  ${state == "expanded" ? "lg:w-[90%]" : "lg:w-full"}`}
    >
      <header className="flex justify-between items-center mb-6">
        <p className="text-3xl font-bold">AMC Info</p>

        <Button
          className="!bg-black hover:!bg-sky-600 !text-white shadow-md"
          onClick={() => setIsSheetOpen(true)}
        >
          + Add New AMC Info
        </Button>
      </header>
      <div className="flex w-full justify-end">
        <input
          type="text"
          placeholder="Search by Dealer or Customer"
          value={searchTerm}
          onChange={handleSearchChange}
          style={{ padding: "8px", marginRight: "10px" }}
          className="border-[2px] mb-2 w-full md:w-[25%] rounded-[4px]"
        />
      </div>

      {/* --- Data Table --- */}
      <div className="border rounded-lg shadow-sm">
        <AmcTable
          data={amcList}
          onEdit={handleEdit}
          meta={meta}
          statusActive={statusActive}
          onPageChange={handlePageChange}
          loading={isLoading}
          handleSort={handleSort}
          handleStatus={handleStatus}
        />
      </div>

      {/* --- Sheet for CRUD Form --- */}
      <Sheet open={isSheetOpen} onOpenChange={handleSheetClose}>
        <SheetContent
          side="right"
          className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {editingAmc
                ? `Edit AMC ID: ${editingAmc.id.substring(0, 8)}...`
                : "Add New AMC Info"}
            </SheetTitle>
          </SheetHeader>

          {/* Pass the actual options and handlers to the form */}
          <AmcForm
            initialData={initialFormState}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            dealerOptions={dealers}
            customerOptions={customers}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
