import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom"
import { useDebouncedSearchParam } from "../useDebouncedSearchParam"

function Harness() {
  const { input, setInput, value, maxLength } = useDebouncedSearchParam()
  const location = useLocation()
  return (
    <>
      <input
        data-testid="input"
        value={input}
        maxLength={maxLength}
        onChange={(e) => setInput(e.target.value.slice(0, maxLength))}
      />
      <span data-testid="value">{value}</span>
      <span data-testid="search">{location.search}</span>
    </>
  )
}

function Navigator() {
  const nav = useNavigate()
  return (
    <>
      <button onClick={() => nav("/?q=external")}>go-external</button>
      <button onClick={() => nav(-1)}>back</button>
    </>
  )
}

describe("useDebouncedSearchParam", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("debounces typing into the URL", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByTestId("input")

    act(() => { fireEvent.change(input, { target: { value: "he" } }) })
    act(() => { vi.advanceTimersByTime(100) })
    expect(screen.getByTestId("search").textContent).toBe("")

    act(() => { fireEvent.change(input, { target: { value: "hello" } }) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId("search").textContent).toBe("?q=hello")
  })

  it("resets input when URL changes externally (back-button scenario)", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Harness />
                <Navigator />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByTestId("input") as HTMLInputElement
    act(() => { fireEvent.change(input, { target: { value: "typed" } }) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId("search").textContent).toBe("?q=typed")

    act(() => { screen.getByText("go-external").click() })
    expect(screen.getByTestId("search").textContent).toBe("?q=external")
    expect(input.value).toBe("external")

    act(() => { screen.getByText("back").click() })
    expect(screen.getByTestId("search").textContent).toBe("?q=typed")
    expect(input.value).toBe("typed")

    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.getByTestId("search").textContent).toBe("?q=typed")
  })

  it("clears the URL param when the input goes empty", () => {
    render(
      <MemoryRouter initialEntries={["/?q=start"]}>
        <Routes>
          <Route path="/" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    )

    const input = screen.getByTestId("input") as HTMLInputElement
    expect(input.value).toBe("start")

    act(() => { fireEvent.change(input, { target: { value: "" } }) })
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId("search").textContent).toBe("")
  })

  it("caps URL value at maxLength", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    )

    const long = "x".repeat(200)
    const input = screen.getByTestId("input")
    act(() => { fireEvent.change(input, { target: { value: long } }) })
    act(() => { vi.advanceTimersByTime(300) })

    const search = screen.getByTestId("search").textContent ?? ""
    const paramValue = new URLSearchParams(search).get("q") ?? ""
    expect(paramValue.length).toBe(100)
  })
})
