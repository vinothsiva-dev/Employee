// src/layout/SidebarComp.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Clock,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Logs,
  Info,
  BookUser
} from "lucide-react";
import { NotificationPrompt } from "./notification/NotificationPrompt";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  // SidebarRail, // keep off if you don't want the vertical handle
  useSidebar, // ⬅️ new
} from "@/components/ui/sidebar";
import {
  LogoutWorklogDialog,
  type LogoutWorklogPayload,
} from "./LogoutWorklogDialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/axios";
import { useToast } from "@/toast/ToastProvider";
import { ensurePushSubscription } from "@/push/ensurePushSubscription";

/* ----------------------------- Helpers ----------------------------- */

const parseWorkedTime = (s: string) => {
  const parts = s.split(" ");
  let total = 0;
  for (let i = 0; i < parts.length; i += 2) {
    const v = parseInt(parts[i]);
    const u = parts[i + 1] || "";
    if (Number.isFinite(v)) {
      if (u.startsWith("hr")) total += v * 3600;
      else if (u.startsWith("min")) total += v * 60;
      else if (u.startsWith("sec")) total += v;
    }
  }
  return total;
};

const pad = (n: number) => n.toString().padStart(2, "0");
const formatTime = (sec: number) =>
  `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(
    sec % 60
  )}`;

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  roles?: Array<string>;
};

const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    url: "/Dashboard",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  { title: "Employees", url: "/Employees", icon: Users, roles: ["admin"] },
  { title: "Attendance", url: "/Attendance", icon: Clock },
  { title: "Projects", url: "/Projects", icon: FolderOpen },
  { title: "Notes", url: "/AddNotes", icon: NotebookPen },
  { title: "WorkLog", url: "/Worklog", icon: Logs },
  { title: "AMC INFO", url: "/AmcInfo", icon: Info },
  { title: "Asset  Details", url: "/EmployeeAssetsForm", icon: Info },
  { title: "Leave Management", url: "/LeaveManagement", icon: BookUser },
];

/* --------------------------- Component ----------------------------- */
interface BirthdayItem {
  _id: string;
  profile_imageFile: string;
  first_name: string;
  last_name: string;
}

export default function SidebarComp({
  children,
}: {
  children?: React.ReactNode;
}) {


  const { logout, setUser, user, setAttendanceRefresh, attendanceRefresh } =
    useAuth();
  const location = useLocation();
  const toast = useToast();
  // ⬇️ read collapse state from shadcn provider
  const { state } = useSidebar();
  const isCollapsed = state;
  const [isLoading] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [openWorklog, setOpenWorklog] = useState(false);
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false);
  const [birthdayData, setBirthdayData] = useState<BirthdayItem[]>([]);
  const [loginLoading, setHandleLogin] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isHover, setIsHover] = useState(false);

  // ---------------------------------------
  // ⭐ AUTO CHANGE EVERY 5 SECONDS
  // ---------------------------------------
  useEffect(() => {
    if (isHover) return; // stop rotation on hover

    const interval = setInterval(() => {
      setVisibleIndex((prev) =>
        birthdayData.length === 0 ? 0 : (prev + 1) % birthdayData.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [birthdayData, isHover]);



  useEffect(() => {
    if (!user?.userId) return;

    const supported = "serviceWorker" in navigator && "PushManager" in window;
    const permission =
      typeof Notification !== "undefined" ? Notification.permission : "default";

    // Snooze logic optional
    const snoozeUntil = Number(localStorage.getItem("pushSnoozeUntil") || 0);
    const snoozed = Date.now() < snoozeUntil;

    if (supported && !user?.hasPush && permission !== "denied" && !snoozed) {
      setShowNotifPrompt(true);
    }
  }, [user?.userId, user?.hasPush]);

  const onEnableNotifications = async () => {
    try {
      const id = toast.info("Enabling browser notifications…", {
        durationMs: 0,
      });
      const res = await ensurePushSubscription(user!.employee_id, {
        testPush: true,
      });
      toast.remove(id);

      if (res.ok) {
        setUser({ ...user!, hasPush: true });
        setShowNotifPrompt(false);
        toast.success(
          "Notifications enabled. You’ll now get real-time updates."
        );
      } else if (res.reason === "denied") {
        setShowNotifPrompt(false);
        toast.error(
          "Permission denied. Enable notifications from your browser settings."
        );
      } else {
        toast.error("Notifications aren’t supported in this browser.");
      }
    } catch (e) {
      console.error("Enable notifications failed:", e);
      toast.error("We couldn’t enable notifications. Please try again.");
    }
  };
  const onDismissNotifications = () => {
    // Optional: snooze 24h to avoid spamming users
    localStorage.setItem(
      "pushSnoozeUntil",
      String(Date.now() + 24 * 60 * 60 * 1000)
    );
    setShowNotifPrompt(false);
  };

  // Restore from localStorage on mount
  useEffect(() => {
    getBirthDays(false);
    const storedClockedIn = localStorage.getItem("isClockedIn");
    const storedClockInTime = localStorage.getItem("clockInTime");
    if (storedClockedIn === "true" && storedClockInTime) {
      const elapsed = Math.floor(
        (Date.now() - new Date(storedClockInTime).getTime()) / 1000
      );
      setIsClockedIn(true);
      setElapsedTime(elapsed);
    }
  }, []);


  const getElapsedMinutes = (elapsedTime: string) => {
    if (!elapsedTime) return 0;
    const mins = parseInt(elapsedTime); // "9 mins" -> 9
    return isNaN(mins) ? 0 : mins;
  };

  const openBirthDay = async (data: any, value: any) => {
    setBirthdayData(data);
    let working = localStorage.getItem("totalWorked") || '';
    const minutes = getElapsedMinutes(working);
    if (minutes > 1) {
      console.log("Popup blocked: already working more than 1 minute");
      return;
    }
    if (!value) {
      console.log("auto Call");
      return;
    }
    setShowBirthdayPopup(true);

  };
  const ConfettiAnimation = () => {
    const confettiPieces = new Array(40).fill(0);
    const colors = ["#ff6b6b", "#ffbe0b", "#8ac926", "#1982c4", "#6a4c93"];

    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-50">
        {confettiPieces.map((_, i) => {
          const size = Math.random() * 10 + 6; // random size
          const left = Math.random() * 100; // random horizontal start %
          const rotateDir = Math.random() > 0.5 ? 360 : -360;

          return (
            <motion.div
              key={i}
              initial={{
                y: -20,
                x: `${left}vw`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: ["-20px", "110vh"],
                rotate: rotateDir,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2.8 + Math.random() * 1.5,
                repeat: Infinity,
                delay: Math.random(),
                ease: "easeOut",
              }}
              style={{
                width: size,
                height: size * 0.6,
                backgroundColor: colors[i % colors.length],
                borderRadius: 2,
                position: "absolute",
              }}
            />
          );
        })}
      </div>
    );
  };

  const getBirthDays = async (value: any) => {
    try {
      const response = await api.get("/api/employee/getTodaysBirthdays");
      if (response) {
        if (response?.data?.length) {

          openBirthDay(response.data, value)
        }
      }

    } catch (error: any) {
      if (error?.status === 400) alert("data of the birthdays");
      console.error("Clock-in error:", error?.response?.data || error);
    }
  };
  // Confirm status with backend per user/day
  useEffect(() => {
    const checkClockInStatus = async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const res = await api.get("/api/attendance/getUserAttendanceByDate", {
          params: { employeeId: user?.employee_id, date: today },
        });
        const rec = res.data?.data;

        if (rec && rec.isActive) {
          if (rec?.totalWorkedTime) {
            const elapsed = Math.floor(parseWorkedTime(rec.totalWorkedTime));
            localStorage.setItem("totalWorked", rec.totalWorkedTime);
            localStorage.setItem("isClockedIn", "true");
            localStorage.setItem(
              "clockInTime",
              new Date(rec.clockIn).toISOString()
            );
            localStorage.setItem("clockedInDate", today);
            localStorage.setItem("attendanceId", rec._id);
            setIsClockedIn(true);
            setElapsedTime(elapsed);
          } else {
            const clockInTime = new Date(rec.clockIn).toISOString();
            const elapsed = Math.floor(
              (Date.now() - new Date(clockInTime).getTime()) / 1000
            );
            localStorage.setItem("isClockedIn", "true");
            localStorage.setItem("clockInTime", clockInTime);
            localStorage.setItem("clockedInDate", today);
            localStorage.setItem("attendanceId", rec._id);
            setIsClockedIn(true);
            setElapsedTime(elapsed);
          }
        } else {
          [
            "isClockedIn",
            "clockInTime",
            "clockedInDate",
            "attendanceId",
            "totalWorked",
          ].forEach((k) => localStorage.removeItem(k));
          setIsClockedIn(false);
          setElapsedTime(0);
        }
      } catch (e) {
        console.error("checkClockInStatus failed:", e);
      }
    };
    if (user?.employee_id) checkClockInStatus();
  }, [user?.employee_id]);

  // ticking timer while clocked in
  useEffect(() => {
    if (!isClockedIn) return;
    const id = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isClockedIn]);

  const handleClockIn = async () => {
    setHandleLogin(true)
    try {
      const payload = {
        employeeId: user?.employee_id,
        date: new Date().toISOString().split("T")[0],
        status: "Present",
        clockIn: new Date().toISOString(),
        clockOut: null,
        reason: "",
        createdBy: user?.userId,
      };
      const res = await api.post("/api/attendance/createAttendance", payload);
      const data = res?.data?.data;
      const clockInISO = new Date(data.clockIn).toISOString();
      const elapsed = data?.totalWorkedTime
        ? Math.floor(parseWorkedTime(data.totalWorkedTime))
        : Math.floor((Date.now() - new Date(clockInISO).getTime()) / 1000);

      localStorage.setItem("isClockedIn", "true");
      localStorage.setItem("clockInTime", clockInISO);
      localStorage.setItem("attendanceId", data._id);
      if (data?.totalWorkedTime)
        localStorage.setItem("totalWorked", data.totalWorkedTime);

      setAttendanceRefresh(!attendanceRefresh);
      setIsClockedIn(true);
      setElapsedTime(elapsed);
      await api.post("/api/push/clockin", {
        userId: user?.employee_id, // Mongo _id of the actor
        title: "Clocked In",
        url: "/Attendance", // optional deep link
      });
      getBirthDays(true);
    } catch (error: any) {
      if (error?.status === 409) alert("You have already clocked in today.");
      console.error("Clock-in error:", error?.response?.data || error);
    }
    setHandleLogin(false)
  };

  function generateAvatar(name: string, size = 64) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Background color
    ctx.fillStyle = "#10B981"; // emerald
    ctx.fillRect(0, 0, size, size);

    // Make it circular
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Text (initials)
    const initials = name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0].toUpperCase())
      .join("")
      .slice(0, 2); // take max 2 letters

    ctx.fillStyle = "white";
    ctx.font = `${size * 0.45}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, size / 2, size / 2);

    return canvas.toDataURL("image/png");
  };

  const handleClockOut = async (isLoggedOut = false) => {
    const attendanceId = localStorage.getItem("attendanceId");
    if (!attendanceId)
      return console.error("No attendance record to clock out.");
    try {
      await api.put(
        `/api/attendance/editAttendance/${attendanceId}?userId=${user?.userId}${isLoggedOut ? "&LoggedOut=true" : ""
        }`,
        { clockOut: new Date().toISOString() }
      );
      [
        "isClockedIn",
        "clockInTime",
        "attendanceId",
        "clockedInDate",
        "totalWorked",
      ].forEach((k) => localStorage.removeItem(k));
      setAttendanceRefresh(!attendanceRefresh);
      setIsClockedIn(false);
      setElapsedTime(0);
      await api.post("/api/push/clockin", {
        userId: user?.employee_id, // Mongo _id of the actor
        title: `${isLoggedOut ? "Logged Out" : "Breaked Out"}`,
        url: "/Attendance", // optional deep link
      });
    } catch (e) {
      console.error("Clock-out error:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }
  const handleSubmitWorklogAndLogout = async (
    payload: LogoutWorklogPayload
  ) => {
    // 1) Persist worklog (adjust endpoint/shape as per your backend)
    const today = new Date().toISOString().split("T")[0];
    try {
      await api.post("/api/worklog/submitDaily", {
        employeeId: user?.employee_id,
        date: today,
        tasks: payload.tasks,
        // optional: enrich with attendanceId if you want referential integrity
        attendanceId: localStorage.getItem("attendanceId") || undefined,
        submittedBy: user?.userId,
      });
    } catch (e) {
      console.error("Worklog submit failed:", e);
      throw e; // bubble to dialog for toast
    }

    // 2) Clock out (and flag as LoggedOut=true for push/title semantics)
    await handleClockOut(true);

    // 3) Perform your auth logout
    logout();
  };
  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r bg-white"
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <SidebarHeader className="border-b px-3 py-3">
          <div
            className={`flex items-center gap-3 truncate ${isCollapsed == "collapsed" ? "justify-center" : ""
              }`}
          >
            {/* ✅ fixed square icon that never stretches */}
            <div className="h-8 w-8 aspect-square shrink-0 rounded-md bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center">
              <Users className="h-4 w-4 text-white" />
            </div>
            {/* Hide brand text when collapsed */}
            {isCollapsed == "expanded" && (
              <div className="min-w-0">
                <div className="truncate font-semibold">EZOFIS</div>
                <div className="truncate text-xs text-muted-foreground">
                  Employee Management
                </div>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          {/* Primary nav */}
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.filter(
                  (n) => !n.roles || n.roles.includes(String(user?.role))
                ).map((item, index) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      className={`rounded-xl transition-all duration-200 ${location.pathname === item.url ||
                        (location.pathname === "/" && index === 0)
                        ? "!bg-black !text-white shadow-lg"
                        : "hover:!bg-slate-100 !text-black hover:!text-black"
                        } `}
                    >
                      <NavLink
                        to={item.url}
                        aria-current={
                          location.pathname === item.url ? "page" : undefined
                        }
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-4 w-4" aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          {/* Quick Actions — hidden when collapsed */}
          {isCollapsed == "expanded" && (
            <SidebarGroup>
              <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
              <SidebarGroupContent>
                {isClockedIn ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <div className="cursor-pointer rounded-lg bg-red-50 p-3">
                        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-red-700">
                          <Clock className="h-4 w-4" />
                          <span>Clocked In</span>
                        </div>
                        <p className="text-sm font-semibold text-red-900">
                          {formatTime(elapsedTime)}
                        </p>
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clock out now?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your session will end and the total worked time will
                          be recorded.
                          <br />
                          Elapsed: <strong>{formatTime(elapsedTime)}</strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleClockOut(false)}
                          className="!bg-sky-600 !text-white hover:!bg-sky-700"
                        >
                          Break Out
                        </AlertDialogAction>
                        <AlertDialogAction
                          onClick={() => setOpenWorklog(true)}
                          className="!bg-red-600 !text-white hover:!bg-red-700"
                        >
                          Logout
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild style={{
                      userSelect: loginLoading ? "none" : "auto",
                      pointerEvents: loginLoading ? "none" : "auto",
                      opacity: loginLoading ? 0.5 : 1,
                    }}
                    >
                      <div className="cursor-pointer rounded-lg bg-emerald-50 p-3">
                        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
                          <Clock className="h-4 w-4" />
                          <span >Quick Clock In</span>
                        </div>
                        <p className="text-xs text-emerald-800">
                          Track your time instantly
                        </p>
                      </div>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm clock in?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel  >Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClockIn}
                          className="!bg-sky-600 !text-white hover:!bg-sky-700"
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {birthdayData?.length > 0 && (
                  <div
                    ref={scrollRef}
                    onMouseEnter={() => setIsHover(true)}
                    onMouseLeave={() => setIsHover(false)}
                    className={`
    grid mt-2 max-h-[calc(100vh-600px)] overflow-auto [scrollbar-width:none] 
    [-ms-overflow-style:none]
  `}
                    style={{
                      background: "#dbd3d3",
                      padding: "5px",
                      borderRadius: "1rem",
                    }}
                  >
                    <div className="text-md mt-2 mb-2 ml-1 font-bold">
                      🎉 Today’s Birthdays 🎉
                    </div>

                    {/* 🔥 If NOT hovering → show only ONE item */}
                    {birthdayData.length > 0 && birthdayData[visibleIndex] && !isHover && (
                      <motion.div
                        key={birthdayData[visibleIndex]._id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white shadow-lg rounded-xl p-2 flex items-center gap-3 border mt-1"
                      >
                        <img
                          src={birthdayData[visibleIndex].profile_imageFile || generateAvatar(
                            `${birthdayData[visibleIndex].first_name} ${birthdayData[visibleIndex].last_name}`,
                            64
                          )}
                          className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500"
                        />

                        <h3 className="text-sm font-bold truncate w-full text-left">
                          {birthdayData[visibleIndex].first_name}
                          {" "}
                          {birthdayData[visibleIndex].last_name}
                        </h3>
                        <br />
                      </motion.div>

                    )}


                    {/* 🔥 On Hover → Show full list and allow scrolling */}
                    {isHover && (
                      <div className="">
                        {birthdayData.map((emp: any) => (
                          <motion.div
                            key={emp._id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white shadow-lg rounded-xl p-2 flex items-center gap-3 border mt-1"
                          >
                            <img
                              src={emp.profile_imageFile || generateAvatar(
                                `${emp.first_name} ${emp.last_name}`,
                                64
                              )}
                              className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500"
                            />

                            <h3 className="text-sm font-bold truncate w-full text-left">
                              {emp.first_name} {emp.last_name}
                            </h3>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    <br />
                  </div>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* Footer — show only logout icon when collapsed */}
        <SidebarFooter className="border-t px-3 py-3">
          {isCollapsed == "collapsed" ? (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Logout"
                className="text-muted-foreground hover:bg-slate-100"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="!bg-slate-100 !text-slate-800 !font-semibold">
                    {user?.name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("") || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user?.name || "User"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email || "email"}
                  </p>
                  <p className="text-xs font-medium text-emerald-600 capitalize">
                    {user?.role || "role"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="text-muted-foreground hover:bg-slate-100"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />

              </Button>
            </div>
          )}
        </SidebarFooter>

        {/* If you want the draggable rail, re-enable:
      <SidebarRail /> */}
      </Sidebar>
      <NotificationPrompt
        open={showNotifPrompt}
        onEnable={onEnableNotifications}
        onDismiss={onDismissNotifications}
      />

      {showBirthdayPopup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowBirthdayPopup(false)}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"

        >
          {/* FLOWER ANIMATION */}


          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] relative"
          >
            <Card className="border-0 shadow-2xl p-6">
              <ConfettiAnimation />
              <CardHeader className="flex flex-row items-center justify-between pb-4" style={{ borderBottom: '1px solid #c6c6c6' }}>
                <CardTitle className="text-2xl font-bold"> 🎉 Today’s Birthdays 🎉</CardTitle>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBirthdayPopup(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </CardHeader>
              <br />

              <CardContent>
                <div className={`
    grid gap-6
    ${birthdayData?.length === 1
                    ? "grid-cols-1 justify-items-center"
                    : birthdayData?.length === 2
                      ? "grid-cols-1 sm:grid-cols-2 justify-items-center"
                      : "grid-cols-1 md:grid-cols-3"
                  }
  `} >
                  {birthdayData?.map((emp: any) => (
                    <motion.div
                      key={emp._id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="bg-white shadow-lg rounded-xl p-5 flex flex-col items-center text-center border"
                      style={{ minWidth: "210px" }}
                    >
                      {/* Profile Image */}
                      <img
                        src={emp.profile_imageFile || generateAvatar(
                          `${emp.first_name} ${emp.last_name}`,
                          64
                        )}
                        className="w-24 h-24 rounded-full object-cover border-2 border-emerald-500"
                      />

                      {/* Name */}
                      <h3 className="mt-3 text-lg font-bold">
                        {emp.first_name} {emp.last_name}
                      </h3>

                      {/* Role */}
                      <p className="text-sm text-gray-500">{emp.position}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
              <br />
            </Card>
          </motion.div>
        </motion.div>
      )}

      <LogoutWorklogDialog
        open={openWorklog}
        onOpenChange={setOpenWorklog}
        onConfirm={handleSubmitWorklogAndLogout}
      />
    </>
  );
}
