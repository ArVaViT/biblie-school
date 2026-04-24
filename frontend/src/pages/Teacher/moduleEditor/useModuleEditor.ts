import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DropResult } from "@hello-pangea/dnd";

import { coursesService } from "@/services/courses";
import { getErrorDetail } from "@/lib/errorDetail";
import { toast } from "@/lib/toast";
import { chapterSchema, moduleSchema } from "@/lib/validations/course";
import type { Chapter, Module } from "@/types";
import type { useConfirm } from "@/components/ui/alert-dialog";

type ConfirmFn = ReturnType<typeof useConfirm>;

/**
 * Encapsulates everything behind the Module editor page: loading the
 * module, inline edits on its title / description / due date, chapter
 * CRUD, lock toggling, and drag-reorder with optimistic local state.
 *
 * Split out so the component file is purely about layout — a good
 * reference point for the CourseEditor pattern established earlier.
 */
export function useModuleEditor(
  courseId: string | undefined,
  moduleId: string | undefined,
  confirm: ConfirmFn,
) {
  const navigate = useNavigate();

  const [mod, setMod] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [modDueDate, setModDueDate] = useState("");
  const [reordering, setReordering] = useState(false);

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!courseId || !moduleId) return;
      setLoading(true);
      try {
        const data = await coursesService.getModule(courseId, moduleId);
        if (signal?.cancelled) return;
        setMod(data);
        setModDueDate(data.due_date ? data.due_date.slice(0, 16) : "");
      } catch {
        if (signal?.cancelled) return;
        toast({ title: "Module not found", variant: "destructive" });
        navigate(`/teacher/courses/${courseId}`);
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [courseId, moduleId, navigate],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const saveModuleField = async (field: "title" | "description", value: string) => {
    if (!courseId || !moduleId) return;
    const check = moduleSchema
      .pick({ title: true, description: true })
      .partial()
      .safeParse({ [field]: value });
    if (!check.success) {
      toast({
        title: check.error.issues[0]?.message ?? `Invalid ${field}`,
        variant: "destructive",
      });
      throw new Error("validation");
    }
    try {
      await coursesService.updateModule(courseId, moduleId, { [field]: value });
      setMod((prev) => (prev ? { ...prev, [field]: value } : prev));
    } catch {
      toast({ title: "Failed to save module", variant: "destructive" });
      throw new Error("save failed");
    }
  };

  const saveDueDate = async (value: string) => {
    if (!courseId || !moduleId) return;
    try {
      const due = value ? new Date(value).toISOString() : null;
      await coursesService.updateModule(courseId, moduleId, { due_date: due });
      setMod((prev) => (prev ? { ...prev, due_date: due } : prev));
    } catch {
      toast({ title: "Failed to save due date", variant: "destructive" });
    }
  };

  const clearDueDate = () => {
    setModDueDate("");
    void saveDueDate("");
  };

  const addChapter = async () => {
    if (!courseId || !moduleId || !mod) return;
    const order = mod.chapters?.length ?? 0;
    try {
      const ch = await coursesService.createChapter(courseId, moduleId, {
        title: `Chapter ${order + 1}`,
        order_index: order,
      });
      setMod((prev) =>
        prev ? { ...prev, chapters: [...(prev.chapters ?? []), ch] } : prev,
      );
      toast({ title: "Chapter added", variant: "success" });
      navigate(
        `/teacher/courses/${courseId}/modules/${moduleId}/chapters/${ch.id}/edit`,
      );
    } catch {
      toast({ title: "Failed to add chapter", variant: "destructive" });
    }
  };

  const updateChapterLocal = (chapterId: string, patch: Partial<Chapter>) => {
    setMod((prev) =>
      prev
        ? {
            ...prev,
            chapters: prev.chapters?.map((c) =>
              c.id === chapterId ? { ...c, ...patch } : c,
            ),
          }
        : prev,
    );
  };

  const renameChapter = async (ch: Chapter, newTitle: string) => {
    if (!courseId || !moduleId || !newTitle.trim()) return;
    const trimmed = newTitle.trim();
    const check = chapterSchema.pick({ title: true }).safeParse({ title: trimmed });
    if (!check.success) {
      toast({
        title: check.error.issues[0]?.message ?? "Invalid chapter title",
        variant: "destructive",
      });
      return;
    }
    const previousTitle = ch.title;
    updateChapterLocal(ch.id, { title: trimmed });
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        title: trimmed,
      });
    } catch {
      updateChapterLocal(ch.id, { title: previousTitle });
      toast({ title: "Failed to rename chapter", variant: "destructive" });
    }
  };

  const deleteChapter = async (chId: string) => {
    if (!courseId || !moduleId) return;
    const ok = await confirm({
      title: "Delete this chapter?",
      description: "The chapter and its content will be removed.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    try {
      await coursesService.deleteChapter(courseId, moduleId, chId);
      setMod((prev) =>
        prev
          ? { ...prev, chapters: prev.chapters?.filter((c) => c.id !== chId) }
          : prev,
      );
      toast({ title: "Chapter deleted", variant: "success" });
    } catch {
      toast({ title: "Failed to delete chapter", variant: "destructive" });
    }
  };

  const toggleLock = async (ch: Chapter) => {
    if (!courseId || !moduleId) return;
    const newLocked = !ch.is_locked;
    updateChapterLocal(ch.id, { is_locked: newLocked });
    try {
      await coursesService.updateChapter(courseId, moduleId, ch.id, {
        is_locked: newLocked,
      });
      toast({
        title: newLocked ? "Chapter locked" : "Chapter unlocked",
        variant: "success",
      });
    } catch (error: unknown) {
      updateChapterLocal(ch.id, { is_locked: ch.is_locked });
      const detail = getErrorDetail(error) || "Unknown error";
      toast({
        title: `Failed to toggle lock: ${detail}`,
        variant: "destructive",
      });
    }
  };

  const handleChapterDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination || !courseId || !moduleId || reordering) return;
      const from = result.source.index;
      const to = result.destination.index;
      if (from === to) return;

      const sorted = [...(mod?.chapters ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      );
      const reordered = Array.from(sorted);
      const [moved] = reordered.splice(from, 1);
      if (!moved) return;
      reordered.splice(to, 0, moved);

      setMod((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: reordered.map((c, i) => ({ ...c, order_index: i })),
        };
      });

      setReordering(true);
      try {
        await Promise.all(
          reordered
            .map((c, i) =>
              c.order_index !== i
                ? coursesService.updateChapter(courseId, moduleId, c.id, {
                    order_index: i,
                  })
                : null,
            )
            .filter(Boolean),
        );
      } catch {
        toast({ title: "Failed to save chapter order", variant: "destructive" });
        load();
      } finally {
        setReordering(false);
      }
    },
    [mod, courseId, moduleId, load, reordering],
  );

  return {
    mod,
    loading,
    modDueDate,
    setModDueDate,
    saveModuleField,
    saveDueDate,
    clearDueDate,
    addChapter,
    renameChapter,
    deleteChapter,
    toggleLock,
    updateChapterLocal,
    handleChapterDragEnd,
  };
}
