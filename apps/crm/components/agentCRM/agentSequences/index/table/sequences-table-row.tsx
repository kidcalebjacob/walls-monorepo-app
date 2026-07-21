"use client";

import React from 'react';
import { FALLBACK_ICON_URL } from "@/lib/asset-urls";
import Image from 'next/image';
import { Plus } from "lucide-react";
import { CardCRM as Card, CardContentCRM as CardContent } from "@/components/agentCRM/agentPeople/custom-ui/card-crm";
import { SequenceSwitch as Switch } from "@/components/agentCRM/agentSequences/ui/sequence-switch";
import { EmailSequence, ColumnWidths } from "../types";

interface SequencesTableRowProps {
  sequence: EmailSequence;
  index: number;
  scrollableRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onSequenceClick: (sequenceId: string) => void;
  onStatusToggle: (sequenceId: string, currentStatus: string, checked: boolean) => void;
  columnWidths: ColumnWidths;
}

export const SequencesTableRow = ({
  sequence,
  index,
  scrollableRefs,
  onSequenceClick,
  onStatusToggle,
  columnWidths,
}: SequencesTableRowProps) => {
  return (
    <div 
      key={sequence.id} 
      className="block relative w-full"
    >
      <div
        className="absolute top-0 bottom-0 w-px z-10 bg-neutral-300 pointer-events-none"
        style={{ left: `${columnWidths.name}px` }}
      ></div>
      <Card className="w-full rounded-none bg-kenoo-white backdrop-blur-md border-b border-r border-l-0 border-t-0 border-neutral-300 transition-all duration-300 group relative overflow-visible box-border">
        <CardContent className="py-3 relative z-10">
          <div className="flex items-stretch">
            {/* Sticky Left Section - Active Toggle and Sequence Name */}
            <div
              className="flex items-stretch gap-4 flex-shrink-0 sticky left-0 z-10 pr-0 overflow-visible bg-kenoo-white"
              style={{ width: `${columnWidths.name}px` }}
            >
              <div
                onClick={() => onSequenceClick(sequence.id)}
                className="flex items-center gap-4 flex-1 cursor-pointer transition-all duration-200 -my-3 py-3 pl-6 relative bg-kenoo-white hover:bg-gray-200/60 max-w-full self-stretch min-h-full"
              >
                <div className="w-[60px] flex items-center justify-start flex-shrink-0">
                  <Switch
                    checked={sequence.status === 'active'}
                    onCheckedChange={(checked) => onStatusToggle(sequence.id, sequence.status, checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-light text-foreground truncate w-full">
                    {sequence.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Right Section - Additional Information */}
            <div 
              ref={(el) => {
                if (el) {
                  scrollableRefs.current[index] = el;
                }
              }}
              className="flex-1 overflow-x-hidden pr-0 flex items-center"
            >
              <div className="flex items-center min-w-max pl-0" style={{ gap: '0.5rem' }}>
                {/* Owner */}
                <div className="flex items-center flex-shrink-0 pl-6 overflow-hidden" style={{ width: `${columnWidths.createdBy}px` }}>
                  {sequence.owner_avatar_url ? (
                    <Image
                      src={sequence.owner_avatar_url}
                      alt="Owner"
                      width={32}
                      height={32}
                      className="rounded-full object-cover border border-neutral-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_ICON_URL;
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 border border-neutral-200 flex items-center justify-center">
                      <span className="text-xs text-neutral-500">—</span>
                    </div>
                  )}
                </div>

                {/* Pitching */}
                <div className="flex items-center gap-1 flex-shrink-0 overflow-visible group" style={{ width: `${columnWidths.pitching}px` }}>
                  {sequence.talent && sequence.talent.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {sequence.talent.slice(0, 3).map((t, index) => {
                        const baseMargin = index > 0 ? -16 : 0;
                        const hoverMargin = index > 0 ? -4 : 0;
                        return (
                          <div
                            key={t.id}
                            className="relative flex-shrink-0 w-8 h-8 rounded-full overflow-hidden transition-all duration-300 ease-in-out"
                            style={{
                              marginLeft: `${baseMargin}px`,
                              zIndex: 10 - index,
                            }}
                            onMouseEnter={(e) => {
                              if (index > 0) {
                                e.currentTarget.style.marginLeft = `${hoverMargin}px`;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (index > 0) {
                                e.currentTarget.style.marginLeft = `${baseMargin}px`;
                              }
                            }}
                          >
                            <Image
                              src={t.avatar_url || FALLBACK_ICON_URL}
                              alt={`Talent ${index + 1}`}
                              width={32}
                              height={32}
                              className="w-full h-full rounded-full object-cover aspect-square"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = FALLBACK_ICON_URL;
                              }}
                            />
                          </div>
                        );
                      })}
                      {sequence.talent.length > 3 && (
                        <div
                          className="relative flex-shrink-0 w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center transition-all duration-300 ease-in-out"
                          style={{
                            marginLeft: '-16px',
                            zIndex: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.marginLeft = '-4px';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.marginLeft = '-16px';
                          }}
                        >
                          <Plus className="w-4 h-4 text-neutral-500" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm font-light text-muted-foreground">—</span>
                  )}
                </div>

                {/* Contacts */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.contacts}px` }}>
                  <p className="text-sm font-light text-foreground whitespace-nowrap">
                    {sequence.contact_count || 0}
                  </p>
                </div>

                {/* Active */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.active}px` }}>
                  <p className="text-sm font-light text-foreground whitespace-nowrap">
                    {sequence.active_count || 0}
                  </p>
                </div>

                {/* Paused */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.paused}px` }}>
                  <p className="text-sm font-light text-foreground whitespace-nowrap">
                    {sequence.paused_count || 0}
                  </p>
                </div>

                {/* Complete */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.complete}px` }}>
                  <p className="text-sm font-light text-foreground whitespace-nowrap">
                    {sequence.complete_count || 0}
                  </p>
                </div>

                {/* Replied */}
                <div className="flex items-center flex-shrink-0 overflow-hidden" style={{ width: `${columnWidths.replied}px` }}>
                  <p className="text-sm font-light text-foreground whitespace-nowrap group">
                    <span className="group-hover:hidden">
                      {sequence.contact_count > 0 
                        ? `${Math.round(((sequence.replied_count || 0) / sequence.contact_count) * 100)}%`
                        : '0%'}
                    </span>
                    <span className="hidden group-hover:inline">
                      {sequence.replied_count || 0}
                    </span>
                  </p>
                </div>
                {/* Spacer for proper scroll boundary */}
                <div style={{ width: '24px' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

