import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /**
   * When "destructive", the confirm button uses the destructive variant. This
   * is the default for delete flows.
   */
  tone?: "default" | "destructive"
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

const ConfirmContext = React.createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false)

/**
 * Provider that renders a single shared AlertDialog and exposes `useConfirm()`.
 * The underlying Radix Dialog provides focus-trapping, ESC-to-close, and
 * restoration of focus to the trigger element — replacing native
 * `window.confirm` which is synchronous and bypasses the event loop.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: "",
  })

  const confirm = React.useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, open: true, resolve })
      }),
    [],
  )

  const handleDone = React.useCallback(
    (value: boolean) => {
      state.resolve?.(value)
      setState((s) => ({ ...s, open: false, resolve: undefined }))
    },
    [state],
  )

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) handleDone(false)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{state.title}</DialogTitle>
            {state.description && (
              <DialogDescription className="whitespace-pre-line">
                {state.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleDone(false)} autoFocus>
              {state.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={state.tone === "destructive" ? "destructive" : "default"}
              onClick={() => handleDone(true)}
            >
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  return React.useContext(ConfirmContext)
}
