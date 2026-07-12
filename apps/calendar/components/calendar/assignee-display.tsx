"use client";

import { createClient } from "@walls/supabase/client";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AssigneeDisplayProps {
  userId: string;
  className?: string;
  currentUserId: string;
  onAssigneeChange?: (userId: string) => void;
}

export function AssigneeDisplay({
  userId,
  className,
  onAssigneeChange,
}: AssigneeDisplayProps) {
  const [userData, setUserData] = useState<{
    displayName: string;
    photoURL: string | null;
  }>({
    displayName: "",
    photoURL: null,
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("users")
          .select("first_name, last_name, email, avatar_url")
          .eq("id", userId)
          .maybeSingle();

        if (error || !data) {
          setUserData({ displayName: "Unknown User", photoURL: null });
          return;
        }

        const displayName =
          [data.first_name, data.last_name].filter(Boolean).join(" ") ||
          data.email ||
          "Unknown User";

        setUserData({
          displayName,
          photoURL: data.avatar_url,
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserData({ displayName: "Unknown User", photoURL: null });
      }
    };

    fetchUserData();
  }, [userId]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-gray-500">Assignee: </span>
      {userData.photoURL ? (
        <Image
          src={userData.photoURL}
          alt={userData.displayName}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
        />
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
          {userData.displayName.charAt(0)}
        </div>
      )}
      <button
        type="button"
        className="text-left"
        onClick={() => onAssigneeChange?.(userId)}
      >
        {userData.displayName || "Loading..."}
      </button>
    </div>
  );
}
