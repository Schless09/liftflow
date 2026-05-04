"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

const BUCKET = "progress-photos";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function uploadProgressPhoto(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Choose a photo");
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use JPEG, PNG, or WebP");
  if (file.size > MAX_BYTES) throw new Error("Max size is 5 MB");

  const buf = Buffer.from(await file.arrayBuffer());
  const objectPath = `${userId}/${randomUUID()}.${extForMime(file.type)}`;
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim().slice(0, 500) : null;

  const supabase = await createServerSupabaseClient();

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { error: insErr } = await supabase.from("progress_photos").insert({
    user_id: userId,
    storage_path: objectPath,
    note,
  });

  if (insErr) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    throw new Error(insErr.message);
  }

  revalidatePath("/profile");
}

export type ProgressPhotoDto = {
  id: string;
  storage_path: string;
  note: string | null;
  created_at: string;
  signedUrl: string | null;
};

export async function listProgressPhotos(): Promise<ProgressPhotoDto[]> {
  const supabase = await createServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from("progress_photos")
    .select("id, storage_path, note, created_at")
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) throw new Error(error.message);

  const out: ProgressPhotoDto[] = [];
  for (const r of rows ?? []) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, 3600);
    out.push({
      id: r.id,
      storage_path: r.storage_path,
      note: r.note,
      created_at: r.created_at,
      signedUrl: signErr ? null : signed?.signedUrl ?? null,
    });
  }
  return out;
}

export async function deleteProgressPhoto(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data: row, error: fetchErr } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!row?.storage_path) throw new Error("Photo not found");

  await supabase.storage.from(BUCKET).remove([row.storage_path]);

  const { error: delErr } = await supabase.from("progress_photos").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/profile");
}
