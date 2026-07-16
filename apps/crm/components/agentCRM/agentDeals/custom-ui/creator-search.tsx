"use client"

import * as React from "react"
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import { CheckCircle, ChevronDown, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/components/ui/select"
import { getSupabaseClient } from "@/app/auth/supabaseClient"
import { useAuth } from "@/app/auth/AuthContext"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"

const FALLBACK_AVATAR = FALLBACK_ICON_URL

interface Creator {
  id: string
  name: string
  avatar_url: string
  agent_team_id: string | null
  contract_type: string | null
}

interface CreatorSearchProps {
  value: string
  onChange: (value: string) => void
  /** When set, called with (talentId, name, avatarUrl?) on select so parent can store (e.g. for deal_talent). */
  onChangeWithId?: (talentId: string, name: string, avatarUrl?: string) => void
  className?: string
  placeholder?: string
  triggerIcon?: "chevron" | "plus"
}

export function CreatorSearch({ value, onChange, onChangeWithId, className, placeholder, triggerIcon = "chevron" }: CreatorSearchProps) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [creators, setCreators] = React.useState<Creator[]>([])
  const [selectedCreator, setSelectedCreator] = React.useState<Creator | null>(null)
  const [managedCreators, setManagedCreators] = React.useState<Creator[]>([])
  const [allCreators, setAllCreators] = React.useState<Creator[]>([])
  const [searchManagedCreators, setSearchManagedCreators] = React.useState<Creator[]>([])
  const [searchAllCreators, setSearchAllCreators] = React.useState<Creator[]>([])
  const [expandedManaged, setExpandedManaged] = React.useState(true)
  const [expandedAll, setExpandedAll] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState("")
  const [searchTerm, setSearchTerm] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const fetchCreators = async () => {
      try {
        const supabase = getSupabaseClient()

        if (!user?.email) {
          setCreators([])
          return
        }

        const { data: { user: supabaseUser } } = await supabase.auth.getUser()
        if (!supabaseUser?.email) {
          setCreators([])
          return
        }

        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("email", supabaseUser.email)
          .single()

        if (userData?.id) {
          setCurrentUserId(userData.id)
        }

        const { data: talentData, error } = await supabase
          .from("talent")
          .select("id, first_name, last_name, avatar_url, agent_team_id, contract_type")
          .eq("status", "Active")
          .order("first_name", { ascending: true })

        if (error) {
          console.error("Error fetching creators:", error)
          setCreators([])
          return
        }

        const creatorsList = (talentData || [])
          .map((talent: {
            id: string
            first_name: string | null
            last_name: string | null
            avatar_url: string | null
            agent_team_id: string | null
            contract_type: string | null
          }) => {
            const firstName = talent.first_name || ""
            const lastName = talent.last_name || ""
            const fullName = `${firstName} ${lastName}`.trim()
            return {
              id: talent.id,
              name: fullName,
              avatar_url: talent.avatar_url || "",
              agent_team_id: talent.agent_team_id || null,
              contract_type: talent.contract_type || null,
            }
          })
          .filter((c: Creator) => c.name)
          .sort((a: Creator, b: Creator) => a.name.localeCompare(b.name))

        setCreators(creatorsList)

        const selected = creatorsList.find((c: Creator) => c.name === value)
        setSelectedCreator(selected || null)
      } catch (error) {
        console.error("Error fetching creators:", error)
        setCreators([])
      }
    }

    fetchCreators()
  }, [value, user?.email])

  React.useEffect(() => {
    if (!currentUserId) {
      setManagedCreators([])
      setAllCreators(creators)
      return
    }
    const managed = creators.filter(
      (c) => c.agent_team_id === currentUserId && c.contract_type === "exclusive"
    )
    setManagedCreators(managed)
    setAllCreators(creators)
  }, [creators, currentUserId])

  React.useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchManagedCreators(managedCreators)
      return
    }
    const q = searchTerm.toLowerCase()
    setSearchManagedCreators(
      managedCreators.filter((c) => c.name.toLowerCase().includes(q))
    )
  }, [searchTerm, managedCreators])

  React.useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchAllCreators(allCreators)
      return
    }
    const q = searchTerm.toLowerCase()
    setSearchAllCreators(
      allCreators.filter((c) => c.name.toLowerCase().includes(q))
    )
  }, [searchTerm, allCreators])

  const displayManaged = searchTerm.trim() ? searchManagedCreators : managedCreators
  const displayAll = searchTerm.trim() ? searchAllCreators : allCreators

  React.useEffect(() => {
    const selected = creators.find((c) => c.name === value)
    setSelectedCreator(selected || null)
  }, [creators, value])

  const handleSelect = (creatorName: string) => {
    onChange(creatorName)
    const creator = creators.find((c) => c.name === creatorName)
    if (creator) {
      onChangeWithId?.(creator.id, creatorName, creator.avatar_url || undefined)
      setSelectedCreator(creator)
    } else {
      setSelectedCreator(null)
    }
    setOpen(false)
  }

  const isSelected = (creatorName: string) => value === creatorName

  return (
    <div className="w-full">
      <Select
        value=""
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) {
            setSearchTerm("")
          } else {
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        onValueChange={() => {}}
      >
        <SelectTrigger
          className={cn(
            "relative group hover:bg-transparent p-0 h-auto w-[350px] max-w-full flex items-center justify-between border-0 shadow-none bg-transparent focus:ring-0 focus:ring-offset-0 [&>:last-child]:hidden",
            className
          )}
        >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCreator?.avatar_url && (
            <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
              <Image
                src={selectedCreator.avatar_url}
                alt={selectedCreator.name}
                fill
                className="object-cover"
                sizes="24px"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = FALLBACK_AVATAR
                }}
              />
            </div>
          )}
          <span className="font-normal truncate">{value || placeholder || "Select creator..."}</span>
        </div>
        {triggerIcon === "plus" ? (
          <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        ) : (
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        )}
      </SelectTrigger>
      <SelectContent
        position="popper"
        side="bottom"
        align="start"
        sideOffset={8}
        className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] min-w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
      >
        {/* Search Input - Sticky (same as PitchTracker) */}
        <div className="p-2 border-b border-gray-900/10 flex-shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
          <div className="rounded-lg bg-neutral-100 backdrop-blur-md shadow-inner border border-neutral-200/50 pr-4 pl-2 py-2">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                e.stopPropagation()
                setSearchTerm(e.target.value)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Escape") setSearchTerm("")
              }}
              placeholder="Search creators..."
              className="border-0 focus-visible:ring-0 focus:ring-0 bg-transparent flex-1 w-full text-sm focus:outline-none placeholder:text-neutral-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Creator List - Scrollable (same structure as PitchTracker) */}
        <div className="overflow-y-auto flex-1 bg-neutral-300/20 backdrop-blur-xl">
          {/* Managed Section */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setExpandedManaged(!expandedManaged)
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer bg-neutral-200/50 hover:bg-neutral-300/40 transition-colors"
            >
              <span className="text-sm font-normal text-gray-700">Managed</span>
              <div className="flex-1" />
              {expandedManaged ? (
                <Minus className="h-4 w-4 text-gray-500" />
              ) : (
                <Plus className="h-4 w-4 text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {expandedManaged && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {displayManaged.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">
                      No managed creators found
                    </div>
                  ) : (
                    displayManaged.map((creator) => (
                      <div
                        key={creator.id}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSelect(creator.name)
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        className={cn(
                          "flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10",
                          isSelected(creator.name) && "bg-kenoo-yellow/40"
                        )}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                            {creator.avatar_url ? (
                              <Image
                                src={creator.avatar_url}
                                alt={creator.name}
                                fill
                                className="object-cover"
                                sizes="24px"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = FALLBACK_AVATAR
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {creator.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-normal text-sm">{creator.name}</span>
                          </div>
                          {isSelected(creator.name) && (
                            <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* All Section */}
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setExpandedAll(!expandedAll)
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center w-full px-4 py-2 border-b border-gray-900/10 cursor-pointer bg-neutral-200/50 hover:bg-neutral-300/40 transition-colors"
            >
              <span className="text-sm font-normal text-gray-700">All</span>
              <div className="flex-1" />
              {expandedAll ? (
                <Minus className="h-4 w-4 text-gray-500" />
              ) : (
                <Plus className="h-4 w-4 text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {expandedAll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {displayAll.length === 0 ? (
                    <div className="py-2 px-4 text-sm text-gray-500">
                      No creators found
                    </div>
                  ) : (
                    displayAll.map((creator) => (
                      <div
                        key={creator.id}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleSelect(creator.name)
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        className={cn(
                          "flex items-center px-4 py-2 cursor-pointer rounded-none hover:bg-neutral-300/30 focus:bg-neutral-500/10",
                          isSelected(creator.name) && "bg-kenoo-yellow/40"
                        )}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <div className="relative w-6 h-6 flex-shrink-0 rounded-full overflow-hidden">
                            {creator.avatar_url ? (
                              <Image
                                src={creator.avatar_url}
                                alt={creator.name}
                                fill
                                className="object-cover"
                                sizes="24px"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = FALLBACK_AVATAR
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                <span className="text-xs text-gray-600">
                                  {creator.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-normal text-sm">{creator.name}</span>
                          </div>
                          {isSelected(creator.name) && (
                            <CheckCircle className="h-4 w-4 text-black ml-auto flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SelectContent>
    </Select>
    </div>
  )
}
