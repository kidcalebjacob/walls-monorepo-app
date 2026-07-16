"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Portal } from "@radix-ui/react-portal";
import { X, CheckCheck, Info, AlertCircle, PartyPopper } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { getSupabaseClient, useAuth } from "@walls/auth";

import {
  SCOUTER_INDEX_URL,
  SCOUTER_NOTIFICATION_TYPE,
} from "../lib/user-notifications";

const EMAIL_NOTIFICATION_ICON =
  "https://assets.wallsentertainment.com/walls-app-icons/email.svg";

const PROJECTS_NOTIFICATION_ICON =
  "https://assets.wallsentertainment.com/walls-app-icons/projects-v3.png";

const SCOUTER_NOTIFICATION_ICON =
  "https://assets.wallsentertainment.com/walls-app-icons/scouter-v3.svg";

export type NotificationItem = {
  id: string;
  type:
    | "info"
    | "success"
    | "alert"
    | "welcome"
    | "email"
    | "projects"
    | "scouter";
  title: string;
  body: string;
  time: string;
  read: boolean;
  redirect_url: string | null;
};

type DbNotification = {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  redirect_url: string | null;
};

function formatTime(createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function toNotificationItem(n: DbNotification): NotificationItem {
  const validTypes = [
    "info",
    "success",
    "alert",
    "welcome",
    "email",
    "projects",
    "scouter",
  ] as const;
  const type = validTypes.includes(n.type as (typeof validTypes)[number])
    ? (n.type as NotificationItem["type"])
    : "info";
  return {
    id: n.id,
    type,
    title: n.title,
    body: n.body ?? "",
    time: formatTime(n.created_at),
    read: n.is_read,
    redirect_url: n.redirect_url,
  };
}

const iconForType = (type: NotificationItem["type"]) => {
  switch (type) {
    case "welcome":
      return (
        <PartyPopper className="h-6 w-6 text-yellow-500" strokeWidth={1.75} />
      );
    case "success":
      return (
        <CheckCheck className="h-6 w-6 text-emerald-500" strokeWidth={1.75} />
      );
    case "alert":
      return (
        <AlertCircle className="h-6 w-6 text-orange-400" strokeWidth={1.75} />
      );
    case "email":
      return (
        <img
          src={EMAIL_NOTIFICATION_ICON}
          alt=""
          className="h-6 w-6 object-contain"
          width={24}
          height={24}
        />
      );
    case "projects":
      return (
        <img
          src={PROJECTS_NOTIFICATION_ICON}
          alt=""
          className="h-6 w-6 object-contain"
          width={24}
          height={24}
        />
      );
    case "scouter":
      return (
        <img
          src={SCOUTER_NOTIFICATION_ICON}
          alt=""
          className="h-6 w-6 object-contain"
          width={24}
          height={24}
        />
      );
    default:
      return <Info className="h-6 w-6 text-kenoo-blue" strokeWidth={1.75} />;
  }
};

/** Inset press at rest — matches media-kit icon / surface wells (hover inset, applied while idle). */
const notificationIconWellClass =
  "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-neutral-200/40 bg-background/70 shadow-[inset_0_4px_8px_rgba(0,0,0,0.12)]";

/** Soft ambient + strong contact shadow (tight layer = crisp edge) */
const floatShadowRest =
  "shadow-[0_8px_28px_-10px_rgba(0,0,0,0.1),0_4px_14px_-2px_rgba(0,0,0,0.5)]";

const floatShadowHover =
  "hover:shadow-[0_9px_30px_-10px_rgba(0,0,0,0.1),0_4px_16px_-2px_rgba(0,0,0,0.52)]";

const cardClass = `bg-white/60 backdrop-blur-sm backdrop-saturate-150 ${floatShadowRest}`;

const floatingBtnClass = `rounded-full border border-neutral-300/90 bg-white/85 backdrop-blur-sm backdrop-saturate-150 ${floatShadowRest} flex items-center justify-center gap-2 ${floatShadowHover} transition-shadow group`;

const markAllReadBtnClass = `rounded-full bg-white/60 backdrop-blur-sm backdrop-saturate-150 ${floatShadowRest} flex items-center justify-center gap-2 ${floatShadowHover} transition-shadow group`;

interface NotificationsPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsPopup({
  open,
  onClose,
}: NotificationsPopupProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("user_notifications")
      .select("id, type, title, body, is_read, created_at, redirect_url")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications((data as DbNotification[]).map(toNotificationItem));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!open) return;
    void fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const supabase = getSupabaseClient();
    await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setNotifications([]);
    const supabase = getSupabaseClient();
    await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_read", false);
  }, [user]);

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      if (!notification.read) void markAsRead(notification.id);
      const redirectUrl =
        notification.type === SCOUTER_NOTIFICATION_TYPE
          ? SCOUTER_INDEX_URL
          : notification.redirect_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
    [markAsRead],
  );

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            {/* Invisible click-outside capture layer */}
            <div className="fixed inset-0 z-[9998]" onClick={onClose} />

            {/* Floating panel — transparent, just cards */}
            <motion.div
              key="notifications-panel"
              className="pointer-events-none fixed top-0 right-0 z-[9999] flex h-full w-[360px] max-w-[95vw] flex-col"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 30,
                mass: 0.9,
              }}
            >
              {/* Floating close button */}
              <div className="pointer-events-auto flex justify-end pt-5 pr-4 pb-2">
                <button
                  onClick={onClose}
                  aria-label="Close notifications"
                  className={`${floatingBtnClass} p-2`}
                >
                  <X className="h-4 w-4 text-gray-700 transition-colors group-hover:text-red-500" />
                </button>
              </div>

              {/* Notification cards */}
              <div
                className="pointer-events-auto flex-1 space-y-2 overflow-y-auto px-4 pt-6 pb-2"
                style={{ scrollbarWidth: "none" }}
              >
                {loading && (
                  <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
                    Loading…
                  </div>
                )}

                {!loading && notifications.length === 0 && (
                  <div
                    className={`flex flex-col items-center justify-center rounded-2xl py-12 ${cardClass}`}
                  >
                    <CheckCheck
                      className="mb-2 h-6 w-6 text-neutral-300"
                      strokeWidth={1.75}
                    />
                    <p className="text-sm text-neutral-400">
                      You&apos;re all caught up
                    </p>
                  </div>
                )}

                {!loading &&
                  notifications.map((notification, i) => (
                    <motion.div
                      key={notification.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ${cardClass} ${floatShadowHover} transition-shadow`}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ scale: 1.02 }}
                      transition={{
                        delay: i * 0.07,
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                      }}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Icon */}
                      <div className={notificationIconWellClass}>
                        {iconForType(notification.type)}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-neutral-800">
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="mt-0.5 text-xs leading-snug text-neutral-600">
                            {notification.body}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-neutral-500">
                          {notification.time}
                        </p>
                      </div>
                    </motion.div>
                  ))}
              </div>

              {/* Floating "Mark all as read" button */}
              <div className="pointer-events-auto flex justify-center pt-2 pb-5">
                <button
                  className={`${markAllReadBtnClass} px-4 py-2`}
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck className="h-4 w-4 text-kenoo-sky/80 transition-colors" />
                  <span className="text-sm font-light text-neutral-500 transition-colors">
                    Mark all as read
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
