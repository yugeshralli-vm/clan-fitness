"use client";

import { upload } from "@vercel/blob/client";
import { Loader2, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/compress-image";
import { useActionToast } from "@/lib/use-action-toast";
import { logDailyCheckIn } from "../actions";
import type { FoodStatus } from "../types";

const STATUS_OPTIONS: { value: FoodStatus; label: string }[] = [
  { value: "yes", label: "Hit it" },
  { value: "no", label: "Missed it" },
  { value: "partial", label: "Partial" },
];

const MAX_PHOTOS = 3;
// Pre-compression sanity cap. Not a platform requirement (photos upload client-direct to Blob,
// bypassing the Server Action body entirely) — just bounding canvas-decode cost on lower-end
// phones when up to 3 images might be compressing at once, and failing fast on a pathological file.
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

type PhotoSlot =
  | { kind: "existing"; url: string }
  | { kind: "new"; previewUrl: string; url?: string; error?: string; uploading: boolean; abort: AbortController };

// Full-height pill wrapping the native input, not just the text, so the tappable area meets the
// ~44px touch-target minimum on mobile — a bare `<input>` + label text was too small to hit reliably.
const TOGGLE_LABEL_CLASS =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-surface-border px-4 text-sm font-medium text-foreground-secondary transition-colors has-[:checked]:border-accent has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent";

export function DailyLogForm({
  alreadyWorkedOut,
  existingGymNote,
  todaysSteps,
  dailyStepsTarget,
  currentFoodStatus,
  existingFoodNote,
  existingPhotoUrls,
  existingThought,
  hasLoggedToday,
}: {
  alreadyWorkedOut: boolean;
  existingGymNote?: string;
  todaysSteps?: number;
  dailyStepsTarget?: number;
  currentFoodStatus?: FoodStatus;
  existingFoodNote?: string;
  existingPhotoUrls?: string[];
  existingThought?: string;
  hasLoggedToday: boolean;
}) {
  const [state, action, pending] = useActionState(logDailyCheckIn, undefined);
  const markSubmitted = useActionToast(state, pending, hasLoggedToday ? "Log updated" : "Log saved");
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    (existingPhotoUrls ?? []).map((url) => ({ kind: "existing", url })),
  );

  async function handlePhotosChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;

    const accepted = files.slice(0, MAX_PHOTOS - photos.length);

    for (const file of accepted) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_PHOTO_BYTES) {
        const slot: PhotoSlot = {
          kind: "new",
          previewUrl: "",
          uploading: false,
          error: "Photo must be under 10MB.",
          abort: new AbortController(),
        };
        setPhotos((prev) => [...prev, slot]);
        continue;
      }

      const abort = new AbortController();
      const previewUrl = URL.createObjectURL(file);
      const slot: PhotoSlot = { kind: "new", previewUrl, uploading: true, abort };
      setPhotos((prev) => [...prev, slot]);

      // Independent per-file pipeline — one failure never blocks or delays the others.
      (async () => {
        try {
          const compressed = await compressImage(file);
          const blob = await upload(`check-ins/${compressed.name}`, compressed, {
            access: "public",
            handleUploadUrl: "/api/check-ins/upload",
            abortSignal: abort.signal,
          });
          setPhotos((prev) => prev.map((p) => (p === slot ? { ...p, uploading: false, url: blob.url } : p)));
        } catch {
          setPhotos((prev) =>
            prev.map((p) => (p === slot ? { ...p, uploading: false, error: "Upload failed." } : p)),
          );
        }
      })();
    }
  }

  function removePhoto(target: PhotoSlot) {
    if (target.kind === "new") {
      target.abort.abort();
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    }
    setPhotos((prev) => prev.filter((p) => p !== target));
  }

  const anyUploading = photos.some((p) => p.kind === "new" && p.uploading);
  // A failed upload (flaky connection, oversized file) used to leave the Save button enabled the
  // moment it settled — easy to miss the tiny error text under the thumbnail and save a log with
  // fewer photos than intended, with nothing to show for it after the fact. Block save until the
  // failed slot is removed, same as an in-flight upload already blocks it.
  const anyPhotoErrors = photos.some((p) => p.kind === "new" && p.error);
  const uploadedUrls = photos.map((p) => p.url).filter((url): url is string => !!url);

  return (
    <form
      action={(formData) => {
        markSubmitted();
        action(formData);
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <span aria-hidden>💪</span> Gym
        </h2>
        {alreadyWorkedOut ? (
          <>
            <p className="text-sm text-foreground-secondary">You already logged a workout today. 🔥</p>
            <Input
              name="gymNote"
              placeholder="Update note (e.g. leg day)"
              maxLength={200}
              defaultValue={existingGymNote}
            />
          </>
        ) : (
          <>
            <label className={TOGGLE_LABEL_CLASS}>
              <input type="checkbox" name="workedOut" className="h-5 w-5 accent-accent" />
              I worked out today 💪
            </label>
            <Input name="gymNote" placeholder="Optional note (e.g. leg day)" maxLength={200} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <span aria-hidden>👟</span> Steps
          </h2>
          {dailyStepsTarget !== undefined && (
            <span className="text-xs text-foreground-tertiary">
              Goal: {dailyStepsTarget.toLocaleString("en-US")}/day
            </span>
          )}
        </div>
        <Input name="count" type="number" min={0} defaultValue={todaysSteps} placeholder="Steps today" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <span aria-hidden>🥗</span> Nutrition
        </h2>
        {currentFoodStatus && (
          <p className="text-sm text-foreground-secondary">You already logged nutrition today.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <label key={option.value} className={TOGGLE_LABEL_CLASS}>
              <input
                type="radio"
                name="status"
                value={option.value}
                defaultChecked={currentFoodStatus === option.value}
                className="h-5 w-5 accent-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
        <Input
          name="foodNote"
          placeholder="Optional note (e.g. meal prepped)"
          maxLength={200}
          defaultValue={existingFoodNote}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <span aria-hidden>📷</span> Photo
          </h2>
          <span className="text-xs text-foreground-tertiary">Optional</span>
        </div>
        <label htmlFor="photos" className="text-xs text-foreground-tertiary">
          {photos.length > 0
            ? `${photos.length}/${MAX_PHOTOS} photos`
            : "Saves on their own, no other answer needed"}
        </label>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-3">
            {photos.map((slot, i) => {
              const previewSrc = slot.kind === "existing" ? slot.url : slot.previewUrl || undefined;
              return (
                <div key={i} className="relative h-14 w-14 shrink-0">
                  {previewSrc ? (
                    slot.kind === "existing" ? (
                      <Image
                        src={previewSrc}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      // Local blob: preview of a not-yet-optimized file — next/image can't render blob: URLs.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    )
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-danger bg-surface" />
                  )}
                  {slot.kind === "new" && slot.uploading && (
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40"
                      role="status"
                      aria-label="Uploading photo"
                    >
                      <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                  )}
                  {slot.kind === "new" && slot.error && (
                    <p className="absolute top-full left-0 w-14 truncate pt-0.5 text-center text-[9px] text-danger">
                      {slot.error}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(slot)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-surface p-0.5 text-foreground-tertiary shadow-[2px_2px_0_0_var(--edge)] hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            className="text-sm text-foreground-secondary file:mr-3 file:rounded-none file:border file:border-surface-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground"
          />
        )}
        {uploadedUrls.map((url) => (
          <input key={url} type="hidden" name="photoUrls" value={url} />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <span aria-hidden>💭</span> Thought
          </h2>
          <span className="text-xs text-foreground-tertiary">Optional</span>
        </div>
        <Input name="thought" placeholder="What's on your mind?" maxLength={200} defaultValue={existingThought} />
      </div>

      {anyPhotoErrors && (
        <p className="text-sm text-danger">Remove the failed photo above before saving.</p>
      )}
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending || anyUploading || anyPhotoErrors}>
        {pending ? "Saving..." : hasLoggedToday ? "Update today's log" : "Save today's log"}
      </Button>
    </form>
  );
}
