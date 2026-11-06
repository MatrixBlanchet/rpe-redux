/** Runs independent desktop build prerequisites and waits for all of them. */
import { spawn } from "node:child_process";

/** Run one prerequisite script and settle when it exits. */
function runScript(script, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} failed (${signal ?? code ?? "unknown"})`));
      }
    });
  });
}

/** Reject after every child has stopped if any prerequisite fails. */
export async function runBuildPrerequisites(scripts, cwd) {
  const results = await Promise.allSettled(scripts.map((script) => runScript(script, cwd)));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    throw failure.reason;
  }
}
