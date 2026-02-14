import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, UserCheck, UserX } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceOverview({ isLoading, data }: any) {
  const attendanceData = [
    {
      label: "Present",
      value: data?.todayPresent ? data?.todayPresent : 0,
      color: "bg-emerald-500", // Updated to emerald for a richer color as per design guidelines
      icon: UserCheck,
    },
  ];

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg rounded-3xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-slate-900 text-sm font-bold">
            <Clock className="w-6 h-6" />
            Today's Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between ">
            <div className="space-y-2 h-[30px]">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
          <Skeleton className="h-4 w-20 mt-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-slate-800 text-sm font-bold">
          <Clock className="w-6 h-6 text-slate-700" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {attendanceData.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between pt-2"
            >
              <div className="flex flex-col">
                <p className="text-lg font-medium text-slate-500 mb-1">
                  {item.label}
                </p>
                <p className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {item.value}
                </p>
              </div>
              <div
                className={`w-10 h-10 ${item.color} rounded-full flex items-center justify-center shadow-inner`}
              >
                <item.icon className="w-5 h-5 text-white" />
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
