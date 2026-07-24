import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command/command";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form/form";
import { Input } from "./input/input";

describe("Drawer", () => {
  it("renders drawer content when open", () => {
    render(
      <Drawer open>
        <DrawerTrigger>open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
            <DrawerDescription>Desc</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
  });
});

describe("Sheet", () => {
  it("renders sheet content when open", () => {
    render(
      <Sheet open>
        <SheetTrigger>open</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet Desc</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("renders a closed select trigger", () => {
    render(
      <Select>
        <SelectTrigger aria-label="pick">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });
});

describe("Command", () => {
  it("renders a command palette with items", () => {
    render(
      <Command>
        <CommandInput placeholder="search" />
        <CommandList>
          <CommandEmpty>none</CommandEmpty>
          <CommandGroup heading="Group">
            <CommandItem>Item one</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    expect(screen.getByPlaceholderText("search")).toBeInTheDocument();
    expect(screen.getByText("Item one")).toBeInTheDocument();
  });
});

const FormHarness = () => {
  const form = useForm({ defaultValues: { name: "" } });
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="name" />
              </FormControl>
              <FormDescription>Your name</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};

describe("Form", () => {
  it("renders a form field with label and description", () => {
    render(<FormHarness />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("name")).toBeInTheDocument();
  });
});
