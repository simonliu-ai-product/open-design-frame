import { Children, Component, isValidElement, type ReactNode } from 'react';
import { useT } from '../lib/i18n.tsx';

export const FRAME_ERROR_ATTR = 'data-odf-frame-error';

type State = { error: Error | null; from: unknown };

/** The component a frame's children start with: it changes when the module reloads. */
function frameType(children: ReactNode): unknown {
  const first = Children.toArray(children)[0];
  return isValidElement(first) ? first.type : null;
}

class Boundary extends Component<
  { children: ReactNode; fallback: (error: Error) => ReactNode },
  State
> {
  state: State = { error: null, from: frameType(this.props.children) };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  // An edit reloads the module and hands in a new component: try again with it.
  static getDerivedStateFromProps(
    props: { children: ReactNode },
    state: State,
  ): Partial<State> | null {
    const from = frameType(props.children);
    return from === state.from ? null : { error: null, from };
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/**
 * Keeps a frame that throws on its own artboard. Without it a render error
 * unmounts the whole viewer — rail, canvas, inspector — and a save half-way
 * through an edit leaves a blank window that no later save brings back.
 */
export function FrameBoundary({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <Boundary
      fallback={(error) => (
        <div className="odf-frame-error" role="alert" {...{ [FRAME_ERROR_ATTR]: error.message }}>
          <strong className="odf-frame-error-title">{t('frame.renderError')}</strong>
          <code className="odf-frame-error-message">{error.message}</code>
          <span className="odf-frame-error-hint">{t('frame.renderErrorHint')}</span>
        </div>
      )}
    >
      {children}
    </Boundary>
  );
}
