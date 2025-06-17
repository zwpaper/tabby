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
import { FolderGitIcon, Search, X } from "lucide-react";
import { useState } from "react";

export interface Repository {
  id: string;
  name: string;
  platform?: string;
}

interface TaskFiltersProps {
  repositories: Repository[];
  onRepositoryChange: (repository: string) => void;
  onSearchChange: (search: string) => void;
  initialRepository?: string;
  initialSearch?: string;
}

const iconMap = {
  github: IconBrandGithub,
  gitlab: IconBrandGitlab,
  bitbucket: IconBrandBitbucket,
  git: FolderGitIcon,
};

export function TaskFilters({
  repositories,
  onRepositoryChange,
  onSearchChange,
  initialRepository = "all",
  initialSearch = "",
}: TaskFiltersProps) {
  const [selectedRepository, setSelectedRepository] =
    useState(initialRepository);
  const [searchValue, setSearchValue] = useState(initialSearch);

  const handleRepositoryChange = (value: string) => {
    setSelectedRepository(value);
    onRepositoryChange(value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchChange(searchValue);
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value === "") {
      onSearchChange("");
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    onSearchChange("");
  };

  const hasActiveFilters =
    selectedRepository !== "all" || searchValue.length > 0;

  const clearAllFilters = () => {
    setSelectedRepository("all");
    setSearchValue("");
    onRepositoryChange("all");
    onSearchChange("");
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
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
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
            {repositories.map((repo) => {
              const Icon = repo.platform
                ? iconMap[repo.platform as keyof typeof iconMap]
                : null;
              return (
                <SelectItem key={repo.id} value={repo.id}>
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    <span className="truncate">{repo.name}</span>
                  </div>
                </SelectItem>
              );
            })}
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
