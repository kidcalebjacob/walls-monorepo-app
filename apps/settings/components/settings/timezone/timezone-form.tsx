"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMMON_TIMEZONES, TimezoneGroup } from "@/types/timezone.types";
import { useAuth } from "@/lib/auth";
import { useUploadTimezone } from "@/hooks/useMutations";
import { SaveAccount } from "@/components/account-buttons";
import { Toaster } from "@/components/ui/toaster";
import { useCallback } from "react";
import { getSupabaseClient } from "@/lib/auth";

export function TimezoneForm() {
  const { user } = useAuth();
  const [timezone, setTimezone] = useState("");
  const [existingTimezone, setExistingTimezone] = useState("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  
  const { mutate: uploadTimezoneMutation } = useUploadTimezone();
  
  const isTimezoneChanged = timezone !== "";
  const savable = isTimezoneChanged;

  useEffect(() => {
    const fetchUserTimezone = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        
        // Get user record from users table using auth_id
        const { data: userData, error } = await supabase
          .from('users')
          .select('timezone')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (!error && userData?.timezone) {
          setExistingTimezone(userData.timezone);
        }
      } catch (error) {
        console.error("Error fetching timezone:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserTimezone();
  }, [user?.id]);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      try {
        const timeString = now.toLocaleTimeString('en-US', {
          timeZone: timezone || existingTimezone || 'UTC',
          hour12: true,
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          timeZoneName: 'short'
        });
        setCurrentTime(timeString);
      } catch (error) {
        console.error('Error formatting time:', error);
      }
    };

    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 1000);

    return () => clearInterval(interval);
  }, [timezone, existingTimezone]);

  const handleSave = useCallback(async () => {
    let success = true;
    
    if (timezone) {
      uploadTimezoneMutation(timezone);
    }
    
    return success;
  }, [timezone, uploadTimezoneMutation]);

  // Group timezones by region
  const groupedTimezones = COMMON_TIMEZONES.reduce((acc, tz) => {
    if (!acc[tz.group]) {
      acc[tz.group] = [];
    }
    acc[tz.group].push(tz);
    return acc;
  }, {} as Record<TimezoneGroup, typeof COMMON_TIMEZONES>);

  return (
    <div className="flex flex-col min-h-screen bg-background relative" style={{ zIndex: 1 }}>
      <div className="flex-1 w-full max-w-[90%] mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="w-full p-8">
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <Label className="text-lg font-semibold text-foreground">
                  Timezone
                </Label>
                <div className="space-y-2">
                  <div className="border border-black rounded-xl overflow-hidden">
                    <Select
                      value={timezone || existingTimezone || ""}
                      onValueChange={setTimezone}
                    >
                      <SelectTrigger className="w-full border-0 h-[42px] focus-visible:ring-0">
                        <SelectValue placeholder="Select your timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(groupedTimezones).map(([group, timezones]) => (
                          <SelectGroup key={group}>
                            <SelectLabel className="font-semibold">{group}</SelectLabel>
                            {timezones.map((tz) => (
                              <SelectItem key={tz.id} value={tz.id}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(timezone || existingTimezone) && (
                    <p className="text-sm text-muted-foreground">
                      Current time: {currentTime}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-start">
              <SaveAccount 
                clickable={savable} 
                handleSave={handleSave}
                buttonClassName="bg-black text-kenoo-yellow font-black" 
              />
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
} 