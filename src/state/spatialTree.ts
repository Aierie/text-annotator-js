import RBush from 'rbush';
import type { Store } from '@annotorious/core';
import type { TextAnnotation, TextAnnotationTarget } from '../model';

interface IndexedHighlightRect {

  minX: number;

  minY: number;

  maxX: number;

  maxY: number;

  annotationId: string;

}

export const createSpatialTree = (store: Store<TextAnnotation>, container: HTMLElement) => {

  const tree = new RBush<IndexedHighlightRect>();

  // Helper: converts a single text annotation target to a list of hightlight rects
  const toItems = (target: TextAnnotationTarget): IndexedHighlightRect[] => {
    const offset = container.getBoundingClientRect();

    const rects = Array.from(target.selector.range.getClientRects());

    return rects.map(rect => {
      const { x, y, width, height } = rect;

      return {
        minX: x - offset.x,
        minY: y - offset.y,
        maxX: x - offset.x + width,
        maxY: y - offset.y + height,
        annotationId: target.annotation
      }
    });
  }

  const all = () => tree.all().map(item => item.annotationId);

  const clear = () => tree.clear();

  const insert = (target: TextAnnotationTarget) => {
    const rects = toItems(target);
    rects.forEach(rect => tree.insert(rect));
  }

  const remove = (target: TextAnnotationTarget) => {
    const rects = toItems(target);
    rects.forEach(rect => tree.remove(rect, (a, b) => a.annotationId === b.annotationId));
  }

  const update = (previous: TextAnnotationTarget, updated: TextAnnotationTarget) => {
    remove(previous);
    insert(updated);
  }

  const set = (targets: TextAnnotationTarget[], replace: boolean = true) => {
    if (replace) tree.clear();

    const rects = targets.reduce((all, target) => [...all, ...toItems(target)], []);
    tree.load(rects);
  }

  const getAt = (x: number, y: number): string | undefined => {
    const hits = tree.search({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y
    });

    const area = (rect: IndexedHighlightRect) => 
      (rect.maxX - rect.minX) * (rect.maxY - rect.minY);

    // Get smallest rect
    if (hits.length > 0) {
      hits.sort((a, b) => area(a) - area(b));
      return hits[0].annotationId;
    }
  }

  const getIntersecting = (minX: number, minY: number, maxX: number, maxY: number): string[] => {
    const hits = tree.search({ minX, minY, maxX, maxY });
    return Array.from(new Set(hits.map(item => item.annotationId)));
  }

  const size = () => tree.all().length;

  const recalculate = () => set(store.all().map(a => a.target), true);

  return {
    all,
    clear,
    getAt,
    getIntersecting,
    insert,
    recalculate,
    remove,
    set,
    size,
    update
  }

}