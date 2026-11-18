// Start the meter simulator (and recording) as soon as the server boots.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getSim } = await import("./lib/sim");
    getSim();
  }
}
