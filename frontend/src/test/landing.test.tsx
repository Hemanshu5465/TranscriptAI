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
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn any video into a script");
    expect(screen.getByLabelText(/youtube video url/i)).toBeInTheDocument();
    expect(screen.getByText("Timestamped segments")).toBeInTheDocument();
    expect(screen.getByText("Word-for-word, never a summary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start transcribing/i })).toBeInTheDocument();
  });

  it("keeps the transcript demo out of the accessibility tree", () => {
    const { container } = renderLanding();
    // The looping demo card is decorative — screen readers get the feature list instead.
    expect(container.querySelector('[aria-hidden="true"].paper-grain')).not.toBeNull();
  });
});
