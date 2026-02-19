import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideProps, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface StatsCardProps {
  title: string;
  value: string | number;
  change: string;
  isLoading: boolean;
  to?: string;
}

export default function StatsCards({
  title,
  value,
  change,
  isLoading,
  to,
}: StatsCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="shadow-lg !w-full bg-gradient-to-br from-slate-900 to-slate-700 border-none rounded-xl min-h-[160px] flex items-center justify-center">
        <CardContent className="p-6 w-full">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24 bg-white/10" />
            <Skeleton className="h-10 w-16 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/10" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleClick = () => {
    navigate(`/${to}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full"
    >
      <Card
        className={`relative overflow-hidden group rounded-xl border-none shadow-2xl transition-all duration-300 w-full h-full min-h-[160px] flex flex-col justify-between bg-gradient-to-br from-slate-900 to-slate-700 ${to && "cursor-pointer"
          }`}
        onClick={() => {
          if (to) {
            handleClick();
          }
        }}
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors duration-500" />

        <CardContent className="relative p-6 flex flex-col h-full justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-2 tracking-wide uppercase">
              {title}
            </p>
            <h3 className="text-4xl font-extrabold text-white tracking-tight">
              {value}
            </h3>
          </div>

          <div className="mt-4">
            {change ? (
              <div className="flex items-center text-sm">
                <div className="flex items-center px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  <span>{change}</span>
                </div>
                <span className="text-slate-500 ml-2.5">vs last month</span>
              </div>
            ) : (
              <div className="h-7" /> /* Spacer to maintain height if no change text */
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

