// cPanel "Setup Node.js App" startup file. Passenger loads apps with require(); the server is an
// ES module, so load it with a dynamic import.
import("./dist/server.js").catch(err => { console.error(err); process.exit(1); });
