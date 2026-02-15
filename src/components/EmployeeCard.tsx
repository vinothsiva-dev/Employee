import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Mail,
  Phone,
  Calendar,
  IndianRupee,
  Edit,
  Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const statusColors = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-yellow-100 text-yellow-800 border-yellow-200",
  terminated: "bg-red-100 text-red-800 border-red-200",
};

export default function EmployeeCard({ employee, onEdit, canEdit }: any) {
  const fullName = `${employee.first_name} ${employee.last_name}`;
  const isLongName = fullName.length > 15;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white w-60 lg:w-72">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-4 border-white shadow-lg">
                <AvatarImage src={employee.profile_imageFile || employee.profile_image} />
                <AvatarFallback className="bg-gradient-to-br from-slate-600  to-slate-700 text-white font-bold text-lg">
                  {employee.first_name?.[0]}
                  {employee.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isLongName ? (
                    <TooltipProvider >
                      <Tooltip >
                        <TooltipTrigger className="!border-none !bg-white !w-full h-[9px] !p-0">
                          {fullName.substring(0, 6)}...
                        </TooltipTrigger>
                        <TooltipContent className="!border-none">
                          <p>{fullName}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    fullName
                  )}
                </h3>
                <p className="text-sm font-medium text-slate-600">
                  {employee.position}
                </p>
                <Badge
                  className={`text-xs mt-1 ${statusColors[
                    `${employee.status
                      ? (employee.status as keyof typeof statusColors)
                      : "active"
                    }`
                    ]
                    }`}
                >
                  {employee.status}
                </Badge>
              </div>
            </div>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(employee)}
                className="hover:bg-slate-100"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Building2 className="w-4 h-4" />
            <span>{employee.department}</span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Mail className="w-4 h-4" />
            <span className="truncate">{employee.email}</span>
          </div>

          {employee.phone && (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Phone className="w-4 h-4" />
              <span>{employee.phone}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span>
              Joined {format(new Date(employee.hire_date), "MMM yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <IndianRupee className="w-4 h-4" />
            <span className="font-medium">
              {/* &#8377; */}
              {employee.hourly_rate}/hr
            </span>
          </div>

          <div className="pt-2 text-xs text-slate-500">
            ID: {employee.employee_id}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
