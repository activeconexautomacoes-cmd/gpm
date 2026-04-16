import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        // Determine the next theme based on current theme
        // If it's system, we check the matches
        let nextTheme: "light" | "dark";

        if (theme === "system") {
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            nextTheme = isDark ? "light" : "dark";
        } else {
            nextTheme = theme === "dark" ? "light" : "dark";
        }

        setTheme(nextTheme);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full w-9 h-9 hover:bg-accent/50"
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Alternar tema</span>
        </Button>
    );
}
