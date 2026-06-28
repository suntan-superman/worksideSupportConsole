import config from "../release-test.config.js";

const { runReleaseVerification } = await loadTestingPackage();

runReleaseVerification(config).catch((error) => {
  console.error(error);
  process.exit(1);
});

async function loadTestingPackage() {
  try {
    return await import("@workside/testing");
  } catch {
    return import("../../packages/workside-testing/index.js");
  }
}
