import { NextResponse } from "next/server";
import { deleteComment } from "@/features/comments/actions";
import { apiError, requireApiUser } from "@/lib/api-response";

/** DELETE /api/v1/comments/:commentId — only the author can delete (enforced by the server action). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const r = await requireApiUser();
  if ("error" in r) return r.error;
  const { commentId } = await params;
  const result = await deleteComment(commentId);
  if (result.error) return apiError(403, result.error);
  return new NextResponse(null, { status: 204 });
}
