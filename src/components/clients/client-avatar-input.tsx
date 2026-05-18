"use client";

import { Camera, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ClientAvatarInputProps = {
  id: string;
  name: string;
  logoUrl?: string | null;
  previewUrl?: string | null;
  accentColor?: string | null;
  uploading?: boolean;
  onFileSelect: (file: File) => void;
  className?: string;
};

export function ClientAvatarInput({
  id,
  name,
  logoUrl,
  previewUrl,
  accentColor,
  uploading = false,
  onFileSelect,
  className,
}: ClientAvatarInputProps) {
  const imageUrl = previewUrl || logoUrl;
  const initial = (name.trim() || "C").slice(0, 1).toUpperCase();

  return (
    <label
      htmlFor={id}
      className={cn(
        "group relative grid h-24 w-24 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-secondary text-3xl font-medium text-foreground",
        className,
      )}
      style={{ color: accentColor || undefined }}
      title="Subir logo"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
      <span className="absolute inset-0 grid place-items-center bg-black/0 text-white transition group-hover:bg-black/35">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin opacity-100" />
        ) : (
          <Camera className="h-5 w-5 opacity-0 transition group-hover:opacity-100" />
        )}
      </span>
      <Input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onFileSelect(file);
          }

          event.target.value = "";
        }}
      />
    </label>
  );
}
