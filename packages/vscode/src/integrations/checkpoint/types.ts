export type GitDiff = {
  // Relative filepath to cwd
  filepath: string;
  before: string;
  after: string;
};
