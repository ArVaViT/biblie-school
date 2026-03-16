import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider } from '../ThemeContext'
import { useTheme } from '../useTheme'

function ThemeDisplay() {
  const { theme, toggleTheme } = useTheme()
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </>
  )
}

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }),
})

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    document.documentElement.classList.remove('dark')
  })

  it('defaults to light when no stored preference', () => {
    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('toggles from light to dark and back', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme').textContent).toBe('light')

    await user.click(screen.getByRole('button', { name: /toggle/i }))
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await user.click(screen.getByRole('button', { name: /toggle/i }))
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme choice to localStorage', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: /toggle/i }))
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark')
  })

  it('restores stored theme from localStorage', () => {
    localStorageMock.getItem.mockReturnValueOnce('dark')

    render(
      <ThemeProvider>
        <ThemeDisplay />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('throws when useTheme is called outside ThemeProvider', () => {
    expect(() => render(<ThemeDisplay />)).toThrow(
      'useTheme must be used within ThemeProvider',
    )
  })
})
