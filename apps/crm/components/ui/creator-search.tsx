"use client"

import * as React from "react"
import { FALLBACK_ICON_URL } from "@/lib/asset-urls"
import { ChevronDown, Minus, Plus, Search } from "lucide-react"
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
  onChangeWithId?: (talentId: string, name: string, avatarUrl?: string) => void
  className?: string
  placeholder?: string
  triggerIcon?: "chevron" | "plus"
  selectedIds?: string[]
  onRemoveId?: (talentId: string) => void
}

export function CreatorSearch({
  value,
  onChange,
  onChangeWithId,
  className,
  placeholder,
  triggerIcon = "chevron",
  selectedIds = [],
  onRemoveId,
}: CreatorSearchProps) {
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
  }, [user?.email, value])

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

  const handleSelect = (creator: Creator) => {
    if (selectedIds.includes(creator.id)) {
      onRemoveId?.(creator.id)
      return
    }
    onChange(creator.name)
    onChangeWithId?.(creator.id, creator.name, creator.avatar_url || undefined)
    setSelectedCreator(creator)
    setOpen(false)
  }

  const isSelected = (creatorId: string) => selectedIds.includes(creatorId)

  const renderCreatorRow = (creator: Creator) => (
    <div
      key={creator.id}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleSelect(creator)
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className="relative flex items-center px-4 py-2 pr-16 cursor-pointer rounded-none hover:bg-neutral-100/60"
    >
      <div className="flex items-center space-x-3 w-full min-w-0">
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
                target.src = FALLBACK_ICON_URL
              }}
            />
          ) : (
            <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
              <span className="text-xs font-light text-neutral-600">
                {creator.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-light">{creator.name}</span>
        </div>
      </div>
      {isSelected(creator.id) && (
        <button
          type="button"
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[10px] font-light lowercase leading-none tracking-wide text-[var(--kenoo-sky)] hover:underline focus:outline-none"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemoveId?.(creator.id)
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          remove
        </button>
      )}
    </div>
  )

  const renderSection = (
    label: string,
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    items: Creator[],
    emptyMessage: string
  ) => (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setExpanded(!expanded)
        }}
        onMouseDown={(e) => e.preventDefault()}
        className="flex items-center w-full px-4 py-2 border-b border-neutral-200/60 cursor-pointer bg-white/80 backdrop-blur-xl hover:bg-neutral-100/60 transition-colors"
      >
        <span className="text-sm font-light text-gray-700">{label}</span>
        <div className="flex-1" />
        {expanded ? (
          <Minus className="h-4 w-4 text-neutral-600" />
        ) : (
          <Plus className="h-4 w-4 text-neutral-600" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {items.length === 0 ? (
              <div className="py-2 px-4 text-sm font-light text-gray-500">{emptyMessage}</div>
            ) : (
              items.map(renderCreatorRow)
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <div className={cn("w-full", className)}>
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
        <SelectTrigger className="group relative flex h-auto min-h-0 w-full max-w-full flex-1 cursor-pointer items-center justify-between border-0 bg-transparent p-0 shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0 focus-visible:outline-none [&>:last-child]:hidden">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedCreator?.avatar_url && (
              <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  src={selectedCreator.avatar_url}
                  alt={selectedCreator.name}
                  fill
                  className="object-cover"
                  sizes="20px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = FALLBACK_ICON_URL
                  }}
                />
              </div>
            )}
            <span className="truncate text-sm font-light text-neutral-700">
              {value || placeholder || "Select creator..."}
            </span>
          </div>
          {triggerIcon === "plus" ? (
            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          )}
        </SelectTrigger>

        <SelectContent
          position="popper"
          className="p-0 bg-white/80 backdrop-blur-xl shadow-2xl !z-[9999] w-[350px] min-w-[350px] max-h-[500px] overflow-hidden flex flex-col [&>div]:!p-0 rounded-lg"
          side="bottom"
          align="start"
          sideOffset={8}
        >
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200/60 bg-white/80 px-3 py-2 backdrop-blur-xl">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
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
                placeholder="Search creators…"
                className={cn(
                  "w-full rounded-none border-0 border-b bg-transparent py-2 pl-6 pr-4 text-sm font-light transition-colors placeholder:text-neutral-300 focus:outline-none focus-visible:outline-none",
                  searchTerm.trim() ? "border-b-[var(--kenoo-sky)]" : "border-neutral-200"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 bg-white/80 backdrop-blur-xl">
            {renderSection("Managed", expandedManaged, setExpandedManaged, displayManaged, "No managed creators found")}
            {renderSection("All", expandedAll, setExpandedAll, displayAll, "No creators found")}
          </div>
        </SelectContent>
      </Select>
    </div>
  )
}
