import type { Meta, StoryObj } from "@storybook/react";

import { ToolInvocationPart } from "@/components/tool-invocation";
import type {
  ToolInvocation,
  ToolProps,
} from "@/components/tool-invocation/types";
import type { ClientToolsType } from "@ragdoll/tools";

const ToolsGallery: React.FC<{
  tools: ToolInvocation<unknown, unknown>[];
}> = ({ tools = [] }) => {
  return (
    <div className="mt-3 ml-1 flex flex-col gap-2">
      {tools.map((tool, index) => (
        <ToolInvocationPart
          key={tool.toolCallId + index}
          tool={tool}
          sendMessage={() => Promise.resolve(undefined)}
          isLoading={false}
        />
      ))}
    </div>
  );
};

const meta: Meta<typeof ToolsGallery> = {
  title: "Pochi/Tools",
  component: ToolsGallery,
};

export default meta;

type Story = StoryObj<typeof ToolsGallery>;
type SearchFilesProp = ToolProps<ClientToolsType["searchFiles"]>;
type ReadFileProp = ToolProps<ClientToolsType["readFile"]>;
type ExecuteCommandProp = ToolProps<ClientToolsType["executeCommand"]>;
type ListFilesProp = ToolProps<ClientToolsType["listFiles"]>;
type GlobFilesProp = ToolProps<ClientToolsType["globFiles"]>;
type WriteToFileProp = ToolProps<ClientToolsType["writeToFile"]>;
type AskFollowupQuestionProp = ToolProps<
  ClientToolsType["askFollowupQuestion"]
>;
type AttemptCompletionProp = ToolProps<ClientToolsType["attemptCompletion"]>;

// FIXME(Meng): adding a type helper for ServerToolsType
type WebFetchProp = ToolProps<{
  parameters: {
    properties: {
      url: { type: "string" };
    };
    required: ["url"];
  };
}>;

const searchProps: SearchFilesProp["tool"] = {
  args: {
    path: ".",
    regex: "index",
  },
  step: 0,
  state: "result",
  result: {
    matches: [
      {
        file: "src/nginx/Dockerfile",
        line: 11,
        context: "COPY index.html .",
      },
      {
        file: "readme.md",
        line: 17,
        context: "        index index.html;",
      },
      {
        file: "readme.md",
        line: 51,
        context: "        index index.html;",
      },
      {
        file: "src/nginx/nginx.conf",
        line: 46,
        context: "        index index.html;",
      },
    ],
    isTruncated: false,
  },
  toolName: "searchFiles",
  toolCallId: "toolu_vrtx_01Dr9irXJzSunZhGToswg4Qu",
};

const searchProps2: SearchFilesProp["tool"] = {
  args: {
    path: ".",
    regex: "open",
  },
  step: 0,
  state: "result",
  result: {
    error: "stdout maxBuffer length exceeded",
  },
  toolName: "searchFiles",
  toolCallId: "LoYtGQXrR9xcOaOU",
};

const readProps: ReadFileProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "94sT2bTZIbHFwz7I",
  toolName: "readFile",
  args: {
    path: "README.md",
  },
  result: {
    content: " **04/17/2024** CodeGemma and CodeQwen mode",
    isTruncated: true,
  },
};

const executeCommandProps: ExecuteCommandProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_exec_cmd_1",
  toolName: "executeCommand",
  args: {
    command: "npm run dev --port 3001",
    cwd: "/Users/annoy/github.com/TabbyML/ragdoll/packages/website",
    isDevServer: true,
  },
  result: {
    output: "Development server started on port 3001",
  },
};

const listFilesProps: ListFilesProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_list_files_1",
  toolName: "listFiles",
  args: {
    path: "src/components",
    recursive: false,
  },
  result: {
    files: ["Button.tsx", "Card.tsx", "Input.tsx"],
    isTruncated: false,
  },
};

const globFilesProps: GlobFilesProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_glob_files_1",
  toolName: "globFiles",
  args: {
    globPattern: "*.stories.tsx",
    path: "src/stories",
  },
  result: {
    files: ["Button.stories.tsx", "ToolGallery.stories.tsx"],
    isTruncated: false,
  },
};

const writeToFileProps: WriteToFileProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_write_file_1",
  toolName: "writeToFile",
  args: {
    path: "src/components/NewFeature.tsx",
    content: "export const NewFeature = () => <p>Amazing new feature!</p>;",
  },
  result: {
    success: true,
  },
};

const writeToFileProps2: WriteToFileProp["tool"] = {
  args: {
    path: "clients/vscode/src/inline-edit/quickPick.ts",
    content: "",
  },
  step: 0,
  state: "result",
  result: {
    success: true,
    newProblems:
      "clients/vscode/src/inline-edit/quickPick.ts\n- [ts Error] Line 536: Type '{ line: number; character: number; }' is missing the following properties from type 'Position': isBefore, isBeforeOrEqual, isAfter, isAfterOrEqual, and 4 more.\n- [ts Error] Line 540: Type '{ line: number; character: number; }' is missing the following properties from type 'Position': isBefore, isBeforeOrEqual, isAfter, isAfterOrEqual, and 4 more.",
  },
  toolName: "writeToFile",
  toolCallId: "KDSU39KsxnLOfpV7",
};

const writeToFileProps3: WriteToFileProp["tool"] = {
  args: {
    path: "src/index.html",
    content:
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Awesome Page</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <header>\n<img src="logo.png" alt="Earth View Logo">\n<h1>Welcome to Earth View</h1>\n        <p>Explore the beauty of our planet from a new perspective.</p>\n        <p id="username-placeholder">Welcome, [Username]</p>\n    </header>\n    <main>\n        <section id="about">\n            <h2>About Earth View</h2>\n            <p>Earth View is a collection of the most beautiful and striking landscapes found in Google Earth.</p>\n        </section>\n<section id="gallery">\n    <h2>Gallery</h2>\n    <p>Discover stunning images from around the globe.</p>\n    <div class="image-gallery">\n        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains">\n        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake">\n        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock">\n    </div>\n</section>\n    </main>\n    <footer>\n<p>&copy; 2025 Earth View. All rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n    </footer>\n    <script src="index.js"></script>\n</body>\n</html>',
  },
  step: 4,
  state: "result",
  result: {
    success: true,
    userEdits:
      '@@ -21,16 +21,16 @@\n <section id="gallery">\n     <h2>Gallery</h2>\n     <p>Discover stunning images from around the globe.</p>\n     <div class="image-gallery">\n-        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains">\n-        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake">\n-        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock">\n+        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains"\n+        <img src="https://images.unsplahh.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake"\n+        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock\n     </div>\n </section>\n     </main>\n     <footer>\n-<p>&copy; 2025 Earth View. All rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n+<p>&copy; 2025 Earth Viewll rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n     </footer>\n     <script src="index.js"></script>\n </body>\n </html>\n',
  },
  toolName: "writeToFile",
  toolCallId: "1PeZdF8RvO0U2yxH",
};

const writeToFileProps4: WriteToFileProp["tool"] = {
  args: {
    path: "src/index.html",
    content:
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Awesome Page</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <header>\n<img src="logo.png" alt="Earth View Logo">\n<h1>Welcome to Earth View</h1>\n        <p>Explore the beauty of our planet from a new perspective.</p>\n        <p id="username-placeholder">Welcome, [Username]</p>\n    </header>\n    <main>\n        <section id="about">\n            <h2>About Earth View</h2>\n            <p>Earth View is a collection of the most beautiful and striking landscapes found in Google Earth.</p>\n        </section>\n<section id="gallery">\n    <h2>Gallery</h2>\n    <p>Discover stunning images from around the globe.</p>\n    <div class="image-gallery">\n        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains">\n        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake">\n        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock">\n    </div>\n</section>\n    </main>\n    <footer>\n<p>&copy; 2025 Earth View. All rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n    </footer>\n    <script src="index.js"></script>\n</body>\n</html>',
  },
  step: 4,
  state: "result",
  result: {
    success: true,
    newProblems:
      "clients/vscode/src/inline-edit/quickPick.ts\n- [ts Error] Line 536: Type '{ line: number; character: number; }' is missing the following properties from type 'Position': isBefore, isBeforeOrEqual, isAfter, isAfterOrEqual, and 4 more.\n- [ts Error] Line 540: Type '{ line: number; character: number; }' is missing the following properties from type 'Position': isBefore, isBeforeOrEqual, isAfter, isAfterOrEqual, and 4 more.",
    userEdits:
      '@@ -21,16 +21,16 @@\n <section id="gallery">\n     <h2>Gallery</h2>\n     <p>Discover stunning images from around the globe.</p>\n     <div class="image-gallery">\n-        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains">\n-        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake">\n-        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock">\n+        <img src="https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Green hills and mountains"\n+        <img src="https://images.unsplahh.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Misty mountains and lake"\n+        <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Mountain landscape with a person standing on a rock\n     </div>\n </section>\n     </main>\n     <footer>\n-<p>&copy; 2025 Earth View. All rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n+<p>&copy; 2025 Earth Viewll rights reserved. <a href="https://github.com/ryannz">My Github</a></p>\n     </footer>\n     <script src="index.js"></script>\n </body>\n </html>\n',
  },
  toolName: "writeToFile",
  toolCallId: "1PeZdF8RvO0U2yxH2",
};

const askFollowupQuestionProps: AskFollowupQuestionProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_ask_followup_1",
  toolName: "askFollowupQuestion",
  args: {
    question: "Which color theme would you like for the new button?",
    followUp: ["Primary", "Secondary", "Destructive"],
  },
  result: {
    success: true,
  },
};
const askFollowupQuestionProps2: AskFollowupQuestionProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_ask_followup_2",
  toolName: "askFollowupQuestion",
  args: {
    question:
      "How would you like to incorporate the MIT license into your README.md?",
    followUp: [
      "Replace existing license information with a standard MIT license.",
      "Add a standard MIT license as an additional license.",
      "I have a specific MIT license text to use.",
      "I want to apply the MIT license to a specific part of the project.",
    ],
  },
  result: {
    success: true,
  },
};

const attemptCompletionProps: AttemptCompletionProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_attempt_completion_1",
  toolName: "attemptCompletion",
  args: {
    result:
      "The new Button component has been created and styled with the primary theme.",
    command: "git status",
  },
  result: {
    success: true,
  },
};

const webFetchProps: WebFetchProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_web_fetch_1",
  toolName: "webFetch",
  args: {
    url: "https://example.com",
  },
  result: {
    result:
      "This is the content fetched from example.com. The page contains information about domain examples and placeholder websites. It includes a header, some paragraphs explaining the purpose of example domains, and links to more information about domain names.",
  },
};

const webFetchProps2: WebFetchProp["tool"] = {
  state: "result",
  step: 0,
  toolCallId: "tool_web_fetch_2",
  toolName: "webFetch",
  args: {
    url: "https://www.google.com/search?as_q=you+have+to+write+a+really+really+long+search+to+get+to+2000+characters.+like+seriously%2C+you+have+no+idea+how+long+it+has+to+be&as_epq=2000+characters+is+absolutely+freaking+enormous.+You+can+fit+sooooooooooooooooooooooooooooooooo+much+data+into+2000+characters.+My+hands+are+getting+tired+typing+this+many+characters.+I+didn%27t+even+realise+how+long+it+was+going+to+take+to+type+them+all.&as_oq=Argh!+So+many+characters.+I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.+I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.I%27m+bored+now%2C+so+I%27ll+just+copy+and+paste.&as_eq=It+has+to+be+freaking+enormously+freaking+enormous&as_nlo=123&as_nhi=456&lr=lang_hu&cr=countryAD&as_qdr=m&as_sitesearch=stackoverflow.com&as_occt=title&safe=active&tbs=rl%3A1%2Crls%3A0&as_filetype=xls&as_rights=(cc_publicdomain%7Ccc_attribute%7Ccc_sharealike%7Ccc_nonderived).-(cc_noncommercial)&gws_rd=ssl",
  },
  result: {
    result:
      "This is the content fetched from example.com. The page contains information about domain examples and placeholder websites. It includes a header, some paragraphs explaining the purpose of example domains, and links to more information about domain names.",
  },
};

export const Tools: Story = {
  args: {
    tools: [
      searchProps,
      searchProps2,
      readProps,
      executeCommandProps,
      listFilesProps,
      globFilesProps,
      writeToFileProps,
      writeToFileProps2,
      writeToFileProps3,
      writeToFileProps4,
      askFollowupQuestionProps,
      askFollowupQuestionProps2,
      attemptCompletionProps,
      webFetchProps,
      webFetchProps2,
    ],
  },
  parameters: {
    backgrounds: { disable: true },
  },
};
