import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from '@/components/ui/button';
import { api } from "@/lib/axios";
import { FC } from "react";
import { MoreHorizontal, Pencil, History, Trash2, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { CheckCircle } from "lucide-react";
import Select from "react-select";
import {
    TooltipProvider,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { LayoutGrid, Table } from "lucide-react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
    placeholder?: string;
    onSearch: (value: string) => void;
    onClear?: () => void;
}
type ViewMode = "grid" | "table";
const HIDDEN_KEYS = [
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "employeeName", "employeeId"
];
interface AssetCardProps {
    data: any;
    onEdit: (id: string) => void;
    onHistory?: (id: string) => void;
    onDelete?: (id: string) => void;
}
interface Employee {
    id: string;
    name: string;
}

interface FormData {
    _id?: string;
    employeeId: string;
    employeeName: string;
    computerName: string;
    ram: string;
    deviceId: string;
    graphicsCard: string;
    processor: string;
    os: string;
    osVersion: string;
    storageDrives: string;
    ssd: string;
    ssdStorage: string;
    fromDate: string;
    remarks: string;
    computerUsername: string;
    computerPassword: string; createdBy: String; updatedBy: String; lockerKey: any; sim: any;
    simNumber: any;
    mouse: any;
    bag: any;
}

export default function EmployeeAssetsForm() {
    const [assets, setAssets] = useState<any[]>([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [sunvalue, setSubValue] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const ITEMS_PER_LOAD = 50;
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [openSearch, setsearch] = useState(false);
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (openSearch && inputRef.current) {
            inputRef.current.focus();
        }
    }, [openSearch]);

    useEffect(() => {
        if (value) {
            const filtered = sunvalue.filter((item) =>
                item.employeeId?.toLowerCase().includes(value.toLowerCase()) ||
                item.employeeName?.toLowerCase().includes(value.toLowerCase())
            );

            console.log(filtered);
            setAssets(filtered)
        } else {
            setPage(1)
            setAssets(sunvalue)
        }
    }, [value]);
    const fetchAssetList = async (pageNumber: number) => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await api.get(`/api/asset?limit=${ITEMS_PER_LOAD}&page=${pageNumber}`);
            const newAssets = res.data.data;

            // Merge with existing assets, replacing duplicates by _id
            if (pageNumber == 1 || pageNumber == 0) {
                console.log(res, 'data for asset')
                setAssets(newAssets)
                setSubValue(newAssets)
            } else {
                setAssets(prev => {
                    const assetsMap = new Map<string, any>();

                    // Add existing assets to map
                    prev.forEach(a => assetsMap.set(a._id, a));

                    // Add new assets (overwrites if _id already exists)
                    newAssets.forEach((a: any) => assetsMap.set(a._id, a));

                    // Return merged array
                    return Array.from(assetsMap.values());
                });
                setSubValue(prev => {
                    const assetsMap = new Map<string, any>();

                    // Add existing assets to map
                    prev.forEach(a => assetsMap.set(a._id, a));

                    // Add new assets (overwrites if _id already exists)
                    newAssets.forEach((a: any) => assetsMap.set(a._id, a));

                    // Return merged array
                    return Array.from(assetsMap.values());
                })
            }

            setPage(res.data.page + 1);
            setHasMore(res.data.page < res.data.totalPages);

        } catch (error) {
            console.error("Failed to fetch assets", error);
        } finally {
            setLoading(false);
        }

    };
    const fetchSearchList = async (searchValue: string, pageNumber: number) => {
        if (loading) return;
        setLoading(true);

        try {
            const res = await api.get(
                `/api/asset/search?search=${encodeURIComponent(searchValue)}&limit=${ITEMS_PER_LOAD}&page=${pageNumber}`
            );

            const newAssets = res.data.data;

            // Merge unique items using _id
            setAssets(prev => {
                const map = new Map<string, any>();
                prev.forEach(a => map.set(a._id, a));
                newAssets.forEach((a: any) => map.set(a._id, a));
                return Array.from(map.values());
            });

            setPage(res.data.page + 1);
            setHasMore(res.data.page < res.data.totalPages);

        } catch (error) {
            console.error("Failed to search assets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 10 && hasMore) {
            let user = localStorage.getItem("user");
            if (user) {
                let parse = JSON.parse(user)
                let email = parse.email || ""
                let id = parse.employee_id || ""

                if (parse.role
                    ==
                    "admin") {
                    fetchAssetList(page);
                }

            }
        }
    };



    const fetchAssetListUser = async (userID: any) => {
        try {
            const res = await api.get("/api/asset/get", {
                params: { id: userID },
            });

            if (res.data) {
                setAssets(res.data);
            }

        } catch (error) {
            console.error("Failed to fetch", error);
        }
    };

    useEffect(() => {
        getEmployees();
        let user = localStorage.getItem("user");
        if (user) {
            let parse = JSON.parse(user)
            let email = parse.email || ""
            let id = parse.employee_id || ""

            if (parse.role
                !=
                "admin") {
                fetchAssetListUser(id);
            } else {
                fetchAssetList(1);
            }

        }
    }, []);
    // useEffect(() => {
    //     fillName();
    // }, [isSheetOpen]);

    type EmployeeAPI = {
        employee_id?: string;
        email?: string;
    };

    type Employee = {
        label: string;
        value: string; // email stored as name
    };

    const [employeeList, setEmployees] = useState<Employee[]>([]);

    const getEmployees = async () => {
        try {
            const res = await api.get<EmployeeAPI[]>("/api/employee/getAllEmployee");

            const formatted = res.data.map((emp) => ({
                label: emp.email ?? "",
                value: emp.employee_id ?? "",
            }));

            setEmployees(formatted);
        } catch (error) {
            console.error("Failed to load employees:", error);
        }
    };

    const fillName = () => {
        let user = localStorage.getItem("user");
        if (user) {
            let parse = JSON.parse(user)
            let email = parse.email || ""
            let id = parse.employee_id || ""

            console.log(user, parse, 'data of the user')
            // handleEmployeeChange(value)
            setFormData((prev) => ({
                ...prev,
                employeeName: email,
                employeeId: id ?? "",
            }));


        }
    }

    // Master form state
    const [formData, setFormData] = useState<FormData>({
        employeeId: "",
        employeeName: "",
        computerName: "",
        ram: "",
        deviceId: "",
        graphicsCard: "",
        processor: "",
        os: "",
        osVersion: "",
        storageDrives: "",
        ssd: "",
        ssdStorage: "",
        fromDate: "",
        remarks: "",
        computerUsername: "",
        computerPassword: "", createdBy: "", updatedBy: "", lockerKey: "", sim: false,
        simNumber: "",
        mouse: false,
        bag: false,
    });

    // Edit Mode
    const [isEditing, setIsEditing] = useState(false);

    // Common change handler
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const target = e.target;
        if (target instanceof HTMLInputElement) {
            if (target.type === "checkbox") {
                // checkbox
                setFormData((prev) => ({
                    ...prev,
                    [target.name]: target.checked,
                }));
            } else {
                // text input
                setFormData((prev) => ({
                    ...prev,
                    [target.name]: target.value,
                }));
            }
        } else if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
            setFormData((prev) => ({
                ...prev,
                [target.name]: target.value,
            }));
        }
    };



    const closeHistory = () => {
        setHistoryData([]);
        setHistoryOpen(false)
    }
    // Handle employee selection
    const handleEmployeeChange = (value: any) => {
        if (value?.value) {
            const id = value?.value;

            const emp = employeeList.find((x) => x.value === id);
            setFormData((prev) => ({
                ...prev,
                employeeName: value?.label,
                employeeId: emp?.value ?? "",
            }));
        } else {
            setFormData((prev) => ({
                ...prev,
                employeeId: "",
                employeeName: "",
            }));
        }

    };

    // SAVE
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true)
        let user = localStorage.getItem("user");
        if (user) {
            let parse = JSON.parse(user)
            let email = parse.email || ""

            if (formData._id) {
                formData.updatedBy = email
            } else {
                formData.createdBy = email
            }
        }
        try {
            if (formData._id) {
                // EDIT MODE

                const res = await api.put(`/api/asset/${formData._id}`, formData);
                console.log("UPDATED:", res.data);
            } else {
                // CREATE MODE
                const res = await api.post(`/api/asset`, formData);
                console.log("CREATED:", res.data);
            }
            handleSheetClose(false);
            setIsEditing(false);
            setPage(1)
            setAssets([])
            let user = localStorage.getItem("user");
            if (user) {
                let parse = JSON.parse(user)
                let email = parse.email || ""
                let id = parse.employee_id || ""

                if (parse.role
                    !=
                    "admin") {
                    fetchAssetListUser(id);
                } else {
                    fetchAssetList(1);
                }

            }

        } catch (error: any) {
            console.error("Save/Update Failed", error);
        }

        setLoading(false)
    };

    const sanitizeObject = (obj: any) => {
        const cleaned: any = {};

        for (const key in obj) {
            let value = obj[key];

            // Convert null/undefined → empty string
            if (value == null) {
                cleaned[key] = "";
                continue;
            }

            // Handle date conversion
            if (
                key.toLowerCase().includes("date") &&
                typeof value === "string" &&
                value.includes("T")
            ) {
                cleaned[key] = value.split("T")[0]; // Extract YYYY-MM-DD
                continue;
            }

            cleaned[key] = value;
        }

        return cleaned;
    };



    const handleViewHistory = async (id: string) => {
        try {
            const res = await api.get(`/api/asset/history/${id}`);
            setHistoryData(res.data);
            setHistoryOpen(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: any) => {
        id.isDeleted = true
        let data = id
        let user = localStorage.getItem("user");
        if (user) {
            let parse = JSON.parse(user)
            let email = parse.email || ""

            if (data._id) {
                data.updatedBy = email
            } else {
                data.createdBy = email
            }
        }
        try {
            if (data._id) {
                // EDIT MODE

                const res = await api.put(`/api/asset/${data._id}`, data);
                console.log("UPDATED:", res.data);
            } else {
                // CREATE MODE
                const res = await api.post(`/api/asset`, data);
                console.log("CREATED:", res.data);
            }
            handleSheetClose(false);
            setIsEditing(false);
            fetchAssetList(1); // reload table after save

        } catch (error: any) {
            console.error("Save/Update Failed", error);
        }

    };
    const handleEdit = (data: any) => {
        let findObject = assets.find((item: any) => item._id == data)
        if (findObject) {
            const cleanedObj = sanitizeObject(findObject);
            setFormData(cleanedObj);
            setIsSheetOpen(true);
            setIsEditing(true)
        }

    };

    const handleSheetClose = (open: boolean) => {
        if (!open) {
            setIsSheetOpen(false);
            setIsEditing(false);
            setFormData({
                employeeId: "",
                employeeName: "",
                computerName: "",
                ram: "",
                deviceId: "",
                graphicsCard: "",
                processor: "",
                os: "",
                osVersion: "",
                storageDrives: "",
                ssd: "",
                ssdStorage: "",
                fromDate: "",
                remarks: "",
                computerUsername: "",
                computerPassword: "", createdBy: "", updatedBy: "", lockerKey: "", sim: false,
                simNumber: "",
                mouse: false,
                bag: false,
            })
        } else {
            setIsSheetOpen(true);
        }
    };

    const AssetCard: FC<AssetCardProps> = ({ data, onEdit, onHistory, onDelete }) => {
        return (
            <div className="
      relative bg-gradient-to-br from-white to-slate-50
      border border-slate-200 rounded-2xl shadow-sm
      p-5 transition hover:shadow-md hover:-translate-y-1 duration-200
      group
    ">
                {/* 3-dot menu */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition">
                    <DropdownMenu>
                        <DropdownMenuTrigger style={{ border: 'none' }}>
                            <Button
                                style={{ width: '5px' }}
                                aria-label="More"
                            >
                                <MoreHorizontal className="w-5 h-5 text-gray-600 hover:text-black" />
                            </Button>

                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 shadow-lg rounded-xl">

                            <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onEdit(data._id)}
                            >
                                <Pencil size={16} /> Edit
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => onHistory && onHistory(data._id)}
                            >
                                <History size={16} /> History
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="cursor-pointer text-red-600 focus:text-red-700 gap-2"
                                onClick={() => onDelete && onDelete(data)}
                            >
                                <Trash2 size={16} /> Delete
                            </DropdownMenuItem>

                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Card Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold"> <EllipsisText
                            text={data.employeeName || "---"}
                        /></h3>
                        <p className="text-xs text-gray-500">{data.employeeId}</p>
                    </div>
                </div>

                {/* Card Details */}
                <div className="text-sm space-y-1.5 text-gray-700">

                    <p>
                        <span className="font-medium">Computer:</span>{" "}
                        {data.computerName || "---"}
                    </p>

                    <p>
                        <span className="font-medium">Processor:</span>{" "}
                        {data.processor || "---"}
                    </p>

                    <p>
                        <span className="font-medium">RAM:</span>{" "}
                        {data.ram || "---"}
                    </p>

                    <p>
                        <span className="font-medium">OS:</span>{" "}
                        {data.os || "---"}
                    </p>

                    <p>
                        <span className="font-medium">From:</span>{" "}
                        {data.fromDate
                            ? new Date(data.fromDate).toLocaleDateString()
                            : "---"}
                    </p>

                    {data.remarks && (
                        <p className="text-xs italic text-gray-500 bg-slate-100 p-2 rounded-lg">
                            "{data.remarks}"
                        </p>
                    )}
                </div>
            </div>
        );
    };

    const EllipsisText = ({ text }: { text: any }) => {
        const isTrue =
            text === true ||
            text === "true" ||
            text === "True" ||
            text === "TRUE";

        return (
            <div className="relative group" style={{ cursor: "pointer" }}>
                {/* Display */}
                <div className="truncate max-w-[150px] cursor-default">
                    {isTrue ? (
                        <CheckCircle className="text-green-500 w-4 h-4 mt-2" />
                    ) : (
                        text || "---"
                    )}
                </div>

                {/* Tooltip */}
                {text && (
                    <div
                        className="
                        absolute 
                        z-[9999]
                        hidden 
                        group-hover:block 
                        bg-black 
                        text-white 
                        text-xs 
                        px-2 
                        py-1 
                        rounded 
                        whitespace-nowrap
                        transform 
                        -translate-y-1 
                        left-0
                        top-[-110%]
                        shadow-lg
                    "
                    >
                        {isTrue ? (
                            <div className="flex items-center gap-1">
                                <CheckCircle className="text-green-400 w-3 h-3" />
                                True
                            </div>
                        ) : (
                            text
                        )}
                    </div>
                )}
            </div>
        );
    };


    const AssetHistoryModal = ({
        open,
        onClose,
        history
    }: {
        open: boolean;
        onClose: () => void;
        history: any[];
    }) => {
        let visibleKeys: string[] = [];

        if (history.length) {
            visibleKeys = Object.keys(history[0].previousData).filter(
                (k) => !HIDDEN_KEYS.includes(k)
            );
        }


        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="" style={{ width: '70vw', maxWidth: 'none' }}>
                    <DialogHeader style={{ borderBottom: '1px solid gray', paddingBottom: '2rem', marginBottom: '5px' }}>
                        <DialogTitle>Asset Change History</DialogTitle>
                    </DialogHeader>

                    {history.length === 0 ? (
                        <p className="text-center py-6 text-gray-500">No history found.</p>
                    ) : (
                        <div className="max-h-[70vh] overflow-auto border rounded-md">
                            <div className="relative min-w-max">

                                {/* ---------------- HEADER ROW ---------------- */}
                                <div
                                    className="grid  text-gray-700 font-medium sticky top-0 z-20"
                                    style={{
                                        gridTemplateColumns: `50px 200px 200px repeat(${visibleKeys.length}, 200px)`,
                                        background: '#00bcd4', color: 'white'
                                    }}
                                >
                                    {/* Sticky Col 1 */}
                                    <div className="p-2  sticky left-0  z-30" style={{ background: '#00bcd4', }}></div>

                                    {/* Sticky Col 2 */}
                                    {/* <div className="p-2  sticky left-[250px]  z-30" style={{ background: '#00bcd4', }}>
                                        Updated By
                                    </div> */}

                                    {/* Sticky Col 3 */}
                                    <div className="p-2  sticky left-[50px]  z-30" style={{ background: '#00bcd4', }}>
                                        Updated At
                                    </div>

                                    {/* Dynamic headers */}
                                    {visibleKeys.map((key) => (
                                        <div key={key} className="p-2  capitalize">
                                            {key}
                                        </div>
                                    ))}
                                </div>

                                {/* ---------------- DATA ROWS ---------------- */}
                                {history.map((item, index) => {
                                    const fields = Object.entries(item.previousData).filter(
                                        ([key]) => !HIDDEN_KEYS.includes(key)
                                    );

                                    return (
                                        <div
                                            key={item._id}
                                            className="grid hover:bg-gray-50"
                                            style={{
                                                gridTemplateColumns: `50px 200px 200px repeat(${fields.length}, 200px)`,
                                                borderBottom: index === history.length - 1 ? "none" : "1px solid #e8e8e8"
                                            }}
                                        >
                                            {/* Sticky Col 1 */}
                                            <div className="p-2  sticky left-0 bg-white z-20 flex justify-center">
                                                <Clock className="w-4 h-4" style={{ color: '#8300e6' }} />
                                            </div>

                                            {/* Sticky Col 2 */}
                                            {/* <div className="p-2  sticky left-[250px] bg-white z-20" style={{ cursor: 'pointer' }}>
                                                <EllipsisText
                                                    text={item.updatedBy || "---"}
                                                />
                                            </div> */}

                                            {/* Sticky Col 3 */}
                                            <div className="p-2  sticky left-[50px] bg-white z-20 whitespace-nowrap">
                                                {item.changedAt
                                                    ? new Date(item.changedAt).toLocaleString()
                                                    : "---"}
                                            </div>

                                            {/* Dynamic columns */}
                                            {fields.map(([key, value]) => (
                                                <div key={key} className="p-2  max-w-[180px]" style={{ cursor: 'pointer' }}>
                                                    <EllipsisText
                                                        text={
                                                            key.toLowerCase().includes("createdAt") &&
                                                                (typeof value === "string" || typeof value === "number")
                                                                ? new Date(value).toLocaleDateString() : key.toLowerCase().includes("updatedAt") &&
                                                                    (typeof value === "string" || typeof value === "number")
                                                                    ? new Date(value).toLocaleDateString()
                                                                    : String(value || "---")
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                            <br />
                        </div>

                    )}
                </DialogContent>
            </Dialog>
        );
    };
    const setSheetOpen = () => {
        fillName();
        setIsSheetOpen(true)
    }
    const AssetHistoryModalList: FC<AssetCardProps> = ({ data, onEdit, onHistory, onDelete }) => {
        let visibleKeys: string[] = [];

        if (data.length) {
            visibleKeys = Object.keys(data[0]).filter(key => !["_id", "updatedAt", "__v", "updatedBy", "createdAt", "isDeleted", "deletedAt"].includes(key));
        }
        let columnKeys = [
            "Employee Id",
            "Employee Name",
            "Computer Name",
            "RAM",
            "Device Id",
            "Graphics Card",
            "Processor",
            "OS",
            "OS Version",
            "Storage Drives",
            "SSD",
            "SSD Storage",
            "From Date",
            "Remarks",
            "User Name",
            "Password",
            "Key",
            "Created By",
            "SIM",
            "MOUSE",
            "BAG",
            "SIM Number"
        ]
        console.log(visibleKeys)
        return (
            <div className=" rounded-md">
                <div className="relative">
                    <div
                        className="grid text-gray-700 font-medium sticky top-0 z-20"
                        style={{
                            gridTemplateColumns: `40px 150px repeat(${columnKeys.length}, 150px) 50px`,
                        }}
                    >
                        {/* Sticky first column */}
                        <div className="p-2  left-0 z-30 bg-[#c5edf2] "></div>

                        {/* Dynamic headers */}
                        {columnKeys.map((key) => (
                            <div key={key} className="p-2 bg-[#c5edf2] text-black capitalize">
                                {
                                    key
                                }
                            </div>
                        ))}

                        {/* Actions column */}
                        <div className="p-2 sticky right-0 z-30 bg-[#c5edf2] text-center text-black" style={{ width: '5rem' }}>Actions</div>
                    </div>

                    {/* ---------------- DATA ROWS ---------------- */}
                    {data.map((item: any, index: any) => {
                        const fields = Object.entries(item).filter(
                            ([key]) => !["_id", "updatedAt", "__v", "updatedBy", "createdAt", "isDeleted", "deletedAt"].includes(key)
                        );
                        return (
                            <div
                                key={index}
                                className="grid hover:bg-gray-50"
                                style={{
                                    gridTemplateColumns: `40px 150px repeat(${fields.length}, 150px) 50px`,
                                }}
                            >
                                {/* Sticky Left Cell */}
                                <div className="p-2  left-0 bg-white flex justify-center border-b border-gray-300 z-10">
                                    <User className="text-blue-500" />
                                </div>

                                {/* Dynamic Columns */}
                                {fields.map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="p-2 max-w-[180px] border-b border-gray-300"
                                        style={{ cursor: "pointer" }}
                                    >
                                        <EllipsisText
                                            text={
                                                (key.toLowerCase().includes("createdat") ||
                                                    key.toLowerCase().includes("updatedat")) &&
                                                    (typeof value === "string" || typeof value === "number")
                                                    ? new Date(value).toLocaleDateString()
                                                    : String(value || "---")
                                            }
                                        />
                                    </div>
                                ))}

                                {/* Sticky Right Cell */}
                                <div
                                    className="p-2 sticky right-0 bg-white flex justify-center border-b border-gray-300 z-10"
                                    style={{ width: "5rem", height: "2.7rem" }}
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="p-0 h-6 w-6 hover:bg-transparent"
                                                aria-label="More"
                                            >
                                                <MoreHorizontal className="w-5 h-5 text-gray-600 hover:text-black" />
                                            </Button>
                                        </DropdownMenuTrigger>

                                        <DropdownMenuContent align="end" className="bg-white border rounded shadow-md w-36">
                                            <DropdownMenuItem
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => onEdit(item._id)}
                                            >
                                                <Pencil size={16} /> Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => onHistory && onHistory(item._id)}
                                            >
                                                <History size={16} /> History
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-500"
                                                onClick={() => onDelete && onDelete(item)}
                                            >
                                                <Trash2 size={16} /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    const SearchInput = ({ placeholder, onSearch, onClear }: SearchInputProps) => {



        const handleSearchClick = () => {
            onSearch(value);
        };
        const handleopen = () => {
            setsearch(true)
        }
        const handleClear = () => {
            setPage(1)
            fetchAssetList(1)
            setsearch(false)
            setValue("");
            onClear && onClear();
        };

        return (
            <div className="relative w-full mr-4">
                {!openSearch && <Button
                    variant={viewMode === "grid" ? "secondary" : "outline"}
                    onClick={handleopen}
                    className={
                        viewMode === "grid"
                            ? "!bg-black !text-white"
                            : "!bg-white !shadow-md"
                    }
                    size="icon"
                    aria-label="Open Search"
                >
                    <Search className="w-5 h-5" />
                </Button>}
                {openSearch &&
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder || "Search..."}
                        className="w-full border rounded pl-3 pr-10 py-2 outline-none focus:ring focus:ring-blue-200 transition"
                    />}

                {/* Search Button */}
                {openSearch && (

                    <X className="w-5 h-5" onClick={handleClear} style={{ position: 'absolute', top: 12, right: 40, cursor: 'pointer' }} />
                )}
                {openSearch && <Search className="w-5 h-5" onClick={handleSearchClick} style={{ position: 'absolute', top: 10, right: 10, cursor: 'pointer' }} />}


                {/* Clear Button (only when value exist) */}

            </div>
        );
    };
    return (
        <>
            <div className="p-4">
                <style>{`
                  .custom-scrollbar::-webkit-scrollbar { width: 12px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 6px; }
                  .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #00bcd4; border-radius: 6px; border: 3px solid #f1f1f1; }
                  .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #00bcd4 #f1f1f1; }
                `}</style>

                {/* Add New Button (Right aligned) */}
                <div className="flex justify-end mb-4">
                    {assets.length > 0 && (<>
                        <div className="grid mr-2">
                            <AnimatePresence mode="wait">
                                <div className="flex justify-end w-full">
                                    <div className="flex items-center w-[90px] gap-2 pb-4">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant={viewMode === "grid" ? "secondary" : "outline"}
                                                        onClick={() => setViewMode("grid")}
                                                        className={
                                                            viewMode === "grid"
                                                                ? "!bg-black !text-white"
                                                                : "!bg-white !shadow-md"
                                                        }
                                                        size="icon"
                                                        aria-label="Grid view"
                                                    >
                                                        <LayoutGrid className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>

                                                {/* Custom styled TooltipContent */}
                                                <TooltipContent
                                                    className="bg-white border border-sky-500 text-blue-500 px-3 py-1 rounded shadow-md"
                                                >
                                                    Grid
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant={viewMode === "table" ? "secondary" : "outline"}
                                                        onClick={() => setViewMode("table")}
                                                        className={
                                                            viewMode === "table"
                                                                ? "!bg-black !text-white"
                                                                : "!bg-white !shadow-md"
                                                        }
                                                        size="icon"
                                                        aria-label="Table view"
                                                    >
                                                        <Table className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>

                                                <TooltipContent
                                                    className="bg-white border border-sky-500 text-blue-500 px-3 py-1 rounded shadow-md"
                                                >
                                                    Table
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                    </div>
                                </div>



                            </AnimatePresence>
                        </div>
                        {SearchInput({
                            placeholder: "Search employee...",
                            onSearch: (v) => fetchSearchList(v, 1),
                            onClear: () => console.log("Clear"),
                        })}

                    </>)}
                    <Button
                        className="!bg-black hover:!bg-sky-600 !text-white shadow-md"
                        onClick={setSheetOpen}
                        style={{ marginRight: '10rem' }}
                    >
                        + Add New Asset
                    </Button>



                </div>



                {assets.length == 0 && !loading && (
                    <div className="flex items-center justify-center h-[70vh] text-gray-500 text-lg font-bold">
                        No Data Found
                    </div>
                )}


                {viewMode === "grid" && (assets.length > 0 || loading) && (
                    <div className=" max-h-[65vh] overflow-auto  rounded-md custom-scrollbar" style={{ marginRight: '8rem' }} onScroll={handleScroll}>
                        <div className="mt-4 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loading && assets.length === 0 ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="border border-slate-200 rounded-2xl p-5 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="w-10 h-10 rounded-full" />
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            <Skeleton className="h-3 w-full" />
                                            <Skeleton className="h-3 w-full" />
                                            <Skeleton className="h-3 w-3/4" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                assets.map((item: any) => (
                                    <AssetCard
                                        key={item._id}
                                        data={item}
                                        onEdit={handleEdit}
                                        onHistory={handleViewHistory}
                                        onDelete={handleDelete}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
                {viewMode === "table" && (assets.length > 0 || loading) && (
                    <div>
                        <div className="grid " style={{ marginRight: '8rem' }}>
                            <div className="max-h-[65vh] overflow-auto border rounded-md custom-scrollbar" onScroll={handleScroll}>
                                {loading && assets.length === 0 ? (
                                    <div className="p-4 space-y-4">
                                        <div className="grid grid-cols-[40px_150px_repeat(22,150px)_50px] gap-2">
                                            {Array.from({ length: 25 }).map((_, i) => (
                                                <Skeleton key={i} className="h-8 w-full" />
                                            ))}
                                        </div>
                                        {Array.from({ length: 10 }).map((_, i) => (
                                            <div key={i} className="grid grid-cols-[40px_150px_repeat(22,150px)_50px] gap-2 border-b pb-2">
                                                <Skeleton className="h-10 w-full" />
                                                <Skeleton className="h-10 w-full" />
                                                {Array.from({ length: 22 }).map((_, j) => (
                                                    <Skeleton key={j} className="h-10 w-full" />
                                                ))}
                                                <Skeleton className="h-10 w-full" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <AssetHistoryModalList
                                        data={assets}
                                        onEdit={handleEdit}
                                        onHistory={handleViewHistory}
                                        onDelete={handleDelete}
                                    />
                                )}
                                {loading && <p className="text-center py-2">Loading...</p>}
                            </div>
                        </div>
                    </div>
                )}

                <Sheet open={isSheetOpen} onOpenChange={handleSheetClose}>
                    <SheetContent side="right" className="sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
                        <SheetHeader style={{ borderBottom: '1px solid #ede7e7' }}>
                            <SheetTitle>
                                {isEditing ? 'Edit' : "Create"} Employee Asset
                            </SheetTitle>
                        </SheetHeader>

                        <div className="" style={{ margin: '1rem' }}>
                            <div style={{ maxHeight: "calc(100vh - 20vh )", overflowY: "auto" }}>
                                <form id="assets-form" onSubmit={handleSubmit} className="space-y-6">
                                    {/* EMPLOYEE SECTION */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Employee Email</label>
                                            <Select
                                                options={employeeList}
                                                value={employeeList.find((op) => op.label === formData.employeeName) || null}
                                                onChange={(selected: any) =>
                                                    handleEmployeeChange(selected)
                                                }
                                                isSearchable={true}
                                                isClearable={true}
                                                placeholder="Select Employee"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Employee Id</label>
                                            <input
                                                type="text"
                                                value={formData.employeeId}
                                                readOnly
                                                className="w-full border bg-gray-100 rounded px-3 py-2"
                                            />
                                        </div>
                                    </div>

                                    {/* MODEL SECTION */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                        {[
                                            { label: "Computer Name", name: "computerName" },
                                            { label: "RAM", name: "ram" },
                                            { label: "Device ID", name: "deviceId" },
                                            { label: "Graphics Card", name: "graphicsCard" },
                                            { label: "Processor", name: "processor" },
                                        ].map((f) => (
                                            <div key={f.name}>
                                                <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>{f.label}</label>
                                                <input
                                                    name={f.name}
                                                    value={(formData as any)[f.name]}
                                                    onChange={handleChange}
                                                    disabled={false}
                                                    className="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {/* OS SECTION */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>OS</label>
                                            <input
                                                name="os"
                                                value={formData.os}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>OS Version</label>
                                            <input
                                                name="osVersion"
                                                value={formData.osVersion}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                    </div>

                                    {/* STORAGE SECTION */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                        <div className="md:col-span-2">
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>
                                                Storage Drives (Multiline)
                                            </label>
                                            <textarea
                                                name="storageDrives"
                                                value={formData.storageDrives}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2 h-24"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>SSD (Yes / No)</label>
                                            <select
                                                name="ssd"
                                                value={formData.ssd}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            >
                                                <option value="">Select</option>
                                                <option>YES</option>
                                                <option>NO</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>SSD Storage</label>
                                            <input
                                                name="ssdStorage"
                                                value={formData.ssdStorage}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                    </div>

                                    {/* OTHER FIELDS */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>From (Date)</label>
                                            <input
                                                type="date"
                                                name="fromDate"
                                                value={formData.fromDate}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Remarks</label>
                                            <textarea
                                                name="remarks"
                                                value={formData.remarks}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2 h-24"
                                            />
                                        </div>
                                    </div>

                                    {/* LOGIN DETAILS */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 border-b gap-4">
                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Computer Username</label>
                                            <input
                                                name="computerUsername"
                                                value={formData.computerUsername}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Computer Password</label>
                                            <input
                                                type="password"
                                                name="computerPassword"
                                                value={formData.computerPassword}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>Bit Locker Key :</label>
                                            <textarea
                                                name="lockerKey"
                                                value={formData.lockerKey}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2 h-24"
                                            />
                                        </div>



                                    </div>

                                    <div className="grid grid-cols-1  gap-4">
                                        <div className="flex flex-wrap md:flex-nowrap items-center gap-6 mt-2">
                                            {/* SIM */}
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    name="sim"
                                                    checked={formData.sim}
                                                    onChange={handleChange}
                                                    className="w-4 h-4"
                                                />
                                                <span>SIM</span>
                                            </label>

                                            {/* Mouse */}
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    name="mouse"
                                                    checked={formData.mouse}
                                                    onChange={handleChange}
                                                    className="w-4 h-4"
                                                />
                                                <span>Mouse</span>
                                            </label>

                                            {/* Bag */}
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    name="bag"
                                                    checked={formData.bag}
                                                    onChange={handleChange}
                                                    className="w-4 h-4"
                                                />
                                                <span>Bag</span>
                                            </label>
                                        </div>

                                        {formData.sim && (<div>
                                            <label className="block font-medium mb-1" style={{ color: 'gray', fontSize: 'small', marginBottom: '9px', marginLeft: '3px' }}>sim Number</label>
                                            <input
                                                type="number"
                                                name="simNumber"
                                                value={formData.simNumber}
                                                onChange={handleChange}
                                                disabled={false}
                                                className="w-full border rounded px-3 py-2"
                                            />
                                        </div>)}
                                    </div>
                                </form>
                            </div>
                            <Button
                                form="assets-form"
                                className="!bg-black hover:!bg-sky-600 !text-white shadow-md"
                                style={{ right: 25, bottom: 2, position: 'fixed', background: 'blue' }}
                                disabled={loading}
                            >
                                {isEditing ? 'Save' : "Create"}
                            </Button>
                        </div>
                    </SheetContent>
                </Sheet>
                <AssetHistoryModal
                    open={historyOpen}
                    onClose={closeHistory}
                    history={historyData}
                />
            </div>
        </>
    );
}
