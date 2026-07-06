"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import {
  motion,
  useScroll,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useVelocity,
  useSpring,
} from "framer-motion";
import { createClient } from "@walls/supabase/client";

interface TalentItem {
  id: string;
  profilePictureUrl: string;
  creatorAlias: string;
}

export function TalentScrollSection() {
  const [talent, setTalent] = useState<TalentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);

  // MotionValues for x positions (numeric, converted to % in style)
  const row1XVal = useMotionValue(0);
  const row2XVal = useMotionValue(-50);
  const textTopXVal = useMotionValue(0);
  const textBottomXVal = useMotionValue(-50);

  // Convert numeric to percentage strings
  const row1X = useTransform(row1XVal, (v) => `${v}%`);
  const row2X = useTransform(row2XVal, (v) => `${v}%`);
  const textTopX = useTransform(textTopXVal, (v) => `${v}%`);
  const textBottomX = useTransform(textBottomXVal, (v) => `${v}%`);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Get scroll velocity and smooth it for natural feel
  const scrollVelocity = useVelocity(scrollYProgress);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 400 });

  // Continuous auto-scroll + scroll-boosted animation
  useAnimationFrame((time, delta) => {
    // Base auto-scroll speed (% per second) — very slow continuous motion
    const baseSpeed = 1.5; // 1.5% per second ≈ 33 seconds for full cycle

    // Boost speed based on scroll velocity
    const velocity = smoothVelocity.get();
    const velocityBoost = Math.abs(velocity) * 80; // multiplier when scrolling

    const speed = baseSpeed + velocityBoost;
    const deltaSeconds = delta / 1000;
    const increment = speed * deltaSeconds;

    // Row 1 & top text: move left (0 → -50, then wrap)
    let r1 = row1XVal.get() - increment;
    while (r1 < -50) r1 += 50;
    row1XVal.set(r1);
    textTopXVal.set(r1);

    // Row 2 & bottom text: move right (-50 → 0, then wrap)
    let r2 = row2XVal.get() + increment;
    while (r2 > 0) r2 -= 50;
    row2XVal.set(r2);
    textBottomXVal.set(r2);
  });

  useEffect(() => {
    const fetchTalent = async () => {
      try {
        setLoading(true);
        const supabase = createClient();

        const { data: talentData, error: talentError } = await supabase
          .from("talent")
          .select(`
            id,
            avatar_url,
            profile_id,
            profile:profiles!talent_profile_id_fkey(id, name)
          `)
          .eq("status", "Active")
          .order("id", { ascending: true });

        if (talentError) {
          console.error("Error fetching talent:", talentError);
          setLoading(false);
          return;
        }

        if (!talentData?.length) {
          setTalent([]);
          setLoading(false);
          return;
        }

        const items: TalentItem[] = talentData.map((t: any) => {
          const profile = Array.isArray(t.profile) ? t.profile[0] : t.profile;
          return {
            id: t.id,
            profilePictureUrl: t.avatar_url || "",
            creatorAlias: profile?.name || "",
          };
        });

        setTalent(items);
      } catch (err) {
        console.error("Error fetching talent:", err);
        setTalent([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTalent();
  }, []);

  // Duplicate for seamless infinite marquee (two full sets so 0 ↔ -50% loops)
  const row1Items = useMemo(() => [...talent, ...talent], [talent]);
  const row2Items = useMemo(() => [...talent, ...talent], [talent]);

  return (
    <div ref={sectionRef}>
      {loading && (
        <section className="w-full py-12 md:py-16 bg-gray-50 overflow-hidden">
          <div className="space-y-0">
            <div className="h-48 md:h-56 bg-gray-200/60 animate-pulse" />
            <div className="h-48 md:h-56 bg-gray-200/60 animate-pulse" />
          </div>
        </section>
      )}
      {!loading && talent.length > 0 && (
        <>
          {/* Full-width walls-yellow bar above — text moves left on scroll */}
          <div className="w-full bg-walls-yellow py-5 md:py-7 overflow-hidden">
            <motion.div
              className="flex w-[max-content] whitespace-nowrap items-center"
              style={{ x: textTopX }}
            >
              {[...Array(12)].map((_, i) => (
                <span key={`top-${i}`} className="flex items-center shrink-0">
                  <span className="text-neutral-800 uppercase tracking-wider text-lg md:text-xl font-light px-8 md:px-12">
                    Talent Management
                  </span>
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-neutral-800 shrink-0" />
                </span>
              ))}
            </motion.div>
          </div>

          <section className="w-full bg-gray-50 overflow-hidden">
            {/* Row 1: moves left on scroll */}
            <div className="relative w-full h-80 md:h-96 overflow-hidden">
              <motion.div
                className="flex h-full w-[max-content] gap-0 items-stretch"
                style={{ x: row1X }}
              >
                {row1Items.map((t, i) => {
                  const aspects = ["aspect-[3/4]", "aspect-[4/5]", "aspect-[2/3]"] as const;
                  const aspect = aspects[i % 3];
                  return (
                    <div
                      key={`row1-${t.id}-${i}`}
                      className={`relative flex-shrink-0 h-full w-auto ${aspect} overflow-hidden bg-gray-200`}
                    >
                      <Image
                        src={t.profilePictureUrl || "/WALLS-Logo.png"}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 200px, 240px"
                      />
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* Row 2: moves right on scroll */}
            <div className="relative w-full h-80 md:h-96 overflow-hidden">
              <motion.div
                className="flex h-full w-[max-content] gap-0 items-stretch"
                style={{ x: row2X }}
              >
                {row2Items.map((t, i) => {
                  const aspects = ["aspect-[4/5]", "aspect-[2/3]", "aspect-[3/4]"] as const;
                  const aspect = aspects[i % 3];
                  return (
                    <div
                      key={`row2-${t.id}-${i}`}
                      className={`relative flex-shrink-0 h-full w-auto ${aspect} overflow-hidden bg-gray-200`}
                    >
                      <Image
                        src={t.profilePictureUrl || "/WALLS-Logo.png"}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 200px, 240px"
                      />
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </section>

          {/* Full-width walls-yellow bar below — text moves right on scroll */}
          <div className="w-full bg-walls-yellow py-5 md:py-7 overflow-hidden">
            <motion.div
              className="flex w-[max-content] whitespace-nowrap items-center"
              style={{ x: textBottomX }}
            >
              {[...Array(12)].map((_, i) => (
                <span key={`bottom-${i}`} className="flex items-center shrink-0">
                  <span className="text-neutral-800 uppercase tracking-wider text-lg md:text-xl font-light px-8 md:px-12">
                    Talent Management
                  </span>
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-neutral-800 shrink-0" />
                </span>
              ))}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
