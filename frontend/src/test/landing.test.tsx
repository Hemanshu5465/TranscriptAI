import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("renders the headline, the composer and every feature", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Turn any video\s*into a script/);
    expect(screen.getByLabelText(/youtube video url/i)).toBeInTheDocument();
    expect(screen.getByText("Timestamped segments")).toBeInTheDocument();
    expect(screen.getByText("Word-for-word, never a summary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start transcribing/i })).toBeInTheDocument();
  });

  it("keeps the decorative hero board out of the accessibility tree", () => {
    const { container } = renderLanding();
    // The split-flap board is decoration — screen readers get the headline + features.
    expect(container.querySelector('.split-flap[aria-hidden="true"]')).not.toBeNull();
  });
});
