import React, { useMemo, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserTable from "./UserTable";
import EmployeeTable from "@/components/attendance/EmployeeTable";
import { useSidebar } from "@/components/ui/sidebar";

// -------- Styles --------
const kpiCard = {
  base: "rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow p-4",
  title: "text-sm font-medium text-slate-500",
  value: "text-2xl font-semibold text-slate-900",
  sub: "text-xs text-slate-500",
} as const;

const pageSize = 10;

// -------- Motion Variants --------
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const softHover = {
  hover: { y: -4, transition: { type: "spring", stiffness: 300, damping: 16 } },
  tap: { scale: 0.98 },
};

const slideTabs = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const Attendance: React.FC = () => {
  const { user, attendanceRefresh, setAttendanceRefresh } = useAuth();

  const [monthlyPresents, setMonthlyPresents] = useState<number>(0);
  const [monthlyAbsents, setMonthlyAbsents] = useState<number>(0);
  const [currentViewPresent, setcurrentViewPresent] = useState<number>(0);
  const [CurrentViewAbsent, setCurrentViewAbsent] = useState<number>(0);

  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<string>(
    isAdmin ? "user" : "only-user"
  );
  const { state } = useSidebar();
  // Tab wiring to keep AnimatePresence in sync with shadcn Tabs value
  const tabsValue = isAdmin ? activeTab : "only-user";

  const cards = useMemo(
    () => [
      {
        key: "present-month",
        title: "This Month • Present",
        value: monthlyPresents,
        sub: "Auto-calculated for the current month",
      },
      {
        key: "absent-month",
        title: "This Month • Absent",
        value: monthlyAbsents,
        sub: "Auto-calculated for the current month",
      },
      {
        key: "present-view",
        title: "Current View • Present",
        value: currentViewPresent,
        sub: "Based on filters below",
      },
      {
        key: "absent-view",
        title: "Current View • Absent",
        value: CurrentViewAbsent,
        sub: "Based on filters below",
      },
    ],
    [monthlyPresents, monthlyAbsents, currentViewPresent, CurrentViewAbsent]
  );

  return (
    <motion.div
      className={`w-full ${state == "expanded" ? "lg:w-[90%]" : "w-full"
        } px-6 pb-16`}
      variants={containerStagger}
      initial="hidden"
      animate="show"
    >
      {/* Page header */}
      <motion.div className="mb-6" variants={fadeInUp as any}>
        <p className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
          Attendance
        </p>
        <p className="mt-1 text-slate-600">
          Keep a clean view of time and presence—filter, sort, and review at a
          glance.
        </p>
      </motion.div>

      {/* KPI row */}
      <motion.div
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={containerStagger}
      >
        {cards.map((c) => (
          <motion.div
            key={c.key}
            variants={fadeInUp as any}
            whileHover={softHover.hover as any}
            whileTap={softHover.tap}
            className={kpiCard.base}
            aria-live="polite"
          >
            <div className={kpiCard.title}>{c.title}</div>
            <div className={kpiCard.value}>{c.value}</div>
            <div className={kpiCard.sub}>{c.sub}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs + Content */}
      <LayoutGroup>
        {isAdmin ? (
          <motion.div variants={fadeInUp as any}>
            <Tabs value={tabsValue} onValueChange={setActiveTab} className="">
              <TabsList className="!border-none w-full ">
                <TabsTrigger value="user" className="tab-trigger">
                  User
                </TabsTrigger>
                <TabsTrigger value="employees" className="tab-trigger">
                  Employees
                </TabsTrigger>
              </TabsList>

              {/* Animated Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === "user" && (
                  <motion.div
                    key="tab-user"
                    variants={slideTabs}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <TabsContent value="user" asChild>
                      <motion.div layout>
                        <UserTable
                          pageSize={pageSize}
                          user={user}
                          attendanceRefresh={attendanceRefresh}
                          setMonthlyAbsents={setMonthlyAbsents}
                          setMonthlyPresents={setMonthlyPresents}
                          setcurrentViewPresent={setcurrentViewPresent}
                          setCurrentViewAbsent={setCurrentViewAbsent}
                        />
                      </motion.div>
                    </TabsContent>
                  </motion.div>
                )}

                {activeTab === "employees" && (
                  <motion.div
                    key="tab-employees"
                    variants={slideTabs}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <TabsContent value="employees" asChild>
                      <motion.div layout>
                        <EmployeeTable
                          setMonthlyAbsents={setMonthlyAbsents}
                          setMonthlyPresents={setMonthlyPresents}
                          setcurrentViewPresent={setcurrentViewPresent}
                          setCurrentViewAbsent={setCurrentViewAbsent}
                        />
                      </motion.div>
                    </TabsContent>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* <style>{`
                .tab-trigger { transition: background-color .25s ease, color .25s ease, transform .2s ease; }
                .tab-trigger[data-state="active"] { background-color: #33cdf3ff; color: white; }
                .tab-trigger:hover { transform: translateY(-2px); }
              `}</style> */}
              <style>{`
                .tab-trigger { transition: background-color .25s ease, color .25s ease, transform .2s ease; }
                .tab-trigger[data-state="active"] { background-color: #111; color: white; }
                .tab-trigger:hover { transform: translateY(-2px); }
              `}</style>
            </Tabs>
          </motion.div>
        ) : (
          // Non-admin: only the User table, but still animated
          <AnimatePresence mode="wait">
            <motion.div
              key="only-user"
              variants={slideTabs}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <UserTable
                pageSize={pageSize}
                user={user}
                attendanceRefresh={attendanceRefresh}
                setMonthlyAbsents={setMonthlyAbsents}
                setMonthlyPresents={setMonthlyPresents}
                setcurrentViewPresent={setcurrentViewPresent}
                setCurrentViewAbsent={setCurrentViewAbsent}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </LayoutGroup>
    </motion.div>
  );
};

export default Attendance;
