import type { Chapter } from "@/interface/project";

export interface ChapterTreeItem {
  chapter: Chapter;
  depth: number;
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

/** 设置 parentId 是否会产生环 */
export function wouldCreateChapterCycle(chapters: Chapter[], chapterId: string, parentId: string): boolean {
  if (parentId === chapterId) return true;
  let current: string | undefined = parentId;
  const visited = new Set<string>();
  while (current) {
    if (current === chapterId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = chapters.find(ch => ch.id === current)?.parentId;
  }
  return false;
}

/** 可作为父节点的候选列表（排除自身及子孙） */
export function getChapterParentOptions(chapters: Chapter[], chapterId: string): Chapter[] {
  const invalid = new Set([chapterId, ...getDescendantChapterIds(chapters, chapterId)]);
  return chapters.filter(ch => !invalid.has(ch.id)).sort((a, b) => a.startTime - b.startTime);
}
