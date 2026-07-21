"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireDeveloperConsole } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { deleteUpload, saveUpload, uploadRejection } from "@/lib/storage";

const BACK = "/admin/media";

function fail(message: string): never {
  redirect(`${BACK}?error=${encodeURIComponent(message)}`);
}

export async function uploadMediaAsset(formData: FormData) {
  const user = await requireDeveloperConsole();

  const file = formData.get("file") as File | null;
  if (!file) fail("Choose a file to upload.");
  const rejection = uploadRejection(file);
  if (rejection) fail(rejection);

  const altText = String(formData.get("altText") ?? "").trim() || null;
  const saved = await saveUpload(file, "media");

  const asset = await db.mediaAsset.create({
    data: { ...saved, altText, uploadedById: user.id },
  });
  await audit({
    actorId: user.id, action: "media.asset_uploaded", entityType: "MediaAsset",
    entityId: asset.id, after: { fileName: asset.fileName, size: asset.size },
  });
  redirect(`${BACK}?saved=1`);
}

export async function deleteMediaAsset(formData: FormData) {
  const user = await requireDeveloperConsole();
  const id = String(formData.get("id") ?? "");

  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) fail("That file no longer exists.");

  await db.mediaAsset.delete({ where: { id } });
  await deleteUpload(asset.filePath);
  await audit({
    actorId: user.id, action: "media.asset_deleted", entityType: "MediaAsset",
    entityId: id, before: { fileName: asset.fileName, size: asset.size },
  });
  redirect(`${BACK}?deleted=1`);
}
