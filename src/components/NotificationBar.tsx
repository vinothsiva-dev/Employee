import * as React from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface Notification {
    _id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

const NotificationBar: React.FC = () => {
    const { user } = useAuth();
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = React.useState(0);

    const fetchNotifications = React.useCallback(async () => {
        if (!user?.employee_id) return;
        try {
            const res = await api.get(`/api/notifications?recipientId=${user.employee_id}`);
            // Filter for leave type as requested: "only related to leave"
            const leaveNotifications = res.data.filter((n: Notification) => n.type === 'leave');
            setNotifications(leaveNotifications);
            setUnreadCount(leaveNotifications.filter((n: Notification) => !n.isRead).length);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    }, [user?.employee_id]);

    React.useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 600000); // Poll every 10 minutes
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAllAsRead = async () => {
        if (!user?.employee_id) return;
        try {
            await api.post("/api/notifications/mark-all-read", { recipientId: user.employee_id });
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await api.patch(`/api/notifications/${id}/read`);
            fetchNotifications();
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-2">
                    <h4 className="text-sm font-semibold">Notifications</h4>
                    {unreadCount > 0 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={markAllAsRead}
                                    >
                                        <CheckCheck className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Mark all as read</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <ScrollArea className="h-80">
                    {notifications.length === 0 ? (
                        <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                            No leave notifications
                        </div>
                    ) : (
                        <div className="grid">
                            {notifications.map((n) => (
                                <div
                                    key={n._id}
                                    className={`flex flex-col gap-1 border-b px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${!n.isRead ? "bg-muted/20" : ""
                                        }`}
                                    onClick={() => !n.isRead && markAsRead(n._id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium text-foreground">{n.title}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {n.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                    }
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
};

export default NotificationBar;
