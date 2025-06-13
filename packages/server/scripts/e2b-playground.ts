import { Sandbox } from "@e2b/code-interpreter";

const sandbox = await Sandbox.connect(process.env.SANDBOX_ID || "");
console.log(await sandbox.getInfo());

console.log(await sandbox.commands.list());

await sandbox.commands.run("echo 'Hello, World!' 2>&1 | tee output.txt", {
  background: false,
});

console.log(await sandbox.files.read("output.txt", { format: "text" }));
