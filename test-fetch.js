const { Response } = require('node-fetch') || global; // Next.js edge runtime has global Response

async function test() {
  const res = new Response("", { status: 500, statusText: "Internal Server Error" });
  try {
    await res.json();
  } catch (e) {
    console.log("Error from res.json():", e.message);
  }
}
test();
