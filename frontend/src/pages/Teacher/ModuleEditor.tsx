import { useParams, useNavigate } from "react-router-dom";
import { CalendarDays, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, InlineEdit, PageHeader } from "@/components/patterns";

import { ChapterList } from "./moduleEditor/ChapterList";
import { ModuleEditorSkeleton } from "./moduleEditor/LoadingSkeleton";
import { useModuleEditor } from "./moduleEditor/useModuleEditor";

export default function ModuleEditor() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const {
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
  } = useModuleEditor(courseId, moduleId, confirm);

  if (loading) {
    return <ModuleEditorSkeleton />;
  }

  if (!mod) {
    return (
      <div className="container mx-auto px-4">
        <ErrorState
          title="Module not found"
          description="The module may have been deleted or you may not have access."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/teacher/courses/${courseId}`)}
            >
              Back to course
            </Button>
          }
        />
      </div>
    );
  }

  const chapters = [...(mod.chapters ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        backTo={`/teacher/courses/${courseId}`}
        backLabel="Back to course"
        title={
          <InlineEdit
            size="h1"
            value={mod.title}
            onSave={(v) => saveModuleField("title", v)}
            required
            placeholder="Untitled module"
            ariaLabel="Edit module title"
            maxLength={200}
          />
        }
        description={
          <InlineEdit
            size="body"
            multiline
            value={mod.description ?? ""}
            onSave={(v) => saveModuleField("description", v)}
            placeholder="Add a module description"
            ariaLabel="Edit module description"
            maxLength={2000}
          />
        }
        meta={
          <>
            <Badge variant="muted">
              {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
            </Badge>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground">Due date</Label>
              <Input
                type="datetime-local"
                value={modDueDate}
                onChange={(e) => setModDueDate(e.target.value)}
                onBlur={(e) => saveDueDate(e.target.value)}
                className="text-xs h-7 w-auto border-border/50"
              />
              {modDueDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={clearDueDate}
                >
                  Clear
                </Button>
              )}
            </div>
          </>
        }
      />

      {chapters.length === 0 ? (
        <EmptyState
          icon={<Pencil />}
          title="No chapters yet"
          description="Add your first chapter to start building this module."
          action={
            <Button onClick={addChapter} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add chapter
            </Button>
          }
          className="mb-6"
        />
      ) : (
        <ChapterList
          chapters={chapters}
          onDragEnd={handleChapterDragEnd}
          onTitleChange={(id, title) => updateChapterLocal(id, { title })}
          onRename={renameChapter}
          onToggleLock={toggleLock}
          onEdit={(chId) =>
            navigate(
              `/teacher/courses/${courseId}/modules/${moduleId}/chapters/${chId}/edit`,
            )
          }
          onDelete={deleteChapter}
        />
      )}

      <Button variant="outline" className="w-full border-dashed h-12" onClick={addChapter}>
        <Plus className="h-4 w-4 mr-2" />
        Add Chapter
      </Button>
    </div>
  );
}
