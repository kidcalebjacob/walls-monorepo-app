"use client";

import { FormMessages } from "@/components/form-messages";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { AddressInput } from "./input";
import { useDebounce } from "@/hooks/use-debounce";
import { fetcher } from "@/utils/fetcher";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";

import { Command as CommandPrimitive } from "cmdk";

export interface AddressType {
  address1: string;
  address2: string;
  formattedAddress: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
}

interface AddressAutoCompleteProps {
  address: AddressType;
  setAddress: (address: AddressType) => void;
  searchInput: string;
  setSearchInput: (searchInput: string) => void;
  dialogTitle: string;
  showInlineError?: boolean;
  placeholder?: string;
  disableInitialFetch?: boolean;
  alwaysEditable?: boolean;
  inputClassName?: string;
  displayInputClassName?: string;
  /** Match CRM people table toolbar search (underline + magnifier). */
  searchInputAppearance?: "default" | "people-toolbar";
}

export default function AddressAutoComplete(props: AddressAutoCompleteProps) {
  const {
    address,
    setAddress,
    dialogTitle,
    showInlineError = true,
    searchInput,
    setSearchInput,
    placeholder,
    disableInitialFetch,
    alwaysEditable = false,
    inputClassName,
    displayInputClassName,
    searchInputAppearance = "default",
  } = props;

  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useSWR(
    selectedPlaceId === ""
      ? null
      : `/api/address/place?placeId=${selectedPlaceId}`,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (data?.data.address) {
      const fetchedAddress = data.data.address as AddressType;
      setAddress(fetchedAddress);
      setIsEditing(false);
      setSelectedPlaceId("");
      // Automatically use the formatted address without opening dialog
      // The parent component will pick up the formattedAddress change
    }
  }, [data, setAddress]);

  // Show input field if address is selected OR if there's an existing address (placeholder)
  const hasAddress = address.formattedAddress || placeholder;
  const displayAddress = address?.formattedAddress || placeholder || "";

  // If we have an address and not editing, show the display view (even when loading)
  // Unless alwaysEditable is true, then always show editable input
  if (hasAddress && !isEditing && !alwaysEditable) {
    return (
      <Input 
        value={isLoading ? "Loading address..." : displayAddress} 
        readOnly 
        onClick={() => setIsEditing(true)}
        className={cn(
          "w-full border-0 h-full focus-visible:ring-0 text-foreground cursor-pointer",
          displayInputClassName,
        )}
      />
    );
  }

  // Otherwise show the search input
  return (
    <AddressAutoCompleteInput
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      selectedPlaceId={selectedPlaceId}
      setSelectedPlaceId={setSelectedPlaceId}
      showInlineError={showInlineError}
      placeholder={placeholder}
      disableInitialFetch={disableInitialFetch}
      onAddressSelected={() => setIsEditing(false)}
      inputClassName={inputClassName}
      searchInputAppearance={searchInputAppearance}
    />
  );
}

interface CommonProps {
  selectedPlaceId: string;
  setSelectedPlaceId: (placeId: string) => void;
  showInlineError?: boolean;
  searchInput: string;
  setSearchInput: (searchInput: string) => void;
  placeholder?: string;
  disableInitialFetch?: boolean;
  onAddressSelected?: () => void;
  inputClassName?: string;
  searchInputAppearance?: "default" | "people-toolbar";
}

function AddressAutoCompleteInput(props: CommonProps) {
  const {
    setSelectedPlaceId,
    selectedPlaceId,
    showInlineError,
    searchInput,
    setSearchInput,
    placeholder,
    disableInitialFetch,
    onAddressSelected,
    inputClassName,
    searchInputAppearance = "default",
  } = props;

  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      close();
    }
  };

  const debouncedSearchInput = useDebounce(searchInput, 500);

  const { data, isLoading } = useSWR(
    disableInitialFetch && !debouncedSearchInput
      ? null
      : `/api/address/autocomplete?input=${debouncedSearchInput}`,
    fetcher,
  );

  const predictions = data?.data || [];

  return (
    <Command
      shouldFilter={false}
      onKeyDown={handleKeyDown}
      className="overflow-visible !bg-transparent"
    >
      {searchInputAppearance === "people-toolbar" ? (
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <AddressInput
            variant="plain"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            onBlur={close}
            onFocus={open}
            placeholder={placeholder || "Enter address"}
            className={cn(
              "w-full pl-6 pr-3 py-2 text-sm bg-transparent border-0 border-b focus:outline-none focus-visible:outline-none transition-colors placeholder:text-neutral-300 font-light rounded-none",
              searchInput.trim()
                ? "border-b-[var(--kenoo-sky)]"
                : "border-neutral-200",
              "focus:border-b-[var(--kenoo-sky)]",
            )}
          />
        </div>
      ) : (
        <AddressInput
          variant={inputClassName ? "plain" : "default"}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          onBlur={close}
          onFocus={open}
          placeholder={placeholder || "Enter address"}
          className={cn(!inputClassName && "h-[47px]", inputClassName)}
        />
      )}
      {searchInput !== "" && !isOpen && !selectedPlaceId && showInlineError && (
        <FormMessages
          type="error"
          className="pt-1 text-sm"
          messages={["Select a valid address from the list"]}
        />
      )}

      {isOpen && (
        <div className="relative animate-in fade-in-0 zoom-in-95 h-auto">
          <CommandList>
            <div className="absolute top-2 z-50 w-full">
              <CommandGroup className="relative h-auto z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-black/10 shadow-2xl bg-background backdrop-blur-sm">
                {isLoading ? (
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {predictions.map(
                      (prediction: {
                        placePrediction: {
                          placeId: string;
                          place: string;
                          text: { text: string };
                        };
                      }) => (
                        <CommandPrimitive.Item
                          value={prediction.placePrediction.text.text}
                          onSelect={() => {
                            setSearchInput("");
                            setSelectedPlaceId(
                              prediction.placePrediction.place,
                            );
                            close(); // Close dropdown when address is selected
                            // Dialog removed - address will be set automatically when place details are fetched
                          }}
                          className="flex select-text flex-row cursor-pointer gap-3 h-max p-3 px-4 rounded-lg transition-all duration-200 aria-selected:bg-black aria-selected:text-kenoo-yellow hover:!bg-neutral-200 hover:!text-black data-[selected=true]:bg-neutral-300 data-[selected=true]:text-black items-center group"
                          key={prediction.placePrediction.placeId}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <MapPin className="size-4 text-muted-foreground group-hover:text-black group-aria-selected:text-black transition-colors duration-200 shrink-0" />
                          <span className="text-sm font-normal group-hover:translate-x-0.5 transition-transform duration-200 flex-1">
                            {prediction.placePrediction.text.text}
                          </span>
                        </CommandPrimitive.Item>
                      ),
                    )}
                  </>
                )}

                <CommandEmpty>
                  {!isLoading && predictions.length === 0 && (
                    <div className="py-6 flex items-center justify-center text-muted-foreground">
                      <span className="text-sm">
                        {searchInput === ""
                          ? "Please enter an address"
                          : "No address found"}
                      </span>
                    </div>
                  )}
                </CommandEmpty>
              </CommandGroup>
            </div>
          </CommandList>
        </div>
      )}
    </Command>
  );
}