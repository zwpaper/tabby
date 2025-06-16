import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconBrandBitbucket,
  IconBrandGithub,
  IconBrandGitlab,
} from "@tabler/icons-react";
import { Search, X } from "lucide-react";
import { useState } from "react";

// Mock repository data
const mockRepositories = [
  {
    id: "all",
    name: "All Repositories",
    icon: null,
  },
  {
    id: "ragdoll",
    name: "TabbyML/ragdoll",
    icon: IconBrandGithub,
    platform: "github",
  },
  {
    id: "tabby",
    name: "TabbyML/tabby",
    icon: IconBrandGithub,
    platform: "github",
  },
  {
    id: "pochi-website",
    name: "TabbyML/pochi-website",
    icon: IconBrandGithub,
    platform: "github",
  },
  {
    id: "example-gitlab",
    name: "company/project",
    icon: IconBrandGitlab,
    platform: "gitlab",
  },
  {
    id: "example-bitbucket",
    name: "team/repository",
    icon: IconBrandBitbucket,
    platform: "bitbucket",
  },
];

interface TaskFiltersProps {
  onRepositoryChange?: (repository: string) => void;
  onSearchChange?: (search: string) => void;
}

export function TaskFilters({
  onRepositoryChange,
  onSearchChange,
}: TaskFiltersProps) {
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const handleRepositoryChange = (value: string) => {
    setSelectedRepository(value);
    onRepositoryChange?.(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const clearSearch = () => {
    setSearchValue("");
    onSearchChange?.("");
  };

  const hasActiveFilters =
    selectedRepository !== "all" || searchValue.length > 0;

  const clearAllFilters = () => {
    setSelectedRepository("all");
    setSearchValue("");
    onRepositoryChange?.("all");
    onSearchChange?.("");
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search Filter */}
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pr-9 pl-9 sm:w-[280px]"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="-translate-y-1/2 absolute top-1/2 right-1 h-7 w-7 p-0 hover:bg-muted"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>

      {/* Repository Filter */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedRepository}
          onValueChange={handleRepositoryChange}
        >
          <SelectTrigger className="w-[200px] sm:w-[240px]">
            <SelectValue placeholder="Select repository" />
          </SelectTrigger>
          <SelectContent>
            {mockRepositories.map((repo) => (
              <SelectItem key={repo.id} value={repo.id}>
                <div className="flex items-center gap-2">
                  {repo.icon && <repo.icon className="h-4 w-4" />}
                  <span className="truncate">{repo.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="self-start sm:self-auto"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
