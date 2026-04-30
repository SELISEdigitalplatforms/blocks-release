import useLanguage from "@/hooks/use-language-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui-kits/dropdown-menu/dropdown-menu";
import { ChevronDown } from "lucide-react";

const languages = [
  { key: "en", title: "English" },
  { key: "de", title: "German" },
  { key: "fr", title: "French" },
];

export function LanguageSelector() {
  const { changeLanguage, language } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex cursor-pointer items-center gap-1">
          <span className="text-sm font-medium uppercase">{language}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang, i) => (
          <div key={lang.key}>
            <DropdownMenuItem
              className={`${lang.key === language ? "font-bold" : "cursor-pointer"}`}
              onClick={() => {
                changeLanguage(lang.key);
              }}
              disabled={lang.key !== "en"}
            >
              {lang.title}
            </DropdownMenuItem>
            {i !== languages.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
