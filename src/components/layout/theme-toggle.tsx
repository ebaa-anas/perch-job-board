"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

/**
 * Icons are swapped with CSS (`dark:` variants) rather than component state, so
 * the button is correct on the very first paint with no hydration mismatch.
 */
export function ThemeToggle() {
  const { toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle color theme"
      title="Toggle theme"
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  );
}
