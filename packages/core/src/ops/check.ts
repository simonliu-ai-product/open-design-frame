import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as t from '@babel/types';
import { parseStrict, walk } from '../editing/babel-walk.ts';
import { readFileSummary } from '../editing/frame-ops.ts';
import type { OpsContext } from './context.ts';
import { frameFile, listFrames } from './frames.ts';

export type CheckRule =
  | 'syntax-error'
  | 'empty-export'
  | 'duplicate-frame-name'
  | 'invalid-size'
  | 'unresolved-link'
  | 'missing-asset'
  | 'unlabeled-layer';

export type CheckSeverity = 'error' | 'warn';

export type CheckFinding = {
  rule: CheckRule;
  severity: CheckSeverity;
  message: string;
  loc?: string;
};

export type FrameCheckReport = {
  id: string;
  file: string;
  title: string | null;
  frameCount: number;
  findings: CheckFinding[];
};

function locString(node: t.Node): string | undefined {
  return node.loc ? `${node.loc.start.line}:${node.loc.start.column}` : undefined;
}

function stringAttr(
  opening: t.JSXOpeningElement,
  attrName: string,
): { value: string; loc?: string } | null {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name, { name: attrName })) continue;
    const val = attr.value;
    if (t.isStringLiteral(val)) {
      const loc = locString(attr);
      return loc ? { value: val.value, loc } : { value: val.value };
    }
    if (t.isJSXExpressionContainer(val) && t.isStringLiteral(val.expression)) {
      const loc = locString(attr);
      return loc ? { value: val.expression.value, loc } : { value: val.expression.value };
    }
  }
  return null;
}

export function checkFrameSource(
  source: string,
  opts: { frameDir?: string } = {},
): { title: string | null; frameCount: number; findings: CheckFinding[] } {
  const findings: CheckFinding[] = [];
  const ast = parseStrict(source);
  if (!ast) {
    return {
      title: null,
      frameCount: 0,
      findings: [
        {
          rule: 'syntax-error',
          severity: 'error',
          message: 'Frame source has a syntax error and cannot be parsed.',
        },
      ],
    };
  }

  const summary = readFileSummary(source);
  if (summary.frames.length === 0) {
    findings.push({
      rule: 'empty-export',
      severity: 'error',
      message: 'Default export must be a non-empty array of frame components.',
    });
  }

  const seenNames = new Set<string>();
  for (const frame of summary.frames) {
    if (seenNames.has(frame.name)) {
      findings.push({
        rule: 'duplicate-frame-name',
        severity: 'error',
        message: `Duplicate frame name "${frame.name}" — prototype links need unique target names.`,
      });
    }
    seenNames.add(frame.name);
    if (frame.size && (frame.size.width <= 0 || frame.size.height <= 0)) {
      findings.push({
        rule: 'invalid-size',
        severity: 'error',
        message: `Frame "${frame.name}" has non-positive size ${frame.size.width}×${frame.size.height}.`,
      });
    }
  }

  // Check relative asset imports if frameDir is provided
  if (opts.frameDir) {
    for (const stmt of ast.program.body) {
      if (!t.isImportDeclaration(stmt)) continue;
      const spec = stmt.source.value;
      if (!spec.startsWith('.')) continue;
      if (/\.(png|jpe?g|gif|webp|svg|avif|mp4|webm|woff2?|ttf|otf)$/i.test(spec)) {
        const resolved = path.resolve(opts.frameDir, spec);
        if (!existsSync(resolved)) {
          const loc = locString(stmt);
          findings.push({
            rule: 'missing-asset',
            severity: 'error',
            message: `Imported asset does not exist on disk: ${spec}`,
            ...(loc ? { loc } : {}),
          });
        }
      }
    }
  }

  walk(ast.program.body, (node) => {
    if (!t.isJSXElement(node)) return;
    const opening = node.openingElement;
    if (!t.isJSXIdentifier(opening.name)) return;
    const tagName = opening.name.name;

    if (tagName === 'Layer') {
      const nameAttr = stringAttr(opening, 'name');
      if (!nameAttr || nameAttr.value.trim() === '') {
        const loc = locString(opening);
        findings.push({
          rule: 'unlabeled-layer',
          severity: 'warn',
          message: '<Layer> has no `name` attribute and will not appear clearly in the layer tree.',
          ...(loc ? { loc } : {}),
        });
      }
      const toAttr = stringAttr(opening, 'to');
      if (toAttr && summary.frames.length > 0 && !seenNames.has(toAttr.value)) {
        const loc = toAttr.loc ?? locString(opening);
        findings.push({
          rule: 'unresolved-link',
          severity: 'error',
          message: `<Layer to="${toAttr.value}"> points to a frame name that is not in this file (${[...seenNames].join(', ')}).`,
          ...(loc ? { loc } : {}),
        });
      }
    }

    if (tagName === 'img' && opts.frameDir) {
      const srcAttr = stringAttr(opening, 'src');
      if (srcAttr && (srcAttr.value.startsWith('./') || srcAttr.value.startsWith('../'))) {
        const resolved = path.resolve(opts.frameDir, srcAttr.value);
        if (!existsSync(resolved)) {
          const loc = srcAttr.loc ?? locString(opening);
          findings.push({
            rule: 'missing-asset',
            severity: 'error',
            message: `<img src="${srcAttr.value}"> does not exist on disk.`,
            ...(loc ? { loc } : {}),
          });
        }
      }
    }
  });

  return {
    title: summary.title,
    frameCount: summary.frames.length,
    findings,
  };
}

export async function checkFrame(ctx: OpsContext, frameId: string): Promise<FrameCheckReport> {
  const file = await frameFile(ctx, frameId);
  const source = await fs.readFile(file, 'utf8');
  const result = checkFrameSource(source, { frameDir: path.dirname(file) });
  return {
    id: frameId,
    file: path.relative(ctx.userCwd, file),
    title: result.title,
    frameCount: result.frameCount,
    findings: result.findings,
  };
}

export async function checkFrames(
  ctx: OpsContext,
  ids?: string[],
): Promise<{ ok: boolean; reports: FrameCheckReport[] }> {
  const targets = ids && ids.length > 0 ? ids : (await listFrames(ctx)).map((entry) => entry.id);
  const reports: FrameCheckReport[] = [];
  for (const id of targets) {
    reports.push(await checkFrame(ctx, id));
  }
  const hasErrors = reports.some((r) => r.findings.some((f) => f.severity === 'error'));
  return { ok: !hasErrors, reports };
}
