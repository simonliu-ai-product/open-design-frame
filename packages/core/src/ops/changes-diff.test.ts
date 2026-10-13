import { describe, expect, it } from 'vitest';
import {
  parseUnifiedDiff,
  placeHunks,
  revertHunkIn,
  withoutReviewMarkers,
} from './changes-diff.ts';

const DIFF = `diff --git a/frames/welcome/index.tsx b/frames/welcome/index.tsx
--- a/frames/welcome/index.tsx
+++ b/frames/welcome/index.tsx
@@ -4,1 +4,1 @@
-    <Layer name="Headline" style={{ fontSize: 48 }}>Old</Layer>
+    <Layer name="Headline" style={{ fontSize: 64 }}>New</Layer>
@@ -5,0 +6,1 @@
+    <p>Added subtitle</p>
`;

const CURRENT_SOURCE = `const Welcome = () => (
  <Layer name="Hero">
    <span>Eyebrow</span>
    <Layer name="Headline" style={{ fontSize: 64 }}>New</Layer>
    <div>Body</div>
    <p>Added subtitle</p>
  </Layer>
);
`;

describe('changes-diff', () => {
  it('parses unified diff and places hunks onto tagged elements', () => {
    const files = parseUnifiedDiff(DIFF, 'frames/welcome/');
    expect(files).toHaveLength(1);
    const file = files[0];
    expect(file?.path).toBe('index.tsx');
    expect(file?.hunks).toHaveLength(2);
    if (!file) return;

    placeHunks(CURRENT_SOURCE, file.hunks);
    expect(file.hunks[0]?.targets).toEqual([{ loc: '4:4', mark: 'changed' }]);
    expect(file.hunks[1]?.targets).toEqual([{ loc: '6:4', mark: 'added' }]);
  });

  it('drops hunks that only add or remove @frame-comment markers', () => {
    const commentDiff = `diff --git a/frames/welcome/index.tsx b/frames/welcome/index.tsx
--- a/frames/welcome/index.tsx
+++ b/frames/welcome/index.tsx
@@ -3,0 +4,1 @@
+    {/* @frame-comment id="c-12345678" ts="2026-10-13" text="eyJub3RlIjoiaGkifQ" */}
`;
    const files = withoutReviewMarkers(parseUnifiedDiff(commentDiff, 'frames/welcome/'));
    expect(files).toHaveLength(0);
  });

  it('reverts a hunk cleanly and refuses when lines moved', () => {
    const files = parseUnifiedDiff(DIFF, 'frames/welcome/');
    const hunk = files[0]?.hunks[0];
    expect(hunk).toBeDefined();
    if (!hunk) return;

    const reverted = revertHunkIn(CURRENT_SOURCE, hunk);
    expect(reverted).toContain('<Layer name="Headline" style={{ fontSize: 48 }}>Old</Layer>');
    expect(revertHunkIn('changed underneath\n', hunk)).toBeNull();
  });
});
