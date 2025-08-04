/**
 * Known XML tags that should be preserved during processing
 */
export const KnownTags = ["file", "workflow"] as const;

const SandboxHome = "/home/pochi";
const SandboxLogDir = `${SandboxHome}/.log`;
const RemotePochiHome = `${SandboxHome}/.remote-pochi`;

export const SandboxPath = {
  home: SandboxHome,
  project: `${SandboxHome}/project`,
  init: `${RemotePochiHome}/init.sh`,
  initLog: `${SandboxLogDir}/init.log`,
  runnerLog: `${SandboxLogDir}/runner.log`,
};

export const CompactTaskMinTokens = 50_000;
