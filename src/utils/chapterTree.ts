import type { Chapter } from "@/interface/project";

export interface ChapterTreeItem {
  chapter: Chapter;
  depth: number;
}

/** 顶层节点（无 parentId），按开始时间排序，用于时间轴与播放 */
export function getRootChapters(chapters: Chapter[]): Chapter[] {
  return chapters.filter(ch => !ch.parentId).sort((a, b) => a.startTime - b.startTime);
}

/** 将扁平节点列表按 parentId 展开为树形顺序（用于 UI 展示） */
export function flattenChapterTree(chapters: Chapter[], parentId?: string, depth = 0): ChapterTreeItem[] {
  const children = chapters
    .filter(ch => (ch.parentId || undefined) === parentId)
    .sort((a, b) => a.startTime - b.startTime);

  const result: ChapterTreeItem[] = [];
  for (const chapter of children) {
    result.push({ chapter, depth });
    result.push(...flattenChapterTree(chapters, chapter.id, depth + 1));
  }
  return result;
}

/** 获取某节点的所有子孙节点 ID */
export function getDescendantChapterIds(chapters: Chapter[], chapterId: string): string[] {
  const result: string[] = [];
  const children = chapters.filter(ch => ch.parentId === chapterId);
  for (const child of children) {
    result.push(child.id);
    result.push(...getDescendantChapterIds(chapters, child.id));
  }
  return result;
}
