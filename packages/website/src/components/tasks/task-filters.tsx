import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useEffect, useReducer } from "react";
import { BranchFilter } from "./branch-filter";
import { RepositoryFilter } from "./repository-filter";
import type { FilterValues } from "./types";

export interface Repository {
  id: string;
  name: string;
  platform?: string;
}

export interface Branch {
  name: string;
}

interface TaskFiltersProps {
  repositories: Repository[];
  branches: Branch[];
  onFilterChange: (filters: FilterValues) => void;
  initialValues?: FilterValues;
}

type FilterState = FilterValues;

type FilterAction =
  | { type: "SET_REPOSITORY"; payload?: string }
  | { type: "SET_BRANCH"; payload?: string }
  | { type: "SET_SEARCH"; payload: string | undefined }
  | { type: "CLEAR_ALL" };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_REPOSITORY":
      return { ...state, repository: action.payload, branch: undefined };
    case "SET_BRANCH":
      return { ...state, branch: action.payload };
    case "SET_SEARCH":
      return { ...state, q: action.payload };
    case "CLEAR_ALL":
      return { repository: undefined, branch: undefined, q: undefined };
    default:
      return state;
  }
}

export function TaskFilters({
  repositories,
  branches,
  onFilterChange,
  initialValues = {},
}: TaskFiltersProps) {
  const [filters, dispatch] = useReducer(filterReducer, {
    repository: initialValues.repository,
    branch: initialValues.branch,
    q: initialValues.q ?? "",
  });

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const handleRepositoryChange = (value?: string) => {
    dispatch({ type: "SET_REPOSITORY", payload: value });
  };

  const handleBranchChange = (value?: string) => {
    dispatch({ type: "SET_BRANCH", payload: value });
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "SET_SEARCH", payload: e.target.value });
  };

  const clearSearch = () => {
    dispatch({ type: "SET_SEARCH", payload: undefined });
  };

  const hasActiveFilters =
    !!filters.repository || !!filters.branch || !!filters.q;

  const clearAllFilters = () => {
    dispatch({ type: "CLEAR_ALL" });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-[240px]">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.q ?? ""}
          onChange={handleSearchInputChange}
          className="w-full pr-9 pl-9"
        />
        {filters.q && (
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
      <RepositoryFilter
        repositories={repositories}
        selectedRepository={filters.repository}
        onRepositoryChange={handleRepositoryChange}
      />
      {filters.repository && (
        <BranchFilter
          branches={branches}
          selectedBranch={filters.branch}
          onBranchChange={handleBranchChange}
        />
      )}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="h-9 self-start sm:self-auto"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
