import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion/accordion";
import { Switch } from "./switch/switch";
import { Checkbox } from "./checkbox/checkbox";
import { RadioGroup, RadioGroupItem } from "./radio-group/radio-group";
import { Slider } from "./slider/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible/collapsible";
import { Textarea } from "./textarea/textarea";
import { Progress } from "./progress/progress";
import { Alert, AlertDescription, AlertTitle } from "./alert/alert";

describe("ui-kit primitives", () => {
  it("renders an accordion", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Section</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText("Section")).toBeInTheDocument();
  });

  it("renders a switch and checkbox", () => {
    render(
      <div>
        <Switch aria-label="toggle" />
        <Checkbox aria-label="check" />
      </div>,
    );
    expect(screen.getByLabelText("toggle")).toBeInTheDocument();
    expect(screen.getByLabelText("check")).toBeInTheDocument();
  });

  it("renders a radio group", () => {
    render(
      <RadioGroup defaultValue="1">
        <RadioGroupItem value="1" aria-label="one" />
        <RadioGroupItem value="2" aria-label="two" />
      </RadioGroup>,
    );
    expect(screen.getByLabelText("one")).toBeInTheDocument();
  });

  it("renders a slider", () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders a collapsible", () => {
    render(
      <Collapsible open>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Content</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByText("Toggle")).toBeInTheDocument();
  });

  it("renders a textarea", () => {
    render(<Textarea placeholder="notes" />);
    expect(screen.getByPlaceholderText("notes")).toBeInTheDocument();
  });

  it("renders a progress bar", () => {
    const { container } = render(<Progress value={40} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders an alert", () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Something happened</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });
});
