"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LookupFieldProps = {
  id: string;
  label: string;
  value: string;
  onLookupClick: () => void;
  placeholder?: string;
  required?: boolean;
};

export function LookupField({
  id,
  label,
  value,
  onLookupClick,
  placeholder = "Select…",
  required = false,
}: LookupFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          readOnly
          placeholder={placeholder}
          className="bg-muted"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Look up ${label}`}
          onClick={onLookupClick}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
